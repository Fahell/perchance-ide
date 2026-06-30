import { useEffect, useState } from "preact/hooks";
import type { ChunkSummary } from "../context-manager.js";
import { clearChunkedSummaries, clearSummary, getChunkedSummaries, getContextState, getTotalMessageCount, type ContextState } from "../context-manager.js";
import { t, type Locale } from "../i18n/index.js";
import { clearMemories, deleteMemory, getMemories } from "../memory.js";
import { colors, fonts } from "./theme.js";

interface ContextViewerProps {
  isOpen: boolean;
  locale?: Locale;
  onClose: () => void;
  onRefresh: () => void;
}

export function ContextViewer({ isOpen, locale, onClose, onRefresh }: ContextViewerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Async state
  const [state, setState] = useState<ContextState | null>(null);
  const [memories, setMemories] = useState<string[]>([]);
  const [chunks, setChunks] = useState<ChunkSummary[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    loadData();
  }, [isOpen]);

  async function loadData() {
    try {
      const [ctx, mems, chks, total] = await Promise.all([
        getContextState(""),
        getMemories(),
        getChunkedSummaries(),
        Promise.resolve(getTotalMessageCount()),
      ]);
      setState(ctx);
      setMemories(mems);
      setChunks(chks);
      setTotalMessages(total);
    } catch (e) {
      console.warn("[ContextViewer] load failed:", e);
    }
  }

  if (!isOpen) return null;

  const usagePercent = state ? Math.min(100, Math.round((state.totalTokens / state.maxTokens) * 100)) : 0;
  const isOverBudget = state ? state.totalTokens > state.maxTokens : false;

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResults(null);
    try {
      const { getTool } = await import("../tools/index.js");
      const tool = getTool("search_history");
      if (tool) {
        const result = await tool.execute({ query: searchQuery });
        setSearchResults(result);
      } else {
        setSearchResults("search_history tool not available");
      }
    } catch (err) {
      setSearchResults("Search failed: " + (err instanceof Error ? err.message : String(err)));
    }
    setIsSearching(false);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: "0",
        left: "0",
        right: "0",
        bottom: "0",
        background: "rgba(0,0,0,0.85)",
        zIndex: "1000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.bg,
          padding: "16px",
          maxWidth: "420px",
          width: "92%",
          maxHeight: "80vh",
          overflowY: "auto",
          border: `1px solid ${colors.border}`,
          fontFamily: fonts.mono,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h3 style={{ margin: "0", color: colors.textSecondary, fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase" }}>
            {t("context.title", locale) || "context"}
          </h3>
          <span
            onClick={onClose}
            style={{ color: colors.textMuted, cursor: "pointer", fontSize: "11px" }}
          >
            [x]
          </span>
        </div>

        {/* Token Budget Bar */}
        <div style={{ marginBottom: "14px", padding: "10px 12px", background: colors.surface1, border: `1px solid ${colors.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ color: colors.textSecondary, fontSize: "10px" }}>
              {t("context.tokens", locale) || "tokens"}
            </span>
            <span style={{ color: isOverBudget ? colors.statusError : colors.textMuted, fontSize: "10px" }}>
              {state ? state.totalTokens.toLocaleString() : "…"} / {state ? state.maxTokens.toLocaleString() : "…"}
            </span>
          </div>
          <div style={{ width: "100%", height: "4px", background: colors.surface3, position: "relative" }}>
            <div style={{
              width: `${usagePercent}%`,
              height: "100%",
              background: isOverBudget ? colors.statusError : colors.textSecondary,
              transition: "width 0.3s",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
            <span style={{ color: colors.textMuted, fontSize: "9px" }}>
              {t("context.totalHistory", locale) || "total messages"}: {totalMessages}
            </span>
            <span style={{ color: colors.textMuted, fontSize: "9px" }}>
              {t("context.messages", locale) || "messages"}: {state ? state.recentMessages.length : 0}
            </span>
          </div>
        </div>

        {/* Hot Tier — Recent Messages */}
        <div style={{ marginBottom: "14px", padding: "10px 12px", background: colors.surface1, border: `1px solid ${colors.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ color: colors.textSecondary, fontSize: "10px" }}>
              {t("context.messages", locale) || "messages"} ({state ? state.recentMessages.length : 0})
            </span>
            <span style={{ color: colors.textMuted, fontSize: "9px", padding: "2px 6px", background: colors.surface2, border: `1px solid ${colors.border}` }}>
              {t("context.tier.hot", locale) || "hot — in prompt"}
            </span>
          </div>
          <div style={{ maxHeight: "120px", overflowY: "auto" }}>
            {state?.recentMessages.map((msg, i) => (
              <div key={i} style={{ marginBottom: "4px", fontSize: "9px" }}>
                <span style={{ color: msg.role === "user" ? colors.text : colors.textSecondary }}>
                  {msg.role === "user" ? "You" : "Agent"}:
                </span>{" "}
                <span style={{ color: colors.textMuted }}>
                  {msg.content.length > 80 ? msg.content.slice(0, 80) + "..." : msg.content}
                </span>
              </div>
            ))}
            {(!state || state.recentMessages.length === 0) && (
              <div style={{ color: colors.textMuted, fontSize: "9px" }}>
                {t("context.noMessages", locale) || "no messages yet"}
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div style={{ marginBottom: "14px", padding: "10px 12px", background: colors.surface1, border: `1px solid ${colors.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ color: colors.textSecondary, fontSize: "10px" }}>
              {t("context.summary", locale) || "summary"} ({state ? state.summaryTokens : 0} {t("context.tokens", locale) || "tokens"})
            </span>
            {state?.summary && (
              <span
                onClick={async () => { await clearSummary(); loadData(); }}
                style={{ color: colors.textMuted, cursor: "pointer", fontSize: "9px" }}
              >
                [clear]
              </span>
            )}
          </div>
          <div style={{ color: colors.textMuted, fontSize: "10px", lineHeight: "1.5" }}>
            {state?.summary
              ? state.summary.length > 200
                ? state.summary.slice(0, 200) + "..."
                : state.summary
              : t("context.noSummary", locale) || "no summary yet — will be generated when conversation exceeds token budget"
            }
          </div>
        </div>

        {/* Chunked Summaries */}
        {chunks.length > 0 && (
          <div style={{ marginBottom: "14px", padding: "10px 12px", background: colors.surface1, border: `1px solid ${colors.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ color: colors.textSecondary, fontSize: "10px" }}>
                {t("context.chunks", locale) || "chunked summaries"} ({chunks.length})
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <span style={{ color: colors.textMuted, fontSize: "9px", padding: "2px 6px", background: colors.surface2, border: `1px solid ${colors.border}` }}>
                  {t("context.tier.warm", locale) || "warm — searchable"}
                </span>
                <span
                  onClick={async () => { await clearChunkedSummaries(); loadData(); }}
                  style={{ color: colors.textMuted, cursor: "pointer", fontSize: "9px" }}
                >
                  [clear]
                </span>
              </div>
            </div>
            <div style={{ maxHeight: "100px", overflowY: "auto" }}>
              {chunks.map((chunk, i) => (
                <div key={i} style={{ marginBottom: "4px", fontSize: "9px" }}>
                  <span style={{ color: colors.textSecondary }}>#{chunk.from}-{chunk.to}:</span>{" "}
                  <span style={{ color: colors.textMuted }}>
                    {chunk.summary.length > 100 ? chunk.summary.slice(0, 100) + "..." : chunk.summary}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search History */}
        <div style={{ marginBottom: "14px", padding: "10px 12px", background: colors.surface1, border: `1px solid ${colors.border}` }}>
          <div style={{ color: colors.textSecondary, fontSize: "10px", marginBottom: "6px" }}>
            {t("context.search", locale) || "search"}
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              type="text"
              value={searchQuery}
              onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder={t("context.searchPlaceholder", locale) || "search history..."}
              style={{
                flex: "1",
                background: colors.surface2,
                border: `1px solid ${colors.border}`,
                color: colors.text,
                padding: "4px 8px",
                fontSize: "10px",
                fontFamily: fonts.mono,
                outline: "none",
              }}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              style={{
                background: colors.surface2,
                border: `1px solid ${colors.border}`,
                color: isSearching ? colors.textMuted : colors.text,
                padding: "4px 8px",
                fontSize: "10px",
                fontFamily: fonts.mono,
                cursor: isSearching ? "default" : "pointer",
              }}
            >
              {isSearching ? "..." : t("context.search", locale) || "search"}
            </button>
          </div>
          {searchResults && (
            <div style={{ marginTop: "8px", color: colors.textMuted, fontSize: "9px", lineHeight: "1.5", whiteSpace: "pre-wrap", maxHeight: "120px", overflowY: "auto" }}>
              {searchResults}
            </div>
          )}
        </div>

        {/* Memories */}
        <div style={{ padding: "10px 12px", background: colors.surface1, border: `1px solid ${colors.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ color: colors.textSecondary, fontSize: "10px" }}>
              {t("context.memories", locale) || "memories"} ({memories.length})
            </span>
            {memories.length > 0 && (
              <span
                onClick={async () => { await clearMemories(); loadData(); }}
                style={{ color: colors.textMuted, cursor: "pointer", fontSize: "9px" }}
              >
                [clear all]
              </span>
            )}
          </div>
          <div style={{ maxHeight: "120px", overflowY: "auto" }}>
            {memories.map((mem, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "3px" }}>
                <span style={{ color: colors.textMuted, fontSize: "9px", flex: "1", marginRight: "6px" }}>
                  {mem.length > 100 ? mem.slice(0, 100) + "..." : mem}
                </span>
                <span
                  onClick={async () => { await deleteMemory(i); loadData(); }}
                  style={{ color: colors.textMuted, cursor: "pointer", fontSize: "9px", flexShrink: "0" }}
                >
                  [x]
                </span>
              </div>
            ))}
            {memories.length === 0 && (
              <div style={{ color: colors.textMuted, fontSize: "9px" }}>
                {t("context.noMemories", locale) || "no memories extracted yet"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
