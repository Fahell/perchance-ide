/**
 * PreviewPanel — live HTML preview via sandboxed iframe.
 *
 * Shows rendered HTML when a .html file is active in the editor.
 * Auto-updates when the file content changes (via vfsVersion counter).
 * Uses srcdoc + sandbox="allow-scripts" for security.
 */

import { useEffect, useRef, useState } from "preact/hooks";
import { t, type Locale } from "../i18n/index.js";
import { ideStore, type IdeState } from "../store.js";
import { vfsRead } from "../vfs.js";
import { colors, fonts } from "./theme.js";

// ─── Props ──────────────────────────────────────────────────
interface PreviewPanelProps {
  locale?: Locale;
}

// ─── Component ──────────────────────────────────────────────
export function PreviewPanel({ locale }: PreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [store, setStore] = useState<IdeState>(ideStore.getState());

  useEffect(() => {
    return ideStore.subscribe((s) => setStore(s));
  }, []);

  const { activeFile, vfsVersion } = store;

  // Re-render preview when activeFile or vfsVersion changes
  useEffect(() => {
    if (!activeFile) return;
    const isHtml = activeFile.endsWith(".html") || activeFile.endsWith(".htm");
    if (!isHtml) return;
    const content = vfsRead(activeFile);
    if (content !== null && iframeRef.current) {
      iframeRef.current.srcdoc = content;
    }
  }, [activeFile, vfsVersion]);

  // Determine what to show
  const noFile = !activeFile;
  const isHtml = activeFile
    ? (activeFile.endsWith(".html") || activeFile.endsWith(".htm"))
    : false;

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: colors.bg,
    }}>
      {/* Title bar */}
      <div style={{
        padding: "4px 8px",
        borderBottom: `1px solid ${colors.border}`,
        color: colors.textMuted, fontSize: "9px",
        textTransform: "uppercase", letterSpacing: "0.5px",
        fontFamily: fonts.mono, flexShrink: 0,
      }}>
        {t("preview.title", locale) || "preview"}
        {activeFile && isHtml && (
          <span style={{ color: colors.textSecondary, marginLeft: "6px", textTransform: "none", fontSize: "9px" }}>
            — {activeFile.split("/").pop()}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, position: "relative" }}>
        {noFile ? (
          <EmptyState message={t("preview.noFile", locale) || "no file open"} />
        ) : !isHtml ? (
          <EmptyState message={t("preview.noHtml", locale) || "open an HTML file to preview"} />
        ) : (
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
