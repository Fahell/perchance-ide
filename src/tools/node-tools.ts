/**
 * Node.js Tools — Agent tools powered by BrowserPod runtime.
 *
 * Provides npm install, node script execution, and arbitrary npm commands.
 * All tools delegate to browserPodManager singleton.
 *
 * IMPORTANT: BrowserPod has an isolated filesystem. VFS files must be
 * synced to the pod before execution via syncVfsToPod().
 *
 * Tools are only registered when BrowserPod is enabled and booted.
 */

import { browserPodManager } from "../browserpod/manager.js";
import type { Tool } from "./index.js";
import { pullProjectFilesFromPod } from "./shell-tools.js";
import { syncVfsToPod, writeToVfs } from "./sync-utils.js";

// ─── Post-execution Pull Helper ──────────────────────────────
/**
 * Pull specific files from BrowserPod back to VFS after npm commands.
 * Only metadata files (package.json, package-lock.json) are synced back;
 * node_modules stays in the Pod (too heavy for VFS/editor).
 */
async function pullMetadataFromPod(): Promise<void> {
  const metadataFiles = ["/home/user/package.json", "/home/user/package-lock.json"];

  for (const filePath of metadataFiles) {
    const content = await browserPodManager.readFile(filePath);
    if (content !== null) {
      writeToVfs(filePath, content);
      console.log(`[NodeTools] Pulled ${filePath} → VFS`);
    }
  }
}

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

      // Sync VFS → Pod so package.json is visible
      await syncVfsToPod();

      const packages = (args.packages as string | undefined)?.trim() ?? "";
      const cmdArgs = packages ? ["install", ...packages.split(/\s+/)] : ["install"];

      console.log(`[NodeTools] npm ${cmdArgs.join(" ")}`);
      const result = await browserPodManager.run("npm", cmdArgs, { cwd: "/home/user" });

      // Pull metadata back to VFS so agent can see package.json changes
      if (result.exitCode === 0) {
        await pullProjectFilesFromPod();
      }

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
        description: "Absolute path to the .js file to execute (e.g., /home/user/hello.js)",
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

      // Sync VFS → Pod so the script file is visible
      await syncVfsToPod();

      const scriptPath = toolArgs.path as string;
      const extraArgs = (toolArgs.args as string | undefined)?.trim();
      const cmdArgs = [scriptPath];
      if (extraArgs) cmdArgs.push(...extraArgs.split(/\s+/));

      console.log(`[NodeTools] node ${cmdArgs.join(" ")}`);
      const result = await browserPodManager.run("node", cmdArgs, { cwd: "/home/user" });

      // Pull any file changes made by the script back to VFS
      await pullProjectFilesFromPod();

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

      // Sync VFS → Pod so project files are visible
      await syncVfsToPod();

      const command = (args.command as string).trim();
      const cmdArgs = command.split(/\s+/);

      console.log(`[NodeTools] npm ${cmdArgs.join(" ")}`);
      const result = await browserPodManager.run("npm", cmdArgs, { cwd: "/home/user" });

      // Pull metadata back to VFS if command may have modified package.json
      if (result.exitCode === 0) {
        await pullMetadataFromPod();
      }

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
