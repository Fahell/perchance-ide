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
git push --set-upstream origin HEAD

# Get commit hash AFTER push — this is the exact hash on GitHub
COMMIT=$(git rev-parse --short HEAD)

# Use @commit instead of @main — jsDelivr serves exact file, no CDN staleness
IMPORT_URL="https://cdn.jsdelivr.net/gh/Fahell/perchance-ide@${COMMIT}/dist/agent.js"

cat > IMPORT.md << EOF
# Import URL

Add an HTML panel to your generator with:

\`\`\`html
<script>
  import("${IMPORT_URL}");
</script>
\`\`\`

Also add \`agentAi = {import:ai-text-plugin}\` to your list panel.
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
