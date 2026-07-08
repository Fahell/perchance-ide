/**
 * Indent guides for CodeMirror 6.
 *
 * Uses ViewPlugin + Decoration.mark to draw subtle vertical lines
 * at each indentation level, similar to VS Code's indent guides.
 *
 * Performance: only recomputes when viewport changes or document changes.
 * Uses RangeSetBuilder for efficient decoration construction.
 */

import { ViewPlugin, Decoration, DecorationSet, ViewUpdate, EditorView } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// ─── Helpers ────────────────────────────────────────────────

/**
 * Calculate the visual indent level (number of tab stops) for a line.
 * Handles both spaces and tabs.
 */
function getIndentLevel(text: string, tabSize: number): number {
  let visualSpaces = 0;
  for (const ch of text) {
    if (ch === " ") {
      visualSpaces++;
    } else if (ch === "\t") {
      visualSpaces += tabSize - (visualSpaces % tabSize);
    } else {
      break;
    }
  }
  return Math.floor(visualSpaces / tabSize);
}

// ─── Decorations ────────────────────────────────────────────

/** Subtle guide (all indent levels) */
const guideMark = Decoration.mark({ class: "cm-indent-guide" });

/** Brighter guide for the current cursor line's indent level */
const activeGuideMark = Decoration.mark({ class: "cm-indent-guide-active" });

// ─── Plugin ─────────────────────────────────────────────────

export const indentGuides = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.compute(view);
    }

    update(update: ViewUpdate) {
      if (update.viewportChanged || update.docChanged || update.selectionSet) {
        this.decorations = this.compute(update.view);
      }
    }

    compute(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>();
      const tabSize = view.state.tabSize;
      const cursorLine = view.state.selection.main.head;

      for (const { from, to } of view.visibleRanges) {
        let pos = from;
        while (pos <= to) {
          const line = view.state.doc.lineAt(pos);
          const level = getIndentLevel(line.text, tabSize);
          
          if (level > 0) {
            const isCursorLine = line.from <= cursorLine && cursorLine <= line.to;

            for (let i = 1; i <= level; i++) {
              // Position at the last character of each tab stop
              const markStart = line.from + i * tabSize - 1;
              
              // Ensure position is valid (within the line and within indent)
              if (markStart >= line.from && markStart < line.to) {
                const mark = i === level && isCursorLine ? activeGuideMark : guideMark;
                builder.add(markStart, Math.min(markStart + 1, line.to), mark);
              }
            }
          }

          pos = line.to + 1;
        }
      }

      return builder.finish();
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
