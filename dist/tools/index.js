/**
 * Tool registry — maps tool names to their implementations
 */
import { SlidingWindowRateLimiter } from "../utils/rate-limiter.js";
import { createContextTools } from "./context-tools.js";
import { createNodeTools } from "./node-tools.js";
import { createShellTools } from "./shell-tools.js";
import { createTerminalTools } from "./terminal-tools.js";
import { createVfsTools } from "./vfs-tools.js";
import { createWebTools } from "./web-search.js";
// ─── Registry ───────────────────────────────────────────────
const tools = {};
const toolCategories = {};
// ─── Rate Limiting ──────────────────────────────────────────
const rateLimiters = new Map();
/**
 * Check whether a tool call is allowed under its configured rate limit.
 * Lazily initializes the limiter on first call for tools that define one.
 * Returns { allowed: true } for tools without a rate limit configured.
 */
export function checkToolRateLimit(toolName) {
    const tool = tools[toolName];
    if (!tool?.rateLimit) {
        return { allowed: true };
    }
    let limiter = rateLimiters.get(toolName);
    if (!limiter) {
        limiter = new SlidingWindowRateLimiter(tool.rateLimit);
        rateLimiters.set(toolName, limiter);
    }
    return limiter.check();
}
/** Reset all rate limiters. Useful for testing or session reset. */
export function resetRateLimiters() {
    for (const limiter of rateLimiters.values()) {
        limiter.reset();
    }
    rateLimiters.clear();
}
// ─── Argument Validation ────────────────────────────────────
/**
 * Validate tool arguments against the tool's parameter schema.
 * Returns null if valid, or a descriptive error string if invalid.
 */
export function validateToolArgs(tool, args) {
    const errors = [];
    for (const [key, meta] of Object.entries(tool.parameters)) {
        const value = args[key];
        if (meta.required && (value === undefined || value === null)) {
            errors.push(`missing required field '${key}' (${meta.type})`);
            continue;
        }
        if (value !== undefined && value !== null) {
            const actualType = typeof value;
            if (actualType !== meta.type) {
                errors.push(`field '${key}' expected ${meta.type} but got ${actualType}`);
            }
        }
    }
    return errors.length > 0
        ? `Invalid arguments for ${tool.name}: ${errors.join("; ")}`
        : null;
}
// ─── Public API ─────────────────────────────────────────────
export function getTool(name) {
    return tools[name];
}
export function getToolDescriptions(enabledCategories) {
    return Object.values(tools)
        .filter((t) => !enabledCategories || enabledCategories.has(toolCategories[t.name]))
        .map((t) => {
        const params = Object.entries(t.parameters)
            .map(([key, meta]) => `    ${key} (${meta.type}${meta.required ? ", required" : ""}): ${meta.description}`)
            .join("\n");
        return `- ${t.name}: ${t.description}\n  Parameters:\n${params}`;
    })
        .join("\n");
}
export function hasTool(name) {
    return name in tools;
}
// ─── Web Tools ───────────────────────────────────────────────
export function initWebTools() {
    const webTools = createWebTools();
    Object.assign(tools, webTools);
    for (const name of Object.keys(webTools)) {
        toolCategories[name] = "web";
    }
    console.log("🌐 [Tools] Web tools registered:", Object.keys(webTools).join(", "));
}
// ─── Context Tools ─────────────────────────────────────────
export function initContextTools() {
    const contextTools = createContextTools();
    Object.assign(tools, contextTools);
    for (const name of Object.keys(contextTools)) {
        toolCategories[name] = "context";
    }
    console.log("🔧 [Tools] Context tools registered:", Object.keys(contextTools).join(", "));
}
// ─── VFS Tools ───────────────────────────────────────────────
export function initVfsTools() {
    const vfsTools = createVfsTools();
    Object.assign(tools, vfsTools);
    for (const name of Object.keys(vfsTools)) {
        toolCategories[name] = "vfs";
    }
    console.log("📁 [Tools] VFS tools registered:", Object.keys(vfsTools).join(", "));
}
// ─── Terminal Tools ───────────────────────────────────────────
export function initTerminalTools() {
    const terminalTools = createTerminalTools();
    Object.assign(tools, terminalTools);
    for (const name of Object.keys(terminalTools)) {
        toolCategories[name] = "terminal";
    }
    console.log("🐍 [Tools] Terminal tools registered:", Object.keys(terminalTools).join(", "));
}
// ─── Node.js Tools (BrowserPod) ─────────────────────────────
export function initNodeTools() {
    const nodeTools = createNodeTools();
    Object.assign(tools, nodeTools);
    for (const name of Object.keys(nodeTools)) {
        toolCategories[name] = "node";
    }
    console.log("🟢 [Tools] Node.js tools registered:", Object.keys(nodeTools).join(", "));
}
// ─── Shell Tools (Bash, Git, HTTP Server) ──────────────────
export function initShellTools() {
    const shellTools = createShellTools();
    Object.assign(tools, shellTools);
    for (const name of Object.keys(shellTools)) {
        toolCategories[name] = "shell";
    }
    console.log("🐚 [Tools] Shell tools registered:", Object.keys(shellTools).join(", "));
}
