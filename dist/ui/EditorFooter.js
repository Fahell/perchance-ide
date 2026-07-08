import { jsxs as _jsxs, jsx as _jsx } from "preact/jsx-runtime";
/**
 * EditorFooter — Footer bar for the code editor column.
 * Shows terminal toggle, dirty file count, and persist status.
 */
import { useEffect, useState } from "preact/hooks";
import { ideStore } from "../store.js";
import { getDirtyCount } from "../vfs-persist.js";
import { colors, fonts } from "./theme.js";
export function EditorFooter({ terminalOpen, onToggleTerminal }) {
    const [dirtyFiles, setDirtyFiles] = useState([]);
    const [persistStatus, setPersistStatus] = useState("idle");
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
    return (_jsxs("div", { style: {
            borderTop: `1px solid ${colors.border}`,
            flexShrink: 0,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "4px 12px",
            background: colors.surface1,
        }, children: [_jsx("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: _jsxs("button", { onClick: onToggleTerminal, style: {
                        color: terminalOpen ? colors.text : colors.textSecondary,
                        cursor: "pointer",
                        fontSize: "11px",
                        fontFamily: fonts.mono,
                        padding: "2px 4px",
                        background: "none",
                        border: "none",
                        display: "inline",
                    }, children: ["[term]", terminalOpen ? "▼" : "▲"] }) }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: "12px" }, children: [dirtyCount > 0 && (_jsxs("span", { style: {
                            fontSize: "9px",
                            fontFamily: fonts.mono,
                            color: "#e8a84c",
                        }, children: [dirtyCount, " dirty"] })), _jsx("span", { style: {
                            fontSize: "9px",
                            fontFamily: fonts.mono,
                            color: hasPendingPersists
                                ? "#e8a84c"
                                : persistStatus === "saving"
                                    ? colors.textSecondary
                                    : colors.textMuted,
                        }, children: hasPendingPersists ? "⏳" : persistStatus === "saving" ? "⋯" : "✓" }), _jsx("span", { style: {
                            fontSize: "9px",
                            fontFamily: fonts.mono,
                            color: colors.textMuted,
                        }, children: "editor" })] })] }));
}
