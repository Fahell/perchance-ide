#!/bin/bash
set -e

echo "🔨 Building..."
pnpm build

echo "📦 Committing..."
git add -A
git commit -m "deploy: $(date +%Y-%m-%d\ %H:%M)" || echo "Nothing to commit"

echo "🚀 Pushing..."
git push

# Purge jsDelivr cache
echo "🧹 Purging jsDelivr cache..."
curl -s "https://purge.jsdelivr.net/gh/Fahell/agent-perchance@main/dist/agent.js" > /dev/null

echo "✅ Done! Use: https://cdn.jsdelivr.net/gh/Fahell/agent-perchance@main/dist/agent.js"
