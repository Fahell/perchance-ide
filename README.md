# agent-perchance

Agent framework for [Perchance AI Character Chat](https://perchance.org/ai-character-chat).

## Quick Start

### In Perchance Custom Code

```js
import("https://cdn.jsdelivr.net/gh/OWNER/agent-perchance@main/dist/agent.js");
```

### Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Watch mode
pnpm dev
```

## Architecture

```
src/
├── index.ts       # Entry point (bundled)
├── types.ts       # Perchance API types (oc.*)
├── tools/         # Tool implementations
└── utils.ts       # Utilities
```

## License

MIT
