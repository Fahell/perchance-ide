/**
 * Lint configuration for CodeMirror 6.
 *
 * Provides lint sources for:
 * - JavaScript / TypeScript (syntax-level checks via the Lezer parser)
 * - JSON (parse validation)
 * - CSS (basic validation)
 * - HTML (basic validation)
 *
 * Each linter produces diagnostics shown as squiggly underlines
 * and gutter markers, with a diagnostic panel via Ctrl+Shift+M.
 */

import type { Diagnostic } from "@codemirror/lint";
import { linter } from "@codemirror/lint";
import { syntaxTree } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";

// ─── JS/TS Linter — detect parser errors ────────────────────
function jsLintSource(view: EditorView): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const tree = syntaxTree(view.state);

  tree.iterate({
    enter: (nodeRef) => {
      const { name, from, to } = nodeRef;

      // Lezer parser creates error nodes for syntax problems.
      // The node name is the Unicode "⚠" character or "✖".
      if (name === "⚠" || name === "✖" || name === "Invalid" || name === "ERROR") {
        const text = view.state.doc.sliceString(from, Math.min(to, from + 60));
        diagnostics.push({
          from,
          to,
          severity: "error",
          message: text.trim() || "Syntax error",
          source: "js-lint",
        });
        return false;
      }
    },
  });

  return diagnostics;
}

// ─── JSON Linter — validate JSON parsing ────────────────────
function jsonLintSource(view: EditorView): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const doc = view.state.doc.toString();

  try {
    JSON.parse(doc);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const posMatch = msg.match(/position\s+(\d+)/i);
    const pos = posMatch ? parseInt(posMatch[1], 10) : 0;

    const line = view.state.doc.lineAt(Math.min(pos, doc.length));
    diagnostics.push({
      from: line.from,
      to: line.to,
      severity: "error",
      message: msg.split("\n")[0] || "Invalid JSON",
      source: "json-lint",
    });
  }

  return diagnostics;
}

// ─── CSS Linter — detect parser errors ──────────────────────
function cssLintSource(view: EditorView): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const tree = syntaxTree(view.state);

  tree.iterate({
    enter: (nodeRef) => {
      const { name, from, to } = nodeRef;

      if (name === "⚠" || name === "✖" || name === "Invalid" || name === "ERROR") {
        const text = view.state.doc.sliceString(from, Math.min(to, from + 60));
        diagnostics.push({
          from,
          to,
          severity: "error",
          message: text.trim() || "CSS syntax error",
          source: "css-lint",
        });
        return false;
      }
    },
  });

  return diagnostics;
}

// ─── HTML Linter — detect parser errors ─────────────────────
function htmlLintSource(view: EditorView): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const tree = syntaxTree(view.state);

  tree.iterate({
    enter: (nodeRef) => {
      const { name, from, to } = nodeRef;

      if (name === "⚠" || name === "✖" || name === "Invalid" || name === "ERROR") {
        const text = view.state.doc.sliceString(from, Math.min(to, from + 60));
        diagnostics.push({
          from,
          to,
          severity: "error",
          message: text.trim() || "HTML syntax error",
          source: "html-lint",
        });
        return false;
      }
    },
  });

  return diagnostics;
}

// ─── Exported linter extensions ─────────────────────────────
// Each uses a 300ms delay to avoid linting on every keystroke.

export const jsLinter = linter(jsLintSource, { delay: 300 });
export const jsonLinter = linter(jsonLintSource, { delay: 300 });
export const cssLinter = linter(cssLintSource, { delay: 300 });
export const htmlLinter = linter(htmlLintSource, { delay: 300 });
