/**
 * Agent loop — orchestrates tool call detection and execution.
 *
 * Flow:
 *   1. Send user message to LLM with tool instructions
 *   2. LLM responds (possibly with tool_call XML)
 *   3. Detect tool_call → execute tool → feed result back
 *   4. Repeat until LLM gives a final answer (no tool_call)
 *
 * Extracted modules live in src/agent/:
 *   - timeout-helpers: AbortSignal utilities, withTimeout, aiCallWithSignal
 *   - prompt-builder: Dynamic system prompt based on enabled tools
 *   - tool-call-parser: XML extraction, cleaning, closing-tag repair
 *   - repetition-detector: Loop prevention via fingerprint tracking
 */

import { getPyodideStatus } from "./terminal/pyodide.js";
import { checkToolRateLimit, getTool, validateToolArgs } from "./tools/index.js";
import { truncateOutput } from "./utils/truncate.js";
import { vfsGetAll, vfsTree, PROJECT_ROOT } from "./vfs.js";

// ─── Extracted Modules ──────────────────────────────────────
import { buildToolPrompt, buildVfsTreeString } from "./agent/prompt-builder.js";
import { RepetitionDetector } from "./agent/repetition-detector.js";
import {
  LLM_TIMEOUT_MS,
  aiCallWithSignal,
  combineSignals,
  withTimeout,
} from "./agent/timeout-helpers.js";
import {
  cleanResponse,
  extractToolCalls,
  fixToolCallClosing,
} from "./agent/tool-call-parser.js";

// ─── Tag Constants (fill in manually) ───────────────────────
const tcOpen = "<tool_call>";
const tcClose = "</tool_call>";

// ─── Local Constants ────────────────────────────────────────
const MAX_TOOL_OUTPUT = 20_000; // Safety net for tool result truncation

// ─── Manual Continue ────────────────────────────────────────
/**
 * Continue a truncated assistant response using startWith.
 * The LLM picks up from where it left off in the same message.
 * result.generatedText contains ONLY the new text (excludes startWith).
 */
export async function continueResponse(
  truncatedText: string
): Promise<string> {
  const result = await aiCallWithSignal({
    instruction:
      "Continue from where you left off in your previous response. " +
      "Do NOT repeat what was already written — just continue naturally. " +
      "Keep it concise. If continuing a <tool_call>, complete it properly.",
    startWith: truncatedText,
    stopSequences: [tcClose],
  });
  return (result.generatedText || result.text || "").trim();
}

// ─── Conversation History Types ─────────────────────────────
export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentContext {
  summary?: string | null;
  recentMessages: HistoryMessage[];
  memories?: string;
}

// ─── Agent Loop ─────────────────────────────────────────────
export async function agentLoop(
  userMessage: string,
  context: AgentContext,
  onStatus?: (status: string) => void,
  onToolResult?: (toolName: string, args: Record<string, any>, result: string) => void,
  onToolStart?: (toolName: string, args: Record<string, any>) => void,
  onToolError?: (toolName: string, args: Record<string, any>, error: string) => void,
  signal?: AbortSignal
): Promise<string> {
  // Gather dynamic state for the system prompt
  const pyodideStatus = getPyodideStatus();
  const allEntries = vfsGetAll();
  const vfsFileCount = allEntries.filter((e) => e.type === "file").length;
  const vfsDirCount = allEntries.filter((e) => e.type === "dir").length;
  const treeNodes = vfsTree(PROJECT_ROOT);
  const treeStr = buildVfsTreeString(treeNodes);
  const toolPrompt = buildToolPrompt(vfsFileCount, pyodideStatus.loaded, treeStr, vfsDirCount);

  // Build the instruction for the LLM with structured context
  const instructionParts: string[] = [];

  instructionParts.push(toolPrompt);

  // Add summary if available
  if (context.summary) {
    instructionParts.push(`[Earlier conversation summary]:\n${context.summary}`);
  }

  // Add recent messages
  if (context.recentMessages.length > 0) {
    let recentBlock = "[Recent messages]:\n";
    for (const msg of context.recentMessages) {
      const role = msg.role === "user" ? "User" : "Assistant";
      recentBlock += `${role}: ${msg.content}\n`;
    }
    instructionParts.push(recentBlock);
  }

  // Add memories if available
  if (context.memories) {
    instructionParts.push(`[Key facts from conversation]:\n${context.memories}`);
  }

  instructionParts.push(`User message: ${userMessage}`);

  // Initialize repetition detector
  const detector = new RepetitionDetector();

  // Continuation state for truncated responses
  let continuationText: string | null = null;
  let continuationCount = 0;

  let iteration = 0;

  while (true) {
    iteration++;
    onStatus?.(`Thinking... (step ${iteration})`);

    // Check for cancellation
    if (signal?.aborted) {
      return "The operation was cancelled.";
    }

    // Call the LLM via ai-text-plugin with timeout + cancellation
    const llmSignal = signal
      ? combineSignals(signal, AbortSignal.timeout(LLM_TIMEOUT_MS))
      : AbortSignal.timeout(LLM_TIMEOUT_MS);
    let result: any;
    try {
      result = await aiCallWithSignal(
        {
          instruction: instructionParts.join("\n\n"),
          stopSequences: [tcClose],
          ...(continuationText ? { startWith: continuationText } : {}),
        },
        llmSignal
      );
    } catch (err: any) {
      if (err instanceof DOMException && err.name === "AbortError") {
        const reason = signal?.aborted
          ? "The operation was cancelled by the user."
          : `The operation timed out after ${LLM_TIMEOUT_MS / 1000} seconds.`;
        onStatus?.(reason);
        return reason;
      }
      throw err;
    }

    const fullText = result.text || result.generatedText || result.toString();

    // Fix tool_call closing syntax before extraction
    const fullTextFixed = fixToolCallClosing(fullText);
    if (fullTextFixed !== fullText) {
      console.warn("[Agent] Fixed tool_call closing syntax");
    }

    // Check for tool calls in the full accumulated text
    const toolCalls = extractToolCalls(fullTextFixed);

    // Detect dangling tool calls (truncated mid-XML)
    const hasDanglingToolCall = tcOpen
      ? countOccurrences(fullText, tcOpen) > countOccurrences(fullText, tcClose)
      : false;

    // Save the FULL accumulated text for continuation
    if (hasDanglingToolCall) {
      continuationText = fullText;
      continuationCount++;
    } else {
      continuationText = null;
      continuationCount = 0;
    }

    if (toolCalls.length === 0 && !hasDanglingToolCall) {
      // No tool calls, not dangling — this is the final answer
      const finalAnswer = cleanResponse(fullText);
      if (finalAnswer.length > 0) return finalAnswer;

      // Empty response — retry with explicit instruction (once)
      if (!signal?.aborted) {
        onStatus?.("Retrying — empty response...");
        instructionParts.push(
          "Your previous response was empty. Write a clear, concise answer using the information above. If the task requires an action, emit a <tool_call>."
        );
        continue;
      }
    }

    // Execute all tool calls in parallel
    const outcomes = await Promise.all(
      toolCalls.map(async (call) => {
        try {
          const tool = getTool(call.name);
          if (!tool)
            return {
              call,
              status: "fulfilled" as const,
              result: undefined as string | undefined,
              error: undefined as string | undefined,
            };

          onStatus?.(`Using ${call.name}...`);
          onToolStart?.(call.name, call.args);

          // Rate limit check
          const rateCheck = checkToolRateLimit(call.name);
          if (!rateCheck.allowed) {
            const waitSec = Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000);
            const rateMsg = `Rate limit exceeded for ${call.name}. Please wait ${waitSec}s before calling this tool again.`;
            onToolError?.(call.name, call.args, rateMsg);
            return {
              call,
              status: "rejected" as const,
              result: undefined as string | undefined,
              error: rateMsg,
            };
          }

          const validationError = validateToolArgs(tool, call.args);
          if (validationError) {
            onToolError?.(call.name, call.args, validationError);
            return {
              call,
              status: "rejected" as const,
              result: undefined as string | undefined,
              error: validationError,
            };
          }

          const timeoutMs = tool.timeoutMs ?? 30_000;
          let execResult = await withTimeout(
            tool.execute(call.args),
            timeoutMs,
            call.name,
            signal
          );

          // Safety net truncation
          if (execResult.length > MAX_TOOL_OUTPUT) {
            execResult = truncateOutput(execResult, MAX_TOOL_OUTPUT);
          }

          onToolResult?.(call.name, call.args, execResult);
          return { call, status: "fulfilled" as const, result: execResult, error: undefined };
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error(`[Agent] Tool ${call.name} failed:`, errorMsg);
          onToolError?.(call.name, call.args, errorMsg);
          return {
            call,
            status: "rejected" as const,
            result: undefined,
            error: errorMsg,
          };
        }
      })
    );

    // Process in ORIGINAL order for instructionParts + repetition detection
    for (const outcome of outcomes) {
      const { call } = outcome;

      if (outcome.status === "fulfilled" && outcome.result !== undefined) {
        // Dynamic next-step guidance
        let nextStep = "";
        if (call.name === "web_search") {
          nextStep =
            "Analyze these search results. Pick the 1-2 most relevant URLs and use scrape_url to read their full content. If the results don't look relevant, try a different search query instead.";
        } else if (call.name === "scrape_url") {
          nextStep =
            "Use the page content above to answer the user's question. If the scraped content doesn't contain the answer, try scraping a different URL from the earlier search results, or run a new web_search with a different query.";
        } else if (["write_file", "delete_file", "rename_file", "run_shell_command", "run_git_command"].includes(call.name)) {
          nextStep = "The file/dir operation completed. Verify the environment (list_files or ls) before any further create/move/delete — do NOT recreate what already exists.";
        } else {
          nextStep = "Now respond to the user based on this information.";
        }
        instructionParts.push(
          `[Tool Result - ${call.name}]:\n${outcome.result}\n\n${nextStep}`
        );

        // Repetition detection
        const repStatus = detector.check(call.name, call.args);
        if (repStatus === "warn") {
          instructionParts.push(
            `[System]: You have called ${call.name} with the same arguments multiple times in a row. This appears to be repetitive. Try a different approach or synthesize the answer from information you already have.`
          );
        } else if (repStatus === "interrupt") {
          return `The agent was interrupted because it appeared to be stuck in a loop (repeated identical tool calls). The target likely already exists — use list_files or ls to check the current environment before retrying. Please rephrase your request to inspect first.`;
        }
      } else {
        // Tool failed or returned no result
        if (outcome.error) {
          instructionParts.push(
            `[Tool Error - ${call.name}]: ${outcome.error}\n\nThe tool failed. Respond to the user explaining the issue.`
          );
        }
      }
    }

    // Add continuation marker when dangling detected
    if (hasDanglingToolCall) {
      onStatus?.("Response was truncated — continuing...");
      instructionParts.push(
        "[CONTINUE]: Your previous response was cut off. " +
        "The incomplete tool_call was NOT executed. Results from complete tool calls are above. " +
        "Continue your response from where you left off, and explicitly close the call with " +
        tcClose +
        " to exit the tool after finishing the content."
      );
    }
  }

  return "I apologize, but I wasn't able to complete that task.";
}

/**
 * Count non-overlapping occurrences of a substring.
 */
function countOccurrences(text: string, substr: string): number {
  if (!substr) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(substr, pos)) !== -1) {
    count++;
    pos += substr.length;
  }
  return count;
}
