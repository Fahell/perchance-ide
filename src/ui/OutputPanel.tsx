/**
 * OutputPanel — persistent Python output history.
 *
 * Shows the last 20 outputs from run_python / execute_script tools.
 * Each entry shows stdout, stderr, exit code, and timestamp.
 * Expandable cards with copy-to-clipboard.
 *
 * Features: search/filter, collapse-all/expand-all, auto-scroll,
 * dynamic relative timestamps.
 */

import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { t, type Locale } from "../i18n/index.js";
import { ideStore, type IdeState, type OutputEntry } from "../store.js";
import { colors, fonts } from "./theme.js";

// ─── Props ──────────────────────────────────────────────────
interface OutputPanelProps {
  locale?: Locale;
}

// ─── RelativeTime — dynamic timestamp ───────────────────────
function RelativeTime({ timestamp }: { timestamp: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const diff = now - timestamp;
  if (diff < 60_000) return <span>just now</span>;
  if (diff < 3_600_000) return <span>{Math.floor(diff / 60_000)}m ago</span>;
  if (diff < 86_400_000) return <span>{Math.floor(diff / 3_600_000)}h ago</span>;
  return <span>{new Date(timestamp).toLocaleString()}</span>;
}

// ─── Helpers ────────────────────────────────────────────────
function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  });
}

// ─── Component ──────────────────────────────────────────────
export function OutputPanel({ locale }: OutputPanelProps) {
  const [store, setStore] = useState<IdeState>(ideStore.getState());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(store.outputs.length);

  useEffect(() => {
    return ideStore.subscribe((s) => setStore(s));
  }, []);

  const { outputs } = store;

  // Auto-scroll to top when new output arrives
  useEffect(() => {
    if (outputs.length > prevCountRef.current && listRef.current) {
      listRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    prevCountRef.current = outputs.length;
  }, [outputs.length]);

  // Filter outputs by search query
  const filtered = searchQuery.trim()
    ? outputs.filter((e) =>
        e.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.stdout && e.stdout.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.stderr && e.stderr.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : outputs;

  // Show newest first
  const reversed = [...filtered].reverse();

  const handleCopy = useCallback((id: string, text: string) => {
    copyText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleClear = useCallback(() => {
    ideStore.getState().clearOutputs();
    setExpandedIds(new Set());
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const ids = outputs.map((e) => e.id);
    setExpandedIds(new Set(ids));
  }, [outputs.length]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const hasSearch = outputs.length >= 5;

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: colors.bg, fontFamily: fonts.mono, fontSize: "10px",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "4px 8px",
        borderBottom: `1px solid ${colors.border}`,
        color: colors.textMuted, fontSize: "9px",
        textTransform: "uppercase", letterSpacing: "0.5px",
        flexShrink: 0,
      }}>
        <span>{t("output.title", locale) || "output"}</span>
        {outputs.length > 0 && (
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            {filtered.length > 1 && (
              <>
                <button onClick={expandAll}
                  style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: "9px", padding: "0 4px", fontFamily: fonts.mono }}>
                  [+]
                </button>
                <button onClick={collapseAll}
                  style={{ background: "none", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: "9px", padding: "0 4px", fontFamily: fonts.mono }}>
                  [-]
                </button>
              </>
            )}
            <button onClick={handleClear}
              style={{
                background: "none", border: `1px solid ${colors.border}`,
                color: colors.textMuted, cursor: "pointer",
                fontSize: "9px", padding: "2px 6px",
                fontFamily: fonts.mono,
              }}>
              {t("output.clear", locale) || "clear"}
            </button>
          </div>
        )}
      </div>

      {/* Search input */}
      {hasSearch && (
        <div style={{
          display: "flex", alignItems: "center",
          padding: "4px 8px", borderBottom: `1px solid ${colors.border}`,
        }}>
          <input
            value={searchQuery}
            onInput={(e: any) => setSearchQuery(e.currentTarget.value)}
            placeholder={t("fileSearch.placeholder", locale) || "filter outputs..."}
            style={{
              flex: 1,
              background: colors.inputBg, border: `1px solid ${colors.border}`,
              color: colors.text, fontSize: "10px", fontFamily: fonts.mono,
              outline: "none", padding: "2px 6px",
            }}
          />
        </div>
      )}

      {/* List */}
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "2px 0" }}>
        {reversed.length === 0 ? (
          <div style={{
            padding: "20px", textAlign: "center",
            color: colors.textMuted, fontSize: "10px", fontStyle: "italic",
          }}>
            {searchQuery.trim()
              ? (t("fileSearch.noResults", locale) || "no results")
              : (t("output.empty", locale) || "no outputs yet")}
          </div>
        ) : (
          reversed.map((entry) => (
            <OutputEntryCard
              key={entry.id}
              entry={entry}
              isExpanded={expandedIds.has(entry.id)}
              isCopied={copiedId === entry.id}
              onToggle={() => toggleExpanded(entry.id)}
              onCopy={handleCopy}
              locale={locale}
            />
          ))
        )}
      </div>

      {/* Footer count */}
      {outputs.length > 0 && (
        <div style={{
          borderTop: `1px solid ${colors.border}`,
          padding: "3px 8px", fontSize: "9px",
          color: colors.textMuted, flexShrink: 0,
        }}>
          {filtered.length === outputs.length
            ? `${outputs.length} / 20`
            : `${filtered.length} / ${outputs.length}`}
        </div>
      )}
    </div>
  );
}

// ─── Output Entry Card ──────────────────────────────────────
interface OutputEntryCardProps {
  entry: OutputEntry;
  isExpanded: boolean;
  isCopied: boolean;
  onToggle: () => void;
  onCopy: (id: string, text: string) => void;
  locale?: Locale;
}

function OutputEntryCard({ entry, isExpanded, isCopied, onToggle, onCopy, locale }: OutputEntryCardProps) {
  const isError = entry.exitCode !== 0;
  const cmdPreview = entry.command.length > 50
    ? entry.command.slice(0, 50) + "..."
    : entry.command;

  return (
    <div style={{
      margin: "2px 4px",
      borderLeft: `2px solid ${isError ? "#f44336" : colors.statusDone}`,
      background: colors.surface1,
    }}>
      {/* Header (clickable) */}
      <button
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: "6px",
          width: "100%", padding: "4px 8px",
          background: "none", border: "none", cursor: "pointer",
          textAlign: "left", fontSize: "10px",
          fontFamily: fonts.mono, color: colors.textSecondary,
        }}
      >
        {/* Exit code badge */}
        <span style={{
          flexShrink: 0, fontSize: "9px", fontWeight: "bold",
          color: isError ? "#f44336" : "#4caf50",
          minWidth: "16px",
        }}>
          {entry.exitCode}
        </span>
        {/* Command preview */}
        <span style={{
          flex: 1, overflow: "hidden", textOverflow: "ellipsis",
          whiteSpace: "nowrap", color: colors.textSecondary,
        }}>
          {cmdPreview}
        </span>
        {/* Dynamic timestamp */}
        <span style={{
          flexShrink: 0, fontSize: "8px", color: colors.textMuted,
        }}>
          <RelativeTime timestamp={entry.timestamp} />
        </span>
        {/* Arrow */}
        <span style={{ flexShrink: 0, color: colors.textMuted, fontSize: "8px" }}>
          {isExpanded ? "▾" : "▸"}
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div style={{ padding: "4px 8px 6px", borderTop: `1px solid ${colors.border}` }}>
          {/* stdout */}
          {entry.stdout && (
            <div style={{ marginBottom: entry.stderr ? "4px" : 0 }}>
              <div style={{ fontSize: "8px", color: colors.textMuted, marginBottom: "2px" }}>
                {t("output.stdout", locale) || "stdout"}:
              </div>
              <pre style={{
                margin: 0, padding: "4px 6px",
                background: colors.surface2, color: colors.textSecondary,
                fontSize: "9px", lineHeight: "1.4",
                maxHeight: "150px", overflow: "auto",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {entry.stdout}
              </pre>
            </div>
          )}

          {/* stderr */}
          {entry.stderr && (
            <div style={{ marginBottom: "4px" }}>
              <div style={{ fontSize: "8px", color: "#f44336", marginBottom: "2px" }}>
                {t("output.stderr", locale) || "stderr"}:
              </div>
              <pre style={{
                margin: 0, padding: "4px 6px",
                background: colors.surface2, color: "#ef9a9a",
                fontSize: "9px", lineHeight: "1.4",
                maxHeight: "150px", overflow: "auto",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {entry.stderr}
              </pre>
            </div>
          )}

          {/* Copy button */}
          <button
            onClick={() => {
              const text = [
                `Exit code: ${entry.exitCode}`,
                entry.stdout ? `stdout:\n${entry.stdout}` : "",
                entry.stderr ? `stderr:\n${entry.stderr}` : "",
              ].filter(Boolean).join("\n\n");
              onCopy(entry.id, text);
            }}
            style={{
              background: "none", border: `1px solid ${colors.border}`,
              color: colors.textMuted, cursor: "pointer",
              fontSize: "8px", padding: "2px 6px",
              fontFamily: fonts.mono,
            }}
          >
            {isCopied
              ? (t("output.copied", locale) || "copied!")
              : (t("output.copy", locale) || "copy")}
          </button>
        </div>
      )}
    </div>
  );
}
