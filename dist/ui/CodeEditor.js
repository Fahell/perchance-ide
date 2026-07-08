import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
/**
 * CodeEditor — tabbed code editor powered by CodeMirror 6.
 *
 * Features:
 * - Multiple open tabs backed by VFS (store)
 * - Syntax highlighting via CM6 language support
 * - New tab / close tab
 * - Auto-save to VFS (debounced 500ms)
 * - Lazy-loaded — CM6 bundle only imported when component mounts
 */
import { Transaction } from "@codemirror/state";
import { useEffect, useRef, useState } from "preact/hooks";
import { getBreadcrumbs } from "../editor/breadcrumbs.js";
import { getEmmetSyntax } from "../editor/emmet-langs.js";
import { getEmmetExtensions } from "../editor/emmet.js";
import { setCurrentView } from "../editor/view-store.js";
import { t } from "../i18n/index.js";
import { ideStore } from "../store.js";
import { getHash, onVfsChange, trackedRename, trackedWrite } from "../vfs-events.js";
import { flushVfsPersist, scheduleVfsPersist } from "../vfs-persist.js";
import { vfsExists, vfsRead } from "../vfs.js";
import { BreadcrumbsBar } from "./BreadcrumbsBar.js";
import { EditorStatusBar, dispatchStatusUpdate } from "./EditorStatusBar.js";
import { colors, fonts } from "./theme.js";
// ─── Helpers ────────────────────────────────────────────────
function getExt(path) {
    return path.split(".").pop()?.toLowerCase() ?? "js";
}
// ─── Component ──────────────────────────────────────────────
export function CodeEditor({ locale }) {
    // Subscribe to Zustand store
    const [store, setStore] = useState(ideStore.getState());
    useEffect(() => {
        return ideStore.subscribe((s) => setStore(s));
    }, []);
    const { files, activeFile } = store;
    const containerRef = useRef(null);
    const viewRef = useRef(null);
    const debounceRef = useRef(null);
    const [pendingCloseFile, setPendingCloseFile] = useState(null);
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const lastSavedHashRef = useRef(null);
    const saveStatusTimerRef = useRef(null);
    const prevActiveRef = useRef(null);
    const mountedRef = useRef(true);
    // Auto-clear save status after a delay (replaces orphan setTimeout calls)
    function scheduleSaveStatusClear(path, delay = 2000) {
        if (saveStatusTimerRef.current)
            clearTimeout(saveStatusTimerRef.current);
        saveStatusTimerRef.current = window.setTimeout(() => {
            if (!mountedRef.current)
                return;
            ideStore.getState().setFileSaveStatus(path, "idle");
            saveStatusTimerRef.current = null;
        }, delay);
    }
    // ── Mount / remount editor when activeFile changes ─────
    useEffect(() => {
        const path = activeFile;
        // If activeFile is null (last tab closed), destroy view and clean up
        if (!path) {
            if (viewRef.current) {
                setCurrentView(null);
                viewRef.current.destroy();
                viewRef.current = null;
            }
            if (containerRef.current) {
                containerRef.current.innerHTML = "";
            }
            prevActiveRef.current = null;
            return;
        }
        if (!containerRef.current)
            return;
        // Save previous file content before switching
        if (prevActiveRef.current && viewRef.current) {
            if (vfsExists(prevActiveRef.current)) {
                const content = viewRef.current.state.doc.toString();
                trackedWrite(prevActiveRef.current, content);
                ideStore.getState().setFileDirty(prevActiveRef.current, false);
                // Use flush instead of schedule — user finished editing this file
                flushVfsPersist();
            }
        }
        prevActiveRef.current = path;
        // Destroy old editor
        if (viewRef.current) {
            setCurrentView(null);
            viewRef.current.destroy();
            viewRef.current = null;
        }
        // Read settings from store (10.4)
        const { fontSize, tabSize, wordWrap } = store.settings;
        // Read content from VFS
        const content = vfsRead(path) ?? "";
        lastSavedHashRef.current = getHash(path) ?? null;
        let cancelled = false;
        (async () => {
            const [{ createEditor }, { getLanguageSupport }] = await Promise.all([
                import("../editor/index.js"),
                import("../editor/langs.js"),
            ]);
            if (cancelled || !containerRef.current)
                return;
            // Lazy-load Emmet for eligible file types (11.5)
            const emmetSyntax = getEmmetSyntax(path);
            const emmetExts = emmetSyntax ? await getEmmetExtensions(emmetSyntax) : [];
            viewRef.current = createEditor({
                parent: containerRef.current,
                doc: content,
                language: getLanguageSupport(path),
                filename: path,
                extraExtensions: emmetExts,
                fontSize,
                tabSize,
                wordWrap,
                onCursorChange: (info) => {
                    dispatchStatusUpdate(info, path);
                    // Update breadcrumbs from cursor position
                    if (viewRef.current) {
                        setBreadcrumbs(getBreadcrumbs(viewRef.current, viewRef.current.state.selection.main.head));
                    }
                },
                onChange: (doc) => {
                    if (!mountedRef.current)
                        return;
                    ideStore.getState().setFileSaveStatus(path, "saving");
                    // Debounce save to VFS
                    if (debounceRef.current)
                        clearTimeout(debounceRef.current);
                    debounceRef.current = window.setTimeout(() => {
                        if (!mountedRef.current)
                            return;
                        // Skip auto-save if disabled in settings
                        if (!ideStore.getState().settings.autoSave)
                            return;
                        trackedWrite(path, doc);
                        lastSavedHashRef.current = getHash(path) ?? null;
                        ideStore.getState().setFileDirty(path, false);
                        ideStore.getState().setFileSaveStatus(path, "saved");
                        ideStore.getState().bumpVfsVersion();
                        scheduleVfsPersist();
                        scheduleSaveStatusClear(path);
                    }, 200);
                    ideStore.getState().setFileDirty(path, true);
                },
            });
            // Populate breadcrumbs for initial cursor position
            // (onCursorChange callback won't fire for initial state)
            setBreadcrumbs(getBreadcrumbs(viewRef.current, viewRef.current.state.selection.main.head));
            // Share view with OutlinePanel (10.1)
            setCurrentView(viewRef.current);
        })();
        return () => {
            cancelled = true;
            setCurrentView(null);
        };
    }, [activeFile, store.settingsVersion]);
    // ── Listen for flush-save event (from Ctrl+S shortcut) ─
    useEffect(() => {
        function handleFlushSave(e) {
            const { path } = e.detail;
            if (!viewRef.current)
                return;
            // Flush debounced write
            if (debounceRef.current)
                clearTimeout(debounceRef.current);
            trackedWrite(path, viewRef.current.state.doc.toString());
            lastSavedHashRef.current = getHash(path) ?? null;
            ideStore.getState().setFileDirty(path, false);
            ideStore.getState().setFileSaveStatus(path, "saved");
            ideStore.getState().bumpVfsVersion();
            scheduleSaveStatusClear(path);
            // Trigger immediate persist
            flushVfsPersist().catch((err) => console.warn("[CodeEditor] flush-save persist failed:", err));
        }
        document.addEventListener("editor:flush-save", handleFlushSave);
        return () => document.removeEventListener("editor:flush-save", handleFlushSave);
    }, []);
    // ── Listen for flush-before-rename event (from TabBar rename) ──
    useEffect(() => {
        function handleFlushBeforeRename(e) {
            const { path } = e.detail;
            if (!viewRef.current)
                return;
            const currentPath = ideStore.getState().activeFile;
            if (path !== currentPath)
                return;
            // Cancel pending debounce and flush buffer to VFS immediately
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
                debounceRef.current = null;
            }
            trackedWrite(path, viewRef.current.state.doc.toString());
            lastSavedHashRef.current = getHash(path) ?? null;
            ideStore.getState().setFileDirty(path, false);
            scheduleVfsPersist();
        }
        document.addEventListener("editor:flush-before-rename", handleFlushBeforeRename);
        return () => document.removeEventListener("editor:flush-before-rename", handleFlushBeforeRename);
    }, []);
    // ── Subscribe to VFS changes (external writes, deletes, renames) ──
    useEffect(() => {
        const unsub = onVfsChange((event) => {
            if (!mountedRef.current)
                return;
            const currentPath = ideStore.getState().activeFile;
            if (!currentPath || !viewRef.current)
                return;
            if (event.type === "deleted") {
                // Close tab if the deleted path matches any open tab
                const deletedPath = event.path;
                const state = ideStore.getState();
                for (const f of [...state.files]) {
                    if (f.path === deletedPath || f.path.startsWith(deletedPath + "/")) {
                        state.closeFile(f.path);
                    }
                }
                return;
            }
            if (event.type === "modified" || event.type === "created") {
                // Only sync if this is the active file and hash differs from our last save
                if (event.path !== currentPath)
                    return;
                if (event.currentHash && event.currentHash === lastSavedHashRef.current)
                    return;
                // External change detected
                const state = ideStore.getState();
                const tab = state.files.find((f) => f.path === currentPath);
                if (tab?.dirty) {
                    // Editor has unsaved changes — mark conflict instead of overwriting
                    state.setConflictedFile(currentPath, {
                        path: currentPath,
                        externalHash: event.currentHash ?? getHash(currentPath) ?? "",
                        timestamp: Date.now(),
                        notified: true,
                    });
                    return;
                }
                // Editor buffer is clean — safe to reload from VFS
                const newContent = vfsRead(currentPath);
                if (newContent === null)
                    return;
                const view = viewRef.current;
                view.dispatch({
                    changes: { from: 0, to: view.state.doc.length, insert: newContent },
                    // Don't add external reloads to undo history — prevents confusing
                    // Ctrl+Z behavior where "undo" jumps past the external change.
                    annotations: [Transaction.addToHistory.of(false)],
                });
                lastSavedHashRef.current = event.currentHash ?? getHash(currentPath) ?? null;
                ideStore.getState().setFileDirty(currentPath, false);
            }
            if (event.type === "renamed") {
                // If the renamed file is currently active, update refs
                if (event.fromPath === currentPath) {
                    prevActiveRef.current = event.toPath ?? null;
                    lastSavedHashRef.current = event.currentHash ?? null;
                }
            }
        });
        return unsub;
    }, []);
    // ── Listen for close-tab requests (from Ctrl+W) ────────
    useEffect(() => {
        function handleCloseTabRequest(e) {
            const { path } = e.detail;
            const tab = files.find((f) => f.path === path);
            if (!tab)
                return;
            if (tab.dirty) {
                if (!store.settings.autoSave) {
                    setPendingCloseFile(path);
                    return;
                }
                if (!confirm(t("editor.unsavedConfirm", locale)))
                    return;
            }
            doCloseFile(path);
        }
        document.addEventListener("editor:request-close-tab", handleCloseTabRequest);
        return () => document.removeEventListener("editor:request-close-tab", handleCloseTabRequest);
    }, [files, store.settings.autoSave, locale, activeFile]);
    // ── Cleanup on unmount ──────────────────────────────────
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            setCurrentView(null);
            if (debounceRef.current)
                clearTimeout(debounceRef.current);
            if (saveStatusTimerRef.current)
                clearTimeout(saveStatusTimerRef.current);
            if (viewRef.current) {
                const currentFile = activeFile;
                if (currentFile) {
                    trackedWrite(currentFile, viewRef.current.state.doc.toString());
                }
                viewRef.current.destroy();
                viewRef.current = null;
            }
            // Flush pending persist on unmount — use race timeout to avoid blocking
            Promise.race([
                flushVfsPersist(),
                new Promise((resolve) => setTimeout(resolve, 1000)),
            ]).catch((e) => console.warn("[CodeEditor] final persist failed:", e));
        };
    }, []);
    // ── Actions ─────────────────────────────────────────────
    function addTab() {
        const count = files.length + 1;
        const name = `untitled-${count}.js`;
        const path = "/" + name;
        if (!vfsExists(path)) {
            trackedWrite(path, "");
            scheduleVfsPersist();
        }
        ideStore.getState().openFile(path, name, "js");
    }
    function doCloseFile(path) {
        if (viewRef.current && path === activeFile && vfsExists(path)) {
            trackedWrite(path, viewRef.current.state.doc.toString());
            scheduleVfsPersist();
        }
        ideStore.getState().closeFile(path);
        setPendingCloseFile(null);
    }
    function closeTab(path, e) {
        e.stopPropagation();
        const tab = files.find((f) => f.path === path);
        if (tab?.dirty) {
            if (!store.settings.autoSave) {
                // Show custom confirmation dialog when auto-save is off
                setPendingCloseFile(path);
                return;
            }
            if (!confirm(t("editor.unsavedConfirm", locale)))
                return;
        }
        doCloseFile(path);
    }
    function handleSaveAndClose() {
        if (pendingCloseFile && viewRef.current && pendingCloseFile === activeFile) {
            trackedWrite(pendingCloseFile, viewRef.current.state.doc.toString());
            scheduleVfsPersist();
        }
        ideStore.getState().closeFile(pendingCloseFile);
        setPendingCloseFile(null);
    }
    function handleCloseAnyway() {
        // Close without saving — VFS retains last saved state
        ideStore.getState().closeFile(pendingCloseFile);
        setPendingCloseFile(null);
    }
    function selectTab(path) {
        if (path === activeFile)
            return;
        ideStore.getState().setActiveFile(path);
    }
    const activeTab = files.find((f) => f.path === activeFile);
    return (_jsxs("div", { style: {
            display: "flex", flexDirection: "column", height: "100%",
            background: colors.bg, borderLeft: `1px solid ${colors.border}`,
        }, children: [_jsx(TabBar, { tabs: files, activeFile: activeFile ?? null, onSelect: selectTab, onClose: closeTab, onAdd: addTab, locale: locale }), activeFile && (_jsx(BreadcrumbsBar, { path: activeFile, symbols: breadcrumbs })), _jsxs("div", { ref: containerRef, style: {
                    flex: 1, overflow: "hidden", position: "relative",
                }, children: [!activeTab && (_jsx("div", { style: {
                            padding: "12px", color: colors.textMuted,
                            fontSize: "11px", fontFamily: fonts.mono,
                        }, children: t("editor.noFiles", locale) || "no files open" })), activeTab && !viewRef.current && (_jsx("div", { style: {
                            padding: "12px", color: colors.textMuted,
                            fontSize: "11px", fontFamily: fonts.mono,
                        }, children: t("editor.loading", locale) || "loading editor..." })), activeFile && store.conflictedFiles[activeFile] && (_jsxs("div", { style: {
                            padding: "8px 12px",
                            background: "#3a2a1a",
                            borderBottom: `1px solid ${colors.border}`,
                            fontSize: "10px", fontFamily: fonts.mono,
                            display: "flex", alignItems: "center", gap: "8px",
                            flexShrink: 0,
                        }, children: [_jsx("span", { style: { color: "#e8a84c" }, children: "\u26A0" }), _jsx("span", { style: { color: colors.text, flex: 1 }, children: "File modified externally while you have unsaved changes" }), _jsx("button", { onClick: () => {
                                    if (!viewRef.current || !activeFile)
                                        return;
                                    // "Keep mine" — overwrite VFS with editor content
                                    const content = viewRef.current.state.doc.toString();
                                    trackedWrite(activeFile, content);
                                    ideStore.getState().resolveConflict(activeFile, "keep");
                                }, style: {
                                    padding: "3px 8px", border: `1px solid ${colors.text}`,
                                    background: "transparent", color: colors.text,
                                    fontSize: "10px", fontFamily: fonts.mono, cursor: "pointer",
                                }, children: "Keep mine" }), _jsx("button", { onClick: () => {
                                    if (!viewRef.current || !activeFile)
                                        return;
                                    // "Accept theirs" — reload editor buffer from VFS
                                    const newContent = vfsRead(activeFile);
                                    if (newContent === null)
                                        return;
                                    viewRef.current.dispatch({
                                        changes: { from: 0, to: viewRef.current.state.doc.length, insert: newContent },
                                        annotations: [Transaction.addToHistory.of(false)],
                                    });
                                    lastSavedHashRef.current = getHash(activeFile) ?? null;
                                    ideStore.getState().setFileDirty(activeFile, false);
                                    ideStore.getState().resolveConflict(activeFile, "accept");
                                }, style: {
                                    padding: "3px 8px", border: `1px solid ${colors.borderEmphasis ?? colors.border}`,
                                    background: "transparent", color: colors.textMuted,
                                    fontSize: "10px", fontFamily: fonts.mono, cursor: "pointer",
                                }, children: "Accept theirs" })] })), pendingCloseFile && (_jsx("div", { style: {
                            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                            background: "rgba(0,0,0,0.85)", zIndex: 100,
                            display: "flex", alignItems: "center", justifyContent: "center",
                        }, children: _jsxs("div", { style: {
                                background: colors.bg, padding: "16px", maxWidth: "300px", width: "90%",
                                border: `1px solid ${colors.border}`,
                            }, children: [_jsx("div", { style: { color: colors.textSecondary, fontSize: "11px", fontFamily: fonts.mono, marginBottom: "12px", letterSpacing: "1px", textTransform: "uppercase" }, children: t("editor.unsavedConfirm", locale) }), _jsxs("div", { style: { display: "flex", gap: "8px", justifyContent: "flex-end" }, children: [_jsx("button", { onClick: handleSaveAndClose, style: {
                                                padding: "6px 10px", border: `1px solid ${colors.text}`,
                                                background: "transparent", color: colors.text,
                                                fontSize: "10px", fontFamily: fonts.mono, cursor: "pointer",
                                            }, children: t("editor.saveAndClose", locale) }), _jsx("button", { onClick: handleCloseAnyway, style: {
                                                padding: "6px 10px", border: `1px solid ${colors.border}`,
                                                background: "transparent", color: colors.textMuted,
                                                fontSize: "10px", fontFamily: fonts.mono, cursor: "pointer",
                                            }, children: t("editor.closeAnyway", locale) }), _jsx("button", { onClick: () => setPendingCloseFile(null), style: {
                                                padding: "6px 10px", border: `1px solid ${colors.border}`,
                                                background: "transparent", color: colors.textMuted,
                                                fontSize: "10px", fontFamily: fonts.mono, cursor: "pointer",
                                            }, children: t("editor.cancel", locale) })] })] }) }))] }), activeFile && _jsx(EditorStatusBar, {})] }));
}
// ─── Tab Bar ────────────────────────────────────────────────
function TabBar({ tabs, activeFile, onSelect, onClose, onAdd, locale }) {
    // Context menu + inline rename state (10.3)
    const [ctxPath, setCtxPath] = useState(null);
    const [ctxPos, setCtxPos] = useState(null);
    const [renamingPath, setRenamingPath] = useState(null);
    const [renameValue, setRenameValue] = useState("");
    // Close context menu on outside click
    useEffect(() => {
        if (!ctxPath)
            return;
        const handler = () => { setCtxPath(null); setCtxPos(null); };
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, [ctxPath]);
    function handleContextMenu(tabPath, e) {
        e.preventDefault();
        e.stopPropagation();
        setCtxPath(tabPath);
        setCtxPos({ x: e.clientX, y: e.clientY });
    }
    function startRename(path) {
        const tab = tabs.find((t) => t.path === path);
        setRenamingPath(path);
        setRenameValue(tab?.name ?? "");
        setCtxPath(null);
        setCtxPos(null);
    }
    function commitRename() {
        if (!renamingPath || !renameValue.trim()) {
            setRenamingPath(null);
            return;
        }
        const parts = renamingPath.split("/").filter(Boolean);
        parts.pop();
        const newPath = "/" + [...parts, renameValue.trim()].join("/");
        if (newPath !== renamingPath) {
            // Flush editor buffer before rename to prevent stale content
            document.dispatchEvent(new CustomEvent("editor:flush-before-rename", {
                detail: { path: renamingPath },
            }));
            // Update VFS entries before telling the store to update tab metadata
            trackedRename(renamingPath, newPath);
            ideStore.getState().renameFile(renamingPath, newPath);
        }
        setRenamingPath(null);
    }
    return (_jsxs("div", { style: {
            display: "flex", alignItems: "center",
            borderBottom: `1px solid ${colors.border}`,
            background: colors.surface1,
            flexShrink: 0, overflowX: "auto", overflowY: "hidden",
            minHeight: "30px",
        }, children: [_jsx("div", { style: { display: "flex", alignItems: "stretch", flex: 1 }, children: tabs.map((tab) => {
                    const isActive = tab.path === activeFile;
                    const ext = getExt(tab.path);
                    const isRenaming = renamingPath === tab.path;
                    return (_jsxs("div", { onClick: () => onSelect(tab.path), onContextMenu: (e) => handleContextMenu(tab.path, e), onDblClick: (e) => { e.stopPropagation(); startRename(tab.path); }, style: {
                            display: "flex", alignItems: "center", gap: "4px",
                            padding: "4px 8px", fontSize: "10px", fontFamily: fonts.mono,
                            color: isActive ? colors.text : colors.textMuted,
                            background: isActive ? colors.bg : "transparent",
                            borderRight: `1px solid ${colors.border}`,
                            cursor: "pointer", userSelect: "none",
                            whiteSpace: "nowrap", minWidth: 0,
                        }, children: [_jsx(LangLabel, { ext: ext }), isRenaming ? (_jsx("input", { value: renameValue, onInput: (e) => setRenameValue(e.currentTarget.value), onKeyDown: (e) => {
                                    if (e.key === "Enter")
                                        commitRename();
                                    if (e.key === "Escape")
                                        setRenamingPath(null);
                                }, onBlur: commitRename, autoFocus: true, onClick: (e) => e.stopPropagation(), style: {
                                    background: colors.inputBg, border: `1px solid ${colors.borderEmphasis}`,
                                    color: colors.text, fontSize: "10px", fontFamily: fonts.mono,
                                    outline: "none", padding: "1px 2px", width: "80px",
                                } })) : (_jsx("span", { children: tab.name })), tab.dirty && (_jsx("span", { style: {
                                    color: colors.textMuted, fontSize: "10px",
                                    width: "6px", height: "6px", borderRadius: "50%",
                                    background: "#888", display: "inline-block",
                                } })), tab.saveStatus === "saving" && (_jsx("span", { style: { color: colors.textMuted, fontSize: "8px", marginLeft: "2px" }, children: t("editor.saving") })), tab.saveStatus === "saved" && (_jsx("span", { style: { color: colors.statusDone, fontSize: "8px", marginLeft: "2px" }, children: t("editor.saved") })), _jsx("span", { onClick: (e) => onClose(tab.path, e), style: {
                                    color: colors.textMuted, fontSize: "10px",
                                    padding: "0 2px", cursor: "pointer", lineHeight: 1,
                                }, children: "\u00D7" })] }, tab.path));
                }) }), ctxPath && ctxPos && (_jsx("div", { style: {
                    position: "fixed", left: ctxPos.x, top: ctxPos.y,
                    background: colors.surface2, border: `1px solid ${colors.borderEmphasis}`,
                    zIndex: 1000, minWidth: "80px",
                    fontSize: "11px", fontFamily: fonts.mono,
                }, children: _jsx("div", { onClick: (e) => { e.stopPropagation(); startRename(ctxPath); }, style: {
                        padding: "4px 10px", cursor: "pointer",
                        color: colors.textSecondary,
                    }, children: t("editor.rename", locale) || "rename" }) })), _jsx("button", { onClick: onAdd, title: "New file", style: {
                    background: "none", border: "none", color: colors.textMuted,
                    padding: "4px 10px", fontSize: "14px", cursor: "pointer",
                    lineHeight: 1, flexShrink: 0,
                }, children: "+" })] }));
}
// ─── Language label ──────────────────────────────────────────
function LangLabel({ ext }) {
    const labels = {
        js: "JS", jsx: "RX", ts: "TS", tsx: "TX",
        json: "{}", html: "<>", htm: "<>", css: "#", md: "MD",
    };
    return _jsx("span", { style: { color: "#555", fontSize: "9px" }, children: labels[ext] ?? "TX" });
}
