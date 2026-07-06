# perchance-ide

A standalone AI-powered Integrated Development Environment that runs entirely within [Perchance](https://perchance.org) generators. Combines an LLM-driven agent with a full-featured code editor (CodeMirror 6), virtual file system, Python execution environment (Pyodide WebAssembly), and a project documentation subagent — all bundled into a single JavaScript file (~350KB minified) served via jsDelivr CDN.

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

Replace `<COMMIT>` with the latest commit hash (auto-generated in `IMPORT.md` after each deployment). See the [generator templates](generator/) for reference implementations and explore the other generator examples in `ai-text-plugin/`, `continue-generator/`, `super-fetch-plugin/`, and `other-coder-perchance-generator/`.

### 3. Web Search Setup (Optional)

On first launch, you'll be prompted to enter a [Jina AI API key](https://jina.ai/?sui=apikey) (free tier available). This enables web search and page scraping capabilities. The key is stored locally in your browser and never sent anywhere else.

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

# Type check without emitting
pnpm typecheck

# Watch mode for tests
pnpm test:watch
```

## Features

### AI Agent & Tools

- **Tool-calling loop** powered by Perchance's `ai-text-plugin` with up to 8 iterations, timeout handling (5min), cancellation (AbortController), and repetition detection
- **Web search** via Jina AI API with in-memory TTL cache (5 min) and FIFO eviction
- **Page scraping** to fetch and parse web content as markdown with retry + exponential backoff
- **Context management tools**: BM25-lite keyword search + index-based message retrieval
- **Virtual File System (VFS)** operations: read, write, edit (exact string replacement), list tree, search (name+content), delete, rename — all with change tracking via FNV-1a hashing
- **Python execution** via Pyodide WebAssembly (v314.0.2) in a dedicated Web Worker — keeps main thread responsive during load and execution; automatic VFS↔MEMFS bidirectional sync via message passing with incremental change propagation (no full snapshot on repeated executions)
- **Package installation** via micropip (numpy, pandas, requests, etc.)
- **Rate limiting** per tool via sliding window algorithm
- **Node.js execution** via BrowserPod (remote Node.js runtime) — `npm install`, `run_node_script`, `execute_npm_command`; requires a BrowserPod API key (console.browserpod.io); conditionally booted at startup when enabled in settings
- **"Continue" mechanism** for truncated responses — picks up where the LLM left off via `startWith`

### Code Editor

- **CodeMirror 6-based** tabbed editor with syntax highlighting for JS/TS/JSX/TSX, HTML, CSS, JSON, Markdown, Python
- **Undo/redo stacks** per file with state persistence
- **Auto-save** to VFS (debounced 500ms)
- **Emmet** support for HTML/CSS expansion
- **Settings**: font size, tab size, word wrap — all persisted to localStorage

### Panels & UI

- **3-column layout**: chat sidebar | code editor | right panel (file explorer / outline / HTML preview / Python output)
- **Preview Panel** — live HTML rendering via sandboxed iframe (`srcdoc` + `allow-scripts`)
- **Output Panel** — persistent history of Python executions (last 20) with expandable cards and copy-to-clipboard
- **File Search** — Ctrl+P fuzzy search across all VFS files with real-time scoring
- **Diff View** — unified line-level diff with collapsible unchanged regions (Myers algorithm)
- **Context Viewer** — token budget visualization across hot/warm/cold tiers
- **Scroll-to-bottom FAB** for chat messages

### Project Documentation (Mapper Agent)

- **Automatic documentation subagent** that maintains structured summaries per-project in `/<project>/_map/` after every file change
- Tracks all VFS mutations via hash-based change detection (FNV-1a)
- Uses its own lightweight tool loop (5 tools: read_file, write_file, edit_file, rename_file, delete_file)
- Coalesces rapid successive edits before dispatching
- Index file (`index.md`) is auto-generated deterministically — mapper focuses on individual file summaries
- Summary format includes **Purpose** field and absolute VFS paths with pipe-separated dependency descriptions

### Internationalization

- **5 languages**: English (en), Português (pt-BR), Español (es), 日本語 (ja), 中文 (zh)
- Full translation dictionaries for settings, setup wizard, panel UI, tool cards, context viewer
- Automatic browser locale detection with localStorage persistence

### Storage & Persistence

- **IndexedDB** (via `idb` v8.0.3) — 3 object stores: `messages` (auto-increment, timestamp index), `kv` (memories, summaries, chunks), `files` (VFS path-keyed)
- **localStorage** — small config (API key, locale, editor settings) with legacy migration
- **Debounced VFS persistence** (2s) with `flushVfsPersist()` for immediate saves
- **Project export/import** via JSON serialization (`src/utils/vfs-io.ts`) with sanitized paths

### Agent Loop Internals

- **Dynamic system prompt** built from enabled tool categories (web, context, VFS, terminal, node — each toggleable in settings)
- **Tool call parsing** via flat XML tags with CDATA sections — `<tool_call name="..."><param><![CDATA[value]]></param></tool_call>` — using depth-aware tag matching and auto-closing-tag repair
- **Repetition detection** — warns at 3 consecutive identical calls, interrupts at 5
- **Token estimation** heuristic: UTF-8 byte length / 4 (or / 3 for code-heavy content)
- **Parallel execution** — multiple `<tool_call>` blocks in one response run simultaneously
- **Conflict resolution** — `edit_file` requires exact old/new string replacement with duplicate detection

### Developer Experience

- **Fully typed** TypeScript strict mode (ES2022) with generic `ToolDefinition<TArgs>` and runtime `validateShape<T>()` guards
- **Zustand** vanilla store (`createStore` + `subscribeWithSelector`) — central IDE state with Preact bridge via `useSyncExternalStore`
- **Zero external dependencies** for validation, diff, retry, and rate-limiting utilities
- **Unit tested** with Vitest + jsdom (80+ tests: VFS, storage, context estimation, tool call parsing, retry, truncation, web cache)
- **Custom `pnpm-workspace.yaml`** allowing esbuild builds

## Architecture

```
src/
├── index.ts                  # Entry — bootstrap, env check, API key setup, agent orchestration
├── agent-loop.ts             # Core loop — tool call detection, continuation, repetition guard
├── context-manager.ts        # Token estimation, summarization, chunked summary storage
├── db.ts                     # IndexedDB (idb v8) — messages, kv, files stores
├── memory.ts                 # Persistent memory extraction (1-3 facts per exchange)
├── message-store.ts          # In-memory message cache + async IndexedDB persistence
├── storage.ts                # localStorage wrapper with legacy migration
├── store.ts                  # Zustand vanilla store — IDE-wide state (files, settings, messages, UI)
├── types.ts                  # Perchance ai-text-plugin types + getAi() resolver
├── mapper-agent.ts           # Subagent — auto-maintains /<project>/_map/ documentation
├── mapper-dispatcher.ts      # Listens to VFS events, coalesces, dispatches per-project mapper
├── vfs.ts                    # Virtual File System — path operations, tree, snapshot
├── vfs-events.ts             # Hash-based (FNV-1a) change tracking + event emitter
├── vfs-persist.ts            # Debounced IndexedDB persistence (2s) with flush
│
├── agent/
│   ├── prompt-builder.ts     # Dynamic system prompt from enabled tools + project state
│   ├── tool-call-parser.ts   # Flat XML CDATA parser, response cleaner, closing-tag fixer
│   ├── repetition-detector.ts # Fingerprint-based loop prevention
│   └── timeout-helpers.ts    # AbortSignal composition, withTimeout, aiCallWithSignal
│
├── browserpod/
│   └── manager.ts            # BrowserPod singleton — Node.js runtime lifecycle, VFS sync, run()
│
├── tools/
│   ├── index.ts              # Registry — ToolDefinition<TArgs>, categories, rate limiters
│   ├── context-tools.ts      # search_history (BM25-lite, trilingual stopwords) + get_messages
│   ├── node-tools.ts         # Node.js tools (npm install, node script, npm command) via BrowserPod
│   ├── vfs-tools.ts          # read/write/edit/list/search/delete/rename — diff-cache integration
│   ├── terminal-tools.ts     # run_python, execute_script, install_package
│   └── web-search.ts         # Jina AI search + scrape with TTL cache
│
├── utils/
│   ├── validate.ts           # Zero-dep runtime guards: validateShape<T>(), isArrayOf()
│   ├── truncate.ts           # Smart truncation (chars or lines) with ellipsis
│   ├── retry.ts              # Exponential backoff with full jitter + AbortSignal
│   ├── rate-limiter.ts       # Sliding window rate limiter
│   ├── diff.ts               # Myers diff algorithm (line-level, ~80 lines core)
│   ├── diff-cache.ts         # Before/after cache for tool call diff views (max 50 entries)
│   └── vfs-io.ts             # Project export/import JSON serialization with path sanitization
│
├── terminal/
│   ├── pyodide.ts            # Pyodide Web Worker bridge — delegates to PyodideWorkerManager; incremental VFS sync
│   └── pyodide.test.ts       # Pyodide bridge tests
│
├── workers/
│   ├── pyodide-manager.ts     # Worker lifecycle, request/response correlation, retry with backoff, incremental VFS sync
│   └── pyodide-worker-code.ts # Inline worker code as string (Blob URL) — init, runPython, installPackage, syncFiles, incremental sync
│
├── editor/
│   ├── index.ts              # CM6 factory — basicSetup, theme, keymap, change listener
│   ├── theme.ts              # Monochrome dark theme matching UI color tokens
│   ├── langs.ts              # Ext→LanguageSupport map (JS/TS/JSX/TSX/HTML/CSS/JSON/MD/Python)
│   ├── outline.ts            # Lezer syntax tree → OutlineSymbol[] (JS/CSS/HTML)
│   ├── emmet.ts              # Emmet CM6 plugin integration
│   ├── emmet-langs.ts        # Emmet syntax mapping
│   └── view-store.ts         # Active EditorView tracker
│
├── i18n/
│   ├── dict.ts               # 5-locale translation dictionaries + locale labels
│   └── index.ts              # t() function, browser detection, persistence
│
└── ui/
    ├── index.ts              # Entry — renderPanel() / renderSetup() with ErrorBoundary
    ├── AgentPanel.tsx        # 3-column layout, modals, keyboard shortcuts, state subscription
    ├── ChatMessages.tsx      # Message list with AutoScroll
    ├── MessageList.tsx       # Scrollable container (role="log", aria-live="polite")
    ├── UserMessage.tsx       # User message bubble
    ├── AgentMessage.tsx      # Agent response + tool call cards
    ├── ResponseText.tsx      # Markdown renderer with expand/collapse
    ├── ToolCallCard.tsx      # Collapsible tool call with args, result, diff view
    ├── ThinkingIndicator.tsx # Animated dots
    ├── ScrollFAB.tsx         # Floating scroll-to-bottom button
    ├── Header.tsx            # Version, commit, FAQ trigger
    ├── Footer.tsx            # Input bar, settings/context buttons
    ├── Modal.tsx             # Accessible modal — focus trap, Escape close
    ├── SettingsModal.tsx     # API key, language, auto-save, tool toggles
    ├── ContextViewer.tsx     # Token budget, summary, tier visualization, memories
    ├── FaqModal.tsx          # FAQ with project links
    ├── CodeEditor.tsx        # CM6 tabbed editor — auto-save, dirty tracking
    ├── DiffView.tsx          # Unified diff with collapsible unchanged regions
    ├── FileSearchModal.tsx   # Ctrl+P fuzzy file search
    ├── PreviewPanel.tsx      # Live HTML preview via sandboxed iframe
    ├── OutputPanel.tsx       # Python execution history with copy
    ├── RightPanel.tsx        # Tab container (files/outline/preview/output)
    ├── SetupScreen.tsx       # First-run API key wizard
    ├── ErrorBoundary.tsx     # Preact error boundary with retry
    ├── theme.ts              # Design tokens — colors, fonts
    ├── markdown.ts           # Minimal markdown→HTML
    ├── animations.ts         # @keyframes definitions
    ├── formatRelativeTime.ts # Human-readable timestamps
    └── types.ts              # PanelMessage, ToolCallEntry, AgentStatus
    └── hooks/
        └── useKeyboardShortcuts.ts  # Global shortcut bindings
```

## Agent Tools

The agent has access to the following tools, exposed through a generic `ToolDefinition<TArgs>` interface with typed parameters and runtime validation. Each tool can be individually enabled/disabled in settings, has an optional rate limit, and a configurable timeout.

### Web & Information Tools

| Tool         | Description                                              | Parameters                           |
| ------------ | -------------------------------------------------------- | ------------------------------------ |
| `web_search` | Search the web via Jina AI (cached 5 min, max 3 retries) | `{ query: string }`                  |
| `scrape_url` | Fetch full page content as markdown (cached 5 min)       | `{ url: string, maxChars?: number }` |

### Context Management Tools

| Tool             | Description                                                               | Parameters                                       |
| ---------------- | ------------------------------------------------------------------------- | ------------------------------------------------ |
| `search_history` | BM25-lite keyword search across conversation history (EN/PT/ES stopwords) | `{ query: string }`                              |
| `get_messages`   | Retrieve raw messages by position or count                                | `{ count?: number, from?: number, to?: number }` |

### Virtual File System Tools

| Tool           | Description                                                        | Parameters                                                      |
| -------------- | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| `read_file`    | Read file contents from VFS (max 5000 chars)                       | `{ path: string }`                                              |
| `write_file`   | Create or overwrite a file (auto-dir, diff-cache, dirty-tracking)  | `{ path: string, content: string }`                             |
| `edit_file`    | Replace exact text (safer than write_file for partial edits)       | `{ file_path: string, old_string: string, new_string: string }` |
| `list_files`   | Show project tree with 📁/📄 icons                                 | `{ dir?: string }`                                              |
| `search_files` | Search files by name or content (case-insensitive, max 20 results) | `{ query: string, maxResults?: number }`                        |
| `delete_file`  | Delete a file or folder recursively                                | `{ path: string }`                                              |
| `rename_file`  | Rename or move a file/folder                                       | `{ oldPath: string, newPath: string }`                          |

### Python Execution Tools

| Tool              | Description                                  | Parameters            |
| ----------------- | -------------------------------------------- | --------------------- |
| `run_python`      | Execute Python via Pyodide (VFS auto-synced) | `{ code: string }`    |
| `execute_script`  | Run a `.py` file from VFS                    | `{ path: string }`    |
| `install_package` | Install via micropip (numpy, pandas, etc.)   | `{ pkgName: string }` |

### Node.js Tools (BrowserPod)

| Tool                  | Description                                          | Parameters                        |
| --------------------- | ---------------------------------------------------- | --------------------------------- |
| `run_npm_install`     | Install npm packages (or from package.json)          | `{ packages?: string }`           |
| `run_node_script`     | Execute a Node.js script file in the BrowserPod env  | `{ path: string, args?: string }` |
| `execute_npm_command` | Run an arbitrary npm command (test, build, start...) | `{ command: string }`             |

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

- **Automatic summarization** triggers when conversation exceeds ~6K token budget
- **Summary condensation** merges old+new summaries when combined budget exceeded
- **Chunked summaries** stored in IndexedDB with message range ranges
- **Memory extraction** runs asynchronously after each exchange, capturing timeless facts (max 20 stored)
- **Context tools** enable the agent to self-retrieve historical information when users reference earlier conversation
- **ContextViewer modal** provides visual feedback on token usage, tier distribution, chunk summaries, and extracted memories
- **Token estimation** uses `TextEncoder` byte-length / 4 with adaptive heuristics (divisor 3.0 if >15% code operators detected)

## Storage Layers

### localStorage (Configuration)

Via `src/storage.ts` — synchronous storage for small user settings with `agent:` prefix:

| Function                    | Description                         |
| --------------------------- | ----------------------------------- |
| `storageGet<T>(key)`        | Get value by key (preserves `null`) |
| `storageSet<T>(key, value)` | Set value by key                    |
| `storageDel(key)`           | Delete a key                        |
| `storageHas(key)`           | Check if key exists                 |
| `storageKeys()`             | List all keys                       |
| `storageClear()`            | Remove all data                     |

**Stored values**: API key (`agent:jina_key`), panel mode, UI locale, input enabled state.

### IndexedDB (Bulk Data)

Via `src/db.ts` — powered by [`idb`](https://github.com/jakearchibald/idb) v8 with two object stores:

| Store      | Key Type            | Contents                                            |
| ---------- | ------------------- | --------------------------------------------------- |
| `messages` | Auto-increment `id` | Chat message history (indexed by `timestamp`)       |
| `kv`       | String `key`        | Generic key-value: memories, summaries, chunks, VFS |

**Messages API**: `dbAddMessage()`, `dbGetAllMessages()`, `dbGetLastN(n)`, `dbGetMessageCount()`, `dbClearMessages()`, `dbGetMessagesByRange(from, to?)`

**Key-Value API**: `dbKvGet<T>()`, `dbKvGetValidated<T>()` (with runtime type guard), `dbKvSet()`, `dbKvDel()`, `dbKvClear()`, `dbKvKeys()`

**VFS (files) API**: `dbSaveVfs(entries)`, `dbLoadVfs()` — full replace on save, path-keyed retrieval.

Both stores share a single lazy-initialized IndexedDB connection via `getDb()`.

### Message Store

Custom message store (`src/message-store.ts`) combining in-memory cache with async IndexedDB persistence:

| Function             | Description                                     |
| -------------------- | ----------------------------------------------- |
| `initMessageStore()` | Load persisted messages from IndexedDB (async)  |
| `addMessage(msg)`    | Append message and persist to IndexedDB (async) |
| `getMessages()`      | Get all messages from cache (sync)              |
| `getLastN(n)`        | Get last N messages from cache (sync)           |
| `getMessageCount()`  | Total message count (sync)                      |
| `clearMessages()`    | Clear cache and IndexedDB (async)               |

### VFS Persistence

Centralized debounced persistence via `src/vfs-persist.ts`:

| Function                   | Description                                                     |
| -------------------------- | --------------------------------------------------------------- |
| `scheduleVfsPersist()`     | Debounced write to IndexedDB (2s timeout) — resets on each call |
| `flushVfsPersist()`        | Immediate write, cancels pending debounce                       |
| `cancelScheduledPersist()` | Cancel pending save without flushing                            |

### VFS Events & Change Tracking

`src/vfs-events.ts` wraps all VFS mutations with hash-based change detection:

- **FNV-1a 32-bit hash** computed on every write (~5μs per 10KB)
- **Event types**: `created`, `modified`, `deleted`, `renamed`
- **Subscriber pattern**: `onVfsChange(listener)` returns unsubscribe function
- **Hash persistence** to IndexedDB for cross-session change detection
- Used by the Mapper Agent to trigger documentation updates

### Virtual File System I/O (Export/Import)

`src/utils/vfs-io.ts` provides project serialization:

| Function                   | Description                                                          |
| -------------------------- | -------------------------------------------------------------------- |
| `serializeProject()`       | Export all VFS files as JSON manifest                                |
| `deserializeProject(json)` | Import JSON manifest with path sanitization (rejects `..` traversal) |

## State Management

Vanilla Zustand store (`src/store.ts`) created with `createStore` and `subscribeWithSelector` middleware:

### State Slices

| Slice          | Key Fields                            | Description                                                                        |
| -------------- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| **Files**      | `activeFile`, `files[]`               | Open file tabs and active selection                                                |
| **Editor**     | `editorView`, `settingsVersion`       | Active EditorView ref, triggers recreation on settings change                      |
| **Layout**     | `panelMode`, `sidebarVisible`         | 3-column layout configuration                                                      |
| **Settings**   | `settings`                            | Locale, fontSize, wordWrap, tabSize, autoSave, tool toggles (5)                    |
| **Status**     | `isProcessing`, `statusMessage`       | Processing indicator state                                                         |
| **BrowserPod** | `browserPodStatus`, `browserPodError` | Node.js runtime (BrowserPod) loading state (idle/loading/ready/error)              |
| **Pyodide**    | `pyodideStatus`, `pyodideError`       | Python runtime loading state                                                       |
| **VFS**        | `vfsVersion`                          | Incremented on file writes for preview reactivity                                  |
| **Output**     | `outputs[]`                           | Python execution history (last 20 entries)                                         |
| **Messages**   | `messages[]`, `agentStatus`           | Panel chat messages and agent status (idle/thinking/searching/scraping/responding) |

### Key Actions

| Action                            | Description                                        |
| --------------------------------- | -------------------------------------------------- |
| `openFile(path, name, language)`  | Open tab or switch active (dedup)                  |
| `closeFile(path)`                 | Close tab, select next available                   |
| `renameFile(oldPath, newPath)`    | Rename + trackedRename events + VFS persist        |
| `addUserMessage(content)`         | Append user message with timestamp                 |
| `addToolCall(name, args)`         | Create tool call entry, return ID for updates      |
| `appendAgentResponse(response)`   | Set final agent response text                      |
| `appendToLastAgentResponse(text)` | Append to current agent response (for "continue")  |
| `setRightPanelTab(tab)`           | Switch between files/outline/preview/output        |
| `addOutput(entry)`                | Add Python output entry (auto-truncate to 20)      |
| `bumpVfsVersion()`                | Trigger preview re-render                          |
| `updateSettings(partial)`         | Merge partial settings + increment settingsVersion |

The store is runtime-only without built-in persistence. Preact components subscribe via `useSyncExternalStore`.

## Accessibility

All UI components follow ARIA patterns for screen reader compatibility and keyboard navigation:

| Component                  | ARIA Implementation                                                               |
| -------------------------- | --------------------------------------------------------------------------------- |
| `Modal`                    | `role="dialog"`, `aria-modal="true"`, focus trap, Escape close, focus restoration |
| `SettingsModal` toggles    | `role="switch"`, `aria-checked`, keyboard activation                              |
| `MessageList`              | `role="log"`, `aria-live="polite"` for dynamic updates                            |
| `ContextViewer` budget bar | `role="progressbar"`, `aria-valuenow/min/max`                                     |
| `RightPanel` tabs          | `role="tablist"` / `role="tab"`, `aria-selected`                                  |
| `RightPanel` tree          | `role="tree"` / `role="treeitem"`, `aria-expanded`                                |
| `FileSearchModal`          | Keyboard navigation (arrows, Enter, Escape)                                       |
| All interactive controls   | Semantic `<button>` elements with accessible labels                               |
| Color contrast             | `textMuted: #757575` on black background (WCAG AA for 18pt+)                      |

## Internationalization

Supports 5 languages with automatic locale detection and persistence:

| Locale     | Code    | Label     |
| ---------- | ------- | --------- |
| English    | `en`    | English   |
| Portuguese | `pt-BR` | Português |
| Spanish    | `es`    | Español   |
| Japanese   | `ja`    | 日本語    |
| Chinese    | `zh`    | 中文      |

Translation dictionaries are stored in `src/i18n/dict.ts` with the `t(key, locale?)` function providing dot-notation access. Fallback chain: `locale dict → en dict → raw key`.

## Testing

Test suite uses [Vitest](https://vitest.dev/) v4 with jsdom environment:

```bash
pnpm test        # Run all tests
pnpm test:watch  # Watch mode for development
```

### Test Coverage

| Test File                              | Coverage Area                                                         |
| -------------------------------------- | --------------------------------------------------------------------- |
| `src/vfs.test.ts`                      | VFS CRUD, normalization, tree, rename, delete, edge cases (~40 tests) |
| `src/storage.test.ts`                  | localStorage get/set/del/has/keys/clear operations                    |
| `src/context-manager.test.ts`          | Token estimation (encoding + code heuristic)                          |
| `src/agent-loop.test.ts`               | Tool call extraction regex, response cleaning                         |
| `src/utils/truncate.test.ts`           | String truncation (character and line modes)                          |
| `src/utils/retry.test.ts`              | Error classification, retry with exponential backoff                  |
| `src/terminal/pyodide.test.ts`         | Pyodide bridge utilities                                              |
| `tests/tools/web-search-cache.test.ts` | Web search + scrape TTL cache, eviction, expiration                   |

## Configuration & Setup

### Initial Setup

On first load without an API key, the **Setup Screen** wizard appears:

1. Enter your [Jina AI API key](https://jina.ai/?sui=apikey) (free tier available)
2. Key is saved to localStorage under `agent:jina_key`
3. Agent panel loads with full functionality
4. Change key later via Settings modal (gear icon in header)

### Settings

Accessible via gear icon in header or `Ctrl+,`:

| Setting                | Description                                                    |
| ---------------------- | -------------------------------------------------------------- |
| **Jina API Key**       | Web search and page scraping API key (validated on save)       |
| **Language**           | UI locale selection (en, pt-BR, es, ja, zh)                    |
| **Auto Save**          | Auto-save files on change in editor (default: off)             |
| **Web Tools**          | Enable/disable web_search and scrape_url tools                 |
| **Context Tools**      | Enable/disable search_history and get_messages tools           |
| **File Tools**         | Enable/disable all VFS tools (read, write, edit, etc.)         |
| **Python Tools**       | Enable/disable run_python, execute_script, install_package     |
| **Node.js Tools**      | Enable/disable npm/node tools via BrowserPod                   |
| **BrowserPod API Key** | API key for BrowserPod Node.js runtime (console.browserpod.io) |

### Keyboard Shortcuts

| Shortcut | Action                     |
| -------- | -------------------------- |
| `Ctrl+,` | Open Settings              |
| `Ctrl+I` | Open Context Viewer        |
| `Ctrl+P` | File search                |
| `Ctrl+L` | Focus chat input           |
| `Escape` | Close modals / blur editor |

## Critical Development Patterns

- **LLM calls**: All operations (agent loop, summarization, memory extraction) use `getAi()` helper which resolves `window[name]` / `window.root[name]` / `window.parent?.root?.[name]`. Never call `window.ai` directly.
- **Tool calls**: AI outputs `<tool_call name="..."><param><![CDATA[value]]></param></tool_call>` XML → runtime parses via depth-aware tag matching with CDATA extraction, executes tool, feeds result back into next LLM iteration. Multiple `<tool_call>` blocks in one response run in parallel.
- **Tool interface**: Generic `ToolDefinition<TArgs>` with typed `execute(args: TArgs)` instead of untyped `Record<string, any>`.
- **Runtime validation**: Zero-dependency `validateShape<T>()` and `isArrayOf()` utilities for type-safe runtime checks with `dbKvGetValidated()`.
- **UI rendering**: Preact renders into `document.body` with semantic HTML and ARIA roles throughout.
- **CDN cache busting**: Use immutable `@<COMMIT>` references, **never** mutable `@main` branch tags.
- **Message flow**: User message → `handleSendMessage()` → `addMessage()` (cache + IndexedDB) → `buildContext()` (token-aware) → `formatMemories()` → `agentLoop()` (up to 8 iterations, with continuation for truncation) → `extractMemories()` (async background).
- **Cancellation**: User can cancel an in-progress agent response via AbortController. The LLM call is stopped via `aiResult.stop()`, and any running tool executions are aborted.
- **"Continue" mechanism**: When agent response is truncated (>~1000 tokens), the panel shows a "Continue" button that re-calls the LLM with `startWith: truncatedText` to pick up where it left off.
- **Mapper Agent**: After the main agent finishes, per-project VFS changes are coalesced and dispatched to a lightweight subagent that auto-maintains documentation in `/<project>/_map/`. This subagent runs with clean context (no history) and has its own internal tool loop (read_file, write_file, edit_file, rename_file, delete_file). Uses the same CDATA-based flat XML tool call format as the main agent.
- **Retry policy**: All external API calls (Jina AI) use exponential backoff with full jitter (AWS-recommended). Retryable errors: network errors (TypeError), HTTP 429, 5xx. Non-retryable: 4xx (except 429), AbortError.

## Build & Deployment

Built with esbuild (v0.28) into a single minified ESM file:

```bash
pnpm build        # Production build → dist/agent.js (minified, no sourcemaps)
pnpm dev          # Development build with source maps + watch mode
pnpm typecheck    # TypeScript strict type checking without emitting
```

Build-time constants injected via esbuild `define`:

- `__VERSION__` — from `package.json`
- `__COMMIT__` — from `$COMMIT` env var or `"dev"`
- `__BUILD_TIME__` — ISO timestamp of build

### Deployment

`pnpm deploy` (via `deploy.sh`) automates:

1. Read version from `package.json`
2. Build with `COMMIT=$(git rev-parse --short HEAD) pnpm build`
3. Commit all changes with message `deploy: v<VERSION>`
4. Push to GitHub
5. Generate `IMPORT.md` with jsDelivr URL using post-push commit hash
6. Amend the commit to include `IMPORT.md`

The CDN URL follows the pattern `https://cdn.jsdelivr.net/gh/Fahell/perchance-ide@<COMMIT>/dist/agent.js`

## Generator Templates

The project includes reference generators in these directories:

| Directory                          | Description                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `generator/`                       | **Main template** — minimal HTML panel that imports the agent bundle + list panel with `agentAi = {import:ai-text-plugin}`                 |
| `ai-text-plugin/`                  | The official ai-text-plugin generator — complete HTML panel with documentation, usage examples, and list panel with all `$output` code     |
| `continue-generator/`              | **AI Text Continue** — interactive text continuation tool with instruction injection, paragraph continuation, and localStorage persistence |
| `super-fetch-plugin/`              | **Super Fetch** — CORS-proxied fetch plugin for Perchance with automatic CDN bypass and fallback logic                                     |
| `other-coder-perchance-generator/` | **UFO AI Code Analyzer** — Monaco Editor-based code analysis tool with language selector, auto-complete, and integrated chat               |

## License

MIT
