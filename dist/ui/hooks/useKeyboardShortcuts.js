/**
 * Global keyboard shortcuts for the IDE.
 *
 * Uses a ref-based pattern to avoid stale closures while keeping
 * the event listener stable (registered once on mount).
 */
import { useEffect, useRef } from "preact/hooks";
import { dbSaveVfs } from "../../db.js";
import { t } from "../../i18n/index.js";
import { ideStore } from "../../store.js";
import { vfsGetAll } from "../../vfs.js";
export function useKeyboardShortcuts(opts) {
    const shortcutRef = useRef(opts);
    // Keep ref in sync with latest state on every render
    shortcutRef.current = opts;
    useEffect(() => {
        function handleKeyDown(e) {
            const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
            const meta = e.metaKey || e.ctrlKey;
            const s = shortcutRef.current;
            // ── Ctrl+S / Cmd+S: Save active file ──────────────
            if (meta && e.key === "s") {
                e.preventDefault();
                const activeFile = ideStore.getState().activeFile;
                if (activeFile) {
                    document.dispatchEvent(new CustomEvent("editor:flush-save", { detail: { path: activeFile } }));
                }
                dbSaveVfs(vfsGetAll()).catch((err) => console.warn("[Shortcuts] persist failed:", err));
                return;
            }
            // ── Ctrl+P / Cmd+P: File search ─────────────────
            if (meta && e.key === "p") {
                e.preventDefault();
                s.setShowFileSearch(true);
                return;
            }
            // ── Ctrl+W / Cmd+W: Close active tab ─────────────
            if (meta && e.key === "w") {
                e.preventDefault();
                const activeFile = ideStore.getState().activeFile;
                if (activeFile) {
                    const tab = ideStore.getState().files.find((f) => f.path === activeFile);
                    if (tab?.dirty) {
                        if (!confirm(t("editor.unsavedConfirm", s.locale)))
                            return;
                    }
                    document.dispatchEvent(new CustomEvent("editor:flush-save", { detail: { path: activeFile } }));
                    ideStore.getState().closeFile(activeFile);
                }
                return;
            }
            // ── Escape: Close modals or cancel rename ────────
            if (e.key === "Escape") {
                if (s.faqOpen) {
                    s.setFaqOpen(false);
                    return;
                }
                if (s.contextOpen) {
                    s.setContextOpen(false);
                    return;
                }
                if (s.settingsOpen) {
                    s.setSettingsOpen(false);
                    return;
                }
                if (s.setShowFileSearch) {
                    s.setShowFileSearch(false);
                    return;
                }
                document.dispatchEvent(new Event("explorer:cancel-rename"));
                return;
            }
            // ── Delete: Delete selected file ─────────────────
            if (e.key === "Delete" && !isInput) {
                document.dispatchEvent(new Event("explorer:delete-selected"));
                return;
            }
            // ── F2: Rename selected file ─────────────────────
            if (e.key === "F2" && !isInput) {
                document.dispatchEvent(new Event("explorer:rename-selected"));
                return;
            }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);
}
