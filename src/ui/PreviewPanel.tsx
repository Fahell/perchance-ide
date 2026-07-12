/**
 * PreviewPanel — live HTML & Markdown preview via sandboxed iframe.
 *
 * Shows rendered HTML when a .html file is active in the editor.
 * Shows rendered Markdown when a .md file is active.
 * Auto-updates when the file content changes (via vfsVersion counter).
 *
 * For HTML previews, linked CSS and JS files are inlined automatically
 * from the VFS so the preview works even with separate files:
 *   <link href="style.css">  →  <style>/* content * /</style>
 *   <script src="app.js"></script>  →  <script>/* content * /</script>
 *
 * Features: refresh button, open-in-new-tab, error handling.
 */

import { marked } from "marked";
import { useEffect, useRef, useState } from "preact/hooks";
import { t, type Locale } from "../i18n/index.js";
import { ideStore, type IdeState } from "../store.js";
import { PROJECT_ROOT, vfsRead } from "../vfs.js";
import { colors, fonts } from "./theme.js";

// ─── Props ──────────────────────────────────────────────────
interface PreviewPanelProps {
  locale?: Locale;
}

// ─── Helpers ────────────────────────────────────────────────
function detectType(path: string): "html" | "md" | "other" {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "md" || ext === "markdown") return "md";
  return "other";
}

/**
 * Inline external CSS and JS files referenced in HTML into the document.
 * Resolves paths relative to the HTML file's location in the VFS.
 * Supports: <link href="...">, <script src="...">
 */
function inlineResources(html: string, htmlPath: string): string {
  const dir = htmlPath.substring(0, htmlPath.lastIndexOf("/") + 1);

  // Helper: try to read a resolved VFS path, falling back to PROJECT_ROOT prefix
  function tryRead(resolved: string): string | null {
    let content = vfsRead(resolved);
    if (content === null && !resolved.startsWith(PROJECT_ROOT)) {
      content = vfsRead(PROJECT_ROOT + resolved);
    }
    return content;
  }

  // Inline <link href="..."> stylesheets
  let result = html.replace(
    /<link\s+[^>]*href="([^"]+)"[^>]*>/gi,
    (_match, href: string) => {
      // Skip absolute URLs and non-stylesheet links
      if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) return _match;
      const ext = href.split(".").pop()?.toLowerCase();
      if (ext !== "css") return _match;

      const resolved = href.startsWith("/") ? href : dir + href;
      const content = tryRead(resolved);
      if (content !== null) {
        return `<style>\n${content}\n</style>`;
      }
      return _match;
    }
  );

  // Inline <script src="...">
  result = result.replace(
    /<script\s+[^>]*src="([^"]+)"[^>]*>\s*<\/script>/gi,
    (_match, src: string) => {
      // Skip absolute URLs
      if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("//")) return _match;

      const resolved = src.startsWith("/") ? src : dir + src;
      const content = tryRead(resolved);
      if (content !== null) {
        return `<script>\n${content}\n</script>`;
      }
      return _match;
    }
  );

  return result;
}

function openInNewTab(content: string, type: "html" | "md") {
  const mimeType = type === "html" ? "text/html" : "text/plain";
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ─── Component ──────────────────────────────────────────────
export function PreviewPanel({ locale }: PreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [store, setStore] = useState<IdeState>(ideStore.getState());
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return ideStore.subscribe((s) => setStore(s));
  }, []);

  const { activeFile, vfsVersion } = store;

  // Re-render preview when activeFile, vfsVersion, or refreshKey changes
  useEffect(() => {
    if (!activeFile) return;
    const type = detectType(activeFile);
    if (type === "other") return;

    const content = vfsRead(activeFile);
    if (content === null) return;

    setError(null);

    if (type === "html" && iframeRef.current) {
      // Inline linked CSS/JS from VFS so the preview works with separate files
      const inlined = inlineResources(content, activeFile);
      iframeRef.current.srcdoc = inlined;
    } else if (type === "md") {
      // Markdown is rendered inside a content div below
    }
  }, [activeFile, vfsVersion, refreshKey]);

  // Parse Markdown
  let mdHtml = "";
  if (activeFile && detectType(activeFile) === "md") {
    const raw = vfsRead(activeFile);
    if (raw !== null) {
      try {
        mdHtml = marked.parse(raw, { async: false }) as string;
      } catch {
        mdHtml = `<p style="color:#e06c9e">Error rendering Markdown</p><pre>${raw}</pre>`;
      }
    }
  }

  const type = activeFile ? detectType(activeFile) : "other";
  const noFile = !activeFile;
  const isPreviewable = type !== "other";

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: colors.bg,
    }}>
      {/* Title bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "4px 8px",
        borderBottom: `1px solid ${colors.border}`,
        color: colors.textMuted, fontSize: "9px",
        textTransform: "uppercase", letterSpacing: "0.5px",
        fontFamily: fonts.mono, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span>{t("preview.title", locale) || "preview"}</span>
          {activeFile && isPreviewable && (
            <span style={{ color: colors.textSecondary, textTransform: "none", fontSize: "9px" }}>
              — {activeFile.split("/").pop()}
            </span>
          )}
        </div>
        {activeFile && isPreviewable && (
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              onClick={() => { setError(null); setRefreshKey((k) => k + 1); }}
              title="Refresh preview"
              style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: "11px", padding: "0 2px", lineHeight: 1 }}
            >
              ↻
            </button>
            <button
              onClick={() => {
                const content = vfsRead(activeFile);
                if (content !== null) {
                  const inlined = type === "html" ? inlineResources(content, activeFile) : content;
                  openInNewTab(inlined, type);
                }
              }}
              title="Open in new tab"
              style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: "11px", padding: "0 2px", lineHeight: 1 }}
            >
              ↗
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, position: "relative" }}>
        {noFile ? (
          <EmptyState message={t("preview.noFile", locale) || "no file open"} />
        ) : type === "other" ? (
          <EmptyState message={t("preview.noHtml", locale) || "open an HTML or Markdown file to preview"} />
        ) : error ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            height: "100%", gap: "8px",
            color: "#e06c9e", fontSize: "10px", fontFamily: fonts.mono,
            padding: "20px", textAlign: "center",
          }}>
            <span>⚠ Preview error: {error}</span>
            <button onClick={() => setRefreshKey((k) => k + 1)}
              style={{ background: "none", border: `1px solid ${colors.borderEmphasis}`, color: colors.textSecondary, fontSize: "10px", padding: "4px 10px", cursor: "pointer", fontFamily: fonts.mono }}>
              [Retry]
            </button>
          </div>
        ) : type === "html" ? (
          <iframe
            ref={iframeRef}
            sandbox="allow-scripts"
            title={(t("preview.title", locale) || "preview") + " - " + (activeFile?.split("/").pop() ?? "")}
            style={{
              width: "100%", height: "100%",
              border: "none", background: "#ffffff",
              display: "block",
            }}
          />
        ) : (
          <div
            className="md-content"
            dangerouslySetInnerHTML={{ __html: mdHtml }}
            style={{
              padding: "12px",
              overflow: "auto",
              height: "100%",
              boxSizing: "border-box",
              background: "#0a0a0a",
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100%",
      color: colors.textMuted, fontSize: "10px",
      fontFamily: fonts.mono, fontStyle: "italic",
      padding: "20px", textAlign: "center",
    }}>
      {message}
    </div>
  );
}
