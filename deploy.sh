#!/bin/bash
set -e

# Capture commit hash BEFORE build
COMMIT=$(git rev-parse --short HEAD)
VERSION=$(node -e "console.log(require('./package.json').version)")
BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "📦 Version: ${VERSION}+${COMMIT}"
echo "🕐 Build: ${BUILD_TIME}"

echo "🔨 Building..."
COMMIT=$COMMIT pnpm build

# Generate IMPORT.md with cache-busted URL
IMPORT_URL="https://cdn.jsdelivr.net/gh/Fahell/agent-perchance@main/dist/agent.js?v=${COMMIT}"
cat > IMPORT.md << EOF
# Import URL

Copy-paste this into Perchance Custom Code:

\`\`\`
import("${IMPORT_URL}");
\`\`\`
EOF
echo "📄 Generated IMPORT.md"

echo "📦 Committing..."
git add -A
git commit -m "deploy: v${VERSION}+${COMMIT}" || echo "Nothing to commit"

echo "🚀 Pushing..."
git push

# Purge jsDelivr cache
echo "🧹 Purging jsDelivr cache..."
curl -s "https://purge.jsdelivr.net/gh/Fahell/agent-perchance@main/dist/agent.js" > /dev/null

echo ""
echo "✅ Deployed!"
echo "   Version: ${VERSION}+${COMMIT}"
echo "   URL: https://cdn.jsdelivr.net/gh/Fahell/agent-perchance@main/dist/agent.js"
echo "   Cache-busted: ?v=${COMMIT}"
