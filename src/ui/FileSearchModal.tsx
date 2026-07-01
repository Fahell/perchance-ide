/**
 * FileSearchModal — fuzzy file search (Ctrl+P).
 *
 * Modal overlay with real-time fuzzy matching against VFS paths.
 * Arrow keys navigate, Enter opens the selected file.
 */

import { useEffect, useRef, useState } from "preact/hooks";
import { t, type Locale } from "../i18n/index.js";
import { ideStore } from "../store.js";
import { vfsGetAll } from "../vfs.js";
import { colors, fonts } from "./theme.js";

// ─── Props ──────────────────────────────────────────────────
interface FileSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale?: Locale;
}

// ─── Fuzzy scoring (10.5) ───────────────────────────────────
function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (q.length === 0) return 0;
  let qi = 0;
  let score = 0;
  let prev = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      // Consecutive match bonus
      if (ti === prev + 1) score += 5;
      // Separator bonus (/, _, -, .)
      if (ti > 0 && "/_-.".includes(t[ti - 1])) score += 10;
      // Filename bonus (after last /)
      const lastSlash = t.lastIndexOf("/");
      if (ti > lastSlash && qi === 0) score += 15;
      score += 1;
      qi++;
      prev = ti;
    }
  }
  if (qi < q.length) return null;
  // Completeness bonus
  score += (q.length / t.length) * 10;
  return score;
}

// ─── Component ──────────────────────────────────────────────
export function FileSearchModal({ isOpen, onClose, locale }: FileSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ path: string; score: number }[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      // Auto-focus input after mount
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filter on query change
  useEffect(() => {
    if (!query.trim()) {
      // Show all files when query is empty (up to 20)
      const all = vfsGetAll().map((e) => ({ path: e.path, score: 0 }));
      setResults(all.slice(0, 20));
      setSelectedIndex(0);
      return;
    }

    const allPaths = vfsGetAll().map((e) => e.path);
    const scored: { path: string; score: number }[] = [];
    for (const p of allPaths) {
      const s = fuzzyScore(query, p);
      if (s !== null) scored.push({ path: p, score: s });
    }
    scored.sort((a, b) => b.score - a.score);
    setResults(scored.slice(0, 20));
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  function openSelected() {
    const entry = results[selectedIndex];
    if (!entry) return;
    const parts = entry.path.split("/").filter(Boolean);
    const name = parts.pop() ?? entry.path;
    const ext = entry.path.split(".").pop()?.toLowerCase() ?? "js";
    ideStore.getState().openFile(entry.path, name, ext);
    onClose();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      openSelected();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  const noFiles = vfsGetAll().length === 0;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.7)",
        display: "flex", justifyContent: "center",
      }}
      onClick={(e: MouseEvent) => {
        // Close if clicking the overlay background
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          position: "absolute", top: "20%",
          width: "450px", maxWidth: "90vw",
          background: colors.surface1,
          border: `1px solid ${colors.borderEmphasis}`,
          maxHeight: "400px",
          display: "flex", flexDirection: "column",
          fontFamily: fonts.mono,
        }}
      >
        {/* Input */}
        <input
          ref={inputRef}
          value={query}
          onInput={(e: any) => setQuery(e.currentTarget.value)}
          onKeyDown={handleKeyDown as any}
          placeholder={noFiles ? t("fileSearch.noFiles", locale) || "no files in project" : t("fileSearch.placeholder", locale) || "Search files..."}
          disabled={noFiles}
          style={{
            width: "100%", boxSizing: "border-box",
            background: colors.inputBg, border: "none",
            borderBottom: `1px solid ${colors.border}`,
            color: colors.text, fontSize: "12px",
            fontFamily: fonts.mono, padding: "10px 12px",
            outline: "none",
          }}
        />

        {/* Results */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
          {noFiles ? (
            <div style={{ padding: "12px", color: colors.textMuted, fontSize: "10px", textAlign: "center" }}>
              {t("fileSearch.noFiles", locale) || "no files in project"}
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: "12px", color: colors.textMuted, fontSize: "10px", textAlign: "center" }}>
              {t("fileSearch.noResults", locale) || "no results"}
            </div>
          ) : (
            results.map((r, i) => (
              <div key={r.path}
                onClick={() => { setSelectedIndex(i); openSelected(); }}
                onMouseEnter={() => setSelectedIndex(i)}
                style={{
                  padding: "4px 12px", cursor: "pointer",
                  fontSize: "11px",
                  color: i === selectedIndex ? colors.text : colors.textSecondary,
                  background: i === selectedIndex ? colors.surface2 : "transparent",
                }}>
                {r.path}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div style={{
            borderTop: `1px solid ${colors.border}`,
            padding: "4px 12px", fontSize: "9px",
            color: colors.textMuted, textAlign: "right",
          }}>
            {results.length >= 20 ? "20+ " : results.length + " "}
            {t("fileSearch.results", locale)?.replace("{n}", String(results.length >= 20 ? "20+" : results.length)) || results.length + " results"}
          </div>
        )}
      </div>
    </div>
  );
}
