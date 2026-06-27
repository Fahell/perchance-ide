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
- `oc.messageRenderingPipeline.push()` — process messages BEFORE AI sees them
- `oc.thread.messages.push()` — add messages to chat
- `oc.generateText({instruction})` — call LLM programmatically
- `oc.window.show() / .hide()` — control iframe window
- `message.expectsReply = false` — prevent AI from responding to a message
- `message.hiddenFrom = ["ai"]` — hide message from AI

## Critical Patterns
- **Message interception**: Use `messageRenderingPipeline` to set `expectsReply: false` BEFORE AI sees message
- **Tool calls**: AI outputs `<tool_call name="...">{JSON}</tool_call>` → custom code detects, executes, feeds result back
- **Window**: All UI goes in the iframe (`document.body.innerHTML`), not in the chat
- **Jina API**: POST with Bearer auth (free tier key in web-search.ts)

## Commands
- `pnpm build` — bundle to dist/agent.js
- `pnpm deploy` — build + push + purge jsDelivr cache
- `pnpm dev` — watch mode

## Conventions
- Use `import type` for type-only imports
- Synchronous handlers for `MessageAdded` (race condition prevention)
- All custom code runs in sandboxed iframe (no access to parent window)
- Jina API: POST with Bearer auth, CORS-friendly
