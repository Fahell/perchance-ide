# Copilot Instructions
1. You are in 'research-first' mode. Before writing or modifying any code that calls, references, or depends on external libraries or APIs, you must consult Docs, web and/or GitMCP tool to ensure you are using the latest API. Do not write code based solely on your training knowledge or on internal code that may be outdated.
2. zsh, rg, sd, bat, eza, fd, git, gh, jq, yq, already installed.
3. Don't rush. Plan it out. suggest modern devdeps; don't reinvent the wheel.
4. Configure stack and scaffolding continuously.
5. compatibility, security, correctness, readability, observability, and efficiency are equally important
6. Defensive programming.

## Project Overview
Agent framework for Perchance AI Character Chat. TypeScript project bundled with esbuild into a single JS file served via CDN (jsDelivr).

## Architecture
- **Entry**: `src/index.ts` → bundled to `dist/agent.js`
- **Agent Loop**: `src/agent-loop.ts` → tool call detection + execution cycle
- **Tools**: `src/tools/` → web search (Jina API), scrape URL
- **Types**: `src/types.ts` → Perchance `oc.*` API type definitions

## Key APIs (Perchance)
- `oc.thread.on("MessageAdded")` — intercept messages (SYNCHRONOUS handler required)
- `oc.messageRenderingPipeline.push()` — rendering filter ONLY (does NOT control generation)
- `oc.thread.messages.push()` — add messages to chat (triggers MessageAdded)
- `oc.generateText({instruction})` — call LLM programmatically (standalone, no MessageAdded)
- `oc.window.show() / .hide()` — control iframe window
- `message.expectsReply = false` — prevent internal generator from responding
- `message.hiddenFrom = ["ai"]` — hide message from internal generator

## Critical Patterns

### Generator Suppression (IMPORTANT)
Perchance has TWO independent AI systems:
1. **Internal generator** (`ai-character-chat` plugin) — uses character persona, respects `expectsReply`/`hiddenFrom`
2. **Our custom agent** — reads `message.content` directly, ignores those flags

To suppress the internal generator, set flags **directly on the message object** in the `MessageAdded` handler:
```typescript
if (message.author === "user") {
  message.expectsReply = false;
  if (!message.hiddenFrom) message.hiddenFrom = [];
  if (!message.hiddenFrom.includes("ai")) message.hiddenFrom.push("ai");
}
```

**WARNING**: `messageRenderingPipeline` is for RENDERING ONLY. Setting `expectsReply`/`hiddenFrom` there does NOT prevent the internal generator from firing.

### Other Patterns
- **Tool calls**: AI outputs `<tool_call name="...">{JSON}</tool_call>` → custom code detects, executes, feeds result back
- **Window**: All UI goes in the iframe (`document.body.innerHTML`), not in the chat
- **CDN cache busting**: Use `@<COMMIT>` (immutable commit reference), not `@main?v=hash`
- **Jina API**: POST with Bearer auth (free tier key in web-search.ts)

## Commands
- `pnpm build` — bundle to dist/agent.js
- `pnpm deploy` — build + push + generate IMPORT.md with @commit URL
- `pnpm dev` — watch mode

## Conventions
- Use `import type` for type-only imports
- Synchronous handlers for `MessageAdded` (race condition prevention)
- All custom code runs in sandboxed iframe (no access to parent window)
- Jina API: POST with Bearer auth, CORS-friendly
