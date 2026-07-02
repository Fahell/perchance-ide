/**
 * Agent loop — handles tool call detection and execution
 *
 * Flow:
 *   1. Send user message to LLM with tool instructions
 *   2. LLM responds (possibly with <tool_call> XML)
 *   3. Detect tool_call → execute tool → feed result back
 *   4. Repeat until LLM gives a final answer (no tool_call)
 */
import { getPyodideStatus } from "./terminal/pyodide.js";
import { checkToolRateLimit, getTool, getToolDescriptions, hasTool, validateToolArgs } from "./tools/index.js";
import { getAi } from "./types.js";
import { truncateOutput } from "./utils/truncate.js";
import { vfsGetAll } from "./vfs.js";
// ─── Constants ──────────────────────────────────────────────
const MAX_ITERATIONS = 8;
const LLM_TIMEOUT_MS = 300_000; // 5 min — Perchance AI can be slow
const MAX_TOOL_OUTPUT = 20_000; // Safety net for tool result truncation
const TOOL_CALL_REGEX = /<tool_call\s+name="(\w+)">\s*(\{.*?\})\s*<\/tool_call>/gs;
// ─── Timeout Helpers ────────────────────────────────────────
/**
 * Wrap a promise with a timeout via AbortSignal.
 * If an existingSignal is provided, combines both — whichever fires first aborts.
 * On timeout, rejects with DOMException 'AbortError'.
 */
export function withTimeout(promise, ms, label, existingSignal) {
    const timeoutSignal = AbortSignal.timeout(ms);
    const signal = existingSignal
        ? combineSignals(existingSignal, timeoutSignal)
        : timeoutSignal;
    if (signal.aborted) {
        return Promise.reject(new DOMException(signal.reason?.message ?? `Timed out after ${ms}ms`, 'AbortError'));
    }
    return new Promise((resolve, reject) => {
        const onAbort = () => {
            reject(new DOMException(signal.reason?.message ?? `Operation "${label}" timed out after ${ms}ms`, 'AbortError'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
        promise.then((v) => {
            signal.removeEventListener('abort', onAbort);
            resolve(v);
        }, (e) => {
            signal.removeEventListener('abort', onAbort);
            reject(e);
        });
    });
}
/**
 * Combine multiple AbortSignals into one.
 * The combined signal aborts when ANY constituent signal aborts.
 * Falls back to manual combining if AbortSignal.any() is unavailable.
 */
function combineSignals(...signals) {
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
export function aiCallWithSignal(options, signal) {
    const aiResult = getAi()(options);
    if (!signal) {
        return Promise.resolve(aiResult);
    }
    if (signal.aborted) {
        aiResult.stop();
        return Promise.reject(new DOMException(signal.reason?.message ?? 'Aborted', 'AbortError'));
    }
    return new Promise((resolve, reject) => {
        let settled = false;
        const onAbort = () => {
            if (settled)
                return;
            settled = true;
            aiResult.stop();
            reject(new DOMException(signal.reason?.message ?? 'Aborted', 'AbortError'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
        // The thenable resolves/rejects when generation finishes
        Promise.resolve(aiResult).then((val) => {
            if (settled)
                return;
            settled = true;
            signal.removeEventListener('abort', onAbort);
            resolve(val);
        }, (err) => {
            if (settled)
                return;
            settled = true;
            signal.removeEventListener('abort', onAbort);
            reject(err);
        });
    });
}
// ─── System Prompt for Tools ────────────────────────────────
function buildToolPrompt(vfsFileCount, pyodideLoaded) {
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
    return `You are a research agent. Your job is to find accurate, up-to-date information using your tools.

IMPORTANT CONTEXT:
- Your training data has a cutoff of early ${cutoffYear}. The current date is ${dateStr} (${timezone}).
- If asked about events in ${cutoffYear}-${currentYear}, you MUST use web_search — do not say "it hasn't happened yet" or refuse.

PROJECT STATE:
- Files in project: ${vfsFileCount ?? '?'}
- Python runtime: ${pyodideLoaded ? '● Loaded and ready' : '○ Not loaded (will load on first use)'}

Available tools:
${getToolDescriptions()}

RESEARCH WORKFLOW:
1. SEARCH: Use web_search to find relevant results with URLs and summaries.
2. FETCH: Use scrape_url on the most relevant URLs to read their full content.
3. If the results are poor, the scrape failed, or you didn't find what you need — try a DIFFERENT search query or scrape different URLs. You have up to 8 iterations — use them.
4. SYNTHESIZE: Give your final answer based on the real page content you fetched.

RULES:
- Use web_search for any real-time data (prices, scores, news, weather, dates, events) or topics outside your ${cutoffYear} training data.
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

You may output MULTIPLE <tool_call> blocks in a single response. Tools are executed in parallel when possible.
If a tool depends on the result of another (e.g., you need to read a file before editing it), output them in SEPARATE responses — output one tool, wait for the result, then output the next.`;
}
function extractToolCalls(text) {
    const calls = [];
    let match;
    // Reset regex state
    TOOL_CALL_REGEX.lastIndex = 0;
    while ((match = TOOL_CALL_REGEX.exec(text)) !== null) {
        const [, name, argsStr] = match;
        try {
            const args = JSON.parse(argsStr);
            if (hasTool(name)) {
                calls.push({ name, args });
            }
        }
        catch {
            console.warn(`[Agent] Failed to parse tool_call args: ${argsStr}`);
        }
    }
    return calls;
}
// ─── Clean Response (remove tool_call tags) ─────────────────
function cleanResponse(text) {
    return text.replace(TOOL_CALL_REGEX, "").trim();
}
class RepetitionDetector {
    recent = [];
    consecutiveIdentical = 0;
    hash(args) {
        return JSON.stringify(args, Object.keys(args).sort());
    }
    /**
     * Check if the current tool call is repetitive.
     * Returns 'ok' if no repetition, 'warn' if 3+ consecutive identical, 'interrupt' if 5+.
     */
    check(toolName, args) {
        const fp = { toolName, argsHash: this.hash(args) };
        const last = this.recent[this.recent.length - 1];
        if (last && last.toolName === fp.toolName && last.argsHash === fp.argsHash) {
            this.consecutiveIdentical++;
        }
        else {
            this.consecutiveIdentical = 1;
        }
        this.recent.push(fp);
        if (this.consecutiveIdentical >= 5)
            return 'interrupt';
        if (this.consecutiveIdentical >= 3)
            return 'warn';
        return 'ok';
    }
}
// ─── Agent Loop ─────────────────────────────────────────────
export async function agentLoop(userMessage, context, onStatus, onToolResult, onToolStart, onToolError, signal) {
    // Gather dynamic state for the system prompt
    const pyodideStatus = getPyodideStatus();
    const vfsFileCount = vfsGetAll().filter(e => e.type === 'file').length;
    const toolPrompt = buildToolPrompt(vfsFileCount, pyodideStatus.loaded);
    // Build the instruction for the LLM with structured context
    const instructionParts = [];
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
    let iteration = 0;
    while (iteration < MAX_ITERATIONS) {
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
        let result;
        try {
            result = await aiCallWithSignal({
                instruction: instructionParts.join("\n\n"),
                stopSequences: ["</tool_call>"],
            }, llmSignal);
        }
        catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                const reason = signal?.aborted
                    ? "The operation was cancelled by the user."
                    : `The operation timed out after ${LLM_TIMEOUT_MS / 1000} seconds.`;
                onStatus?.(reason);
                return reason;
            }
            throw err;
        }
        const responseText = result.generatedText || result.text || result.toString();
        // Check for tool calls
        const toolCalls = extractToolCalls(responseText);
        if (toolCalls.length === 0) {
            // No tool calls — this is the final answer
            const finalAnswer = cleanResponse(responseText);
            if (finalAnswer.length > 0)
                return finalAnswer;
            // Empty response — retry with explicit instruction (once)
            if (iteration < MAX_ITERATIONS) {
                onStatus?.("Retrying — empty response...");
                instructionParts.push("Your previous response was empty. Write a clear, concise answer to the user's question using the information above. Do NOT output tool_call XML — just write your answer directly.");
                continue;
            }
        }
        // Execute all tool calls in parallel
        const outcomes = await Promise.all(toolCalls.map(async (call) => {
            try {
                const tool = getTool(call.name);
                if (!tool)
                    return { call, status: 'fulfilled', result: undefined, error: undefined };
                onStatus?.(`Using ${call.name}...`);
                onToolStart?.(call.name, call.args);
                // Rate limit check — prevents abuse of external APIs
                const rateCheck = checkToolRateLimit(call.name);
                if (!rateCheck.allowed) {
                    const waitSec = Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000);
                    const rateMsg = `Rate limit exceeded for ${call.name}. Please wait ${waitSec}s before calling this tool again.`;
                    onToolError?.(call.name, call.args, rateMsg);
                    return { call, status: 'rejected', result: undefined, error: rateMsg };
                }
                const validationError = validateToolArgs(tool, call.args);
                if (validationError) {
                    onToolError?.(call.name, call.args, validationError);
                    return { call, status: 'rejected', result: undefined, error: validationError };
                }
                const timeoutMs = tool.timeoutMs ?? 30_000;
                let result = await withTimeout(tool.execute(call.args), timeoutMs, call.name, signal);
                // Safety net truncation (from 8.6)
                if (result.length > MAX_TOOL_OUTPUT) {
                    result = truncateOutput(result, MAX_TOOL_OUTPUT);
                }
                onToolResult?.(call.name, call.args, result);
                return { call, status: 'fulfilled', result, error: undefined };
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                console.error(`[Agent] Tool ${call.name} failed:`, errorMsg);
                onToolError?.(call.name, call.args, errorMsg);
                return { call, status: 'rejected', result: undefined, error: errorMsg };
            }
        }));
        // Process in ORIGINAL order for instructionParts + repetition detection
        for (const outcome of outcomes) {
            const { call } = outcome;
            if (outcome.status === 'fulfilled' && outcome.result !== undefined) {
                // Dynamic next-step guidance
                let nextStep = "";
                if (call.name === "web_search") {
                    nextStep = "Analyze these search results. Pick the 1-2 most relevant URLs and use scrape_url to read their full content. If the results don't look relevant, try a different search query instead.";
                }
                else if (call.name === "scrape_url") {
                    nextStep = "Use the page content above to answer the user's question. If the scraped content doesn't contain the answer, try scraping a different URL from the earlier search results, or run a new web_search with a different query.";
                }
                else {
                    nextStep = "Now respond to the user based on this information.";
                }
                instructionParts.push(`[Tool Result - ${call.name}]:\n${outcome.result}\n\n${nextStep}`);
                // Repetition detection (in original order)
                const repStatus = detector.check(call.name, call.args);
                if (repStatus === 'warn') {
                    instructionParts.push(`[System]: You have called ${call.name} with the same arguments multiple times in a row. This appears to be repetitive. Try a different approach or synthesize the answer from information you already have.`);
                }
                else if (repStatus === 'interrupt') {
                    return `The agent was interrupted because it appeared to be stuck in a loop (called ${call.name} with identical arguments too many times). Here's what was accomplished so far. Please try rephrasing your request.`;
                }
            }
            else {
                // Tool failed or returned no result (tool not found)
                if (outcome.error) {
                    instructionParts.push(`[Tool Error - ${call.name}]: ${outcome.error}\n\nThe tool failed. Respond to the user explaining the issue.`);
                }
                // If !outcome.error && !outcome.result: tool not found — skip silently
            }
        }
    }
    return "I apologize, but I wasn't able to complete that task after multiple attempts.";
}
