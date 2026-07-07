#!/bin/bash
set -e

BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$BRANCH" = "HEAD" ]; then
  echo "❌ Cannot deploy from detached HEAD. Checkout a named branch first."
  exit 1
fi

if [ "$BRANCH" = "main" ]; then
  echo "⚠️  You are on 'main'. Use 'pnpm deploy' for main branch deployments."
  echo "   To force branch deploy anyway, edit this script or checkout a feature branch."
  exit 1
fi

VERSION=$(node -e "console.log(require('./package.json').version)")
BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "📦 Version: ${VERSION}"
echo "🕐 Build: ${BUILD_TIME}"
echo "🌿 Branch: ${BRANCH}"

echo "🔨 Building..."
COMMIT=$(git rev-parse --short HEAD) pnpm build

if [ ! -f "dist/agent.js" ]; then
  echo "❌ Build failed: dist/agent.js not found. Aborting deploy."
  exit 1
fi

echo "📦 Committing build output..."
git add -A
git commit -m "deploy: v${VERSION} (${BRANCH})" || echo "Nothing to commit"

echo "🚀 Pushing branch '${BRANCH}'..."
git push --set-upstream origin "${BRANCH}"

# Use @commit-hash for cache-busting — each push generates a unique immutable URL
COMMIT_HASH=$(git rev-parse HEAD)
IMPORT_URL="https://cdn.jsdelivr.net/gh/Fahell/perchance-ide@${COMMIT_HASH}/dist/agent.js"

cat > IMPORT.md << EOF
# Import URL (Branch: ${BRANCH})

Add an HTML panel to your generator with:

\`\`\`html
<script>
  import("${IMPORT_URL}");
</script>
\`\`\`

Also add \`agentAi = {import:ai-text-plugin}\` to your list panel.

> 📌 This URL points to commit \`${COMMIT_HASH}\` on branch \`${BRANCH}\`.
> Each push generates a new unique URL (cache-busting). For production, use \`pnpm deploy\` on \`main\`.
EOF
echo "📄 Generated IMPORT.md (branch: ${BRANCH})"

# Amend commit to include IMPORT.md and dist/agent.js
git add IMPORT.md dist/agent.js
git commit --amend --no-edit || true
git push --force-with-lease

echo ""
echo "✅ Deployed to branch!"
echo "   Version: ${VERSION}"
echo "   Branch:  ${BRANCH}"
echo "   Commit:  ${COMMIT_HASH}"
echo "   URL:     ${IMPORT_URL}"
