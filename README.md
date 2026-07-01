# perchance-ide

Standalone AI agent generator for [Perchance](https://perchance.org), powered by [ai-text-plugin](https://perchance.org/ai-text-plugin).

TypeScript + Preact project, bundled with esbuild into a single JS file and served via jsDelivr CDN.

## Quick Start

### 1. Create a Perchance generator

Create a new generator on Perchance and add an HTML panel with:

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

# Build (minified production bundle)
pnpm build

# Watch mode with source maps
pnpm dev

# Deploy — build + commit + push + generate IMPORT.md
pnpm deploy

# Run tests
pnpm test
```

### Generator scaffolding

The `generator/` folder contains templates you can adapt:

- `generator/list-panel.txt` — minimal list panel with ai-text-plugin import
- `generator/html-template.html` — minimal HTML panel that loads the agent bundle

## Features

- **AI agent with tools** — web search (Jina AI), page scraping, context management, VFS operations, Python execution
- **Tool-calling agent loop** — AI outputs `<tool_call>` XML, runtime detects and executes each call, feeds results back (up to 8 iterations)
- **Token-aware context management** — 3-tier architecture (hot/warm/cold) with automatic summarization and memory extraction
- **Context tools** — agent can query its own history via `search_history` (BM25-lite) and `get_messages` (index retrieval)
- **Persistent memory** — extracts timeless facts from conversations, stored across sessions via IndexedDB
- **Dual persistence layers** — IndexedDB (via `idb` v8) for messages, memories, summaries; localStorage for small config (API key, panel mode, locale)
- **Zustand state management** — vanilla Zustand store with `subscribeWithSelector` middleware for IDE-wide state
- **CodeMirror 6 editor** — tabbed code editor with syntax highlighting, undo/redo stacks, and file management
- **Virtual File System (VFS)** — fully in-memory tree with persistence, exposed as agent tools (read, write, search, list, delete, rename)
- **Python execution via Pyodide** — run Python snippets, execute `.py` files from VFS, install packages via micropip (lazy-loaded, ~3.5MB gzip)
- **i18n** — 5 languages (English, Português, Español, 日本語, 中文)
- **Monochrome dark UI** — Preact-based 3-column layout: chat sidebar, code editor, file explorer / output panels
- **Fully typed** — TypeScript strict mode, generic tool definitions with typed parameters, runtime validation guards
- **Accessible** — semantic `<button>` elements, ARIA roles (`dialog`, `tablist`, `tree`, `log`, `switch`, `progressbar`), focus trapping in modals, WCAG AA contrast ratios
- **Unit tested** — Vitest + jsdom with 70+ tests across VFS, storage, context management, agent loop, and utilities

## Architecture

```
src/
├── index.ts              # Entry point — bootstrap, agent orchestration, send handler
├── agent-loop.ts         # Core agent loop — tool call detection, instruction building, window.ai calls
├── context-manager.ts    # Token-aware context building, summarization, chunked summaries (IndexedDB), UTF-8 token estimation
├── db.ts                 # IndexedDB persistence layer (idb v8) — messages + kv stores, optional runtime validation
├── memory.ts             # Persistent memory extraction and retrieval (IndexedDB)
├── message-store.ts      # In-memory message cache + async IndexedDB persistence
├── storage.ts            # localStorage wrapper for small config (API key, panel mode, locale, input enabled)
├── store.ts              # Zustand vanilla store — IDE state (files, editor history, layout, settings)
├── types.ts              # Perchance API types + window.ai type declarations + getAi() helper
│
├── tools/
│   ├── index.ts          # Tool registry — ToolDefinition<TArgs> generic interface + getToolDescriptions()
│   ├── context-tools.ts  # search_history (BM25-lite) + get_messages tools
│   ├── vfs-tools.ts      # read_file, write_file, list_files, search_files, delete_file, rename_file
│   ├── terminal-tools.ts # run_python, execute_script, install_package
│   └── web-search.ts     # Jina AI integration (search + scrape), typed FetchError + result interfaces
│
├── utils/
│   └── validate.ts       # Zero-dependency runtime validation — validateShape<T>(), isArrayOf()
│
├── terminal/
│   └── pyodide.ts        # Pyodide WebAssembly loader + VFS→MEMFS sync bridge
│
├── i18n/
│   ├── dict.ts           # Translation dictionaries (5 locales)
│   └── index.ts          # t() function, locale detection, persistence
│
└── ui/
    ├── AgentPanel.tsx     # Main panel — 3-column layout, state, modal management
    ├── Header.tsx         # Top bar — version display, [clear] and [?] buttons
    ├── Footer.tsx         # Input bar + settings/context buttons
    ├── MessageList.tsx    # Scrollable message container — role="log", aria-live="polite"
    ├── UserMessage.tsx    # User message bubble
    ├── AgentMessage.tsx   # Agent response with tool call cards
    ├── ResponseText.tsx   # Markdown rendering + expand/collapse
    ├── ToolCallCard.tsx   # Collapsible tool call display
    ├── ThinkingIndicator.tsx  # Animated thinking dots
    ├── ScrollFAB.tsx      # Scroll-to-bottom floating button
    ├── Modal.tsx          # Accessible modal wrapper — focus trap, Escape close, focus restoration
    ├── SettingsModal.tsx  # Settings dialog — API key, panel mode, language, input toggle (role="switch")
    ├── ContextViewer.tsx  # Context visualization — token budget (role="progressbar"), tiers, search, memories
    ├── FaqModal.tsx       # FAQ dialog — project links, usage notes
    ├── CodeEditor.tsx     # CodeMirror 6 editor — tabbed interface, syntax highlighting
    ├── RightPanel.tsx     # File explorer + outline + preview + output tabs (ARIA tablist/tree)
    ├── SetupScreen.tsx    # Initial API key setup wizard
    ├── theme.ts           # Monochrome color palette + fonts (WCAG AA compliant)
    ├── markdown.ts        # Minimal markdown → HTML renderer
    ├── animations.ts      # Keyframe animations (pulse, glow, scroll)
    └── types.ts           # UI-specific types (PanelMessage, ToolCallEntry, PanelMode, etc.)
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

- **Summarization** triggers automatically when conversation exceeds ~3K token budget
- **Memory extraction** runs in background after each exchange, capturing timeless facts (max 20)
- **Context tools** let the agent search its own history when the user references earlier conversation
- **ContextViewer** modal visualizes token usage, tiers, chunks, and memories
- **Token estimation** uses `TextEncoder` byte-length / 4 with a code heuristic (divisor 3.0 if >15% code operators)

## Type Safety

Tools use a generic `ToolDefinition<TArgs>` interface:

```ts
interface ToolDefinition<TArgs extends Record<string, unknown>> {
  name: string;
  description: string;
  parameters: Record<string, { description: string; type: string; required?: boolean }>;
  execute(args: TArgs): Promise<string>;
}
```

Runtime validation uses zero-dependency type guards:

```ts
const isChunkSummary = validateShape<ChunkSummary>({
  from: v => typeof v === "number",
  to: v => typeof v === "number",
  summary: v => typeof v === "string",
  tokenCount: v => typeof v === "number",
});

const data: unknown = await dbKvGet("key");
if (isChunkSummary(data)) {
  data.from; // typed as number ✓
}
```

## Accessibility

All UI components follow ARIA patterns:

| Component | ARIA |
|-----------|------|
| `Modal` | `role="dialog"`, `aria-modal="true"`, focus trap, Escape close, focus restoration |
| `SettingsModal` toggles | `role="switch"`, `aria-checked`, keyboard activation |
| `MessageList` | `role="log"`, `aria-live="polite"` |
| `ContextViewer` budget bar | `role="progressbar"`, `aria-valuenow/min/max` |
| `RightPanel` tabs | `role="tablist"` / `role="tab"`, `aria-selected` |
| `RightPanel` tree | `role="tree"` / `role="treeitem"`, `aria-expanded` |
| All close/action controls | `<button>` elements with accessible labels |
| Color contrast | `textMuted: #757575` on black bg (WCAG AA for 18pt+) |

## Message Flow

```
User sends message
    │
    ├──→ handleSendMessage()
    │    ├─ addMessage() → stores in custom message store + IndexedDB
    │    ├─ buildContext() → token-aware: hot messages + summary + memories
    │    ├─ formatMemories() → injects key facts as bullet list
    │    ├─ agentLoop() → window.ai() call with tool instructions
    │    │   ├─ Agent uses web_search / scrape_url for real-time data
    │    │   ├─ Agent uses search_history / get_messages for older context
    │    │   ├─ Agent uses VFS tools to read/write files
    │    │   └─ Up to 8 tool-call iterations
    │    ├─ addMessage() → stores agent response
    │    └─ extractMemories() → background fact extraction (async)
    │
    └──→ Response rendered in Preact sidebar panel
```

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
| `install_package` | Install a Python package via micropip | `{ name: string }` |```

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

Two persistence layers with different scopes:

### localStorage (small config)

Via `src/storage.ts` — synchronous, for small user settings:

| Function | Description |
|----------|-------------|
| `storageGet<T>(key)` | Get a value by key (preserves `null`) |
| `storageSet<T>(key, value)` | Set a value by key |
| `storageDel(key)` | Delete a key |
| `storageHas(key)` | Check if key exists |
| `storageKeys()` | List all keys |
| `storageClear()` | Remove all data |

All keys use the `agent:` prefix internally. Stores: API key, panel mode, UI locale, input enabled state.

### IndexedDB (messages, memories, summaries)

Via `src/db.ts` — powered by [`idb`](https://github.com/jakearchibald/idb) v8, two object stores:

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
| `dbKvGetValidated<T>(key, validator)` | Get + runtime type guard (logs warning on mismatch) |
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

Messages are cached in memory for fast access; writes are fire-and-forget persisted to the `messages` store in IndexedDB.

## State Management

Vanilla Zustand store (`src/store.ts`) created with `createStore` from `zustand/vanilla` and `subscribeWithSelector` middleware:

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

The store is runtime-only (no built-in persistence). Persistent state uses `storage.ts` (localStorage) for small config and `db.ts` (IndexedDB) for bulk data. Preact components subscribe via `useSyncExternalStore`.

## Setup & Configuration

The first time the agent loads without an API key, a **Setup Screen** is shown:

1. Enter your [Jina AI API key](https://jina.ai/?sui=apikey) (free tier)
2. The key is saved to localStorage and the agent panel loads
3. Change the key later via the Settings modal (gear icon)

### Panel Modes

- **Full** — Chat sidebar + code editor + file explorer / output panels
- **Tools-only** — Compact view showing only tool call history

### Settings

Accessible via the gear icon in the header:

| Setting | Description |
|---------|-------------|
| **Jina API Key** | Web search & scrape API key |
| **Panel Mode** | Full 3-column or tools-only |
| **Language** | UI locale (en, pt, es, ja, zh) |
| **Input Enabled** | Toggle chat input on/off |

## Testing

Tests use [Vitest](https://vitest.dev/) with jsdom environment:

```bash
pnpm test        # Run all tests
pnpm test:watch  # Watch mode
```

Test files (`*.test.ts`) live alongside source files:

| Test file | Covers |
|-----------|--------|
| `src/vfs.test.ts` | VFS CRUD, normalize, tree, rename, delete, edge cases |
| `src/storage.test.ts` | localStorage get/set/del/has/keys/clear |
| `src/context-manager.test.ts` | Token estimation (UTF-8 + code heuristic) |
| `src/agent-loop.test.ts` | Tool call extraction regex, response cleaning |
| `src/utils/truncate.test.ts` | String truncation (chars + lines modes) |
| `src/utils/retry.test.ts` | isRetryableError, retryWithBackoff |

## Critical Patterns

- **LLM calls**: All operations (agent loop, summarization, memory extraction) use `getAi()` helper (resolves `window[name]` / `window.root[name]` / `window.parent?.root?.[name]`). Never call `window.ai` directly.
- **Message store**: In-memory cache + async IndexedDB persistence via `db.ts`.
- **Storage**: Two layers — `storage.ts` (localStorage) for small config, `db.ts` (IndexedDB) for bulk data with optional runtime validation (`dbKvGetValidated`).
- **Tool calls**: AI outputs `<tool_call name="...">{JSON}</tool_call>` → runtime detects, executes tool, feeds result back into next LLM iteration.
- **Tool interface**: `ToolDefinition<TArgs>` generic — typed `execute(args: TArgs)` instead of `Record<string, any>`.
- **UI**: Preact renders into `document.body`. Accessible via ARIA roles throughout.
- **CDN cache busting**: Use `@<COMMIT>` (immutable commit reference), not `@main`.
- **API key**: Jina AI key stored in localStorage under `agent:jina_key`.
- **Panel modes**: `"full"` (3-column) or `"tools-only"` — persisted in localStorage.

## Bundle

Built with esbuild, minified in production (dev mode includes source maps). Served via jsDelivr CDN as a single ESM file.

```bash
pnpm build   # → dist/agent.js (minified)
pnpm dev     # → dist/agent.js + source maps, watch mode
```

## License

MIT
