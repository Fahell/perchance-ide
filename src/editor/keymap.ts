/**
 * VS Code-inspired keybindings for CodeMirror 6.
 *
 * Extends the default keymap with productivity shortcuts:
 * - Ctrl+D / Cmd+D: Select next occurrence
 * - Ctrl+Shift+L / Cmd+Shift+L: Select all occurrences
 * - Alt+↑/↓: Move line up/down
 * - Alt+Shift+↑/↓: Copy line up/down
 * - Ctrl+/: Toggle comment
 * - Ctrl+Shift+K: Delete line
 * - Ctrl+Enter: Insert blank line below
 * - Ctrl+Shift+Enter: Insert blank line above
 * - Tab/Shift+Tab: Indent/outdent
 */

import {
  cursorLineStart,
  deleteLine,
  indentLess,
  indentMore,
  lineComment,
  moveLineDown,
  moveLineUp,
  toggleTabFocusMode,
  copyLineDown,
  copyLineUp,
} from "@codemirror/commands";
import {
  selectNextOccurrence,
  selectSelectionMatches,
} from "@codemirror/search";
import type { KeyBinding } from "@codemirror/view";

export const vscodeKeymap: readonly KeyBinding[] = [
  // ── Multi-cursor ────────────────────────────────────────
  {
    key: "Mod-d",
    run: selectNextOccurrence,
    preventDefault: true,
  },
  {
    key: "Mod-Shift-l",
    run: selectSelectionMatches,
    preventDefault: true,
  },

  // ── Line manipulation ────────────────────────────────────
  {
    key: "Alt-ArrowUp",
    run: moveLineUp,
    preventDefault: true,
  },
  {
    key: "Alt-ArrowDown",
    run: moveLineDown,
    preventDefault: true,
  },
  {
    key: "Alt-Shift-ArrowUp",
    run: copyLineUp,
    preventDefault: true,
  },
  {
    key: "Alt-Shift-ArrowDown",
    run: copyLineDown,
    preventDefault: true,
  },
  {
    key: "Ctrl-Shift-k",
    mac: "Cmd-Shift-k",
    run: deleteLine,
    preventDefault: true,
  },

  // ── Comments ────────────────────────────────────────────
  {
    key: "Mod-/",
    run: lineComment,
    preventDefault: true,
  },

  // ── Indentation ─────────────────────────────────────────
  {
    key: "Tab",
    run: indentMore,
    shift: indentLess,
  },

  // ── Navigation ──────────────────────────────────────────
  {
    key: "Mod-ArrowLeft",
    mac: "Alt-ArrowLeft",
    run: cursorLineStart,
    preventDefault: true,
  },

  // ── Focus mode ──────────────────────────────────────────
  {
    key: "Ctrl-m",
    mac: "Cmd-m",
    run: toggleTabFocusMode,
    preventDefault: true,
  },
];
