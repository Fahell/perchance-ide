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
  This repeats (up to 8 iterations) until the LLM gives a final answer.

Tool Calls
  Multiple independent tool calls in one response run in parallel.
  Dependent tools must be called sequentially (wait for result, then call next).
  The agent has timeout (5min) and cancellation (click [Cancel]) support.

Context & Memory
  Last 5 messages always kept in full. Older ones summarized when >6K tokens.
  Key facts are auto-extracted after each exchange ("memories").

Mapper Agent
  After each file change, a subagent maintains <project>/_map/ documentation.
  The main agent uses _map/ summaries to navigate projects without reading full files.
  Index files show dependency graphs, entry points, and file purposes.`,
  },
  {
    id: "file-system",
    title: "File System & Editor",
    content: `Virtual file system (VFS) in memory backed by IndexedDB. PROJECT_ROOT: /home/user

Code Editor
  CodeMirror 6 with syntax highlighting for 10+ languages (JS/TS/JSX/TSX/HTML/CSS/JSON/MD/Python/XML/YAML).
  Emmet support, autocomplete, linting, hover tooltips, and indent guides.
  One Dark Pro dark theme. Configurable font size, tab size, word wrap.

File Explorer (right panel)
  Tree view with create, rename, delete (right-click context menu).
  Upload single files or entire folders via the webkitdirectory picker.
  Download project as ZIP or individual files via right-click → download.

Preview Panel
  Live HTML preview via sandboxed iframe. CSS/JS files linked in HTML are
  auto-inlined from the VFS so separate files render correctly.
  Markdown preview with marked library. Refresh and open-in-new-tab buttons.`,
  },
  {
    id: "tools-reference",
    title: "Tools Reference",
    content: `The agent has 5 tool categories (each can be toggled in Settings):

Web Tools (requires Jina API key)
  web_search       Search the web. Results include URLs + snippets.
  scrape_url       Fetch full page content as markdown.

Context Tools
  search_history   BM25-lite keyword search across conversation history.
  get_messages     Retrieve raw messages by position or count.

VFS Tools
  read_file        Read a file from VFS.
  write_file       Create or overwrite a file. Auto-creates directories.
  edit_file        Partial edit via exact string replacement.
  list_files       Show project tree.
  search_files     Find files by name or content.
  delete_file      Delete file/folder recursively.
  rename_file      Rename or move.

Python Tools (in-browser via Pyodide WebAssembly)
  run_python       Execute Python snippets.
  execute_script   Run a .py file from VFS.
  install_package  Install PyPI packages (numpy, pandas, etc.).

Node.js Tools (via BrowserPod remote runtime, requires API key)
  run_npm_install       Install npm packages.
  run_node_script       Execute a .js/.mjs file.
  execute_npm_command   Run npm/npx commands (test, build).
  run_shell_command     Execute safe Bash commands (ls, cat, grep, curl, mkdir, git).
  run_git_command       Git operations (status, diff, add, commit, branch).
  start_http_server     Start HTTP server with public URL via BrowserPod portal.`,
  },
  {
    id: "node-execution",
    title: "Node.js & Shell",
    content: `Node.js runs remotely via BrowserPod (requires API key from console.browserpod.io).

How It Works
  BrowserPod boots a Node.js 22 environment in the cloud.
  Files are auto-synced between the local VFS and the Pod filesystem.
  VFS → Pod sync happens before each command. Pod → VFS pull happens after.
  The pod disk persists across page reloads (same storageKey).

Interactive Terminal
  The terminal panel ([terminal] button in editor footer) opens an interactive bash
  shell connected to the Pod. Type commands directly — ls, node, npm, git, etc.
  Files created in the terminal are synced back to the VFS when the panel closes.
  Resizable (drag handle) with close button.

Shell Tools
  run_shell_command: Whitelist-enforced Bash (safe commands only).
  run_git_command: Git operations (push/fetch/remote blocked for safety).
  start_http_server: Get a public URL for any HTTP server running in the Pod.`,
  },
  {
    id: "layout-ui",
    title: "Layout & UI",
    content: `The IDE has a 3-column layout with collapsible panels:

Left Panel (Chat)
  Conversation with the agent. Messages, tool call cards, thinking indicator.
  [new] archives current conversation and starts fresh.
  [hist] opens archived conversations — reopen or delete old chats.
  [=] opens Settings. [ctx] opens Context Viewer (token budget visualization).
  Resizable width — drag the edge between chat and editor.
  Collapsible with the ◀ button.

Middle (Editor)
  Tabbed CodeMirror editor. Status bar with line/column, dirty count.
  [terminal] button toggles the interactive terminal panel.
  Auto-save status indicator.

Right Panel
  Vertical icon sidebar: 📁 Files | ◎ Outline | ▶ Preview | >_ Output.
  Each panel resizable — drag the handle between editor and right panel.

Modals
  Settings (Ctrl+,): API keys, language, auto-save, tool toggles.
  Context Viewer (Ctrl+I): Token budget, summaries, memories.
  FAQ (?): Help system (this).
  File Search (Ctrl+P): Fuzzy file name search.`,
  },
  {
    id: "settings",
    title: "Settings & Customization",
    content: `Access via [=] button in chat footer or Ctrl+, shortcut.

Language
  Choose from 5 locales: English, Português, Español, 日本語, 中文.

Jina API Key
  Required for web search. Get free key at jina.ai.
  Stored locally in localStorage, never sent anywhere.

BrowserPod API Key
  Required for Node.js/shell tools and interactive terminal.
  Get key at console.browserpod.io.

Auto-Save
  When enabled, saves files 500ms after the last edit.
  When disabled, save manually with Ctrl+S or by switching tabs.

Agent Tools
  Toggle entire tool categories on/off. Disabled tools are:
  - Hidden from the agent's system prompt
  - Blocked at execution time with a clear error message

Editor
  Font size (10-24px), tab size (2/4/8), word wrap on/off.`,
  },
  {
    id: "tips",
    title: "Tips & Troubleshooting",
    content: `Common Issues

  Agent not responding    Make sure ai-text-plugin is imported in your list panel:
                          agentAi = {import:ai-text-plugin}
                          Then reload the generator.

  Web search failing      Verify your Jina API key in Settings.
                          The key should start with "jina_".

  Python errors           Use install_package first before importing third-party libs.
                          Check the Output tab for full error messages.

  Node.js not working     Enable Node.js tools in Settings and add a BrowserPod API key.
                          The terminal panel shows connection status.

  File tree not updating  Files created by the agent or editor should appear
                          automatically. If not, switch tabs to refresh.

Best Practices

  Be specific in requests. The agent has tool-calling loop with 8 max iterations.
  Let the agent navigate first — it reads _map/ docs before touching files.
  Use [new] to archive conversations when switching topics.
  Check the Context Viewer (Ctrl+I) to see token usage and memories.
  Download your project as ZIP (⬇ button) regularly as backup.`,
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
