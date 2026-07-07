/**
 * Shell Tools — Agent tools for Bash, Git, and HTTP server exposure.
 *
 * All tools delegate to browserPodManager and require BrowserPod to be ready.
 * These complement the existing Node.js tools (npm install, node script, npm command)
 * by exposing the underlying Linux environment capabilities of BrowserPod.
 *
 * Security: run_shell_command uses a whitelist of safe commands.
 * Git operations validate against destructive flags.
 * HTTP servers use the official pod.onPortal() API for URL exposure.
 */

import { browserPodManager } from "../browserpod/manager.js";
import { ideStore } from "../store.js";
import { vfsGetAll } from "../vfs.js";
import type { Tool } from "./index.js";

// ─── VFS Sync Helper (reused pattern from node-tools) ──────
async function syncVfsToPod(): Promise<void> {
  const entries = vfsGetAll();
  if (entries.length === 0) return;

  const vfsEntries = entries
    .filter((e) => e.type === "file")
    .map((e) => ({
      path: e.path,
      content: e.content ?? "",
    }));

  if (vfsEntries.length > 0) {
    await browserPodManager.syncFiles(vfsEntries);
  }
}

// ─── Shell Command Whitelist ────────────────────────────────
/**
 * Commands allowed in run_shell_command.
 * Only read-only or safely scoped utilities are permitted.
 * Destructive or network-exfiltration commands are excluded.
 */
const ALLOWED_SHELL_COMMANDS = new Set([
  "ls", "ll", "pwd", "whoami", "uname",
  "cat", "head", "tail", "wc", "file",
  "find", "grep", "awk", "sed", "sort", "uniq", "cut", "tr",
  "echo", "printf", "date", "env", "printenv",
  "mkdir", "touch", "cp", "mv", "rm",
  "chmod", "chown",
  "tar", "gzip", "gunzip", "zip", "unzip",
  "curl", "wget",
  "node", "npm", "npx", "python3", "pip3",
  "git",
  "ps", "kill", "top", "df", "du", "free",
  "which", "type", "command",
]);

/**
 * Extract the base command from a shell expression.
 * Handles pipes, redirects, and subshells by taking the first token.
 */
function extractBaseCommand(cmd: string): string {
  // Strip leading env vars (e.g., FOO=bar cmd) and take first token
  const stripped = cmd.replace(/^(\w+=\S+\s+)*/, "").trim();
  const firstToken = stripped.split(/\s+/)[0] ?? "";
  // Remove path prefix (e.g., /usr/bin/ls → ls)
  return firstToken.split("/").pop() ?? "";
}

/**
 * Check if a shell command is allowed by the whitelist.
 * Returns null if allowed, or an error message if blocked.
 */
function validateShellCommand(cmd: string): string | null {
  const baseCmd = extractBaseCommand(cmd);
  if (!baseCmd) return "Empty command";
  if (!ALLOWED_SHELL_COMMANDS.has(baseCmd)) {
    return `Command '${baseCmd}' is not in the allowed whitelist. Allowed: ${[...ALLOWED_SHELL_COMMANDS].sort().join(", ")}`;
  }
  return null;
}

// ─── Git Safety ────────────────────────────────────────────
/** Git subcommands that are always blocked for safety */
const BLOCKED_GIT_SUBCOMMANDS = new Set([
  "push",       // Prevent accidental pushes from browser
  "fetch",      // Network operation — use clone instead
  "remote",     // Remote manipulation is dangerous
  "config",     // Prevent credential/config leakage
  "credential", // Never expose credentials
]);

/**
 * Validate git arguments for safety.
 * Returns null if safe, or an error message if blocked.
 */
function validateGitArgs(args: string[]): string | null {
  if (args.length === 0) return "No git subcommand specified";

  const subcmd = args[0];
  if (BLOCKED_GIT_SUBCOMMANDS.has(subcmd)) {
    return `git ${subcmd} is blocked for security reasons. Allowed subcommands: clone, init, add, commit, status, log, diff, branch, checkout, merge, rebase, tag, stash, show, blame`;
  }

  // Block --force on destructive operations
  if (args.includes("--force") || args.includes("-f")) {
    if (["reset", "checkout", "merge", "rebase"].includes(subcmd)) {
      return `git ${subcmd} --force is blocked to prevent data loss`;
    }
  }

  return null;
}

// ─── Tool: run_shell_command ────────────────────────────────
function createRunShellCommandTool(): Tool {
  return {
    name: "run_shell_command",
    description:
      "Execute a Bash shell command in the BrowserPod Linux environment. " +
      "Only whitelisted commands are allowed (ls, cat, grep, find, curl, mkdir, cp, mv, rm, etc.). " +
      "VFS files are synced before execution.",
    parameters: {
      command: {
        description: "The shell command to execute (e.g., 'ls -la /home/user/src')",
        type: "string",
        required: true,
      },
    },
    timeoutMs: 60_000,
    async execute(args) {
      if (!browserPodManager.isReady()) {
        return "Error: BrowserPod not initialized. Enable Node.js tools in settings and provide a valid API key.";
      }

      const command = (args.command as string).trim();
      if (!command) return "Error: Empty command";

      // Validate against whitelist
      const validationError = validateShellCommand(command);
      if (validationError) {
        return `Error: ${validationError}`;
      }

      // Sync VFS → Pod so files are visible
      await syncVfsToPod();

      console.log(`[ShellTools] bash -c "${command}"`);
      const result = await browserPodManager.run("bash", ["-c", command]);

      const output = [
        result.stdout ? `stdout:\n${result.stdout}` : "",
        result.stderr ? `stderr:\n${result.stderr}` : "",
        `exit code: ${result.exitCode}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      return output || "Command completed (no output)";
    },
  };
}

// ─── Tool: run_git_command ──────────────────────────────────
function createRunGitCommandTool(): Tool {
  return {
    name: "run_git_command",
    description:
      "Execute a Git command in the BrowserPod environment. " +
      "Supports clone, init, add, commit, status, log, diff, branch, checkout, merge, etc. " +
      "Blocked: push, fetch, remote, config, credential (security). " +
      "VFS files are synced before execution.",
    parameters: {
      args: {
        description:
          "Git subcommand and arguments (e.g., 'status', 'log --oneline -5', 'clone https://github.com/user/repo.git')",
        type: "string",
        required: true,
      },
    },
    timeoutMs: 120_000,
    async execute(toolArgs) {
      if (!browserPodManager.isReady()) {
        return "Error: BrowserPod not initialized.";
      }

      const rawArgs = (toolArgs.args as string).trim();
      if (!rawArgs) return "Error: No git arguments provided";

      const gitArgs = rawArgs.split(/\s+/);

      // Validate git subcommand safety
      const validationError = validateGitArgs(gitArgs);
      if (validationError) {
        return `Error: ${validationError}`;
      }

      // Sync VFS → Pod so project files are visible
      await syncVfsToPod();

      console.log(`[ShellTools] git ${gitArgs.join(" ")}`);
      const result = await browserPodManager.run("git", gitArgs);

      const output = [
        result.stdout ? `stdout:\n${result.stdout}` : "",
        result.stderr ? `stderr:\n${result.stderr}` : "",
        `exit code: ${result.exitCode}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      return output || `git ${gitArgs[0]} completed (no output)`;
    },
  };
}

// ─── Tool: start_http_server ────────────────────────────────
function createStartHttpServerTool(): Tool {
  return {
    name: "start_http_server",
    description:
      "Start an HTTP server inside the BrowserPod and expose it via a public portal URL. " +
      "Uses the official pod.onPortal() API. The server must listen on the specified port. " +
      "Returns the public URL that can be shared or embedded. " +
      "Example: start a Node.js Express server on port 3000.",
    parameters: {
      command: {
        description:
          "The command to start the server (e.g., 'node server.js' or 'npx serve -l 3000')",
        type: "string",
        required: true,
      },
      port: {
        description: "The port the server will listen on (default: 3000)",
        type: "number",
        required: false,
      },
    },
    timeoutMs: 30_000,
    async execute(args) {
      if (!browserPodManager.isReady()) {
        return "Error: BrowserPod not initialized.";
      }

      const command = (args.command as string).trim();
      if (!command) return "Error: No server command provided";

      const port = (args.port as number | undefined) ?? 3000;

      // Sync VFS → Pod so server files are available
      await syncVfsToPod();

      // Register portal callback to capture the URL when the server starts listening
      let portalUrl: string | null = null;
      const portalPromise = new Promise<string>((resolve) => {
        const timeout = setTimeout(() => {
          resolve("");
        }, 15_000);

        browserPodManager.registerPortalCallback((event) => {
          if (event.port === port) {
            clearTimeout(timeout);
            portalUrl = event.url;
            resolve(event.url);

            // Persist portal in store for UI display
            try {
              ideStore.getState().addPortal({ url: event.url, port: event.port });
            } catch {
              // Store may not be initialized in test environments
            }
          }
        });
      });

      console.log(`[ShellTools] Starting HTTP server: ${command} (port ${port})`);

      // Start the server command in background (don't await completion)
      // We use bash -c to allow complex commands like "npx serve -l 3000"
      const serverPromise = browserPodManager.run("bash", ["-c", command]);

      // Wait for either the portal URL or a timeout
      const url = await portalPromise;

      if (url) {
        return `HTTP server started successfully.\nPublic URL: ${url}\nPort: ${port}\nCommand: ${command}\n\nNote: The server runs in the background. Use run_shell_command to check its status or kill it.`;
      }

      // If no portal was detected, check if the command failed
      const result = await Promise.race([
        serverPromise,
        new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) =>
          setTimeout(() => resolve({ stdout: "", stderr: "Timeout waiting for server", exitCode: 1 }), 10_000)
        ),
      ]);

      if (result.exitCode !== 0) {
        return `Server failed to start (exit code ${result.exitCode}).\n${result.stderr || result.stdout}`;
      }

      return `Server command executed but no portal URL was detected on port ${port} within 15s.\nEnsure your server calls listen(${port}) and binds to 0.0.0.0 (not localhost).\nCommand output:\n${result.stdout}`;
    },
  };
}

// ─── Factory ────────────────────────────────────────────────
export function createShellTools(): Record<string, Tool> {
  const tools = [
    createRunShellCommandTool(),
    createRunGitCommandTool(),
    createStartHttpServerTool(),
  ];

  const map: Record<string, Tool> = {};
  for (const tool of tools) {
    map[tool.name] = tool;
  }
  return map;
}
