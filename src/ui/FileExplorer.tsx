/**
 * FileExplorer — standalone file explorer for the Virtual File System.
 *
 * Shows a tree view of all files in the VFS. Click to open in editor.
 * Right-click for rename/delete. Buttons for new file/folder.
 * Supports full keyboard navigation.
 *
 * Extracted from RightPanel.tsx for better modularity.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { t, type Locale } from "../i18n/index.js";
import { ideStore } from "../store.js";
import { serializeProject } from "../utils/vfs-io.js";
import { trackedDelete, trackedRename, trackedWrite } from "../vfs-events.js";
import { flushVfsPersist, scheduleVfsPersist } from "../vfs-persist.js";
import {
  vfsExists, vfsMkdir,
  vfsTree,
  type VfsTreeNode,
} from "../vfs.js";
import { colors, fonts } from "./theme.js";
import { ConfirmModal } from "./ConfirmModal.js";

// ─── Types ──────────────────────────────────────────────────
interface FileExplorerProps {
  locale?: Locale;
}

// ─── Component ──────────────────────────────────────────────
export function FileExplorer({ locale }: FileExplorerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["/"]));
  // Inline rename
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  // Inline new item
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [creatingIsDir, setCreatingIsDir] = useState(false);
  const [createName, setCreateName] = useState("");
  // Context menu
  const [ctxTarget, setCtxTarget] = useState<string | null>(null);
  const [ctxPos, setCtxPos] = useState<{ x: number; y: number } | null>(null);
  // Confirm modal for delete
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // ── Download / Upload refs ────────────────────────────
  const downloadRef = useRef<HTMLAnchorElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // Tree keyboard navigation ref
  const treeRef = useRef<HTMLDivElement>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  // Memoize vfsTree call — re-compute only when store vfsVersion changes
  const [vfsVersion, setVfsVersion] = useState(0);
  useEffect(() => {
    return ideStore.subscribe((s) => {
      if (s.vfsVersion !== vfsVersion) setVfsVersion(s.vfsVersion);
    });
  }, [vfsVersion]);

  const tree = useMemo(() => vfsTree("/"), [vfsVersion]);

  // ── Download / Upload handlers ─────────────────────────
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

  async function handleUploadFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      trackedWrite("/" + file.name, content);
      ideStore.getState().bumpVfsVersion();
      scheduleVfsPersist();
    } catch (err) {
      console.warn("[FileExplorer] Upload failed:", err);
    }
    input.value = "";
  }

  async function handleUploadFolder(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    let count = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const relPath = file.webkitRelativePath;
      const parts = relPath.split("/");
      parts.shift();
      const vfsPath = "/" + parts.join("/");
      if (!vfsPath || vfsPath === "/") continue;
      try {
        const content = await file.text();
        trackedWrite(vfsPath, content);
        count++;
      } catch (err) {
        console.warn(`[FileExplorer] Failed to upload ${relPath}:`, err);
      }
    }

    if (count > 0) {
      ideStore.getState().bumpVfsVersion();
      scheduleVfsPersist();
    }
    input.value = "";
  }

  // ── Handlers ───────────────────────────────────────────
  function toggleDir(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function openFile(path: string) {
    if (!vfsExists(path)) return;
    setSelectedPath(path);
    const name = path.split("/").filter(Boolean).pop() ?? path;
    const ext = path.split(".").pop()?.toLowerCase() ?? "js";
    ideStore.getState().openFile(path, name, ext);
  }

  function handleContextMenu(path: string, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setCtxTarget(path);

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

  function startRename(path: string) {
    const name = path.split("/").filter(Boolean).pop() ?? path;
    setRenaming(path);
    setRenameValue(name);
    closeCtxMenu();
  }

  function commitRename() {
    if (!renaming || !renameValue.trim()) {
      setRenaming(null);
      return;
    }
    const parts = renaming.split("/").filter(Boolean);
    parts.pop();
    const newPath = "/" + [...parts, renameValue.trim()].join("/");
    if (newPath !== renaming) {
      trackedRename(renaming, newPath);
      ideStore.getState().renameFile(renaming, newPath);
    }
    setRenaming(null);
  }

  function startCreate(dir: string, isDir: boolean) {
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
    } else {
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
  }

  // ── Tree keyboard navigation ───────────────────────────
  const handleTreeKeyDown = useCallback((e: KeyboardEvent) => {
    const items = treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]');
    if (!items || items.length === 0) return;

    const focused = document.activeElement;
    let currentIndex = -1;
    items.forEach((item, i) => {
      if (item.contains(focused)) currentIndex = i;
    });
    if (currentIndex === -1) currentIndex = 0;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (currentIndex < items.length - 1) {
          const next = items[currentIndex + 1]!.querySelector(":scope > div") as HTMLElement;
          next?.focus();
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (currentIndex > 0) {
          const prev = items[currentIndex - 1]!.querySelector(":scope > div") as HTMLElement;
          prev?.focus();
        }
        break;
      case "ArrowRight":
        e.preventDefault();
        {
          const item = items[currentIndex]!;
          const expanded = item.getAttribute("aria-expanded");
          if (expanded === "false") {
            (item.querySelector(":scope > div") as HTMLElement)?.click();
          }
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        {
          const item = items[currentIndex]!;
          const expanded = item.getAttribute("aria-expanded");
          if (expanded === "true") {
            (item.querySelector(":scope > div") as HTMLElement)?.click();
          }
        }
        break;
      case "Home":
        e.preventDefault();
        {
          const first = items[0]!.querySelector(":scope > div") as HTMLElement;
          first?.focus();
        }
        break;
      case "End":
        e.preventDefault();
        {
          const last = items[items.length - 1]!.querySelector(":scope > div") as HTMLElement;
          last?.focus();
        }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focused) (focused as HTMLElement).click();
        break;
      case "Escape":
        e.preventDefault();
        if (renaming) setRenaming(null);
        if (creatingIn) setCreatingIn(null);
        break;
    }
  }, [renaming, creatingIn]);

  // ── Confirm delete ─────────────────────────────────────
  function handleDeleteStart(path: string) {
    closeCtxMenu();
    setDeleteTarget(path);
  }

  async function handleDeleteConfirm() {
    const path = deleteTarget;
    if (!path) return;
    setDeleteTarget(null);

    trackedDelete(path);
    const state = ideStore.getState();
    for (const f of [...state.files]) {
      if (f.path === path || f.path.startsWith(path + "/")) {
        state.closeFile(f.path);
      }
    }
    if (selectedPath === path) setSelectedPath(null);
    await flushVfsPersist();
  }

  // Close context menu on click outside
  useEffect(() => {
    if (!ctxTarget) return;
    const onClick = () => closeCtxMenu();
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [ctxTarget]);

  // Close context menu on Escape
  useEffect(() => {
    if (!ctxTarget) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCtxMenu();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [ctxTarget]);

  // Listen for keyboard shortcut custom events
  useEffect(() => {
    function handleDeleteSelected() {
      const target = selectedPath ?? ideStore.getState().activeFile;
      if (target) handleDeleteStart(target);
    }
    function handleRenameSelected() {
      const target = selectedPath ?? ideStore.getState().activeFile;
      if (target) startRename(target);
    }
    function handleCancelRename() {
      if (renaming) setRenaming(null);
    }
    function handleNewFile() {
      startCreate("/", false);
    }
    document.addEventListener("explorer:delete-selected", handleDeleteSelected);
    document.addEventListener("explorer:rename-selected", handleRenameSelected);
    document.addEventListener("explorer:cancel-rename", handleCancelRename);
    document.addEventListener("explorer:new-file", handleNewFile);
    return () => {
      document.removeEventListener("explorer:delete-selected", handleDeleteSelected);
      document.removeEventListener("explorer:rename-selected", handleRenameSelected);
      document.removeEventListener("explorer:cancel-rename", handleCancelRename);
      document.removeEventListener("explorer:new-file", handleNewFile);
    };
  }, [selectedPath, renaming]);

  const activeFile = ideStore.getState().activeFile;

  return (
    <>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "4px 8px", borderBottom: `1px solid ${colors.border}`,
        color: colors.textMuted, fontSize: "9px", textTransform: "uppercase",
        letterSpacing: "0.5px", flexShrink: 0,
      }}>
        <span>{t("fileExplorer.title", locale) || "files"}</span>
        <div style={{ display: "flex", gap: "2px" }}>
          <button onClick={(e: MouseEvent) => { e.stopPropagation(); startCreate("/", false); }}
            title="New file"
            style={{...btnStyle, fontSize: "11px"}}>+</button>
          <button onClick={(e: MouseEvent) => { e.stopPropagation(); startCreate("/", true); }}
            title="New folder"
            style={{...btnStyle, fontSize: "10px"}}>+📁</button>
        </div>
      </div>

      {/* Tree */}
      <div role="tree" aria-label="File explorer" tabIndex={0}
        ref={treeRef}
        onKeyDown={handleTreeKeyDown}
        style={{ flex: 1, overflowY: "auto", overflowX: "auto", padding: "2px 0", outline: "none" }}>
        {tree.length === 0 && (
          <div style={{ padding: "12px 8px", color: colors.textMuted, fontSize: "10px", fontStyle: "italic" }}>
            {t("fileExplorer.empty", locale) || "empty project"}
          </div>
        )}
        {tree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            expanded={expanded}
            onToggle={toggleDir}
            onOpen={openFile}
            onContextMenu={handleContextMenu}
            onStartCreate={startCreate}
            renaming={renaming}
            renameValue={renameValue}
            onRenameChange={setRenameValue}
            onRenameCommit={commitRename}
            onRenameCancel={() => setRenaming(null)}
            creatingIn={creatingIn}
            creatingIsDir={creatingIsDir}
            createName={createName}
            onCreateNameChange={setCreateName}
            onCreateCommit={commitCreate}
            onCreateCancel={() => setCreatingIn(null)}
            activeFile={activeFile}
          />
        ))}

        {/* Inline create at root */}
        {creatingIn === "/" && (
          <CreateInput
            isDir={creatingIsDir}
            value={createName}
            onChange={setCreateName}
            onCommit={commitCreate}
            onCancel={() => setCreatingIn(null)}
          />
        )}
      </div>

      {/* Context menu */}
      {ctxTarget && ctxPos && (
        <div style={{
          position: "fixed", left: ctxPos.x, top: ctxPos.y,
          background: colors.surface2, border: `1px solid ${colors.borderEmphasis}`,
          zIndex: 1000, minWidth: "100px",
          fontSize: "11px", fontFamily: fonts.mono,
        }}>
          <div onClick={(e: MouseEvent) => { e.stopPropagation(); startRename(ctxTarget); }}
            style={ctxItemStyle}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = colors.surface1; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            {t("fileExplorer.rename", locale) || "rename"}
          </div>
          <div onClick={(e: MouseEvent) => { e.stopPropagation(); handleDeleteStart(ctxTarget); }}
            style={ctxItemStyle}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = colors.surface1; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            {t("fileExplorer.delete", locale) || "delete"}
          </div>
        </div>
      )}

      {/* Download / Upload toolbar + Counter */}
      <div style={{
        borderTop: `1px solid ${colors.border}`,
        padding: "4px 8px", fontSize: "9px",
        color: colors.textMuted,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", gap: "4px" }}>
          <a ref={downloadRef} download="project.json" style={{ display: "none" }} />
          <input ref={fileInputRef} type="file" style={{ display: "none" }}
            onChange={handleUploadFile} />
          <input ref={folderInputRef} type="file" {...{ webkitdirectory: true }} style={{ display: "none" }}
            onChange={handleUploadFolder} />
          <button onClick={handleDownload}
            title={t("vfs.download", locale) || "download project"}
            style={{...btnStyle, fontSize: "11px"}}>⬇</button>
          <button onClick={() => fileInputRef.current?.click()}
            title={t("vfs.uploadFile", locale) || "upload file"}
            style={{...btnStyle, fontSize: "11px", padding: "1px 4px"}}>📄</button>
          <button onClick={() => folderInputRef.current?.click()}
            title={t("vfs.uploadFolder", locale) || "upload folder"}
            style={{...btnStyle, fontSize: "11px", padding: "1px 4px"}}>📁</button>
        </div>
        <span>{t("fileExplorer.count", locale) || "files"}: {countFiles(tree)}</span>
      </div>

      {/* Delete confirmation modal */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title={t("fileExplorer.delete", locale) || "delete"}
        message={(() => {
          if (!deleteTarget) return "";
          const name = deleteTarget.split("/").filter(Boolean).pop() ?? deleteTarget;
          const children = vfsTree(deleteTarget);
          const isDir = children.length > 0;
          return isDir
            ? `Delete folder "${name}" and all its files?`
            : `Delete file "${name}"?`;
        })()}
        confirmLabel="delete"
        cancelLabel="cancel"
        danger={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

// ─── TreeNode ───────────────────────────────────────────────
function TreeNode({ node, depth, expanded, onToggle, onOpen, onContextMenu, onStartCreate,
  renaming, renameValue, onRenameChange, onRenameCommit, onRenameCancel,
  creatingIn, creatingIsDir, createName, onCreateNameChange, onCreateCommit, onCreateCancel,
  activeFile,
}: {
  node: VfsTreeNode; depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onOpen: (path: string) => void;
  onContextMenu: (path: string, e: MouseEvent) => void;
  onStartCreate: (dir: string, isDir: boolean) => void;
  renaming: string | null;
  renameValue: string;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  creatingIn: string | null;
  creatingIsDir: boolean;
  createName: string;
  onCreateNameChange: (v: string) => void;
  onCreateCommit: () => void;
  onCreateCancel: () => void;
  activeFile: string | null;
}) {
  const isDir = node.type === "dir";
  const isExpanded = expanded.has(node.path);
  const isRenaming = renaming === node.path;
  const isActive = activeFile === node.path;
  const indent = depth * 14;
  const [rowHover, setRowHover] = useState(false);

  function handleClick() {
    if (isDir) onToggle(node.path);
    else onOpen(node.path);
  }

  return (
    <div role="treeitem" aria-expanded={isDir ? isExpanded : undefined}
      aria-selected={isActive || undefined}>
      <div onClick={handleClick}
        onContextMenu={(e: MouseEvent) => onContextMenu(node.path, e)}
        onMouseEnter={() => setRowHover(true)}
        onMouseLeave={() => setRowHover(false)}
        style={{
          display: "flex", alignItems: "center", gap: "4px",
          padding: "2px 4px 2px 0", paddingLeft: `${8 + indent}px`,
          cursor: "pointer", whiteSpace: "nowrap",
          background: isActive ? colors.surface2 : (rowHover ? colors.surface1 : "transparent"),
          transition: "background 0.1s",
          outline: "none",
        }}
        tabIndex={-1}
      >
        {/* Arrow / icon */}
        <span style={{ width: "14px", textAlign: "center", flexShrink: 0, color: isDir ? colors.textMuted : fileInfo(node.path).color }}>
          {isDir ? (isExpanded ? "▾" : "▸") : fileInfo(node.path).icon}
        </span>

        {/* Name or rename input */}
        {isRenaming ? (
          <input
            value={renameValue}
            aria-label="Rename file"
            onInput={(e: any) => onRenameChange(e.currentTarget.value)}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === "Enter") onRenameCommit();
              if (e.key === "Escape") onRenameCancel();
            }}
            onBlur={onRenameCommit}
            autoFocus
            style={{
              background: colors.inputBg, border: `1px solid ${colors.borderEmphasis}`,
              color: colors.text, fontSize: "10px", fontFamily: fonts.mono,
              outline: "none", padding: "1px 4px", width: "100px",
            }}
            onClick={(e: MouseEvent) => e.stopPropagation()}
          />
        ) : (
          <span style={{
            color: isDir ? colors.textSecondary : colors.text,
            fontSize: "10px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "200px",
          }}>
            {node.name}
          </span>
        )}

        {/* Hover create buttons for directories */}
        {isDir && !isRenaming && rowHover && (
          <span style={{ marginLeft: "auto", display: "flex", gap: "2px", flexShrink: 0 }}>
            <button
              onClick={(e: MouseEvent) => { e.stopPropagation(); onStartCreate(node.path, false); }}
              title="New file in this folder"
              style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: "10px", padding: "0 2px", lineHeight: 1, opacity: 0.6 }}>+</button>
            <button
              onClick={(e: MouseEvent) => { e.stopPropagation(); onStartCreate(node.path, true); }}
              title="New subfolder"
              style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: "9px", padding: "0 2px", lineHeight: 1, opacity: 0.6 }}>📁</button>
          </span>
        )}
      </div>

      {/* Children */}
      {isDir && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onOpen={onOpen}
              onContextMenu={onContextMenu}
              onStartCreate={onStartCreate}
              renaming={renaming}
              renameValue={renameValue}
              onRenameChange={onRenameChange}
              onRenameCommit={onRenameCommit}
              onRenameCancel={onRenameCancel}
              creatingIn={creatingIn}
              creatingIsDir={creatingIsDir}
              createName={createName}
              onCreateNameChange={onCreateNameChange}
              onCreateCommit={onCreateCommit}
              onCreateCancel={onCreateCancel}
              activeFile={activeFile}
            />
          ))}
          {/* Inline create inside this directory */}
          {creatingIn === node.path && (
            <CreateInput
              isDir={creatingIsDir}
              value={createName}
              onChange={onCreateNameChange}
              onCommit={onCreateCommit}
              onCancel={onCreateCancel}
              depth={depth + 1}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Create Input ───────────────────────────────────────────
function CreateInput({ isDir, value, onChange, onCommit, onCancel, depth = 0 }: {
  isDir: boolean; value: string; onChange: (v: string) => void;
  onCommit: () => void; onCancel: () => void; depth?: number;
}) {
  const indent = depth * 14;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "4px",
      padding: "2px 4px 2px 0", paddingLeft: `${8 + indent}px`,
    }}>
      <span style={{ width: "12px", textAlign: "center", flexShrink: 0, color: colors.textMuted }}>
        {isDir ? "▸" : " "}
      </span>
      <input
        value={value}
        aria-label={isDir ? "New folder name" : "New file name"}
        onInput={(e: any) => onChange(e.currentTarget.value)}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === "Enter") onCommit();
          if (e.key === "Escape") onCancel();
        }}
        onBlur={onCommit}
        autoFocus
        placeholder={isDir ? "folder name" : "file.ts"}
        style={{
          background: colors.inputBg, border: `1px solid ${colors.borderEmphasis}`,
          color: colors.text, fontSize: "10px", fontFamily: fonts.mono,
          outline: "none", padding: "1px 4px", width: "100px",
        }}
      />
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────
function countFiles(tree: VfsTreeNode[]): number {
  let n = 0;
  for (const node of tree) {
    if (node.type === "file") n++;
    if (node.children) n += countFiles(node.children);
  }
  return n;
}

const btnStyle: Record<string, string> = {
  background: "none", border: `1px solid ${colors.border}`,
  color: colors.textMuted, cursor: "pointer", fontSize: "9px",
  padding: "1px 5px", lineHeight: "12px",
  borderRadius: "2px",
};

const ctxItemStyle: Record<string, string> = {
  padding: "4px 10px", cursor: "pointer",
  color: colors.textSecondary,
};

// ─── File icon helper ───────────────────────────────────────
function fileInfo(path: string): { icon: string; color: string } {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, [string, string]> = {
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
  if (entry) return { icon: entry[0], color: entry[1] };
  return { icon: "📄", color: colors.textMuted };
}
