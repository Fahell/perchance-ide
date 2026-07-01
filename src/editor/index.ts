/**
 * CodeMirror 6 factory — creates and manages editor instances.
 *
 * All CM6 imports are centralized here so the bundler can tree-shake
 * and lazy-load the entire editor module on demand.
 */

import { indentUnit, type LanguageSupport } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { EditorView, basicSetup } from "codemirror";
import { cmTheme } from "./theme.js";

export type { LanguageSupport } from "@codemirror/language";

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
  /** Font size in px (default: 13) */
  fontSize?: number;
  /** Tab indent size (default: 2) */
  tabSize?: number;
  /** Enable word wrap (default: false) */
  wordWrap?: boolean;
  /** Read-only mode (default: false) */
  readonly?: boolean;
}

// ─── Factory ────────────────────────────────────────────────
export function createEditor(config: EditorConfig): EditorView {
  const {
    parent,
    doc,
    language,
    onChange,
    fontSize = 13,
    tabSize = 2,
    wordWrap = false,
    readonly = false,
  } = config;

  const extensions = [
    basicSetup,
    cmTheme,

    // Language
    language ?? [],

    // Indentation
    indentUnit.of(" ".repeat(tabSize)),

    // Line wrapping — opt-in
    wordWrap ? EditorView.lineWrapping : [],

    // Read-only
    readonly ? EditorView.editable.of(false) : [],

    // Custom keymap
    keymap.of([
      // Escape: blur the editor (useful to trigger global shortcuts)
      { key: "Escape", run: (view) => { view.contentDOM.blur(); return true; } },
    ]),

    // Change listener
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange?.(update.state.doc.toString());
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
