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

## Architecture

```
src/
├── index.ts         # Entry point — MessageAdded handler, bootstrap, window
├── agent-loop.ts    # Core agent loop with tool call detection + execution
├── storage.ts       # Persistent storage via oc.thread.customData
├── types.ts         # Perchance API types (oc.*)
└── tools/
    ├── index.ts     # Tool registry with descriptions
    └── web-search.ts # Jina API integration (search + scrape)
```

### Message Flow

```
User sends message
    │
    ├──→ Our agent (custom code in iframe)
    │    ├─ MessageAdded handler intercepts
    │    ├─ Sets expectsReply=false, hiddenFrom=["ai"] on message
    │    ├─ Passes content to agentLoop()
    │    └─ Agent uses oc.generateText() with custom instruction
    │
    └──→ Internal Perchance generator (ai-character-chat)
         └─ Sees expectsReply=false / hiddenFrom=["ai"]
         └─ Does NOT fire (suppressed)
```

### Key Perchance APIs

| API | Purpose | Notes |
|-----|---------|-------|
| `oc.thread.on("MessageAdded")` | Intercept messages | SYNCHRONOUS handler required |
| `oc.thread.messages.push()` | Add messages to chat | Triggers MessageAdded |
| `oc.generateText({instruction})` | Call LLM programmatically | Standalone, no MessageAdded |
| `oc.window.show() / .hide()` | Control iframe window | UI lives in iframe |
| `oc.thread.customData` | Persistent key-value storage | ~1-2KB limit, persists across sessions |

### Critical Patterns

- **Generator suppression**: Set `expectsReply = false` and `hiddenFrom = ["ai"]` on user messages in the `MessageAdded` handler (NOT in the pipeline — pipeline is rendering-only)
- **Storage**: Use `oc.thread.customData` for persistence — `localStorage` and `IndexedDB` are blocked in Perchance sandboxed iframes
- **Tool calls**: AI outputs `<tool_call name="...">{JSON}</tool_call>` → custom code detects, executes, feeds result back
- **Window**: All UI goes in the iframe (`document.body.innerHTML`), not in the chat
- **CDN cache busting**: Use `@<COMMIT>` (immutable commit reference), not `@main`

## Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Bundle to `dist/agent.js` |
| `pnpm deploy` | Build + commit + push + generate IMPORT.md |
| `pnpm dev` | Watch mode |

## License

MIT
