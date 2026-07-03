# perchance-ide

A standalone AI-powered Integrated Development Environment that runs entirely within [Perchance](https://perchance.org) generators. Combines an LLM-driven agent with a full-featured code editor, virtual file system, and Python execution environment — all bundled into a single JavaScript file served via jsDelivr CDN.

## Quick Start

### 1. Create a Perchance Generator

Create a new generator on Perchance and add an HTML panel:

```html
<!-- HTML Panel -->
<script>
  import("https://cdn.jsdelivr.net/gh/Fahell/perchance-ide@<COMMIT>/dist/agent.js");
</script>
```

### 2. Configure the List Panel

Add the ai-text-plugin to your list panel:

```
agentAi = {import:ai-text-plugin}
```

Replace `<COMMIT>` with the latest commit hash (auto-generated in `IMPORT.md` after each deployment). See the [generator templates](generator/) for reference implementations.

### Development Workflow

```bash
# Install dependencies
pnpm install

# Build production bundle (minified)
pnpm build

# Development mode with source maps and watch
pnpm dev

# Deploy — build + commit + push + generate IMPORT.md
pnpm deploy

# Run test suite
pnpm test
```

## Features

### AI Agent & Tools
- **Tool-calling loop** powered by Perchance's `ai-text-plugin`, supporting up to 8 iterations per message
- **Web search** via Jina AI API for real-time information retrieval
- **Page scraping** to fetch and parse web content as markdown
- **Context management tools** enabling the agent to search its own conversation history
- **Virtual File System (VFS)** operations for reading, writing, searching, and managing project files
- **Python execution** via Pyodide WebAssembly with package installation support

### Code Editor
- **CodeMirror 6-based** tabbed editor with syntax highlighting for multiple languages
- **Undo/redo stacks** per file with state persistence
- **File explorer** with tree view and outline panel
- **Output panel** for Python execution results

### Context Management
- **3-tier architecture** (hot/warm/cold) with automatic token-aware summarization
- **Persistent memory extraction** capturing timeless facts across sessions
- **BM25-lite keyword search** across conversation history
- **Token budget visualization** with progress indicators

### Storage & Persistence
- **IndexedDB** (via `idb` v8) for messages, memories, chunked summaries, and VFS
- **localStorage** for small configuration (API key, panel mode, locale, settings)
- **Dual persistence layers** optimized for different data types and access patterns

### User Interface
- **Preact-based** monochrome dark interface with WCAG AA contrast compliance
- **3-column layout**: chat sidebar, code editor, file explorer/output panels
- **Accessible design** with semantic HTML, ARIA roles, focus trapping, and keyboard navigation
- **Internationalization** supporting 5 languages (English, Português, Español, 日本語, 中文)
- **Modal dialogs** for settings, context viewer, FAQ, and file search

### Developer Experience
- **Fully typed** TypeScript strict mode with generic tool definitions and runtime validation
- **Unit tested** with Vitest + jsdom (70+ tests covering VFS, storage, context, agent loop)
- **Zero-dependency validation** utilities for type-safe runtime checks

## Architecture

```
src/
├── index.ts                  # Entry point — bootstrap, agent orchestration, event handlers
├── agent-loop.ts             # Core agent loop — tool call detection, instruction building, LLM calls
├── context-manager.ts        # Token-aware context building, summarization, UTF-8 estimation
├── db.ts                     # IndexedDB persistence layer (idb v8) — messages + kv stores
├── memory.ts                 # Persistent memory extraction and retrieval
├── message-store.ts          # In-memory message cache + async IndexedDB persistence
├── storage.ts                # localStorage wrapper for small config values
├── store.ts                  # Zustand vanilla store — IDE-wide state management
├── types.ts                  # Perchance API types + window.ai declarations + helpers
│
├── tools/
│   ├── index.ts              # Tool registry — generic ToolDefinition<TArgs> interface
│   ├── context-tools.ts      # search_history (BM25-lite) + get_messages
│   ├── vfs-tools.ts          # read_file, write_file, list_files, search_files, delete_file, rename_file
│   ├── terminal-tools.ts     # run_python, execute_script, install_package
│   └── web-search.ts         # Jina AI integration (search + scrape)
│
├── utils/
│   └── validate.ts           # Zero-dependency runtime validation — validateShape<T>(), isArrayOf()
│
├── terminal/
│   └── pyodide.ts            # Pyodide WebAssembly loader + VFS→MEMFS synchronization
│
├── i18n/
│   ├── dict.ts               # Translation dictionaries (5 locales)
│   └── index.ts              # t() function, locale detection, persistence
│
└── ui/
    ├── AgentPanel.tsx        # Main panel — 3-column layout, modal management
    ├── Header.tsx            # Top bar — version display, clear/help buttons
    ├── Footer.tsx            # Input bar + settings/context buttons
    ├── MessageList.tsx       # Scrollable message container (role="log", aria-live="polite")
    ├── UserMessage.tsx       # User message bubble component
    ├── AgentMessage.tsx      # Agent response with tool call cards
    ├── ResponseText.tsx      # Markdown rendering with expand/collapse
    ├── ToolCallCard.tsx      # Collapsible tool call display
    ├── ThinkingIndicator.tsx # Animated thinking dots
    ├── ScrollFAB.tsx         # Scroll-to-bottom floating action button
    ├── Modal.tsx             # Accessible modal wrapper — focus trap, Escape close
    ├── SettingsModal.tsx     # Settings dialog — API key, panel mode, language, input toggle
    ├── ContextViewer.tsx     # Context visualization — token budget, tiers, chunks, memories
    ├── FaqModal.tsx          # FAQ dialog with project links and usage notes
    ├── CodeEditor.tsx        # CodeMirror 6 editor — tabs, syntax highlighting
    ├── RightPanel.tsx        # File explorer + outline + preview + output tabs
    ├── SetupScreen.tsx       # Initial API key setup wizard
    ├── theme.ts              # Monochrome color palette + fonts (WCAG AA compliant)
    ├── markdown.ts           # Minimal markdown → HTML renderer
    ├── animations.ts         # Keyframe animations (pulse, glow, scroll)
    └── types.ts              # UI-specific types (PanelMessage, ToolCallEntry, etc.)
```

## Agent Tools

The agent has access to the following tools, exposed through a generic `ToolDefinition<TArgs>` interface with typed parameters and runtime validation:

### Web & Information Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `web_search` | Search the web via Jina AI | `{ query: string }` |
| `scrape_url` | Fetch full page content as markdown | `{ url: string, maxChars?: number }` |

### Context Management Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `search_history` | Search conversation history by keyword (BM25-lite) | `{ query: string }` |
| `get_messages` | Retrieve messages by position or count | `{ count?: number, from?: number, to?: number }` |

### Virtual File System Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `read_file` | Read file contents from VFS | `{ path: string }` |
| `write_file` | Create or overwrite a file in VFS | `{ path: string, content: string }` |
| `list_files` | Show project tree structure | `{ path?: string }` |
| `search_files` | Search files by name or content | `{ query: string, mode?: "name" \| "content" }` |
| `delete_file` | Delete a file or folder recursively | `{ path: string }` |
| `rename_file` | Rename or move a file/folder | `{ source: string, dest: string }` |

### Python Execution Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `run_python` | Execute a Python snippet, returns stdout/stderr | `{ code: string }` |
| `execute_script` | Run a `.py` file from VFS | `{ path: string }` |
| `install_package` | Install a Python package via micropip | `{ name: string }` |

## Context Management Architecture

The agent employs a **3-tier context architecture** to efficiently manage conversation history within token budgets:

```
┌─────────────────────────────────────────────────────┐
│  HOT — Always in prompt (~1200 tokens)              │
│  Last 5 messages + rolling summary + key facts      │
├─────────────────────────────────────────────────────┤
│  WARM — Accessible via search_history tool          │
│  Chunked summaries of older conversation blocks     │
│  BM25-lite keyword search across all history        │
├─────────────────────────────────────────────────────┤
│  COLD — Accessible via get_messages tool            │
│  Full raw message history                           │
│  Index-based retrieval (by position or count)       │
└─────────────────────────────────────────────────────┘
```

### Key Mechanisms

- **Automatic summarization** triggers when conversation exceeds ~3K token budget
- **Memory extraction** runs asynchronously after each exchange, capturing timeless facts (max 20 stored)
- **Context tools** enable the agent to self-retrieve historical information when users reference earlier conversation
- **ContextViewer modal** provides visual feedback on token usage, tier distribution, chunk summaries, and extracted memories
- **Token estimation** uses `TextEncoder` byte-length / 4 with adaptive heuristics (divisor 3.0 if >15% code operators detected)

## Storage Layers

### localStorage (Configuration)

Via `src/storage.ts` — synchronous storage for small user settings with `agent:` prefix:

| Function | Description |
|----------|-------------|
| `storageGet<T>(key)` | Get value by key (preserves `null`) |
| `storageSet<T>(key, value)` | Set value by key |
| `storageDel(key)` | Delete a key |
| `storageHas(key)` | Check if key exists |
| `storageKeys()` | List all keys |
| `storageClear()` | Remove all data |

**Stored values**: API key (`agent:jina_key`), panel mode, UI locale, input enabled state.

### IndexedDB (Bulk Data)

Via `src/db.ts` — powered by [`idb`](https://github.com/jakearchibald/idb) v8 with two object stores:

| Store | Key Type | Contents |
|-------|----------|----------|
| `messages` | Auto-increment `id` | Chat message history (indexed by `timestamp`) |
| `kv` | String `key` | Generic key-value: memories, summaries, chunks, VFS |

**Messages API**: `dbAddMessage()`, `dbGetAllMessages()`, `dbGetLastN(n)`, `dbGetMessageCount()`, `dbClearMessages()`, `dbGetMessagesByRange(from, to?)`

**Key-Value API**: `dbKvGet<T>()`, `dbKvGetValidated<T>()` (with runtime type guard), `dbKvSet()`, `dbKvDel()`, `dbKvClear()`, `dbKvKeys()`

Both stores share a single lazy-initialized IndexedDB connection via `getDb()`.

### Message Store

Custom message store (`src/message-store.ts`) combining in-memory cache with async IndexedDB persistence:

| Function | Description |
|----------|-------------|
| `initMessageStore()` | Load persisted messages from IndexedDB (async) |
| `addMessage(msg)` | Append message and persist to IndexedDB (async) |
| `getMessages()` | Get all messages from cache (sync) |
| `getLastN(n)` | Get last N messages from cache (sync) |
| `getMessageCount()` | Total message count (sync) |
| `clearMessages()` | Clear cache and IndexedDB (async) |

## State Management

Vanilla Zustand store (`src/store.ts`) created with `createStore` and `subscribeWithSelector` middleware:

### State Slices

| Slice | Key Fields | Description |
|-------|-----------|-------------|
| **Files** | `activeFile`, `files[]` | Open file tabs and active selection |
| **Editor** | `editorHistory{}` | Per-file undo/redo stacks (max 50 entries) |
| **Layout** | `panelMode`, `sidebarVisible` | 3-column layout configuration |
| **Settings** | `settings` | Locale, font size, word wrap, tab size |
| **Status** | `isProcessing`, `statusMessage` | Processing indicator state |

### Actions

| Action | Description |
|--------|-------------|
| `setActiveFile(path)` | Switch active file tab |
| `addFile(file)` | Add file tab (no-op if already present) |
| `removeFile(path)` | Close file tab |
| `setFileDirty(path, dirty)` | Mark file as modified |
| `pushEditorState(path, content)` | Push content onto undo stack |
| `undoEditor(path)` / `redoEditor(path)` | Undo/redo for specific file |
| `setPanelMode(mode)` | Switch between chat, editor, split, settings modes |
| `toggleSidebar()` | Show/hide sidebar |
| `updateSettings(partial)` | Merge partial settings update |
| `setProcessing(bool, msg?)` | Toggle processing state with optional message |

The store is runtime-only without built-in persistence. Preact components subscribe via `useSyncExternalStore`.

## Accessibility

All UI components follow ARIA patterns for screen reader compatibility and keyboard navigation:

| Component | ARIA Implementation |
|-----------|---------------------|
| `Modal` | `role="dialog"`, `aria-modal="true"`, focus trap, Escape close, focus restoration |
| `SettingsModal` toggles | `role="switch"`, `aria-checked`, keyboard activation |
| `MessageList` | `role="log"`, `aria-live="polite"` for dynamic updates |
| `ContextViewer` budget bar | `role="progressbar"`, `aria-valuenow/min/max` |
| `RightPanel` tabs | `role="tablist"` / `role="tab"`, `aria-selected` |
| `RightPanel` tree | `role="tree"` / `role="treeitem"`, `aria-expanded` |
| All interactive controls | Semantic `<button>` elements with accessible labels |
| Color contrast | `textMuted: #757575` on black background (WCAG AA for 18pt+) |

## Internationalization

Supports 5 languages with automatic locale detection and persistence:

- **English** (en)
- **Português** (pt)
- **Español** (es)
- **日本語** (ja)
- **中文** (zh)

Translation dictionaries are stored in `src/i18n/dict.ts` with the `t()` function providing type-safe access.

## Testing

Test suite uses [Vitest](https://vitest.dev/) with jsdom environment:

```bash
pnpm test        # Run all tests
pnpm test:watch  # Watch mode for development
```

### Test Coverage

| Test File | Coverage Area |
|-----------|---------------|
| `src/vfs.test.ts` | VFS CRUD operations, normalization, tree structure, rename, delete, edge cases |
| `src/storage.test.ts` | localStorage get/set/del/has/keys/clear operations |
| `src/context-manager.test.ts` | Token estimation (UTF-8 encoding + code heuristic) |
| `src/agent-loop.test.ts` | Tool call extraction regex, response cleaning |
| `src/utils/truncate.test.ts` | String truncation (character and line modes) |
| `src/utils/retry.test.ts` | Error classification, retry with exponential backoff |

## Configuration & Setup

### Initial Setup

On first load without an API key, the **Setup Screen** wizard appears:

1. Enter your [Jina AI API key](https://jina.ai/?sui=apikey) (free tier available)
2. Key is saved to localStorage under `agent:jina_key`
3. Agent panel loads with full functionality
4. Change key later via Settings modal (gear icon in header)

### Panel Modes

- **Full** — Complete 3-column layout: chat sidebar + code editor + file explorer/output panels
- **Tools-only** — Compact view showing only tool call history

### Settings

Accessible via gear icon in header:

| Setting | Description |
|---------|-------------|
| **Jina API Key** | Web search and page scraping API key |
| **Panel Mode** | Full 3-column or tools-only compact view |
| **Language** | UI locale selection (en, pt, es, ja, zh) |
| **Input Enabled** | Toggle chat input on/off |

## Critical Development Patterns

- **LLM calls**: All operations (agent loop, summarization, memory extraction) use `getAi()` helper which resolves `window[name]` / `window.root[name]` / `window.parent?.root?.[name]`. Never call `window.ai` directly.
- **Tool calls**: AI outputs `<tool_call name="...">{JSON}` XML format → runtime detects pattern, executes tool, feeds result back into next LLM iteration.
- **Tool interface**: Generic `ToolDefinition<TArgs>` with typed `execute(args: TArgs)` instead of untyped `Record<string, any>`.
- **Runtime validation**: Zero-dependency `validateShape<T>()` and `isArrayOf()` utilities for type-safe runtime checks with `dbKvGetValidated()`.
- **UI rendering**: Preact renders into `document.body` with semantic HTML and ARIA roles throughout.
- **CDN cache busting**: Use immutable `@<COMMIT>` references, not mutable `@main` branch tags.
- **Message flow**: User message → `handleSendMessage()` → `addMessage()` (cache + IndexedDB) → `buildContext()` (token-aware) → `formatMemories()` → `agentLoop()` (up to 8 iterations) → `extractMemories()` (async background).

## Build & Deployment

Built with esbuild into a single minified ESM file:

```bash
pnpm build   # Production build → dist/agent.js (minified)
pnpm dev     # Development build → dist/agent.js + source maps, watch mode
```

Served via jsDelivr CDN with immutable commit references for cache busting. The `pnpm deploy` script automates build, commit, push, and `IMPORT.md` generation with the latest commit hash.

## License

MIT
