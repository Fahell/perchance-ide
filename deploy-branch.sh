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

echo "📦 Committing..."
git add -A
git commit -m "deploy: v${VERSION} (${BRANCH})" || echo "Nothing to commit"

echo "🚀 Pushing branch '${BRANCH}'..."
git push --set-upstream origin "${BRANCH}"

# Use @branch instead of @commit — jsDelivr auto-resolves to latest commit on branch
IMPORT_URL="https://cdn.jsdelivr.net/gh/Fahell/perchance-ide@${BRANCH}/dist/agent.js"

cat > IMPORT.md << EOF
# Import URL (Branch: ${BRANCH})

Add an HTML panel to your generator with:

\`\`\`html
<script>
  import("${IMPORT_URL}");
</script>
\`\`\`

Also add \`agentAi = {import:ai-text-plugin}\` to your list panel.

> ⚠️ This URL points to the **latest commit** on branch \`${BRANCH}\`.
> It auto-updates on every push. For production, use \`pnpm deploy\` on \`main\`.
EOF
echo "📄 Generated IMPORT.md (branch: ${BRANCH})"

# Amend commit to include IMPORT.md
git add IMPORT.md
git commit --amend --no-edit || true
git push --force-with-lease

echo ""
echo "✅ Deployed to branch!"
echo "   Version: ${VERSION}"
echo "   Branch:  ${BRANCH}"
echo "   URL:     ${IMPORT_URL}"
