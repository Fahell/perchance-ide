/**
 * Node.js Tools — Agent tools powered by BrowserPod runtime.
 *
 * Provides npm install, node script execution, and arbitrary npm commands.
 * All tools delegate to browserPodManager singleton.
 *
 * Tools are only registered when BrowserPod is enabled and booted.
 */

import { browserPodManager } from "../browserpod/manager.js";
import type { Tool } from "./index.js";

// ─── Tool: run_npm_install ──────────────────────────────────
function createNpmInstallTool(): Tool {
  return {
    name: "run_npm_install",
    description: "Install npm packages in the BrowserPod Node.js environment. Syncs VFS files first, then runs 'npm install' with optional package names.",
    parameters: {
      packages: {
        description: "Space-separated package names to install (optional, defaults to installing from package.json)",
        type: "string",
        required: false,
      },
    },
    timeoutMs: 120_000,
    async execute(args) {
      if (!browserPodManager.isReady()) {
        return "Error: BrowserPod not initialized. Enable Node.js tools in settings and provide a valid API key.";
      }

      const packages = (args.packages as string | undefined)?.trim() ?? "";
      const cmdArgs = packages ? ["install", ...packages.split(/\s+/)] : ["install"];

      console.log(`[NodeTools] npm ${cmdArgs.join(" ")}`);
      const result = await browserPodManager.run("npm", cmdArgs, "/app");

      const output = [
        result.stdout ? `stdout:\n${result.stdout}` : "",
        result.stderr ? `stderr:\n${result.stderr}` : "",
        `exit code: ${result.exitCode}`,
      ].filter(Boolean).join("\n\n");

      return output || "npm install completed (no output)";
    },
  };
}

// ─── Tool: run_node_script ──────────────────────────────────
function createRunNodeScriptTool(): Tool {
  return {
    name: "run_node_script",
    description: "Execute a Node.js script file in the BrowserPod environment. The file must exist in the VFS or be written first.",
    parameters: {
      path: {
        description: "Path to the .js file to execute (relative to /app)",
        type: "string",
        required: true,
      },
      args: {
        description: "Additional arguments to pass to the script",
        type: "string",
        required: false,
      },
    },
    timeoutMs: 60_000,
    async execute(toolArgs) {
      if (!browserPodManager.isReady()) {
        return "Error: BrowserPod not initialized.";
      }

      const scriptPath = toolArgs.path as string;
      const extraArgs = (toolArgs.args as string | undefined)?.trim();
      const cmdArgs = [scriptPath];
      if (extraArgs) cmdArgs.push(...extraArgs.split(/\s+/));

      console.log(`[NodeTools] node ${cmdArgs.join(" ")}`);
      const result = await browserPodManager.run("node", cmdArgs, "/app");

      const output = [
        result.stdout ? `stdout:\n${result.stdout}` : "",
        result.stderr ? `stderr:\n${result.stderr}` : "",
        `exit code: ${result.exitCode}`,
      ].filter(Boolean).join("\n\n");

      return output || "Script executed (no output)";
    },
  };
}

// ─── Tool: execute_npm_command ──────────────────────────────
function createExecuteNpmCommandTool(): Tool {
  return {
    name: "execute_npm_command",
    description: "Run an arbitrary npm command in the BrowserPod environment (e.g., 'test', 'build', 'start').",
    parameters: {
      command: {
        description: "The npm subcommand to run (e.g., test, build, start, run dev)",
        type: "string",
        required: true,
      },
    },
    timeoutMs: 120_000,
    async execute(args) {
      if (!browserPodManager.isReady()) {
        return "Error: BrowserPod not initialized.";
      }

      const command = (args.command as string).trim();
      const cmdArgs = command.split(/\s+/);

      console.log(`[NodeTools] npm ${cmdArgs.join(" ")}`);
      const result = await browserPodManager.run("npm", cmdArgs, "/app");

      const output = [
        result.stdout ? `stdout:\n${result.stdout}` : "",
        result.stderr ? `stderr:\n${result.stderr}` : "",
        `exit code: ${result.exitCode}`,
      ].filter(Boolean).join("\n\n");

      return output || `npm ${command} completed (no output)`;
    },
  };
}

// ─── Factory ────────────────────────────────────────────────
export function createNodeTools(): Record<string, Tool> {
  const tools = [
    createNpmInstallTool(),
    createRunNodeScriptTool(),
    createExecuteNpmCommandTool(),
  ];

  const map: Record<string, Tool> = {};
  for (const tool of tools) {
    map[tool.name] = tool;
  }
  return map;
}
