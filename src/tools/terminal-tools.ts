/**
 * Terminal Tools — agent-accessible tools for executing Python code
 * in the browser via Pyodide (WebAssembly Python runtime).
 *
 * All tools capture stdout/stderr and return them as formatted strings.
 * VFS is automatically synced before/after execution.
 *
 * Each tool returns descriptive strings (success or error) — never throws.
 */

import { executePython, installPackage } from "../terminal/pyodide.js";
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
        code: "The Python source code to execute. Can include multiple statements, function definitions, etc.",
      },
      timeoutMs: 120_000,
      execute: async (args) => {
        const code = String(args.code || "").trim();
        if (!code) return "Error: code is required.";

        try {
          const result = await executePython(code);
          return formatPythonResult(result);
        } catch (err: any) {
          return `Error: Failed to execute Python: ${err.message || err}`;
        }
      },
    },

    execute_script: {
      name: "execute_script",
      description:
        "Execute a .py file from the virtual file system using Pyodide (WebAssembly Python). Reads the file, runs it, and returns stdout, stderr, and exit code. The VFS is automatically synced before execution and synced back afterwards (so Python can read/write project files). Use this to run existing Python scripts in the project.",
      parameters: {
        path: "Absolute path to a .py file in the VFS (e.g., /scripts/analyze.py). The file must exist and have a .py extension.",
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
          return formatPythonResult(result);
        } catch (err: any) {
          return `Error: Failed to execute script: ${err.message || err}`;
        }
      },
    },

    install_package: {
      name: "install_package",
      description:
        "Install a Python package in the Pyodide runtime. Tries pre-compiled packages first (numpy, pandas, matplotlib, etc.), then falls back to micropip for pure-Python wheels from PyPI. The package is available for all subsequent run_python and execute_script calls. Use this before running code that imports external libraries.",
      parameters: {
        name: "The name of the Python package to install (e.g., numpy, pandas, requests, beautifulsoup4).",
      },
      timeoutMs: 120_000,
      execute: async (args) => {
        const name = String(args.name || "").trim();
        if (!name) return "Error: package name is required.";

        try {
          const result = await installPackage(name);
          return result;
        } catch (err: any) {
          return `Error: ${err.message || err}`;
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
  const out = result.stdout || "(empty)";
  const err = result.stderr || "(empty)";
  return [
    `Exit code: ${result.exitCode}`,
    `stdout:\n${out}`,
    `stderr:\n${err}`,
  ].join("\n\n");
}
