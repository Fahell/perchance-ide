/**
 * Agent loop — handles tool call detection and execution
 *
 * Flow:
 *   1. Send user message to LLM with tool instructions
 *   2. LLM responds (possibly with <tool_call> XML)
 *   3. Detect tool_call → execute tool → feed result back
 *   4. Repeat until LLM gives a final answer (no tool_call)
 */

import { getTool, getToolDescriptions, hasTool } from "./tools/index.js";
import { getAi } from "./types.js";

// ─── Constants ──────────────────────────────────────────────
const MAX_ITERATIONS = 8;
const TOOL_CALL_REGEX = /<tool_call\s+name="(\w+)">\s*(\{.*?\})\s*<\/tool_call>/gs;

// ─── System Prompt for Tools ────────────────────────────────
function buildToolPrompt(): string {
  return `You are a research agent. Your job is to find accurate, up-to-date information using your tools.

IMPORTANT CONTEXT:
- Your training data has a cutoff of early 2025. The current date is 2026.
- If asked about events in 2025-2026, you MUST use web_search — do not say "it hasn't happened yet" or refuse.

Available tools:
${getToolDescriptions()}

RESEARCH WORKFLOW:
1. SEARCH: Use web_search to find relevant results with URLs and summaries.
2. FETCH: Use scrape_url on the most relevant URLs to read their full content.
3. If the results are poor, the scrape failed, or you didn't find what you need — try a DIFFERENT search query or scrape different URLs. You have up to 8 iterations — use them.
4. SYNTHESIZE: Give your final answer based on the real page content you fetched.

RULES:
- Use web_search for any real-time data (prices, scores, news, weather, dates, events) or topics outside your 2025 training data.
- You may use web_search MULTIPLE times with different queries if the first search doesn't find what you need.
- You may scrape up to 3-4 URLs total across iterations.
- Always prefer scraping actual page content over answering from search snippets alone.
- If all attempts fail, honestly tell the user what you found and what didn't work.

CONTEXT TOOLS:
- search_history: Search your conversation history by keyword. USE this when the user references something from earlier that is NOT in the recent messages above (e.g., "what did we discuss about...", "remember when...", "earlier you mentioned...").
- get_messages: Get raw messages by position or count. USE this when you need exact quotes or specific messages from the history.
IMPORTANT: Your prompt only includes the LAST 5 MESSAGES. For anything older, you MUST use search_history or get_messages — do NOT say "I don't remember" without searching first.
Example: If user says "what was that website you mentioned earlier?", call search_history with {"query":"website"} to find it.

FILE ACCESS RULES:
- You have FULL access to the project files via read_file, write_file, list_files, search_files, delete_file, and rename_file.
- When asked to create, modify, or review code, use read_file first to examine existing files, then write_file to make changes.
- After writing files, briefly summarize what was created or changed.
- Paths are absolute from root (/): e.g., /src/index.ts, /README.md.
- You can use search_files to find where a function, variable, or concept is used.
- Use list_files to explore the project structure before making changes.
- Use delete_file to remove files (only when explicitly asked).

PYTHON EXECUTION RULES:
- You can execute Python code using run_python or execute_script.
- Use run_python for quick snippets, calculations, or one-off Python tasks.
- Use execute_script to run a .py file from the VFS (it must exist first).
- The VFS is automatically synced to Pyodide's filesystem before execution and synced back after — Python can read/write any project file.
- Use install_package to install Python packages (e.g., numpy, pandas, requests) before using them in code.
- Python runs in the browser via WebAssembly — no external server needed.
- Both stdout and stderr are captured and returned with the exit code.

To use a tool, output EXACTLY this format on its own line:
<tool_call name="tool_name">{"param":"value"}</tool_call>

You may output ONE tool_call per response, followed by a brief note.`;
}

// ─── Conversation History ────────────────────────────────────
export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentContext {
  summary?: string | null;
  recentMessages: HistoryMessage[];
  memories?: string;
}

// ─── Parse Tool Calls ───────────────────────────────────────
interface ToolCall {
  name: string;
  args: Record<string, any>;
}

function extractToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  TOOL_CALL_REGEX.lastIndex = 0;

  while ((match = TOOL_CALL_REGEX.exec(text)) !== null) {
    const [, name, argsStr] = match;
    try {
      const args = JSON.parse(argsStr);
      if (hasTool(name)) {
        calls.push({ name, args });
      }
    } catch {
      console.warn(`[Agent] Failed to parse tool_call args: ${argsStr}`);
    }
  }

  return calls;
}

// ─── Clean Response (remove tool_call tags) ─────────────────
function cleanResponse(text: string): string {
  return text.replace(TOOL_CALL_REGEX, "").trim();
}

// ─── Agent Loop ─────────────────────────────────────────────
export async function agentLoop(
  userMessage: string,
  context: AgentContext,
  onStatus?: (status: string) => void,
  onToolResult?: (toolName: string, args: Record<string, any>, result: string) => void,
  onToolStart?: (toolName: string, args: Record<string, any>) => void,
  onToolError?: (toolName: string, args: Record<string, any>, error: string) => void
): Promise<string> {
  const toolPrompt = buildToolPrompt();

  // Build the instruction for the LLM with structured context
  let instruction = toolPrompt + "\n\n";

  // Add summary if available
  if (context.summary) {
    instruction += `[Earlier conversation summary]:\n${context.summary}\n\n`;
  }

  // Add recent messages
  if (context.recentMessages.length > 0) {
    instruction += "[Recent messages]:\n";
    for (const msg of context.recentMessages) {
      const role = msg.role === "user" ? "User" : "Assistant";
      instruction += `${role}: ${msg.content}\n`;
    }
    instruction += "\n";
  }

  // Add memories if available
  if (context.memories) {
    instruction += `[Key facts from conversation]:\n${context.memories}\n\n`;
  }

  instruction += `User message: ${userMessage}`;

  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    onStatus?.(`Thinking... (step ${iteration})`);

    // Call the LLM via ai-text-plugin
    const result = await getAi()({
      instruction: instruction,
      stopSequences: ["</tool_call>"],
    });

    const responseText = result.generatedText || result.text || result.toString();

    // Check for tool calls
    const toolCalls = extractToolCalls(responseText);

    if (toolCalls.length === 0) {
      // No tool calls — this is the final answer
      const finalAnswer = cleanResponse(responseText);
      if (finalAnswer.length > 0) return finalAnswer;

      // Empty response — retry with explicit instruction (once)
      if (iteration < MAX_ITERATIONS) {
        onStatus?.("Retrying — empty response...");
        instruction += "\n\nYour previous response was empty. Write a clear, concise answer to the user's question using the information above. Do NOT output tool_call XML — just write your answer directly.";
        continue;
      }
    }

    // Execute each tool call (usually just one)
    for (const call of toolCalls) {
      const tool = getTool(call.name);
      if (!tool) continue;

      onStatus?.(`Using ${call.name}...`);
      onToolStart?.(call.name, call.args);

      try {
        const result = await tool.execute(call.args);

        // Notify about tool result
        onToolResult?.(call.name, call.args, result);

        // Feed result back as context for next iteration with dynamic guidance
        let nextStep = "";
        if (call.name === "web_search") {
          nextStep = "Analyze these search results. Pick the 1-2 most relevant URLs and use scrape_url to read their full content. If the results don't look relevant, try a different search query instead.";
        } else if (call.name === "scrape_url") {
          nextStep = "Use the page content above to answer the user's question. If the scraped content doesn't contain the answer, try scraping a different URL from the earlier search results, or run a new web_search with a different query.";
        } else {
          nextStep = "Now respond to the user based on this information.";
        }
        const toolResult = `\n\n[Tool Result - ${call.name}]:\n${result}\n\n${nextStep}`;

        // For next iteration, include the tool result
        instruction += toolResult;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Agent] Tool ${call.name} failed:`, errorMsg);
        onToolError?.(call.name, call.args, errorMsg);
        instruction += `\n\n[Tool Error - ${call.name}]: ${errorMsg}\n\nThe tool failed. Respond to the user explaining the issue.`;
      }
    }
  }

  return "I apologize, but I wasn't able to complete that task after multiple attempts.";
}
