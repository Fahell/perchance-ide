#!/bin/bash
set -e

VERSION=$(node -e "console.log(require('./package.json').version)")
BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "📦 Version: ${VERSION}"
echo "🕐 Build: ${BUILD_TIME}"

echo "🔨 Building..."
COMMIT=$(git rev-parse --short HEAD) pnpm build

echo "📦 Committing..."
git add -A
git commit -m "deploy: v${VERSION}" || echo "Nothing to commit"

echo "🚀 Pushing..."
git push

# Get commit hash AFTER push — this is the exact hash on GitHub
COMMIT=$(git rev-parse --short HEAD)

# Use @commit instead of @main — jsDelivr serves exact file, no CDN staleness
IMPORT_URL="https://cdn.jsdelivr.net/gh/Fahell/agent-perchance@${COMMIT}/dist/agent.js"

cat > IMPORT.md << EOF
# Import URL

Copy-paste this into Perchance Custom Code:

\`\`\`
import("${IMPORT_URL}");
\`\`\`
EOF
echo "📄 Generated IMPORT.md"

# Amend commit to include IMPORT.md
git add IMPORT.md
git commit --amend --no-edit || true
git push --force-with-lease

echo ""
echo "✅ Deployed!"
echo "   Version: ${VERSION}"
echo "   URL: ${IMPORT_URL}"
