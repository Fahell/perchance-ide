/**
 * FaqModal — topic-based help system with sidebar navigation.
 *
 * Replaces the old static FAQ with a two-column layout:
 * - Left sidebar: clickable topic list
 * - Right panel: content of the selected topic
 *
 * Content is in English for simplicity (not i18n'd).
 * The title is still translated via t("faq.title", locale).
 */

import { useState } from "preact/hooks";
import { t, type Locale } from "../i18n/index.js";
import { Modal } from "./Modal.js";
import { colors, fonts } from "./theme.js";

interface FaqModalProps {
  isOpen: boolean;
  locale?: Locale;
  onClose: () => void;
}

// ─── Help Topics ────────────────────────────────────────────
interface HelpTopic {
  id: string;
  title: string;
  content: string;
}

const HELP_TOPICS: HelpTopic[] = [
  {
    id: "how-it-works",
    title: "How the Agent Works",
    content: `The agent uses Perchance's ai-text-plugin internally. Here's the flow:

Agent Loop
  Your message is sent to the LLM with context (recent messages + summary).
  The LLM responds, possibly with <tool_call> XML tags.
  Tool calls are detected and executed — results go back to the LLM.
  This repeats until the LLM gives a final answer (you can cancel at any time).

Tool Calls
  The LLM outputs <tool_call name="tool_name">{"args"}</tool_call> on its own line.
  Multiple independent tool calls can run in parallel.
  Tools that depend on each other's results must be called sequentially.

Context Management
  The last 5 messages are always kept in full.
  When the total exceeds 6000 tokens, older messages get summarized.
  Summaries are stored in IndexedDB and persist across sessions.

Memory Extraction
  Key facts from conversations are automatically extracted in the background.
  These "memories" are included in the context on future interactions.`,
  },
  {
    id: "file-system",
    title: "File System & Editor",
    content: `The project uses a virtual file system (VFS) in memory backed by IndexedDB.

CodeMirror 6 Editor
  Tabbed editor with syntax highlighting for JS, TS, JSX, TSX, JSON, HTML, CSS, Markdown, and Python.
  Emmet support for HTML, CSS, and JSX.
  Configurable font size, tab size, and word wrap (via editor settings).

Tabs
  Open files by clicking in the explorer (right panel).
  Close with the × button, Ctrl+W, or middle-click.
  Files with unsaved changes show a small dot indicator.
  Double-click a tab to rename it inline.

Saving
  Auto-save writes to VFS 500ms after the last edit (can be disabled in Settings).
  Ctrl+S flushes pending writes immediately.
  Tab switches and tab closes also trigger a save.
  The entire VFS is persisted to IndexedDB.`,
  },
  {
    id: "tools-reference",
    title: "Tools Reference",
    content: `The agent has tools organized in four categories:

Web Tools
  web_search       Search the web via Jina.ai (requires API key). Up to 5 results.
  scrape_url       Fetch full text content from a URL as markdown.

Context Tools
  search_history   Keyword search in conversation history (BM25-lite).
  get_messages     Retrieve messages by index range or count.

VFS Tools
  read_file        Read a file from the VFS (max 5000 chars).
  write_file       Create or overwrite a file. Auto-creates directories.
  edit_file        Make partial edits by searching and replacing text.
  list_files       Show directory tree with icons.
  search_files     Find files by name or content (case-insensitive).
  delete_file      Delete a file or folder (recursive).
  rename_file      Rename or move a file or folder.

Terminal Tools
  run_python       Execute Python code via Pyodide (WebAssembly).
  execute_script   Run a .py file from the VFS.
  install_package  Install Python packages (numpy, pandas, etc.).`,
  },
  {
    id: "python-execution",
    title: "Python Execution",
    content: `Python runs entirely in the browser via Pyodide (WebAssembly).

How It Works
  Python code is executed in a Pyodide runtime loaded on first use.
  No external server needed — everything runs client-side.
  The VFS is synced to Pyodide's filesystem before execution and synced back after.

Available Tools
  run_python       Execute a Python snippet directly. Use for quick calculations.
  execute_script   Run a .py file from the VFS. Use for existing scripts.
  install_package  Install packages from PyPI (e.g., numpy, pandas, requests).

Output
  Both stdout and stderr are captured and returned with the exit code.
  Outputs appear in the Output tab (right panel, bottom).
  Each execution gets a timestamped, expandable card.
  Max 20 entries are kept (newest first).`,
  },
  {
    id: "settings",
    title: "Settings & Customization",
    content: `Available settings in the Settings panel ([=] button):

Language
  Choose from 5 locales: English, Portuguese, Spanish, Japanese, Chinese.
  Changes the UI labels throughout the panels.

Jina API Key
  Required for the agent's web search tool.
  Get a free key at jina.ai.
  Your key is stored locally in localStorage and never shared.

Auto-Save
  Toggle automatic saving of file edits after 500ms of inactivity.
  When disabled, save manually with Ctrl+S or by switching tabs.

Agent Tools
  Enable or disable entire tool categories (Web, Context, VFS, Terminal).
  The agent's system prompt only lists enabled tools.
  Disabled tools cannot be called by the agent.`,
  },
  {
    id: "tips",
    title: "Tips & Troubleshooting",
    content: `Common Issues

  Agent not responding    Make sure ai-text-plugin is imported in your list panel:
                          agentAi = {import:ai-text-plugin}
                          Then reload the generator.

  Web search failing      Verify your Jina API key in Settings (bottom of left panel).
                          The key should start with "jina_".

  Python errors           Use install_package first before importing third-party libraries.
                          Check the Output tab for full error messages.

  Files not saving        Check if auto-save is enabled in Settings.
                          Use Ctrl+S to force an immediate save.
                          Tab switches also trigger saves.

Best Practices

  Be specific in your requests to the agent.
  Good: "Search for recent TypeScript 5.8 features"
  Avoid: "Search for something about TypeScript"

  Use the editor to prepare files before asking the agent.
  The agent can read, write, and edit files based on your requests.

  Check the Output tab for Python execution results.
  stdout/stderr are captured and displayed as formatted cards.

  Use context tools when referencing earlier conversation.
  The agent can search history or retrieve specific messages.`,
  },
];

// ─── Help Topic Content Renderer ────────────────────────────
function renderContent(text: string) {
  const lines = text.split("\n");
  const elements: preact.VNode[] = [];
  let inList = false;

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed === "") {
      if (inList) { inList = false; }
      elements.push(<div key={i} style={{ height: "6px" }} />);
    } else if (trimmed.startsWith("- ")) {
      inList = true;
      elements.push(
        <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "4px", lineHeight: "1.5" }}>
          <span style={{ color: colors.textMuted }}>•</span>
          <span style={{ color: colors.text, fontSize: "10px", fontFamily: fonts.mono, lineHeight: "1.5" }}>
            {trimmed.slice(2)}
          </span>
        </div>
      );
    } else if (trimmed.endsWith(":") && !trimmed.includes("  ")) {
      // Sub-header line
      elements.push(
        <div key={i} style={{ color: colors.textSecondary, fontSize: "11px", fontWeight: "600", marginTop: "8px", marginBottom: "4px", lineHeight: "1.4", fontFamily: fonts.mono }}>
          {trimmed}
        </div>
      );
    } else if (trimmed.includes("  ") && !trimmed.startsWith("    ")) {
      // Definition-style lines with double space separator
      const parts = trimmed.split(/\s{2,}/);
      elements.push(
        <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "3px", lineHeight: "1.5" }}>
          {parts.length >= 2 ? (
            <>
              <span style={{ color: colors.text, fontSize: "10px", fontFamily: fonts.mono, minWidth: "150px", fontWeight: "600" }}>
                {parts[0]}
              </span>
              <span style={{ color: colors.textMuted, fontSize: "10px", fontFamily: fonts.mono, lineHeight: "1.5" }}>
                {parts.slice(1).join("  ")}
              </span>
            </>
          ) : (
            <span style={{ color: colors.text, fontSize: "10px", fontFamily: fonts.mono, lineHeight: "1.5" }}>
              {trimmed}
            </span>
          )}
        </div>
      );
    } else {
      inList = false;
      elements.push(
        <div key={i} style={{ color: colors.text, fontSize: "10px", fontFamily: fonts.mono, lineHeight: "1.5", marginBottom: "2px" }}>
          {trimmed}
        </div>
      );
    }
  });

  return elements;
}

// ─── Component ──────────────────────────────────────────────
export function FaqModal({ isOpen, locale, onClose }: FaqModalProps) {
  const [activeId, setActiveId] = useState(HELP_TOPICS[0].id);
  const activeTopic = HELP_TOPICS.find((t) => t.id === activeId) ?? HELP_TOPICS[0];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("faq.title", locale) || "help"} wide>
      <div style={{
        display: "flex",
        gap: "0",
        fontFamily: fonts.mono,
        minHeight: "320px",
      }}>
        {/* ── Sidebar ───────────────────────────────────── */}
        <div style={{
          width: "130px",
          minWidth: "130px",
          borderRight: `1px solid ${colors.border}`,
          padding: "4px 0",
          overflowY: "auto",
          flexShrink: 0,
        }}>
          {HELP_TOPICS.map((topic) => (
            <div
              key={topic.id}
              role="button"
              tabIndex={0}
              aria-selected={topic.id === activeId}
              onClick={() => setActiveId(topic.id)}
              onKeyDown={(e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveId(topic.id); } }}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                fontSize: "10px",
                color: topic.id === activeId ? colors.text : colors.textMuted,
                background: topic.id === activeId ? colors.surface2 : "transparent",
                borderLeft: topic.id === activeId ? `2px solid ${colors.text}` : "2px solid transparent",
                transition: "all 0.15s",
                userSelect: "none",
                lineHeight: "1.3",
              }}
            >
              {topic.title}
            </div>
          ))}
        </div>

        {/* ── Content Panel ─────────────────────────────── */}
        <div style={{
          flex: "1",
          padding: "8px 14px",
          overflowY: "auto",
          maxHeight: "400px",
        }}>
          <div style={{ color: colors.textSecondary, fontSize: "11px", fontWeight: "600", marginBottom: "8px", lineHeight: "1.4", fontFamily: fonts.mono }}>
            {activeTopic.title}
          </div>
          {renderContent(activeTopic.content)}
        </div>
      </div>
    </Modal>
  );
}
