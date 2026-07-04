/**
 * Agent loop — handles tool call detection and execution
 *
 * Flow:
 *   1. Send user message to LLM with tool instructions
 *   2. LLM responds (possibly with <tool_call> XML)
 *   3. Detect tool_call → execute tool → feed result back
 *   4. Repeat until LLM gives a final answer (no tool_call)
 */

import { ideStore } from "./store.js";
import { getPyodideStatus } from "./terminal/pyodide.js";
import { checkToolRateLimit, getTool, getToolDescriptions, hasTool, validateToolArgs } from "./tools/index.js";
import { getAi } from "./types.js";
import { truncateOutput } from "./utils/truncate.js";
import { vfsGetAll } from "./vfs.js";

// ─── Constants ──────────────────────────────────────────────
const LLM_TIMEOUT_MS = 300_000; // 5 min — Perchance AI can be slow
const MAX_TOOL_OUTPUT = 20_000; // Safety net for tool result truncation
const TOOL_CALL_REGEX = /<tool_call\s+name="(\w+)">\s*(\{.*?\})\s*<\/tool_call>/gs;

// ─── Timeout Helpers ────────────────────────────────────────

/**
 * Wrap a promise with a timeout via AbortSignal.
 * If an existingSignal is provided, combines both — whichever fires first aborts.
 * On timeout, rejects with DOMException 'AbortError'.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  existingSignal?: AbortSignal
): Promise<T> {
  const timeoutSignal = AbortSignal.timeout(ms);
  const signal = existingSignal
    ? combineSignals(existingSignal, timeoutSignal)
    : timeoutSignal;

  if (signal.aborted) {
    return Promise.reject(new DOMException(signal.reason?.message ?? `Timed out after ${ms}ms`, 'AbortError'));
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException(
        signal.reason?.message ?? `Operation "${label}" timed out after ${ms}ms`,
        'AbortError'
      ));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      }
    );
  });
}

/**
 * Combine multiple AbortSignals into one.
 * The combined signal aborts when ANY constituent signal aborts.
 * Falls back to manual combining if AbortSignal.any() is unavailable.
 */
function combineSignals(...signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(signals);
  }
  // Manual fallback for older browsers
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      controller.abort(s.reason);
      break;
    }
    s.addEventListener('abort', () => controller.abort(s.reason), { once: true });
  }
  return controller.signal;
}

/**
 * Wrapper around getAi() that supports AbortSignal cancellation.
 * The Perchance ai-text-plugin doesn't support AbortSignal natively,
 * so we listen to the signal and call result.stop() on abort.
 * Returns the AiCallResult (which is thenable — can be awaited).
 */
export function aiCallWithSignal(
  options: {
    instruction: string;
    startWith?: string;
    stopSequences?: string[];
  },
  signal?: AbortSignal
): Promise<any> {
  const aiResult = getAi()(options);

  if (!signal) {
    return Promise.resolve(aiResult);
  }

  if (signal.aborted) {
    aiResult.stop();
    return Promise.reject(
      new DOMException(signal.reason?.message ?? 'Aborted', 'AbortError')
    );
  }

  return new Promise<any>((resolve, reject) => {
    let settled = false;

    const onAbort = () => {
      if (settled) return;
      settled = true;
      aiResult.stop();
      reject(
        new DOMException(signal!.reason?.message ?? 'Aborted', 'AbortError')
      );
    };

    signal.addEventListener('abort', onAbort, { once: true });

    // The thenable resolves/rejects when generation finishes
    Promise.resolve(aiResult).then(
      (val: any) => {
        if (settled) return;
        settled = true;
        signal!.removeEventListener('abort', onAbort);
        resolve(val);
      },
      (err: any) => {
        if (settled) return;
        settled = true;
        signal!.removeEventListener('abort', onAbort);
        reject(err);
      }
    );
  });
}

// ─── System Prompt for Tools ────────────────────────────────
function buildToolPrompt(vfsFileCount?: number, pyodideLoaded?: boolean): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const cutoffYear = 2025;
  const currentYear = now.getFullYear();

  // Read enabled tool categories from user settings
  const settings = ideStore.getState().settings;
  const enabledCats = new Set<string>();
  if (settings.toolWebEnabled) enabledCats.add("web");
  if (settings.toolContextEnabled) enabledCats.add("context");
  if (settings.toolVfsEnabled) enabledCats.add("vfs");
  if (settings.toolTerminalEnabled) enabledCats.add("terminal");

  return `You are a research agent. Use your tools to find accurate, up-to-date information.

KNOWLEDGE CUTOFF: Early ${cutoffYear}. Today: ${dateStr} (${timezone}). For events after ${cutoffYear}, use web_search — do not refuse.

PROJECT STATE:
- Files: ${vfsFileCount ?? '?'}
- Python: ${pyodideLoaded ? '● Loaded' : '○ Loads on first use'}

OUTPUT LIMIT: ~1000 tokens (~3000 chars). Responses that exceed this are silently cut off.
- Keep responses short; use bullet points
- Create files ONE AT A TIME (write_file per file)
- For large operations, split across multiple <tool_call> responses

TOOLS:
${getToolDescriptions(enabledCats)}

WORKFLOW:
1. **Search** → web_search for URLs with summaries.
2. **Fetch** → scrape_url on the most relevant URLs.
3. **Refine** → poor results? Try different queries/URLs. Continue iterating until you provide a final answer.
4. **Answer** → synthesize from actual page content.

CONTEXT (your prompt only includes the last 5 messages):
- search_history: Find past mentions by keyword.
- get_messages: Retrieve exact messages by position.
Use these when the user references earlier conversation — do not guess.

FILE OPERATIONS (paths are absolute, e.g. /src/index.ts):
- read: read_file, search_files, list_files
- write: write_file (read target first, summarize changes after)
- delete: delete_file (only when asked)
- rename: rename_file

PYTHON (in-browser via Pyodide, VFS auto-synced):
- run_python: Quick snippets.
- execute_script: Run a .py file from VFS.
- install_package: Install packages (numpy, pandas, etc.).
- stdout, stderr, and exit code captured.

TOOL CALL FORMAT — one per line:
<tool_call name="tool_name">{"param":"value"}</tool_call>

Multiple <tool_call> blocks in one response run in parallel. If a tool depends on another's result, output them one per response — call, wait, then call next.`;
}

// ─── Manual Continue (Fase D) ────────────────────────────────
/**
 * Continue a truncated assistant response using startWith.
 * The LLM picks up from where it left off in the same message.
 * result.generatedText contains ONLY the new text (excludes startWith).
 *
 * This mirrors the continue-generator pattern:
 *   startWith = existingText
 *   result.generatedText = only the continuation
 */
export async function continueResponse(
  truncatedText: string
): Promise<string> {
  const result = await getAi()({
    instruction:
      "Continue from where you left off in your previous response. " +
      "Do NOT repeat what was already written — just continue naturally. " +
      "Keep it concise. Do not use tool calls unless absolutely necessary.",
    startWith: truncatedText,
    stopSequences: ["</tool_call>"],
  });
  return (result.generatedText || result.text || "").trim();
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
      console.warn(`[Agent] Failed to parse tool_call args for '${name}': ${argsStr.slice(0, 200)}`);
    }
  }

  return calls;
}

// ─── Clean Response (remove tool_call tags) ─────────────────
function cleanResponse(text: string): string {
  return text.replace(TOOL_CALL_REGEX, "").trim();
}

// ─── Fix Tool Call Closing Syntax (Fase E) ──────────────────
/**
 * Fix an incomplete tool_call at the end of the response text.
 * Only activates when `</tool_call>` is present (LLM explicitly tried to close).
 *
 * The LLM occasionally truncates the tool_call closing syntax:
 * - Missing `</tool_call>` tag
 * - Missing closing `}` in the JSON object
 *
 * This function ONLY balances XML tags and JSON braces — it NEVER
 * inspects or modifies the generated content inside the tool call.
 */
function fixToolCallClosing(text: string): string {
  // Only fix when the LLM explicitly tried to close
  if (!text.includes('</tool_call>')) return text;

  const openTags = (text.match(/<tool_call\s+name=/g) || []).length;
  const closeTags = (text.match(/<\/tool_call>/g) || []).length;

  // All tool calls are properly matched — no fix needed
  if (openTags <= closeTags) return text;

  // Find the last <tool_call position
  const lastOpenIdx = text.lastIndexOf('<tool_call');
  if (lastOpenIdx === -1) return text;

  // Check if the last tool_call already has a matching </tool_call> after it
  const afterLastOpen = text.slice(lastOpenIdx + '<tool_call'.length);
  if (afterLastOpen.includes('</tool_call>')) {
    // The last tool call is closed, but some earlier one isn't.
    // This is unusual — just add </tool_call> at the end as best-effort.
    return text + '</tool_call>';
  }

  // The last tool call is dangling — count braces to close JSON too
  const openBraces = (afterLastOpen.match(/\{/g) || []).length;
  const closeBraces = (afterLastOpen.match(/\}/g) || []).length;

  let fixed = text;
  if (openBraces > closeBraces) {
    fixed += '}'.repeat(openBraces - closeBraces);
  }
  fixed += '</tool_call>';

  return fixed;
}

// ─── Repetition Detector ────────────────────────────────────
interface ToolCallFingerprint {
  toolName: string;
  argsHash: string;
}

class RepetitionDetector {
  private recent: ToolCallFingerprint[] = [];
  private consecutiveIdentical = 0;

  private hash(args: Record<string, any>): string {
    return JSON.stringify(args, Object.keys(args).sort());
  }

  /**
   * Check if the current tool call is repetitive.
   * Returns 'ok' if no repetition, 'warn' if 3+ consecutive identical, 'interrupt' if 5+.
   */
  check(toolName: string, args: Record<string, any>): 'ok' | 'warn' | 'interrupt' {
    const fp: ToolCallFingerprint = { toolName, argsHash: this.hash(args) };

    const last = this.recent[this.recent.length - 1];
    if (last && last.toolName === fp.toolName && last.argsHash === fp.argsHash) {
      this.consecutiveIdentical++;
    } else {
      this.consecutiveIdentical = 1;
    }

    this.recent.push(fp);

    if (this.consecutiveIdentical >= 5) return 'interrupt';
    if (this.consecutiveIdentical >= 3) return 'warn';
    return 'ok';
  }
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
  const vfsFileCount = vfsGetAll().filter(e => e.type === 'file').length;
  const toolPrompt = buildToolPrompt(vfsFileCount, pyodideStatus.loaded);

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

  // Continuation state for truncated responses (Fase B + C)
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
    // Pass startWith for auto-continue if previous response was truncated (Fase C)
    const llmSignal = signal
      ? combineSignals(signal, AbortSignal.timeout(LLM_TIMEOUT_MS))
      : AbortSignal.timeout(LLM_TIMEOUT_MS);
    let result: any;
    try {
      result = await aiCallWithSignal(
        {
          instruction: instructionParts.join("\n\n"),
          stopSequences: ["</tool_call>"],
          ...(continuationText ? { startWith: continuationText } : {}),
        },
        llmSignal
      );
    } catch (err: any) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        const reason = signal?.aborted
          ? "The operation was cancelled by the user."
          : `The operation timed out after ${LLM_TIMEOUT_MS / 1000} seconds.`;
        onStatus?.(reason);
        return reason;
      }
      throw err;
    }

    // result.text includes everything (startWith + generatedText).
    // When there's no continuationText (normal mode), generatedText === text.
    // When continuing, text includes the partial tool call from startWith,
    // which is needed for proper extraction across multiple iterations.
    const fullText = result.text || result.generatedText || result.toString();

    // ── Fase E: Fix tool_call closing syntax before extraction ─────────
    // Only fix when </tool_call> is present (LLM explicitly tried to close).
    // If the LLM didn't write </tool_call>, the auto-continue (Fase C) handles it.
    const fullTextFixed = fixToolCallClosing(fullText);
    if (fullTextFixed !== fullText) {
      console.warn('[Agent] Fixed tool_call closing syntax');
    }

    // Check for tool calls in the full accumulated text
    const toolCalls = extractToolCalls(fullTextFixed);

    // ── Fase B: Detect dangling tool calls (truncated mid-XML) ─────
    const openTags = (fullText.match(/<tool_call\s+name=/g) || []).length;
    const closeTags = (fullText.match(/<\/tool_call>/g) || []).length;
    const hasDanglingToolCall = openTags > closeTags;

    // Save the FULL accumulated text for continuation (Fase C).
    // The model sees its own partial tool call across multiple iterations
    // and continues completing it. Since startWith is not counted toward
    // the output limit, only the completion needs to fit each round.
    if (hasDanglingToolCall) {
      // Accumulates across iterations:
      // 1st: responseText (no prev continuation)
      // 2nd+: result.text = prev startWith + new text
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
        instructionParts.push("Your previous response was empty. Write a clear, concise answer to the user's question using the information above. Do NOT output tool_call XML — just write your answer directly.");
        continue;
      }
    }

    // Execute all tool calls in parallel (only complete ones; dangling was ignored by extractToolCalls)
    const outcomes = await Promise.all(
      toolCalls.map(async (call) => {
        try {
          const tool = getTool(call.name);
          if (!tool) return { call, status: 'fulfilled' as const, result: undefined as string | undefined, error: undefined as string | undefined };

          onStatus?.(`Using ${call.name}...`);
          onToolStart?.(call.name, call.args);

          // Rate limit check — prevents abuse of external APIs
          const rateCheck = checkToolRateLimit(call.name);
          if (!rateCheck.allowed) {
            const waitSec = Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000);
            const rateMsg = `Rate limit exceeded for ${call.name}. Please wait ${waitSec}s before calling this tool again.`;
            onToolError?.(call.name, call.args, rateMsg);
            return { call, status: 'rejected' as const, result: undefined as string | undefined, error: rateMsg };
          }

          const validationError = validateToolArgs(tool, call.args);
          if (validationError) {
            onToolError?.(call.name, call.args, validationError);
            return { call, status: 'rejected' as const, result: undefined as string | undefined, error: validationError };
          }

          const timeoutMs = tool.timeoutMs ?? 30_000;
          let result = await withTimeout(
            tool.execute(call.args),
            timeoutMs,
            call.name,
            signal
          );

          // Safety net truncation (from 8.6)
          if (result.length > MAX_TOOL_OUTPUT) {
            result = truncateOutput(result, MAX_TOOL_OUTPUT);
          }

          onToolResult?.(call.name, call.args, result);
          return { call, status: 'fulfilled' as const, result, error: undefined };
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error(`[Agent] Tool ${call.name} failed:`, errorMsg);
          onToolError?.(call.name, call.args, errorMsg);
          return { call, status: 'rejected' as const, result: undefined, error: errorMsg };
        }
      })
    );

    // Process in ORIGINAL order for instructionParts + repetition detection
    for (const outcome of outcomes) {
      const { call } = outcome;

      if (outcome.status === 'fulfilled' && outcome.result !== undefined) {
        // Dynamic next-step guidance
        let nextStep = "";
        if (call.name === "web_search") {
          nextStep = "Analyze these search results. Pick the 1-2 most relevant URLs and use scrape_url to read their full content. If the results don't look relevant, try a different search query instead.";
        } else if (call.name === "scrape_url") {
          nextStep = "Use the page content above to answer the user's question. If the scraped content doesn't contain the answer, try scraping a different URL from the earlier search results, or run a new web_search with a different query.";
        } else {
          nextStep = "Now respond to the user based on this information.";
        }
        instructionParts.push(`[Tool Result - ${call.name}]:\n${outcome.result}\n\n${nextStep}`);

        // Repetition detection (in original order)
        const repStatus = detector.check(call.name, call.args);
        if (repStatus === 'warn') {
          instructionParts.push(`[System]: You have called ${call.name} with the same arguments multiple times in a row. This appears to be repetitive. Try a different approach or synthesize the answer from information you already have.`);
        } else if (repStatus === 'interrupt') {
          return `The agent was interrupted because it appeared to be stuck in a loop (called ${call.name} with identical arguments too many times). Here's what was accomplished so far. Please try rephrasing your request.`;
        }
      } else {
        // Tool failed or returned no result (tool not found)
        if (outcome.error) {
          instructionParts.push(`[Tool Error - ${call.name}]: ${outcome.error}\n\nThe tool failed. Respond to the user explaining the issue.`);
        }
        // If !outcome.error && !outcome.result: tool not found — skip silently
      }
    }

    // ── Fase C: Add continuation marker when dangling detected ──────
    if (hasDanglingToolCall) {
      onStatus?.("Response was truncated — continuing...");
      instructionParts.push(
        "[CONTINUE]: Your previous response was cut off. " +
        "The incomplete tool_call was NOT executed. Results from complete tool calls are above. " +
        "Continue your response from where you left off, and explicitly close the call with </tool_call> to exit the tool after finishing the content."
      );
    }
  }

  return "I apologize, but I wasn't able to complete that task.";
}
