/**
 * CodeMirror 6 factory — creates and manages editor instances.
 *
 * All CM6 imports are centralized here so the bundler can tree-shake
 * and lazy-load the entire editor module on demand.
 */
import { indentUnit } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { EditorView, basicSetup } from "codemirror";
import { cmTheme } from "./theme.js";
// ─── Factory ────────────────────────────────────────────────
export function createEditor(config) {
    const { parent, doc, language, onChange, fontSize = 13, tabSize = 2, wordWrap = false, readonly = false, extraExtensions = [], } = config;
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
        // Additional extensions (e.g., Emmet)
        ...extraExtensions,
        // Change listener
        EditorView.updateListener.of((update) => {
            if (update.docChanged) {
                onChange?.(update.state.doc.toString());
            }
        }),
    ];
    // Font size override (the theme defaults to 13px)
    if (fontSize !== 13) {
        extensions.push(EditorView.theme({ "&": { fontSize: `${fontSize}px` } }));
    }
    const state = EditorState.create({
        doc,
        extensions,
    });
    return new EditorView({ state, parent });
}
