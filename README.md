# agent-perchance

Agent framework for [Perchance AI Character Chat](https://perchance.org/ai-character-chat).

TypeScript project bundled with esbuild into a single JS file, served via jsDelivr CDN.

## Quick Start

### In Perchance Custom Code

```js
import("https://cdn.jsdelivr.net/gh/Fahell/agent-perchance@<COMMIT>/dist/agent.js");
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

## Features

- **Web search + page scraping** via Jina AI API (free tier)
- **Tool-calling agent loop** — AI outputs `<tool_call>` XML, custom code executes and feeds results back (up to 8 iterations)
- **Context window management** — token-aware summarization with 3-tier architecture (hot/warm/cold)
- **Context tools** — agent can query its own history via `search_history` (BM25-lite) and `get_messages` (index retrieval)
- **Persistent memory** — extracts timeless facts from conversations, stored across sessions
- **i18n** — 5 languages (English, Português, Español, 日本語, 中文)
- **Monochrome dark UI** — Preact-based panel with compact/full modes, tool call cards, scroll FAB
- **FAQ panel** — built-in info modal with project links and usage notes

## Architecture

```
src/
├── index.ts              # Entry point — bootstrap, MessageAdded handler, agent orchestration
├── agent-loop.ts         # Core agent loop — tool call detection, instruction building, LLM calls
├── context-manager.ts    # Token-aware context building, summarization, chunked summaries
├── memory.ts             # Persistent memory extraction and retrieval
├── storage.ts            # Persistent storage via oc.thread.customData
├── types.ts              # Perchance API types (oc.*)
│
├── tools/
│   ├── index.ts          # Tool registry + initContextTools()
│   ├── context-tools.ts  # search_history (BM25-lite) + get_messages tools
│   └── web-search.ts     # Jina API integration (search + scrape)
│
├── i18n/
│   ├── dict.ts           # Translation dictionaries (5 locales)
│   └── index.ts          # t() function, locale detection, persistence
│
└── ui/
    ├── AgentPanel.tsx     # Main panel — state, layout, modal management
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
│  Full raw message history in oc.thread.messages     │
│  Index-based retrieval (by position or count)       │
└─────────────────────────────────────────────────────┘
```

- **Summarization** triggers automatically when conversation exceeds 3K token budget
- **Memory extraction** runs in background after each exchange, capturing timeless facts (max 20)
- **Context tools** let the agent search its own history when the user references earlier conversation
- **ContextViewer** modal visualizes token usage, tiers, chunks, and memories

## Message Flow

```
User sends message
    │
    ├──→ Our agent (custom code in iframe)
    │    ├─ MessageAdded handler intercepts
    │    ├─ Sets expectsReply=false, hiddenFrom=["ai"] on message
    │    ├─ buildContext() → token-aware summarization + recent messages
    │    ├─ formatMemories() → injects key facts
    │    ├─ agentLoop() → LLM call with tool instructions
    │    │   ├─ Agent uses web_search / scrape_url for real-time data
    │    │   ├─ Agent uses search_history / get_messages for older context
    │    │   └─ Up to 8 tool-call iterations
    │    ├─ extractMemories() → background fact extraction
    │    └─ Pushes response to oc.thread.messages
    │
    └──→ Internal Perchance generator (ai-character-chat)
         └─ Sees expectsReply=false / hiddenFrom=["ai"]
         └─ Does NOT fire (suppressed)
```

## Key Perchance APIs

| API | Purpose | Notes |
|-----|---------|-------|
| `oc.thread.on("MessageAdded")` | Intercept messages | SYNCHRONOUS handler required |
| `oc.thread.messages.push()` | Add messages to chat | Triggers MessageAdded |
| `oc.generateText({instruction})` | Call LLM programmatically | Standalone, no auto-context |
| `oc.window.show() / .hide()` | Control iframe window | UI lives in iframe |
| `oc.thread.customData` | Persistent key-value storage | ~1-2KB limit, persists across sessions |
| `oc.thread.userCharacter?.name` | Get username | 3-level fallback chain |

## Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `web_search` | Search the web via Jina AI | `{ query: string }` |
| `scrape_url` | Fetch full page content as markdown | `{ url: string, maxChars?: number }` |
| `search_history` | Search conversation history by keyword (BM25-lite) | `{ query: string }` |
| `get_messages` | Retrieve messages by position or count | `{ count?: number, from?: number, to?: number }` |

## Critical Patterns

- **Generator suppression**: Set `expectsReply = false` and `hiddenFrom = ["ai"]` on user messages in the `MessageAdded` handler (NOT in the pipeline — pipeline is rendering-only)
- **Storage**: Use `oc.thread.customData` for persistence — `localStorage` and `IndexedDB` are blocked in Perchance sandboxed iframes
- **Tool calls**: AI outputs `<tool_call name="...">{JSON}</tool_call>` → custom code detects, executes, feeds result back
- **Window**: All UI goes in the iframe (`document.body.innerHTML`), not in the chat
- **CDN cache busting**: Use `@<COMMIT>` (immutable commit reference), not `@main`
- **Username fallback**: `oc.thread.userCharacter?.name` → `oc.character?.userCharacter?.name` → `oc.userCharacter?.name`

## Bundle

~85KB minified (esbuild), served via jsDelivr CDN.

## License

MIT
