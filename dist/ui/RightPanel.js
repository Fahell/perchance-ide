import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "preact/jsx-runtime";
/**
 * RightPanel — file explorer for the Virtual File System.
 *
 * Shows a tree view of all files in the VFS. Click to open in editor.
 * Right-click for rename/delete. "+" button for new file/folder.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import { t } from "../i18n/index.js";
import { ideStore } from "../store.js";
import { serializeProject } from "../utils/vfs-io.js";
import { trackedDelete, trackedWrite } from "../vfs-events.js";
import { flushVfsPersist, scheduleVfsPersist } from "../vfs-persist.js";
import { vfsExists, vfsMkdir, vfsTree } from "../vfs.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { OutlinePanel } from "./OutlinePanel.js";
import { OutputPanel } from "./OutputPanel.js";
import { PreviewPanel } from "./PreviewPanel.js";
import { colors, fonts } from "./theme.js";
// ─── Component ──────────────────────────────────────────────
export function RightPanel({ locale }) {
    // Force re-render when store changes (e.g., file opened from editor)
    const [, forceUpdate] = useState(0);
    useEffect(() => {
        return ideStore.subscribe(() => forceUpdate((n) => n + 1));
    }, []);
    const [expanded, setExpanded] = useState(new Set(["/"]));
    // Inline rename
    const [renaming, setRenaming] = useState(null);
    const [renameValue, setRenameValue] = useState("");
    // Inline new item
    const [creatingIn, setCreatingIn] = useState(null);
    const [creatingIsDir, setCreatingIsDir] = useState(false);
    const [createName, setCreateName] = useState("");
    // Context menu
    const [ctxTarget, setCtxTarget] = useState(null);
    const [ctxPos, setCtxPos] = useState(null);
    // ── Download / Upload refs (11.4) ─────────────────────
    const downloadRef = useRef(null);
    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);
    function refresh() {
        forceUpdate((n) => n + 1);
    }
    // ── Download / Upload handlers (11.4) ──────────────────
    function handleDownload() {
        const json = serializeProject();
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = downloadRef.current;
        if (a) {
            a.href = url;
            a.click();
        }
        window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
    async function handleUploadFile(e) {
        const input = e.target;
        const file = input.files?.[0];
        if (!file)
            return;
        try {
            const content = await file.text();
            trackedWrite("/" + file.name, content);
            ideStore.getState().bumpVfsVersion();
            scheduleVfsPersist();
            refresh();
        }
        catch (err) {
            console.warn("[RightPanel] Upload failed:", err);
        }
        input.value = "";
    }
    async function handleUploadFolder(e) {
        const input = e.target;
        const files = input.files;
        if (!files || files.length === 0)
            return;
        let count = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const relPath = file.webkitRelativePath;
            const parts = relPath.split("/");
            parts.shift(); // Remove top-level folder name
            const vfsPath = "/" + parts.join("/");
            if (!vfsPath || vfsPath === "/")
                continue;
            try {
                const content = await file.text();
                trackedWrite(vfsPath, content);
                count++;
            }
            catch (err) {
                console.warn(`[RightPanel] Failed to upload ${relPath}:`, err);
            }
        }
        if (count > 0) {
            ideStore.getState().bumpVfsVersion();
            scheduleVfsPersist();
            refresh();
        }
        input.value = "";
    }
    // ── Handlers ──────────────────────────────────────────
    function toggleDir(path) {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(path))
                next.delete(path);
            else
                next.add(path);
            return next;
        });
    }
    function openFile(path) {
        if (!vfsExists(path))
            return;
        setSelectedPath(path);
        const name = path.split("/").filter(Boolean).pop() ?? path;
        const ext = path.split(".").pop()?.toLowerCase() ?? "js";
        ideStore.getState().openFile(path, name, ext);
    }
    function handleContextMenu(path, e) {
        e.preventDefault();
        e.stopPropagation();
        setCtxTarget(path);
        // Boundary detection — prevent menu from overflowing viewport
        const MENU_WIDTH = 140;
        const MENU_HEIGHT = 56;
        const PAD = 8;
        let x = e.clientX;
        let y = e.clientY;
        if (x + MENU_WIDTH + PAD > window.innerWidth) {
            x = window.innerWidth - MENU_WIDTH - PAD;
        }
        if (y + MENU_HEIGHT + PAD > window.innerHeight) {
            y = window.innerHeight - MENU_HEIGHT - PAD;
        }
        x = Math.max(PAD, x);
        y = Math.max(PAD, y);
        setCtxPos({ x, y });
    }
    function closeCtxMenu() {
        setCtxTarget(null);
        setCtxPos(null);
    }
    function startRename(path) {
        const name = path.split("/").filter(Boolean).pop() ?? path;
        setRenaming(path);
        setRenameValue(name);
        closeCtxMenu();
    }
    // persistVfs removed — using centralized vfs-persist module
    function commitRename() {
        if (!renaming || !renameValue.trim()) {
            setRenaming(null);
            return;
        }
        const parts = renaming.split("/").filter(Boolean);
        parts.pop();
        const newPath = "/" + [...parts, renameValue.trim()].join("/");
        if (newPath !== renaming) {
            ideStore.getState().renameFile(renaming, newPath);
            refresh();
        }
        setRenaming(null);
    }
    function startCreate(dir, isDir) {
        setCreatingIn(dir);
        setCreatingIsDir(isDir);
        setCreateName("");
    }
    async function commitCreate() {
        if (!creatingIn || !createName.trim()) {
            setCreatingIn(null);
            return;
        }
        const base = creatingIn === "/" ? "/" : creatingIn + "/";
        const path = base + createName.trim();
        if (creatingIsDir) {
            vfsMkdir(path);
        }
        else {
            trackedWrite(path, "");
            const name = createName.trim();
            const ext = path.split(".").pop()?.toLowerCase() ?? "js";
            ideStore.getState().openFile(path, name, ext);
        }
        setExpanded((prev) => {
            const next = new Set(prev);
            next.add(creatingIn);
            return next;
        });
        setCreatingIn(null);
        scheduleVfsPersist();
        refresh();
    }
    // ── Selected path (for keyboard shortcuts) ────────────
    const [selectedPath, setSelectedPath] = useState(null);
    async function handleDelete(path) {
        closeCtxMenu();
        const name = path.split("/").filter(Boolean).pop() ?? path;
        const children = vfsTree(path);
        const isDirectory = children.length > 0;
        const message = isDirectory
            ? `Delete folder "${name}" and all its files?`
            : `Delete file "${name}"?`;
        if (!confirm(message))
            return;
        trackedDelete(path);
        // Close any open tabs with this path or descendants
        const state = ideStore.getState();
        for (const f of [...state.files]) {
            if (f.path === path || f.path.startsWith(path + "/")) {
                state.closeFile(f.path);
            }
        }
        if (selectedPath === path)
            setSelectedPath(null);
        await flushVfsPersist();
        refresh();
    }
    // Close context menu on any click
    useEffect(() => {
        if (!ctxTarget)
            return;
        const handler = () => closeCtxMenu();
        document.addEventListener("click", handler);
        return () => document.removeEventListener("click", handler);
    }, [ctxTarget]);
    // Listen for keyboard shortcut custom events (from AgentPanel)
    useEffect(() => {
        function handleDeleteSelected() {
            const target = selectedPath ?? ideStore.getState().activeFile;
            if (target)
                handleDelete(target);
        }
        function handleRenameSelected() {
            const target = selectedPath ?? ideStore.getState().activeFile;
            if (target)
                startRename(target);
        }
        function handleCancelRename() {
            if (renaming)
                setRenaming(null);
        }
        document.addEventListener("explorer:delete-selected", handleDeleteSelected);
        document.addEventListener("explorer:rename-selected", handleRenameSelected);
        document.addEventListener("explorer:cancel-rename", handleCancelRename);
        return () => {
            document.removeEventListener("explorer:delete-selected", handleDeleteSelected);
            document.removeEventListener("explorer:rename-selected", handleRenameSelected);
            document.removeEventListener("explorer:cancel-rename", handleCancelRename);
        };
    }, [selectedPath, renaming]);
    const tree = vfsTree("/");
    const activeTab = ideStore.getState().rightPanelTab ?? "files";
    return (_jsxs("div", { style: {
            display: "flex", flexDirection: "column", height: "100%",
            background: colors.bg, borderLeft: `1px solid ${colors.border}`,
            fontFamily: fonts.mono, fontSize: "11px",
            color: colors.textSecondary, userSelect: "none",
        }, children: [_jsx("div", { role: "tablist", "aria-label": "Panels", style: {
                    display: "flex", borderBottom: `1px solid ${colors.border}`,
                    flexShrink: 0,
                }, children: ["files", "outline", "preview", "output"].map((tab) => {
                    const label = tab === "files"
                        ? (t("fileExplorer.title", locale) || "files")
                        : tab === "outline"
                            ? (t("outline.title", locale) || "outline")
                            : tab === "preview"
                                ? (t("preview.title", locale) || "preview")
                                : (t("output.title", locale) || "output");
                    return (_jsx("div", { role: "tab", "aria-selected": activeTab === tab, tabIndex: activeTab === tab ? 0 : -1, onClick: () => ideStore.getState().setRightPanelTab(tab), onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            ideStore.getState().setRightPanelTab(tab);
                        } }, style: {
                            padding: "6px 10px", fontSize: "9px", textTransform: "uppercase",
                            letterSpacing: "0.5px", cursor: "pointer", userSelect: "none",
                            color: activeTab === tab ? colors.text : colors.textMuted,
                            background: activeTab === tab ? colors.bg : "transparent",
                            borderBottom: activeTab === tab ? `1px solid ${colors.text}` : "1px solid transparent",
                            marginBottom: "-1px",
                        }, children: label }, tab));
                }) }), activeTab === "files" ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: {
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "4px 8px", borderBottom: `1px solid ${colors.border}`,
                            color: colors.textMuted, fontSize: "9px", textTransform: "uppercase",
                            letterSpacing: "0.5px", flexShrink: 0,
                        }, children: [_jsx("span", { children: t("fileExplorer.title", locale) || "files" }), _jsxs("div", { style: { display: "flex", gap: "2px" }, children: [_jsx("button", { onClick: (e) => { e.stopPropagation(); startCreate("/", false); }, title: "New file", style: btnStyle, children: "+" }), _jsx("button", { onClick: (e) => { e.stopPropagation(); startCreate("/", true); }, title: "New folder", style: btnStyle, children: "+d" })] })] }), _jsxs("div", { role: "tree", "aria-label": "File explorer", style: { flex: 1, overflowY: "auto", overflowX: "auto", padding: "2px 0" }, children: [tree.length === 0 && (_jsx("div", { style: { padding: "12px 8px", color: colors.textMuted, fontSize: "10px", fontStyle: "italic" }, children: t("fileExplorer.empty", locale) || "empty project" })), tree.map((node) => (_jsx(TreeNode, { node: node, depth: 0, expanded: expanded, onToggle: toggleDir, onOpen: openFile, onContextMenu: handleContextMenu, onStartCreate: startCreate, renaming: renaming, renameValue: renameValue, onRenameChange: setRenameValue, onRenameCommit: commitRename, onRenameCancel: () => setRenaming(null), creatingIn: creatingIn, creatingIsDir: creatingIsDir, createName: createName, onCreateNameChange: setCreateName, onCreateCommit: commitCreate, onCreateCancel: () => setCreatingIn(null) }, node.path))), creatingIn === "/" && (_jsx(CreateInput, { isDir: creatingIsDir, value: createName, onChange: setCreateName, onCommit: commitCreate, onCancel: () => setCreatingIn(null) }))] }), ctxTarget && ctxPos && (_jsxs("div", { style: {
                            position: "fixed", left: ctxPos.x, top: ctxPos.y,
                            background: colors.surface2, border: `1px solid ${colors.borderEmphasis}`,
                            zIndex: 1000, minWidth: "100px",
                            fontSize: "11px", fontFamily: fonts.mono,
                        }, children: [_jsx("div", { onClick: (e) => { e.stopPropagation(); startRename(ctxTarget); }, style: ctxItemStyle, children: t("fileExplorer.rename", locale) || "rename" }), _jsx("div", { onClick: (e) => { e.stopPropagation(); handleDelete(ctxTarget); }, style: ctxItemStyle, children: t("fileExplorer.delete", locale) || "delete" })] })), _jsxs("div", { style: {
                            borderTop: `1px solid ${colors.border}`,
                            padding: "4px 8px", fontSize: "9px",
                            color: colors.textMuted,
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                        }, children: [_jsxs("div", { style: { display: "flex", gap: "4px" }, children: [_jsx("a", { ref: downloadRef, download: "project.json", style: { display: "none" } }), _jsx("input", { ref: fileInputRef, type: "file", style: { display: "none" }, onChange: handleUploadFile }), _jsx("input", { ref: folderInputRef, type: "file", webkitdirectory: true, style: { display: "none" }, onChange: handleUploadFolder }), _jsx("button", { onClick: handleDownload, title: t("vfs.download", locale) || "download project", style: btnStyle, children: "\u2B07" }), _jsx("button", { onClick: () => fileInputRef.current?.click(), title: t("vfs.uploadFile", locale) || "upload file", style: btnStyle, children: "\u2B06" }), _jsx("button", { onClick: () => folderInputRef.current?.click(), title: t("vfs.uploadFolder", locale) || "upload folder", style: btnStyle, children: "\u2B06d" })] }), _jsxs("span", { children: [t("fileExplorer.count", locale) || "files", ": ", countFiles(tree)] })] })] })) : activeTab === "outline" ? (_jsx("div", { style: { flex: 1, overflow: "auto" }, children: _jsx(ErrorBoundary, { name: "OutlinePanel", children: _jsx(OutlinePanel, { locale: locale }) }) })) : activeTab === "preview" ? (_jsx("div", { style: { flex: 1, overflow: "auto" }, children: _jsx(ErrorBoundary, { name: "PreviewPanel", children: _jsx(PreviewPanel, { locale: locale }) }) })) : (_jsx("div", { style: { flex: 1, overflow: "auto" }, children: _jsx(ErrorBoundary, { name: "OutputPanel", children: _jsx(OutputPanel, { locale: locale }) }) }))] }));
}
// ─── TreeNode ───────────────────────────────────────────────
function TreeNode({ node, depth, expanded, onToggle, onOpen, onContextMenu, onStartCreate, renaming, renameValue, onRenameChange, onRenameCommit, onRenameCancel, creatingIn, creatingIsDir, createName, onCreateNameChange, onCreateCommit, onCreateCancel, }) {
    const isDir = node.type === "dir";
    const isExpanded = expanded.has(node.path);
    const isRenaming = renaming === node.path;
    const indent = depth * 14;
    const [rowHover, setRowHover] = useState(false);
    function handleClick() {
        if (isDir)
            onToggle(node.path);
        else
            onOpen(node.path);
    }
    return (_jsxs("div", { role: "treeitem", "aria-expanded": isDir ? isExpanded : undefined, children: [_jsxs("div", { onClick: handleClick, onContextMenu: (e) => onContextMenu(node.path, e), onMouseEnter: () => setRowHover(true), onMouseLeave: () => setRowHover(false), style: {
                    display: "flex", alignItems: "center", gap: "4px",
                    padding: "2px 4px 2px 0", paddingLeft: `${8 + indent}px`,
                    cursor: "pointer", whiteSpace: "nowrap",
                }, children: [_jsx("span", { style: { width: "14px", textAlign: "center", flexShrink: 0, color: isDir ? colors.textMuted : fileInfo(node.path).color }, children: isDir ? (isExpanded ? "▾" : "▸") : fileInfo(node.path).icon }), isRenaming ? (_jsx("input", { value: renameValue, "aria-label": "Rename file", onInput: (e) => onRenameChange(e.currentTarget.value), onKeyDown: (e) => {
                            if (e.key === "Enter")
                                onRenameCommit();
                            if (e.key === "Escape")
                                onRenameCancel();
                        }, onBlur: onRenameCommit, autoFocus: true, style: {
                            background: colors.inputBg, border: `1px solid ${colors.borderEmphasis}`,
                            color: colors.text, fontSize: "10px", fontFamily: fonts.mono,
                            outline: "none", padding: "1px 4px", width: "100px",
                        }, onClick: (e) => e.stopPropagation() })) : (_jsx("span", { style: {
                            color: isDir ? colors.textSecondary : colors.text,
                            fontSize: "10px",
                        }, children: node.name })), isDir && !isRenaming && rowHover && (_jsxs("span", { style: { marginLeft: "auto", display: "flex", gap: "2px" }, children: [_jsx("button", { onClick: (e) => { e.stopPropagation(); onStartCreate(node.path, false); }, title: "New file in this folder", style: { background: "none", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: "9px", padding: "0 2px", lineHeight: 1 }, children: "+" }), _jsx("button", { onClick: (e) => { e.stopPropagation(); onStartCreate(node.path, true); }, title: "New subfolder", style: { background: "none", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: "9px", padding: "0 2px", lineHeight: 1 }, children: "d" })] }))] }), isDir && isExpanded && node.children && (_jsxs("div", { children: [node.children.map((child) => (_jsx(TreeNode, { node: child, depth: depth + 1, expanded: expanded, onToggle: onToggle, onOpen: onOpen, onContextMenu: onContextMenu, onStartCreate: onStartCreate, renaming: renaming, renameValue: renameValue, onRenameChange: onRenameChange, onRenameCommit: onRenameCommit, onRenameCancel: onRenameCancel, creatingIn: creatingIn, creatingIsDir: creatingIsDir, createName: createName, onCreateNameChange: onCreateNameChange, onCreateCommit: onCreateCommit, onCreateCancel: onCreateCancel }, child.path))), creatingIn === node.path && (_jsx(CreateInput, { isDir: creatingIsDir, value: createName, onChange: onCreateNameChange, onCommit: onCreateCommit, onCancel: onCreateCancel, depth: depth + 1 }))] }))] }));
}
// ─── Create Input ───────────────────────────────────────────
function CreateInput({ isDir, value, onChange, onCommit, onCancel, depth = 0 }) {
    const indent = depth * 14;
    return (_jsxs("div", { style: {
            display: "flex", alignItems: "center", gap: "4px",
            padding: "2px 4px 2px 0", paddingLeft: `${8 + indent}px`,
        }, children: [_jsx("span", { style: { width: "12px", textAlign: "center", flexShrink: 0, color: colors.textMuted }, children: isDir ? "▸" : " " }), _jsx("input", { value: value, "aria-label": isDir ? "New folder name" : "New file name", onInput: (e) => onChange(e.currentTarget.value), onKeyDown: (e) => {
                    if (e.key === "Enter")
                        onCommit();
                    if (e.key === "Escape")
                        onCancel();
                }, onBlur: onCommit, autoFocus: true, placeholder: isDir ? "folder name" : "file.ts", style: {
                    background: colors.inputBg, border: `1px solid ${colors.borderEmphasis}`,
                    color: colors.text, fontSize: "10px", fontFamily: fonts.mono,
                    outline: "none", padding: "1px 4px", width: "100px",
                } })] }));
}
// ─── Helpers ────────────────────────────────────────────────
function countFiles(tree) {
    let n = 0;
    for (const node of tree) {
        if (node.type === "file")
            n++;
        if (node.children)
            n += countFiles(node.children);
    }
    return n;
}
const btnStyle = {
    background: "none", border: `1px solid ${colors.border}`,
    color: colors.textMuted, cursor: "pointer", fontSize: "9px",
    padding: "1px 5px", lineHeight: "12px",
    borderRadius: "2px",
};
const ctxItemStyle = {
    padding: "4px 10px", cursor: "pointer",
    color: colors.textSecondary,
};
// ─── File icon helper (10.2) ────────────────────────────────
function fileInfo(path) {
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const map = {
        ts: ["TS", "#6b9fff"],
        tsx: ["TX", "#6b9fff"],
        js: ["JS", "#c9a93e"],
        jsx: ["RX", "#c97e3e"],
        json: ["{}", "#c9a93e"],
        html: ["<>", "#c97e3e"],
        htm: ["<>", "#c97e3e"],
        css: ["#", "#e06c9e"],
        scss: ["#", "#e06c9e"],
        md: ["MD", "#888888"],
        py: ["PY", "#6b9fff"],
        txt: ["TX", "#888888"],
        yml: ["YM", "#888888"],
        yaml: ["YM", "#888888"],
        toml: ["TM", "#888888"],
        env: [".e", "#888888"],
        gitignore: [".g", "#555555"],
    };
    const entry = map[ext];
    if (entry)
        return { icon: entry[0], color: entry[1] };
    return { icon: "📄", color: colors.textMuted };
}
