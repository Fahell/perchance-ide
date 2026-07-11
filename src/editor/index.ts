/**
 * CodeMirror 6 factory — creates and manages editor instances.
 *
 * All CM6 imports are centralized here so the bundler can tree-shake
 * and lazy-load the entire editor module on demand.
 */

import { indentUnit, type LanguageSupport } from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { EditorView, basicSetup } from "codemirror";
import { cmTheme } from "./theme.js";
import { indentGuides } from "./indent-guides.js";
import { vscodeKeymap } from "./keymap.js";
import { jsLinter, jsonLinter, cssLinter, htmlLinter, pyLinter } from "./lint.js";
import { hoverPlugin } from "./hover.js";
import { nextSnippetField, prevSnippetField, clearSnippet } from "@codemirror/autocomplete";
import {
  jsAutoComplete,
  tsAutoComplete,
  jsxAutoComplete,
  tsxAutoComplete,
  cssAutoComplete,
  htmlAutoComplete,
  pyAutoComplete,
} from "./autocomplete.js";

export type { LanguageSupport } from "@codemirror/language";

// ─── Autocomplete selector ─────────────────────────────────
function getAutoCompleteExtensions(filename: string): Extension[] {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "mjs":
    case "cjs":
      return [jsAutoComplete];
    case "jsx":
      return [jsAutoComplete, jsxAutoComplete];
    case "ts":
    case "mts":
    case "cts":
      return [tsAutoComplete];
    case "tsx":
      return [tsAutoComplete, tsxAutoComplete];
    case "css":
      return [cssAutoComplete];
    case "html":
    case "htm":
      return [htmlAutoComplete];
    case "py":
      return [pyAutoComplete];
    default:
      return [];
  }
}

// ─── Linter selector ────────────────────────────────────────
function getLinter(filename: string): Extension | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "mjs":
    case "cjs":
    case "jsx":
    case "ts":
    case "mts":
    case "cts":
    case "tsx":
      return jsLinter;
    case "json":
      return jsonLinter;
    case "css":
      return cssLinter;
    case "html":
    case "htm":
      return htmlLinter;
    case "py":
      return pyLinter;
    default:
      return null;
  }
}

// ─── Config ─────────────────────────────────────────────────
export interface EditorConfig {
  /** DOM element to mount the editor into */
  parent: Element;
  /** Initial document content */
  doc: string;
  /** Language support extension (from langs.ts) */
  language?: LanguageSupport | null;
  /** Called on every document change with the full text */
  onChange?: (doc: string) => void;
  /** Called on cursor position changes (selection + scroll) */
  onCursorChange?: (info: CursorInfo) => void;
  /** Font size in px (default: 13) */
  fontSize?: number;
  /** Tab indent size (default: 2) */
  tabSize?: number;
  /** Enable word wrap (default: false) */
  wordWrap?: boolean;
  /** Read-only mode (default: false) */
  readonly?: boolean;
  /** Additional CM6 extensions (e.g., Emmet) */
  extraExtensions?: Extension[];
  /** File path/name used for linter detection */
  filename?: string;
}

// ─── Cursor info type ───────────────────────────────────────
export interface CursorInfo {
  line: number;
  column: number;
  totalLines: number;
  selectionLength: number;
}

// ─── Factory ────────────────────────────────────────────────
export function createEditor(config: EditorConfig): EditorView {
  const {
    parent,
    doc,
    language,
    onChange,
    onCursorChange,
    fontSize = 13,
    tabSize = 2,
    wordWrap = false,
    readonly = false,
    extraExtensions = [],
    filename = "",
  } = config;

  // Select linter based on file extension
  const linterExt = filename ? getLinter(filename) : null;

  const extensions = [
    basicSetup,
    cmTheme,

    // Language
    language ?? [],

    // Linters
    linterExt ?? [],

    // Indentation
    indentUnit.of(" ".repeat(tabSize)),

    // Indent guides (vertical lines at each tab stop)
    indentGuides,

    // Line wrapping — opt-in
    wordWrap ? EditorView.lineWrapping : [],

    // Read-only
    readonly ? EditorView.editable.of(false) : [],

    // VS Code-inspired keymap + snippet field navigation
    // nextSnippetField returns false when no snippet is active,
    // falling through to indentMore in vscodeKeymap
    keymap.of([
      ...vscodeKeymap,
      { key: "Tab", run: nextSnippetField, shift: clearSnippet },
      { key: "Shift-Tab", run: prevSnippetField },
      // Escape: blur the editor (useful to trigger global shortcuts)
      { key: "Escape", run: (view) => { view.contentDOM.blur(); return true; } },
    ]),

    // Hover tooltips — shows contextual info on hover (keywords, APIs, etc.)
    hoverPlugin,

    // Language-specific autocomplete (registered via languageData)
    // Picked up automatically by the autocompletion from basicSetup
    ...getAutoCompleteExtensions(filename),

    // Additional extensions (e.g., Emmet)
    ...extraExtensions,

    // Change listener + cursor position tracker
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange?.(update.state.doc.toString());
      }
      if ((update.selectionSet || update.docChanged || update.geometryChanged) && onCursorChange) {
        const sel = update.state.selection.main;
        const line = update.state.doc.lineAt(sel.head);
        onCursorChange({
          line: line.number,
          column: sel.head - line.from + 1,
          totalLines: update.state.doc.lines,
          selectionLength: Math.abs(sel.to - sel.from),
        });
      }
    }),
  ];

  // Font size override (the theme defaults to 13px)
  if (fontSize !== 13) {
    extensions.push(
      EditorView.theme({ "&": { fontSize: `${fontSize}px` } })
    );
  }

  const state = EditorState.create({
    doc,
    extensions,
  });

  return new EditorView({ state, parent });
}
