/**
 * Terminal Tools — agent-accessible tools for executing Python code
 * in the browser via Pyodide (WebAssembly Python runtime).
 *
 * All tools capture stdout/stderr and return them as formatted strings.
 * VFS is automatically synced before/after execution.
 *
 * Each tool returns descriptive strings (success or error) — never throws.
 */

import { ideStore } from "../store.js";
import { executePython, installPackage } from "../terminal/pyodide.js";
import { truncateOutput } from "../utils/truncate.js";
import { vfsExists, vfsRead } from "../vfs.js";
import type { Tool } from "./index.js";

// ─── Tool Factory ───────────────────────────────────────────
export function createTerminalTools(): Record<string, Tool> {
  return {
    run_python: {
      name: "run_python",
      description:
        "Execute Python code in the browser via Pyodide (WebAssembly). Returns stdout, stderr, and exit code. The VFS is automatically synced to Python's filesystem before execution, and any file changes made by Python are synced back afterwards. Use this for calculations, data processing, testing code snippets, or any Python task. Supports most standard library modules and popular packages like numpy, pandas, requests (via install_package first).",
      parameters: {
        code: { description: "The Python source code to execute. Can include multiple statements, function definitions, etc.", type: "string", required: true },
      },
      timeoutMs: 120_000,
      execute: async (args) => {
        const code = String(args.code ?? "").trim();
        if (!code) return "Error: code is required.";

        try {
          const result = await executePython(code);
          // Emit output for OutputPanel (11.3)
          ideStore.getState().addOutput({
            command: code.slice(0, 200),
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
          });
          return formatPythonResult(result);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          ideStore.getState().addOutput({
            command: code.slice(0, 200),
            stdout: "",
            stderr: msg,
            exitCode: 1,
          });
          return `Error: Failed to execute Python: ${msg}`;
        }
      },
    },

    execute_script: {
      name: "execute_script",
      description:
        "Execute a .py file from the virtual file system using Pyodide (WebAssembly Python). Reads the file, runs it, and returns stdout, stderr, and exit code. The VFS is automatically synced before execution and synced back afterwards (so Python can read/write project files). Use this to run existing Python scripts in the project.",
      parameters: {
        path: { description: "Absolute path to a .py file in the VFS (e.g., /scripts/analyze.py). The file must exist and have a .py extension.", type: "string", required: true },
      },
      timeoutMs: 120_000,
      execute: async (args) => {
        const path = String(args.path || "");
        if (!path) return "Error: path is required.";
        if (!path.endsWith(".py"))
          return "Error: path must end with .py extension.";
        if (!vfsExists(path))
          return `Error: File not found: ${path}`;

        const content = vfsRead(path);
        if (content === null)
          return `Error: ${path} is a directory, not a file.`;

        try {
          const result = await executePython(content);
          // Emit output for OutputPanel (11.3)
          ideStore.getState().addOutput({
            command: `execute_script: ${path}`,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
          });
          return formatPythonResult(result);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          ideStore.getState().addOutput({
            command: `execute_script: ${path}`,
            stdout: "",
            stderr: msg,
            exitCode: 1,
          });
          return `Error: Failed to execute script: ${msg}`;
        }
      },
    },

    install_package: {
      name: "install_package",
      description:
        "Install a Python package in the Pyodide runtime. Tries pre-compiled packages first (numpy, pandas, matplotlib, etc.), then falls back to micropip for pure-Python wheels from PyPI. The package is available for all subsequent run_python and execute_script calls. Use this before running code that imports external libraries.",
      parameters: {
        pkgName: { description: "The name of the Python package to install (e.g., numpy, pandas, requests, beautifulsoup4).", type: "string", required: true },
      },
      timeoutMs: 120_000,
      execute: async (args) => {
        const pkgName = String(args.pkgName || "").trim();
        if (!pkgName) return "Error: package name is required.";

        try {
          const result = await installPackage(pkgName);
          return result;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return `Error: ${msg}`;
        }
      },
    },
  };
}

// ─── Formatting ─────────────────────────────────────────────
function formatPythonResult(result: {
  stdout: string;
  stderr: string;
  exitCode: number;
}): string {
  const maxStdout = 10_000;
  const maxStderr = 5_000;
  const out = result.stdout ? truncateOutput(result.stdout, maxStdout) : "(empty)";
  const err = result.stderr ? truncateOutput(result.stderr, maxStderr) : "(empty)";
  return [
    `Exit code: ${result.exitCode}`,
    `stdout:\n${out}`,
    `stderr:\n${err}`,
  ].join("\n\n");
}
