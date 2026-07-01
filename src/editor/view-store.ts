/**
 * Shared EditorView reference — allows OutlinePanel and other components
 * to access the current CodeMirror EditorView without prop drilling.
 */
import type { EditorView } from "codemirror";

let _view: EditorView | null = null;

export function setCurrentView(v: EditorView | null): void {
  _view = v;
}

export function getCurrentView(): EditorView | null {
  return _view;
}
