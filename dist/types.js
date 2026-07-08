/**
 * Type definitions for ai-text-plugin (window.ai)
 * https://perchance.org/ai-text-plugin
 */
/** Possible global names that the user might have imported the plugin as. */
const AI_GLOBAL_NAMES = ["agentAi", "generateText", "text", "ai"];
/** Narrow window to our Perchance-aware interface for global lookups. */
const pw = window;
const parentPw = window.parent;
/**
 * Resolve the ai-text-plugin function across expected global names.
 *
 * In Perchance, importing `name = {import:ai-text-plugin}` in the list panel:
 * - non-`ai` names (e.g. `agentAi`, `generateText`) → set as `window[name]` globally
 * - `ai` name → ONLY set as `window.root.ai` (Perchance runtime root), NOT `window.ai`
 *
 * We check in order:
 *   1. `window[name]`                         — works for non-ai names
 *   2. `window.root[name]`                    — works for all names including `ai`
 *   3. `window.parent?.root?.[name]`          — iframe fallback to parent's Perchance root
 */
let _cachedAi = null;
function findAi() {
    for (const name of AI_GLOBAL_NAMES) {
        // 1. Direct global (non-ai names like agentAi, generateText)
        const fn = pw[name];
        if (typeof fn === "function")
            return fn;
        // 2. Perchance root object (all names including "ai")
        const root = pw.root;
        const rootFn = root?.[name];
        if (typeof rootFn === "function")
            return rootFn;
        // 3. Parent frame's Perchance root (iframe in HTML panel)
        const parentRoot = parentPw?.root;
        const parentRootFn = parentRoot?.[name];
        if (typeof parentRootFn === "function")
            return parentRootFn;
    }
    return null;
}
/** Get the ai function, caching the result after first successful lookup. */
export function getAi() {
    if (_cachedAi)
        return _cachedAi;
    const ai = findAi();
    if (ai) {
        _cachedAi = ai;
        return ai;
    }
    throw new Error("ai-text-plugin not found. Make sure your list panel has:\n" +
        '  agentAi = {import:ai-text-plugin}\n' +
        "Then reload the generator.");
}
/** Check if ai is available without throwing. */
export function isAiAvailable() {
    try {
        return getAi() !== null;
    }
    catch {
        return false;
    }
}
