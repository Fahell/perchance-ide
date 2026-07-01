/**
 * RightPanel — file explorer for the Virtual File System.
 *
 * Shows a tree view of all files in the VFS. Click to open in editor.
 * Right-click for rename/delete. "+" button for new file/folder.
 */

import { useEffect, useState } from "preact/hooks";
import { dbSaveVfs } from "../db.js";
import { t, type Locale } from "../i18n/index.js";
import { ideStore } from "../store.js";
import {
  vfsDeleteTree,
  vfsExists, vfsGetAll, vfsMkdir,
  vfsRename,
  vfsTree,
  vfsWrite,
  type VfsTreeNode
} from "../vfs.js";
import { colors, fonts } from "./theme.js";

// ─── Types ──────────────────────────────────────────────────
interface RightPanelProps {
  locale?: Locale;
}

type CtxAction = "rename" | "delete";

// ─── Component ──────────────────────────────────────────────
export function RightPanel({ locale }: RightPanelProps) {
  // Force re-render when store changes (e.g., file opened from editor)
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    return ideStore.subscribe(() => forceUpdate((n) => n + 1));
  }, []);
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

  function refresh() {
    forceUpdate((n) => n + 1);
  }

  // ── Handlers ──────────────────────────────────────────
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
    const name = path.split("/").filter(Boolean).pop() ?? path;
    const ext = path.split(".").pop()?.toLowerCase() ?? "js";
    ideStore.getState().openFile(path, name, ext);
  }

  function handleContextMenu(path: string, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setCtxTarget(path);
    setCtxPos({ x: e.clientX, y: e.clientY });
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

  async function persistVfs() {
    try {
      await dbSaveVfs(vfsGetAll());
    } catch (e) {
      console.warn("[RightPanel] dbSaveVfs failed:", e);
    }
  }

  async function commitRename() {
    if (!renaming || !renameValue.trim()) {
      setRenaming(null);
      return;
    }
    const parts = renaming.split("/").filter(Boolean);
    parts.pop();
    const newPath = "/" + [...parts, renameValue.trim()].join("/");
    if (newPath !== renaming && vfsRename(renaming, newPath)) {
      // Update store tabs that reference the old path
      const state = ideStore.getState();
      for (const f of state.files) {
        if (f.path === renaming) {
          state.removeFile(renaming);
          state.openFile(newPath, renameValue.trim(), newPath.split(".").pop()?.toLowerCase() ?? "js");
        }
      }
      await persistVfs();
      refresh();
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
      vfsWrite(path, "");
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
    await persistVfs();
    refresh();
  }

  async function handleDelete(path: string) {
    vfsDeleteTree(path);
    // Close any open tabs with this path or descendants
    const state = ideStore.getState();
    for (const f of [...state.files]) {
      if (f.path === path || f.path.startsWith(path + "/")) {
        state.closeFile(f.path);
      }
    }
    closeCtxMenu();
    await persistVfs();
    refresh();
  }

  // Close context menu on any click
  useEffect(() => {
    if (!ctxTarget) return;
    const handler = () => closeCtxMenu();
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [ctxTarget]);

  const tree = vfsTree("/");

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: colors.bg, borderLeft: `1px solid ${colors.border}`,
      fontFamily: fonts.mono, fontSize: "11px",
      color: colors.textSecondary, userSelect: "none",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 8px", borderBottom: `1px solid ${colors.border}`,
        color: colors.textMuted, fontSize: "9px", textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}>
        <span>{t("fileExplorer.title", locale) || "files"}</span>
        <div style={{ display: "flex", gap: "2px" }}>
          <button onClick={(e: MouseEvent) => { e.stopPropagation(); startCreate("/", false); }}
            title="New file"
            style={btnStyle}>+</button>
          <button onClick={(e: MouseEvent) => { e.stopPropagation(); startCreate("/", true); }}
            title="New folder"
            style={btnStyle}>+d</button>
        </div>
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "auto", padding: "2px 0" }}>
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
            style={ctxItemStyle}>
            {t("fileExplorer.rename", locale) || "rename"}
          </div>
          <div onClick={(e: MouseEvent) => { e.stopPropagation(); handleDelete(ctxTarget); }}
            style={ctxItemStyle}>
            {t("fileExplorer.delete", locale) || "delete"}
          </div>
        </div>
      )}

      {/* Counter */}
      <div style={{
        borderTop: `1px solid ${colors.border}`,
        padding: "4px 8px", fontSize: "9px",
        color: colors.textMuted,
      }}>
        {t("fileExplorer.count", locale) || "files"}: {countFiles(tree)}
      </div>
    </div>
  );
}

// ─── TreeNode ───────────────────────────────────────────────
function TreeNode({ node, depth, expanded, onToggle, onOpen, onContextMenu, onStartCreate,
  renaming, renameValue, onRenameChange, onRenameCommit, onRenameCancel,
  creatingIn, creatingIsDir, createName, onCreateNameChange, onCreateCommit, onCreateCancel,
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
}) {
  const isDir = node.type === "dir";
  const isExpanded = expanded.has(node.path);
  const isRenaming = renaming === node.path;
  const indent = depth * 14;
  const [rowHover, setRowHover] = useState(false);

  function handleClick() {
    if (isDir) onToggle(node.path);
    else onOpen(node.path);
  }

  return (
    <div>
      <div onClick={handleClick}
        onContextMenu={(e: MouseEvent) => onContextMenu(node.path, e)}
        onMouseEnter={() => setRowHover(true)}
        onMouseLeave={() => setRowHover(false)}
        style={{
          display: "flex", alignItems: "center", gap: "4px",
          padding: "2px 4px 2px 0", paddingLeft: `${8 + indent}px`,
          cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        {/* Arrow / icon */}
        <span style={{ width: "12px", textAlign: "center", flexShrink: 0, color: colors.textMuted }}>
          {isDir ? (isExpanded ? "▾" : "▸") : " "}
        </span>

        {/* Name or rename input */}
        {isRenaming ? (
          <input
            value={renameValue}
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
          }}>
            {node.name}
          </span>
        )}

        {/* Hover create buttons for directories */}
        {isDir && !isRenaming && rowHover && (
          <span style={{ marginLeft: "auto", display: "flex", gap: "2px" }}>
            <button
              onClick={(e: MouseEvent) => { e.stopPropagation(); onStartCreate(node.path, false); }}
              title="New file in this folder"
              style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: "9px", padding: "0 2px", lineHeight: 1 }}>+</button>
            <button
              onClick={(e: MouseEvent) => { e.stopPropagation(); onStartCreate(node.path, true); }}
              title="New subfolder"
              style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: "9px", padding: "0 2px", lineHeight: 1 }}>d</button>
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
