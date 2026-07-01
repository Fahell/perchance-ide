# perchance-ide

Standalone AI agent generator for [Perchance](https://perchance.org), powered by [ai-text-plugin](https://perchance.org/ai-text-plugin).

TypeScript project bundled with esbuild into a single JS file, served via jsDelivr CDN.

## Quick Start

### 1. Create a Perchance generator

Make a new generator on Perchance and set up an HTML panel with:

```html
<!-- HTML Panel -->
<script>
  import("https://cdn.jsdelivr.net/gh/Fahell/perchance-ide@<COMMIT>/dist/agent.js");
</script>
```

### 2. Add ai-text-plugin to your list panel

```
agentAi = {import:ai-text-plugin}
```

Replace `<COMMIT>` with the latest commit hash (auto-generated in `IMPORT.md` after each deploy).

### Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Deploy (build + push + generate IMPORT.md)
pnpm deploy

# Watch mode
pnpm dev
```

### Generator scaffolding

The `generator/` folder contains templates you can adapt:

- `generator/list-panel.txt` — minimal list panel with ai-text-plugin import
- `generator/html-template.html` — minimal HTML panel that loads the agent bundle

## Features

- **AI agent with tools** — web search, page scraping, context management
- **Tool-calling agent loop** — AI outputs `<tool_call>` XML, custom code executes and feeds results back (up to 8 iterations)
- **Context window management** — token-aware summarization with 3-tier architecture (hot/warm/cold)
- **Context tools** — agent can query its own history via `search_history` (BM25-lite) and `get_messages` (index retrieval)
- **Persistent memory** — extracts timeless facts from conversations, stored across sessions via IndexedDB
- **Custom message store** — in-memory message history persisted to IndexedDB (via `idb` v8)
- **IndexedDB persistence** — messages, memories, and summaries stored in IndexedDB for reliable cross-session persistence
- **Zustand state management** — vanilla Zustand store for IDE state (active file, editor history, layout, settings)
- **i18n** — 5 languages (English, Português, Español, 日本語, 中文)
- **Monochrome dark UI** — Preact-based 3-column panel with chat sidebar, code editor, and placeholder right panel
- **FAQ panel** — built-in info modal with project links and usage notes
- **VFS agent tools** — read, write, search, list, delete, and rename files in a virtual file system
- **Python execution via Pyodide** — run Python snippets, execute `.py` files from VFS, install packages via micropip (lazy-loaded, ~3.5MB gzip, 2-6s cold start)

## Architecture

```
src/
├── index.ts              # Entry point — bootstrap, agent orchestration, send handler
├── agent-loop.ts         # Core agent loop — tool call detection, instruction building, window.ai calls
├── context-manager.ts    # Token-aware context building, summarization, chunked summaries (IndexedDB)
├── db.ts                 # IndexedDB persistence layer (idb v8) — messages + kv stores
├── memory.ts             # Persistent memory extraction and retrieval (IndexedDB)
├── message-store.ts      # In-memory message cache + async IndexedDB persistence
├── storage.ts            # localStorage wrapper for small config (API key, panel mode, locale)
├── store.ts              # Zustand vanilla store — IDE state management
├── types.ts              # Perchance API types + window.ai type declarations
│
├── tools/
│   ├── index.ts          # Tool registry + initContextTools()
│   ├── context-tools.ts  # search_history (BM25-lite) + get_messages tools
│   ├── vfs-tools.ts      # read_file, write_file, list_files, search_files, delete_file, rename_file
│   ├── terminal-tools.ts # run_python, execute_script, install_package
│   └── web-search.ts     # Jina API integration (search + scrape)
│
├── terminal/
│   └── pyodide.ts        # Pyodide loader + VFS→MEMFS sync bridge
│
├── i18n/
│   ├── dict.ts           # Translation dictionaries (5 locales)
│   └── index.ts          # t() function, locale detection, persistence
│
└── ui/
    ├── AgentPanel.tsx     # Main panel — 3-column layout, state, modal management
    ├── Header.tsx         # Top bar with version + FAQ button
    ├── Footer.tsx         # Input bar + settings/context buttons
    ├── MessageList.tsx    # Scrollable message container
    ├── UserMessage.tsx    # User message bubble
    ├── AgentMessage.tsx   # Agent response with tool call cards
    ├── ResponseText.tsx   # Markdown rendering + expand/collapse
    ├── ToolCallCard.tsx   # Collapsible tool call display
    ├── ThinkingIndicator.tsx  # Animated thinking dots
    ├── ScrollFAB.tsx      # Scroll-to-bottom floating button
    ├── SettingsModal.tsx  # API key, panel mode, language settings
    ├── ContextViewer.tsx  # Context visualization (tokens, tiers, search, memories)
    ├── FaqModal.tsx       # FAQ modal with project info
    ├── CodeEditor.tsx     # Code/text editor panel (middle column)
    ├── RightPanel.tsx     # Placeholder panel (right column, coming soon)
    ├── SetupScreen.tsx    # Initial API key setup wizard
    ├── theme.ts           # Monochrome color palette + fonts
    ├── markdown.ts        # Minimal markdown → HTML renderer
    ├── animations.ts      # Keyframe animations (pulse, glow, scroll)
    └── types.ts           # UI-specific types (PanelMessage, ToolCallEntry, etc.)
```

## Context Management

The agent uses a **3-tier context architecture** to manage conversation history efficiently:

```
┌─────────────────────────────────────────────────────┐
│  HOT — always in prompt (~1200 tokens)              │
│  Last 5 messages + rolling summary + key facts      │
├─────────────────────────────────────────────────────┤
│  WARM — accessible via search_history tool          │
│  Chunked summaries of older conversation blocks     │
│  BM25-lite keyword search across all history        │
├─────────────────────────────────────────────────────┤
│  COLD — accessible via get_messages tool            │
│  Full raw message history                         │
│  Index-based retrieval (by position or count)       │
└─────────────────────────────────────────────────────┘
```

- **Summarization** triggers automatically when conversation exceeds 3K token budget
- **Memory extraction** runs in background after each exchange, capturing timeless facts (max 20)
- **Context tools** let the agent search its own history when the user references earlier conversation
- **ContextViewer** modal visualizes token usage, tiers, chunks, and memories
- **Custom message store** — messages stored in memory + persisted to IndexedDB (via `db.ts`)

## Message Flow

```
User sends message
    │
    ├──→ handleSendMessage()
    │    ├─ addMessage() → stores in custom message store
    │    ├─ buildContext() → token-aware summarization + recent messages
    │    ├─ formatMemories() → injects key facts
    │    ├─ agentLoop() → window.ai() call with tool instructions
    │    │   ├─ Agent uses web_search / scrape_url for real-time data
    │    │   ├─ Agent uses search_history / get_messages for older context
    │    │   └─ Up to 8 tool-call iterations
    │    ├─ addMessage() → stores agent response
    │    └─ extractMemories() → background fact extraction
    │
    └──→ Response shown in Preact sidebar panel
```

## Key Perchance APIs

| API | Purpose | Notes |
|-----|---------|-------|
| `window.ai()` / `root.ai()` | Call LLM via ai-text-plugin | Single API for all LLM operations |

## Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `web_search` | Search the web via Jina AI | `{ query: string }` |
| `scrape_url` | Fetch full page content as markdown | `{ url: string, maxChars?: number }` |
| `search_history` | Search conversation history by keyword (BM25-lite) | `{ query: string }` |
| `get_messages` | Retrieve messages by position or count | `{ count?: number, from?: number, to?: number }` |
| `read_file` | Read file contents from VFS | `{ path: string }` |
| `write_file` | Create or overwrite a file in VFS | `{ path: string, content: string }` |
| `list_files` | Show project tree structure | `{ path?: string }` |
| `search_files` | Search files by name or content | `{ query: string, mode?: "name" \| "content" }` |
| `delete_file` | Delete a file or folder recursively | `{ path: string }` |
| `rename_file` | Rename or move a file/folder | `{ source: string, dest: string }` |
| `run_python` | Execute a Python snippet, returns stdout/stderr | `{ code: string }` |
| `execute_script` | Run a `.py` file from VFS | `{ path: string }` |
| `install_package` | Install a Python package via micropip | `{ name: string }` |

## Storage API

The project uses two persistence layers with different scopes:

### localStorage (small config)

Via `src/storage.ts` — preserved for small user settings:

| Function | Description |
|----------|-------------|
| `storageGet<T>(key)` | Get a value by key |
| `storageSet<T>(key, value)` | Set a value by key |
| `storageDel(key)` | Delete a key |
| `storageHas(key)` | Check if key exists |
| `storageKeys()` | List all keys |
| `storageClear()` | Remove all data |

All keys use the `agent:` prefix internally to avoid collisions. Stores: API key, panel mode, UI locale, input enabled state.

### IndexedDB (messages, memories, summaries)

Via `src/db.ts` — powered by [`idb`](https://github.com/jakearchibald/idb) v8, with two object stores:

| Store | Key | Contents |
|-------|-----|----------|
| `messages` | auto-increment `id` | Chat message history (indexed by `timestamp`) |
| `kv` | `key` string | Generic key-value: memories, summaries, chunks |

**Messages API:**

| Function | Description |
|----------|-------------|
| `dbAddMessage(msg)` | Insert a message, returns new id |
| `dbGetAllMessages()` | Retrieve all messages |
| `dbGetLastN(n)` | Get the last N messages |
| `dbGetMessageCount()` | Total message count |
| `dbClearMessages()` | Delete all messages |
| `dbGetMessagesByRange(from, to?)` | Query by timestamp range |

**Key-Value API:**

| Function | Description |
|----------|-------------|
| `dbKvGet<T>(key)` | Get a value by key |
| `dbKvSet(key, value)` | Set a value by key |
| `dbKvDel(key)` | Delete a key |
| `dbKvClear()` | Remove all KV entries |
| `dbKvKeys()` | List all keys |

Both stores share a single IndexedDB connection (`getDb()`) opened lazily on first access.

## Message Store

Custom message store with in-memory cache + async IndexedDB persistence (`src/message-store.ts`):

| Function | Description |
|----------|-------------|
| `initMessageStore()` | Load persisted messages from IndexedDB (async) |
| `addMessage(msg)` | Append a message (role + content) and persist to IndexedDB (async) |
| `getMessages()` | Get all messages (sync, from cache) |
| `getLastN(n)` | Get the last N messages (sync) |
| `getMessageCount()` | Total message count (sync) |
| `clearMessages()` | Clear all messages from cache and IndexedDB (async) |

Messages are cached in memory for fast access; writes are fire-and-forget persisted to the `messages` store in IndexedDB via `db.ts`.

## State Management

Vanilla Zustand store (`src/store.ts`) for IDE-wide state, created with `createStore` from `zustand/vanilla` and the `subscribeWithSelector` middleware:

### State Slices

| Slice | Key fields | Description |
|-------|-----------|-------------|
| **Files** | `activeFile`, `files[]` | Open file tabs and active selection |
| **Editor** | `editorHistory{}` | Per-file undo/redo stacks (max 50) |
| **Layout** | `panelMode`, `sidebarVisible` | 3-column layout state |
| **Settings** | `settings` | Locale, font size, word wrap, tab size |
| **Status** | `isProcessing`, `statusMessage` | Processing indicator |

### Actions

| Action | Description |
|--------|-------------|
| `setActiveFile(path)` | Switch active file tab |
| `addFile(file)` | Add a file tab (no-ops if already present) |
| `removeFile(path)` | Close a file tab |
| `setFileDirty(path, dirty)` | Mark file as modified |
| `pushEditorState(path, content)` | Push content onto undo stack |
| `undoEditor(path)` / `redoEditor(path)` | Undo/redo for a file |
| `setPanelMode(mode)` | Switch between chat, editor, split, settings |
| `toggleSidebar()` | Show/hide sidebar |
| `updateSettings(partial)` | Merge settings partial |
| `setProcessing(bool, msg?)` | Toggle processing state |

The store is runtime-only (no built-in persistence). Persistent state uses `storage.ts` (localStorage) for small config and `db.ts` (IndexedDB) for bulk data. Preact components can subscribe via `useSyncExternalStore`.

## Setup & Configuration

The first time the agent loads without an API key, a **Setup Screen** is shown:

1. Enter your [Jina AI API key](https://jina.ai/?sui=apikey) (free tier)
2. The key is saved to localStorage and the agent panel loads
3. Change the key later via the Settings modal (gear icon)

### Panel Modes

- **Full** — Chat sidebar + code editor + placeholder right panel
- **Tools-only** — Compact view showing only tool call history

Switch modes in Settings. The selection persists across sessions.

### Settings

Accessible via the gear icon in the header:

| Setting | Description |
|---------|-------------|
| **Jina API Key** | Web search & scrape API key |
| **Panel Mode** | Full 3-column or tools-only |
| **Language** | UI locale (en, pt, es, ja, zh) |
| **Input Enabled** | Toggle chat input on/off |

## Critical Patterns

- **LLM calls**: All operations (agent loop, summarization, memory extraction) use `window.ai()` / `root.ai()` from ai-text-plugin.
- **Custom message store**: Messages cached in memory + persisted to IndexedDB (via `db.ts`).
- **Storage**: Two layers — `storage.ts` (localStorage) for small config (API key, panel mode, locale), `db.ts` (IndexedDB) for messages, memories, and summaries.
- **Tool calls**: AI outputs `<tool_call name="...">{JSON}</tool_call>` → code detects, executes, feeds result back.
- **UI**: All UI rendered by Preact into `document.body`.
- **CDN cache busting**: Use `@<COMMIT>` (immutable commit reference), not `@main`.
- **API key**: Jina AI key stored in localStorage under `agent:jina_key`.
- **Panel modes**: `"full"` (3-column) or `"tools-only"` — persisted in localStorage.

## Bundle

~92KB minified (esbuild), served via jsDelivr CDN.

## License

MIT
