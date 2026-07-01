/**
 * Emmet CM6 integration — lazy-loaded abbreviation expansion.
 *
 * Wraps @emmetio/codemirror6-plugin behind a dynamic import()
 * so the Emmet bundle is only loaded when the user opens a file
 * that supports abbreviation expansion (HTML, CSS, JSX, TSX).
 */

import type { Extension } from "@codemirror/state";

// ─── Module-level cache ────────────────────────────────────
type EmmetPlugin = typeof import("@emmetio/codemirror6-plugin");

let cachedPlugin: Promise<EmmetPlugin> | null = null;

function loadPlugin(): Promise<EmmetPlugin> {
  if (!cachedPlugin) {
    cachedPlugin = import("@emmetio/codemirror6-plugin").catch((err) => {
      console.warn("[Emmet] Failed to load @emmetio/codemirror6-plugin:", err);
      cachedPlugin = null; // Reset so next call retries
      throw err;
    });
  }
  return cachedPlugin;
}

// ─── Public API ────────────────────────────────────────────
/**
 * Get CM6 extensions for Emmet abbreviation expansion.
 *
 * Lazily imports the plugin — returns an empty array if loading fails.
 *
 * @param syntax - The Emmet syntax to use (html, css, or jsx)
 * @returns A promise resolving to an array of CM6 extensions
 */
export async function getEmmetExtensions(
  syntax: string
): Promise<Extension[]> {
  try {
    const plugin = await loadPlugin();
    if (!plugin) return [];
    return [
      plugin.emmetConfig.of({ syntax: syntax as any }),
      plugin.abbreviationTracker({ syntax: syntax as any }),
    ];
  } catch {
    // Silently fall back — Emmet is a nice-to-have, not critical
    return [];
  }
}
