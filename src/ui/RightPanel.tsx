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
    vfsTree,
    vfsWrite,
    type VfsTreeNode
} from "../vfs.js";
import { OutlinePanel } from "./OutlinePanel.js";
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
    setSelectedPath(path);
    const name = path.split("/").filter(Boolean).pop() ?? path;
    const ext = path.split(".").pop()?.toLowerCase() ?? "js";
    ideStore.getState().openFile(path, name, ext);
  }

  function handleContextMenu(path: string, e: MouseEvent) {
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

  // ── Selected path (for keyboard shortcuts) ────────────
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  async function handleDelete(path: string) {
    closeCtxMenu();

    const name = path.split("/").filter(Boolean).pop() ?? path;
    const children = vfsTree(path);
    const isDirectory = children.length > 0;

    const message = isDirectory
      ? `Delete folder "${name}" and all its files?`
      : `Delete file "${name}"?`;

    if (!confirm(message)) return;

    vfsDeleteTree(path);
    // Close any open tabs with this path or descendants
    const state = ideStore.getState();
    for (const f of [...state.files]) {
      if (f.path === path || f.path.startsWith(path + "/")) {
        state.closeFile(f.path);
      }
    }
    if (selectedPath === path) setSelectedPath(null);
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

  // Listen for keyboard shortcut custom events (from AgentPanel)
  useEffect(() => {
    function handleDeleteSelected() {
      const target = selectedPath ?? ideStore.getState().activeFile;
      if (target) handleDelete(target);
    }
    function handleRenameSelected() {
      const target = selectedPath ?? ideStore.getState().activeFile;
      if (target) startRename(target);
    }
    function handleCancelRename() {
      if (renaming) setRenaming(null);
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
  const activeTab: "files" | "outline" = (ideStore.getState() as any).rightPanelTab ?? "files";

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: colors.bg, borderLeft: `1px solid ${colors.border}`,
      fontFamily: fonts.mono, fontSize: "11px",
      color: colors.textSecondary, userSelect: "none",
    }}>
      {/* Tab bar: Files | Outline */}
      <div style={{
        display: "flex", borderBottom: `1px solid ${colors.border}`,
        flexShrink: 0,
      }}>
        {["files", "outline"].map((tab) => (
          <div key={tab}
            onClick={() => (ideStore.getState() as any).setRightPanelTab(tab)}
            style={{
              padding: "6px 10px", fontSize: "9px", textTransform: "uppercase",
              letterSpacing: "0.5px", cursor: "pointer", userSelect: "none",
              color: activeTab === tab ? colors.text : colors.textMuted,
              background: activeTab === tab ? colors.bg : "transparent",
              borderBottom: activeTab === tab ? `1px solid ${colors.text}` : "1px solid transparent",
              marginBottom: "-1px",
            }}>
            {tab === "files"
              ? (t("fileExplorer.title", locale) || "files")
              : (t("outline.title", locale) || "outline")}
          </div>
        ))}
      </div>

      {activeTab === "files" ? (
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
        </>
      ) : (
        <div style={{ flex: 1, overflow: "auto" }}>
          <OutlinePanel locale={locale} />
        </div>
      )}
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
        <span style={{ width: "14px", textAlign: "center", flexShrink: 0, color: isDir ? colors.textMuted : fileInfo(node.path).color }}>
          {isDir ? (isExpanded ? "▾" : "▸") : fileInfo(node.path).icon}
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

// ─── File icon helper (10.2) ────────────────────────────────
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
