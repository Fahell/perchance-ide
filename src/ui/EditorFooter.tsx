/**
 * EditorFooter — Footer bar for the code editor column.
 * Shows terminal toggle, dirty file count, and persist status.
 */

import { useEffect, useState } from "preact/hooks";
import { ideStore, type FileTab } from "../store.js";
import { getDirtyCount } from "../vfs-persist.js";
import { colors, fonts } from "./theme.js";

interface EditorFooterProps {
  terminalOpen: boolean;
  onToggleTerminal: () => void;
}

export function EditorFooter({ terminalOpen, onToggleTerminal }: EditorFooterProps) {
  const [dirtyFiles, setDirtyFiles] = useState<FileTab[]>([]);
  const [persistStatus, setPersistStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Subscribe to store for dirty files and save status
  useEffect(() => {
    return ideStore.subscribe((s) => {
      setDirtyFiles(s.files.filter((f) => f.dirty));
      // Show persist status from any open file's saveStatus
      const activeTab = s.files.find((f) => f.path === s.activeFile);
      setPersistStatus(activeTab?.saveStatus ?? "idle");
    });
  }, []);

  const dirtyCount = dirtyFiles.length;
  const persistCount = getDirtyCount();
  const hasPendingPersists = persistCount.dirty > 0 || persistCount.deleted > 0;

  return (
    <div style={{
      borderTop: `1px solid ${colors.border}`,
      flexShrink: 0,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "4px 12px",
      background: colors.surface1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          onClick={onToggleTerminal}
          title={`${terminalOpen ? "Hide" : "Show"} terminal (Ctrl+\`)`}
          style={{
            color: terminalOpen ? colors.text : colors.textSecondary,
            cursor: "pointer",
            fontSize: "11px",
            fontFamily: fonts.mono,
            padding: "2px 6px",
            background: terminalOpen ? colors.surface2 : "none",
            border: `1px solid ${terminalOpen ? colors.border : "transparent"}`,
            borderRadius: "2px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            transition: "background 0.1s, border-color 0.1s",
          }}
        >
          {terminalOpen ? "▼" : "▶"} Terminal
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Dirty file count */}
        {dirtyCount > 0 && (
          <span style={{
            fontSize: "9px",
            fontFamily: fonts.mono,
            color: "#e8a84c",
          }}
            title={`${dirtyCount} file${dirtyCount > 1 ? "s have" : " has"} unsaved changes`}
          >
            {dirtyCount} dirty
          </span>
        )}

        {/* Persist status indicator */}
        <span style={{
          fontSize: "9px",
          fontFamily: fonts.mono,
          color: hasPendingPersists
            ? "#e8a84c"
            : persistStatus === "saving"
              ? colors.textSecondary
              : colors.textMuted,
        }}
          title={hasPendingPersists
            ? "Pending writes to storage..."
            : persistStatus === "saving"
              ? "Writing to storage..."
              : "All changes saved"}
        >
          {hasPendingPersists ? "⏳" : persistStatus === "saving" ? "⋯" : "✓"}
        </span>

        <span style={{
          fontSize: "9px",
          fontFamily: fonts.mono,
          color: colors.textMuted,
        }}>
          editor
        </span>
      </div>
    </div>
  );
}
