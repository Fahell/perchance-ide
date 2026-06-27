/**
 * Agent loop — handles tool call detection and execution
 *
 * Flow:
 *   1. Send user message to LLM with tool instructions
 *   2. LLM responds (possibly with <tool_call> XML)
 *   3. Detect tool_call → execute tool → feed result back
 *   4. Repeat until LLM gives a final answer (no tool_call)
 */

import type { Oc } from "./types.js";
import { getTool, getToolDescriptions, hasTool } from "./tools/index.js";

// ─── Constants ──────────────────────────────────────────────
const MAX_ITERATIONS = 5;
const TOOL_CALL_REGEX = /<tool_call\s+name="(\w+)">\s*(\{.*?\})\s*<\/tool_call>/gs;

// ─── System Prompt for Tools ────────────────────────────────
function buildToolPrompt(): string {
  return `You have access to the following tools:

${getToolDescriptions()}

When you need to use a tool, output a tool_call block EXACTLY like this:

<tool_call name="tool_name">{"param":"value"}</tool_call>

Rules:
- You can output ONE tool_call per response.
- The tool_call must be on its own line.
- After the tool_call, you can add a brief explanation of what you're searching for.
- When you receive tool results, use them to answer the user's question.
- Do NOT output tool_call blocks when responding to tool results — give your final answer.
- For general knowledge questions, respond directly without using tools.`;
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
  oc: Oc,
  userMessage: string,
  onStatus?: (status: string) => void
): Promise<string> {
  const toolPrompt = buildToolPrompt();

  // Build the instruction for the LLM
  let instruction = `${toolPrompt}\n\nUser message: ${userMessage}`;

  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    onStatus?.(`Thinking... (step ${iteration})`);

    // Call the LLM
    const response = await oc.generateText({
      instruction: instruction,
    });

    const responseText = response.toString();

    // Check for tool calls
    const toolCalls = extractToolCalls(responseText);

    if (toolCalls.length === 0) {
      // No tool calls — this is the final answer
      return cleanResponse(responseText);
    }

    // Execute each tool call (usually just one)
    for (const call of toolCalls) {
      const tool = getTool(call.name);
      if (!tool) continue;

      onStatus?.(`Using ${call.name}...`);

      try {
        const result = await tool.execute(call.args);

        // Feed result back as context for next iteration
        // We append the tool result to the instruction
        const toolResult = `\n\n[Tool Result - ${call.name}]:\n${result}\n\nNow respond to the user based on this information. Do NOT use any more tools — give your final answer.`;

        // For next iteration, include the tool result
        instruction += toolResult;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[Agent] Tool ${call.name} failed:`, errorMsg);
        instruction += `\n\n[Tool Error - ${call.name}]: ${errorMsg}\n\nThe tool failed. Respond to the user explaining the issue.`;
      }
    }
  }

  return "I apologize, but I wasn't able to complete that task after multiple attempts.";
}
