/**
 * Tool registry — maps tool names to their implementations
 */

import { SlidingWindowRateLimiter, type RateLimitConfig, type RateLimitResult } from "../utils/rate-limiter.js";
import { createContextTools } from "./context-tools.js";
import { createTerminalTools } from "./terminal-tools.js";
import { createVfsTools } from "./vfs-tools.js";
import { createWebTools } from "./web-search.js";

// ─── Tool Definition ────────────────────────────────────────
export interface ToolDefinition<TArgs extends Record<string, unknown> = Record<string, unknown>> {
  name: string;
  description: string;
  parameters: { [K in keyof TArgs]: { description: string; type: "string" | "number" | "boolean"; required?: boolean } };
  timeoutMs?: number;
  /** Optional rate limit to prevent abuse of external APIs. */
  rateLimit?: RateLimitConfig;
  execute: (args: TArgs) => Promise<string>;
}

/** Non-generic alias for backward compatibility with tool factories. */
export type Tool = ToolDefinition;

// ─── Registry ───────────────────────────────────────────────
const tools: Record<string, Tool> = {};
const toolCategories: Record<string, string> = {};

// ─── Rate Limiting ──────────────────────────────────────────
const rateLimiters = new Map<string, SlidingWindowRateLimiter>();

/**
 * Check whether a tool call is allowed under its configured rate limit.
 * Lazily initializes the limiter on first call for tools that define one.
 * Returns { allowed: true } for tools without a rate limit configured.
 */
export function checkToolRateLimit(toolName: string): RateLimitResult {
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
export function resetRateLimiters(): void {
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
export function validateToolArgs(
  tool: Tool,
  args: Record<string, unknown>
): string | null {
  const errors: string[] = [];

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
export function getTool(name: string): Tool | undefined {
  return tools[name];
}

export function getToolDescriptions(enabledCategories?: Set<string>): string {
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

export function hasTool(name: string): boolean {
  return name in tools;
}

// ─── Web Tools ───────────────────────────────────────────────
export function initWebTools(): void {
  const webTools = createWebTools();
  Object.assign(tools, webTools);
  for (const name of Object.keys(webTools)) {
    toolCategories[name] = "web";
  }
  console.log("🌐 [Tools] Web tools registered:", Object.keys(webTools).join(", "));
}

// ─── Context Tools ─────────────────────────────────────────
export function initContextTools(): void {
  const contextTools = createContextTools();
  Object.assign(tools, contextTools);
  for (const name of Object.keys(contextTools)) {
    toolCategories[name] = "context";
  }
  console.log("🔧 [Tools] Context tools registered:", Object.keys(contextTools).join(", "));
}

// ─── VFS Tools ───────────────────────────────────────────────
export function initVfsTools(): void {
  const vfsTools = createVfsTools();
  Object.assign(tools, vfsTools);
  for (const name of Object.keys(vfsTools)) {
    toolCategories[name] = "vfs";
  }
  console.log("📁 [Tools] VFS tools registered:", Object.keys(vfsTools).join(", "));
}

// ─── Terminal Tools ───────────────────────────────────────────
export function initTerminalTools(): void {
  const terminalTools = createTerminalTools();
  Object.assign(tools, terminalTools);
  for (const name of Object.keys(terminalTools)) {
    toolCategories[name] = "terminal";
  }
  console.log("🐍 [Tools] Terminal tools registered:", Object.keys(terminalTools).join(", "));
}
