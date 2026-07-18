/**
 * TerminalPanel — Interactive terminal UI component.
 *
 * Owns its own xterm.js Terminal instance (v6.0.0) styled with the IDE's
 * dark theme.  Bridges I/O to BrowserPod via the manager's
 * createInteractiveTerminal() which uses createCustomTerminal under the hood.
 *
 * This replaces the old createDefaultTerminal(element) black-box approach.
 * We now control fontSize, theme, cursor, and fontFamily directly.
 *
 * Features:
 * - xterm.js + FitAddon with ResizeObserver for responsive sizing
 * - Custom GitHub Dark-inspired color theme
 * - Bridge: xterm.onData → BP terminal stdin (.write/.input)
 * - Bridge: BP terminal onOutput → xterm.write(bytes)
 * - Resize: xterm.onResize → BP terminal resize(cols, rows)
 * - Bash history persistence (save on close, restore on open)
 * - Maximize / Restart / Close header buttons
 */

import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { browserPodManager } from "../browserpod/manager.js";
import { pullProjectFilesFromPod } from "../tools/shell-tools.js";
import { ideStore } from "../store.js";
import { storageGet, storageSet } from "../storage.js";
import { ResizeHandle } from "./ResizeHandle.js";
import { colors, fonts } from "./theme.js";

// Build-time constant injected by esbuild — `dist-branch` only ever publishes
// `@<sha>`, never the literal `dev` suffix, so `showStack` evaluates false in
// production deployments while staying on for `pnpm dev` local builds.
declare const __COMMIT__: string;

interface TerminalPanelProps {
  visible: boolean;
}

const MIN_HEIGHT = 100;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 250;
const STORAGE_KEY = "terminal:height";
const BASH_HISTORY_KEY = "terminal:bash_history";
const HISTORY_PATH = "/home/user/.bash_history";

function loadSavedHeight(): number {
  const saved = storageGet<number>(STORAGE_KEY);
  if (saved && saved >= MIN_HEIGHT && saved <= MAX_HEIGHT) return saved;
  return DEFAULT_HEIGHT;
}

/** Best-effort save of bash history from Pod → localStorage. */
async function saveBashHistory(): Promise<void> {
  if (!browserPodManager.isReady()) return;
  try {
    const history = await browserPodManager.readFile(HISTORY_PATH);
    if (history && history.trim()) {
      storageSet(BASH_HISTORY_KEY, history);
      console.log("[TerminalPanel] Bash history saved:", history.split("\n").length, "lines");
    }
  } catch {
    // Non-critical — history is best-effort
  }
}

/** Restore bash history from localStorage → Pod filesystem. */
async function loadBashHistory(): Promise<void> {
  if (!browserPodManager.isReady()) return;
  try {
    const saved = storageGet<string>(BASH_HISTORY_KEY);
    if (saved && saved.trim()) {
      await browserPodManager.writeFile(HISTORY_PATH, saved);
      console.log("[TerminalPanel] Bash history restored:", saved.split("\n").length, "lines");
    }
  } catch (err) {
    console.warn("[TerminalPanel] Failed to restore bash history:", err);
  }
}

/** Pretty-print the first 8 lines of an error for the dev-only stack block. */
function formatStack(err: unknown): string {
  if (err instanceof Error) {
    const raw = err.stack ?? `${err.name}: ${err.message}`;
    return raw.split("\n").slice(0, 8).join("\n").trim();
  }
  return String(err);
}

/** GitHub Dark-inspired xterm.js theme matching the IDE palette. */
const XTERM_THEME = {
  background: "#0d1117",
  foreground: "#c9d1d9",
  cursor: "#58a6ff",
  cursorAccent: "#0d1117",
  selectionBackground: "#264f78",
  black: "#484f58",
  red: "#ff7b72",
  green: "#3fb950",
  yellow: "#d29922",
  blue: "#58a6ff",
  magenta: "#bc8cff",
  cyan: "#39c5cf",
  white: "#b1bac4",
  brightBlack: "#6e7681",
  brightRed: "#ffa198",
  brightGreen: "#56d364",
  brightYellow: "#e3b341",
  brightBlue: "#79c0ff",
  brightMagenta: "#d2a8ff",
  brightCyan: "#56d4dd",
  brightWhite: "#f0f6fc",
};

export function TerminalPanel({ visible }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wasVisibleRef = useRef(false);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const bridgeRef = useRef<{ write: (d: string) => void; resize: (c: number, r: number) => void } | null>(null);
  const [height, setHeight] = useState(loadSavedHeight);
  const [maximized, setMaximized] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [lastError, setLastError] = useState<unknown>(null);
  const podReady = browserPodManager.isReady();
  const terminalFontSize = ideStore.getState().settings.terminalFontSize ?? 13;
  // Dev-only stack trace in the error UI; production builds never carry this.
  const showStack = typeof __COMMIT__ !== "undefined" && __COMMIT__.endsWith("dev");

  // Persist height when it changes
  useEffect(() => {
    storageSet(STORAGE_KEY, height);
  }, [height]);

  // Initialize xterm.js + BrowserPod shell when panel becomes visible
  useEffect(() => {
    if (!visible || !containerRef.current) return;

    let disposed = false;
    setConnecting(true);
    setError(null);

    async function init() {
      // Import xterm CSS dynamically
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/@xterm/xterm@6.0.0/css/xterm.min.css";
      if (!document.querySelector('link[href*="xterm"]')) {
        document.head.appendChild(link);
      }

      if (disposed || !containerRef.current) return;

      if (!browserPodManager.isReady()) {
        if (!disposed) {
          setConnecting(false);
          setError("BrowserPod not ready. Enable Node.js tools in Settings.");
        }
        return;
      }

      try {
        // Restore bash history before starting the shell
        await loadBashHistory();

        // ── Create xterm.js instance ──────────────────────
        const term = new Terminal({
          fontSize: terminalFontSize,
          fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
          theme: XTERM_THEME,
          cursorBlink: true,
          allowProposedApi: true,
          cols: 80,
          rows: 24,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        // Mount into the container div
        term.open(containerRef.current!);

        // Fit to container size
        try { fitAddon.fit(); } catch { /* container may not be sized yet */ }

        if (disposed) { term.dispose(); fitAddon.dispose(); return; }

        // ── Create the Pod shell via BrowserPod ────────────
        const bridge = await browserPodManager.createInteractiveTerminal({
          cols: term.cols,
          rows: term.rows,
          onOutput: (data: Uint8Array) => {
            if (!disposed) term.write(data);
          },
        });

        if (disposed) { term.dispose(); fitAddon.dispose(); return; }

        // ── Bridge stdin: keyboard → Pod process ──────────
        term.onData((data: string) => {
          bridge.write(data);
        });

        // ── Bridge resize: FitAddon → Pod ─────────────────
        term.onResize(({ cols, rows }) => {
          bridge.resize(cols, rows);
        });

        // ── Responsive: ResizeObserver re-fits on container size changes ──
        const resizeObserver = new ResizeObserver(() => {
          try { fitAddon.fit(); } catch { /* ignore */ }
        });
        resizeObserver.observe(containerRef.current!);

        // Store refs for cleanup
        termRef.current = term;
        fitAddonRef.current = fitAddon;
        bridgeRef.current = bridge;

        if (!disposed) {
          setConnecting(false);
          console.log("[TerminalPanel] Interactive terminal connected");

          // Dispose the ResizeObserver on next cleanup (we keep it alive here)
          // Attach to the termRef scope for cleanup
          (termRef as any)._resizeObserver = resizeObserver;

          // Auto-focus
          setTimeout(() => {
            if (!disposed) term.focus();
          }, 100);
        }
      } catch (err) {
        if (!disposed) {
          setConnecting(false);
          setLastError(err);
          setError(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    init();

    return () => {
      disposed = true;
      setConnecting(false);
      setError(null);
      // Save bash history before tearing down
      saveBashHistory();
      // Dispose xterm.js (cleans up DOM, event listeners, addons)
      const resizeObserver = (termRef as any)._resizeObserver as ResizeObserver | undefined;
      resizeObserver?.disconnect();
      termRef.current?.dispose();
      fitAddonRef.current?.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      bridgeRef.current = null;
      // Tell manager to clear its reference
      browserPodManager.disposeInteractiveTerminal().catch(() => {});
    };
  }, [visible, retryKey]);

  // Trigger Pod→VFS sync when panel is hidden
  useEffect(() => {
    if (wasVisibleRef.current && !visible) {
      pullProjectFilesFromPod().catch((err: unknown) => {
        console.warn("[TerminalPanel] Pod→VFS sync on hide failed:", err);
      });
    }
    wasVisibleRef.current = visible;
  }, [visible]);

  const handleResize = useCallback((delta: number) => {
    setHeight((h) => Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, h + delta)));
  }, []);

  function handleClose() {
    saveBashHistory();
    ideStore.getState().setTerminalOpen(false);
  }

  function handleMaximize() {
    setMaximized((m) => {
      if (m) {
        setHeight(loadSavedHeight());
      } else {
        storageSet(STORAGE_KEY, height);
        setHeight(MAX_HEIGHT);
      }
      return !m;
    });
  }

  function handleRestart() {
    saveBashHistory();
    setRetryKey((k) => k + 1);
  }

  /**
   * "Reset BP" state machine: dispose the live pod, re-boot using the API
   * key from settings, re-attach VFS → Pod sync, then bump retryKey so the
   * useEffect re-runs init(). Idempotent — additional clicks while running
   *   the await chain are ignored via `resetting` flag.
   *
   * The bash history is flushed BEFORE dispose() so the user's history is
   * not lost on rebuild. After dispose, _bashrcWritten resets to false and
   * the next createInteractiveTerminal writes a fresh .bashrc.
   */
  async function handleResetBrowserPod() {
    if (resetting) return;
    setResetting(true);
    // Reflect the in-flight state in the store immediately so the footer
    // badge doesn't keep showing the previous "error" / "idle" value.
    ideStore.getState().setBrowserPodStatus("loading");
    setLastError(null);
    setError(null);
    try {
      // Save history while Pod is still alive and connected.
      try { await saveBashHistory(); } catch { /* best-effort */ }
      // Dispose silently — any in-flight agent tools using the Pod will lose
      // their context; we trade off that to recover the interactive terminal.
      await browserPodManager.dispose().catch(() => undefined);
      const apiKey = ideStore.getState().settings.browserPodApiKey;
      if (!apiKey) {
        throw new Error("No BrowserPod API key in settings.");
      }
      const ok = await browserPodManager.boot({
        apiKey,
        storageKey: "agent-perchance",
        nodeVersion: "22",
      });
      if (!ok) {
        throw new Error(browserPodManager.getError() ?? "Boot failed after reset.");
      }
      // boot() leaves VFS subscriptions intact only via the reactive
      // subscriber in store.ts; the singleton manager needs explicit re-attach.
      browserPodManager.subscribeToVfsChanges();
      // Mirror startAgent(): re-attempt bulk VFS → Pod sync. Persistent disk
      // (storageKey="agent-perchance") usually retains files, but anything
      // VFS-only since the last pod boot won't be in the fresh pod otherwise.
      // Best-effort: a sync failure is non-fatal — see index.ts's pattern.
      try {
        const { syncVfsToPod } = await import("../tools/sync-utils.js");
        await syncVfsToPod(false);
      } catch (err) {
        console.warn("[TerminalPanel] Reset BP: VFS → Pod bulk sync failed (non-fatal):", err);
      }
      // The reactive subscriber in store.ts only fires on settings change, so
      // without this explicit call store.browserPodStatus would stay at
      // "loading". Only promote to "ready" if the user still has Node tools
      // enabled — otherwise respect their explicit opt-out (toggle off).
      const enabled = ideStore.getState().settings.toolNodeEnabled;
      ideStore.getState().setBrowserPodStatus(enabled ? "ready" : "idle");
      // Bumping retryKey cleans up the old xterm and re-runs init().
      setRetryKey((k) => k + 1);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setError(`Failed to reset BrowserPod: ${errMsg}`);
      setLastError(e);
      // Mirror the failure into the store so the footer badge reflects truth.
      ideStore.getState().setBrowserPodStatus("error", errMsg);
    } finally {
      setResetting(false);
    }
  }

  const displayHeight = maximized ? MAX_HEIGHT : height;

  if (!visible) return null;

  return (
    <div style={{
      borderTop: `1px solid ${colors.border}`,
      height: `${displayHeight}px`,
      minHeight: `${MIN_HEIGHT}px`,
      maxHeight: `${MAX_HEIGHT}px`,
      flexShrink: 0,
      background: colors.bg,
      position: "relative",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Resize handle */}
      <ResizeHandle direction="vertical" onResize={handleResize} />

      {/* Header bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "3px 8px",
        borderBottom: `1px solid ${colors.border}`,
        background: colors.surface1,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: "10px",
          fontFamily: fonts.mono,
          color: colors.textSecondary,
        }}>
          TERMINAL (Node.js / Bash)
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {/* Restart button */}
          {!connecting && !error && (
            <button
              onClick={handleRestart}
              title="Restart shell"
              style={{
                background: "none", border: "none", color: colors.textMuted,
                fontSize: "10px", cursor: "pointer", padding: "1px 5px",
                fontFamily: fonts.mono, borderRadius: "2px",
                transition: "background 0.1s, color 0.1s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = colors.surface2; (e.currentTarget as HTMLElement).style.color = colors.text; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = colors.textMuted; }}
            >↻</button>
          )}
          {/* Maximize button */}
          <button
            onClick={handleMaximize}
            title={maximized ? "Restore height" : "Maximize"}
            style={{
              background: "none", border: "none", color: colors.textMuted,
              fontSize: "10px", cursor: "pointer", padding: "1px 5px",
              fontFamily: fonts.mono, borderRadius: "2px",
              transition: "background 0.1s, color 0.1s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = colors.surface2; (e.currentTarget as HTMLElement).style.color = colors.text; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = colors.textMuted; }}
          >{maximized ? "⊟" : "⊞"}</button>
          {/* Status indicator */}
          <span style={{
            display: "flex", alignItems: "center", gap: "4px",
            fontSize: "9px", fontFamily: fonts.mono, color: colors.textMuted,
          }}>
            <span style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: connecting ? "none" : error ? "#f87171" : podReady ? "#4ade80" : colors.textMuted,
              animation: connecting ? "status-dot-pulse 1s ease-in-out infinite" : "none",
              border: connecting ? "1px solid #666" : "none",
              flexShrink: 0,
            }} />
            {connecting ? "connecting..." : error ? "error" : podReady ? "connected" : "disconnected"}
          </span>
          {/* Close button */}
          <button
            onClick={handleClose}
            title="Close terminal"
            style={{
              background: "none", border: "none", color: colors.textMuted,
              fontSize: "14px", cursor: "pointer", padding: "2px 6px",
              lineHeight: 1, fontFamily: fonts.mono, borderRadius: "2px",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = colors.surface2)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >×</button>
        </div>
      </div>

      {/* Content area */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", position: "relative",
      }}>
        {/* Loading state */}
        {connecting && (
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: colors.bg, zIndex: 5,
          }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
              <span style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: colors.textSecondary,
                animation: "status-dot-pulse 1s ease-in-out infinite",
              }} />
              <span style={{ fontSize: "10px", fontFamily: fonts.mono, color: colors.textMuted }}>
                connecting to terminal...
              </span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div style={{
            padding: "16px 12px", color: "#e74c3c", fontSize: "11px",
            fontFamily: fonts.mono, display: "flex", flexDirection: "column", gap: "10px",
          }}>
            <span>⚠ {error}</span>
            {showStack && lastError != null && (
              <details style={{ marginTop: "2px" }}>
                <summary
                  aria-label="Show error details"
                  style={{
                    fontSize: "9px", color: colors.textMuted, cursor: "pointer",
                    fontFamily: fonts.mono, padding: "2px 0",
                  }}
                >Show details</summary>
                <pre style={{
                  fontSize: "9px", color: colors.textMuted,
                  background: colors.surface2, padding: "8px",
                  margin: "6px 0 0", overflow: "auto",
                  maxHeight: "120px", whiteSpace: "pre-wrap",
                  wordBreak: "break-word", borderRadius: "3px",
                  fontFamily: fonts.mono, lineHeight: 1.4,
                }}>{formatStack(lastError)}</pre>
              </details>
            )}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={() => setRetryKey((k) => k + 1)}
                disabled={resetting}
                style={{
                  padding: "5px 14px", border: `1px solid ${colors.border}`,
                  borderRadius: "3px", background: colors.surface1, color: colors.text,
                  fontSize: "10px", fontFamily: fonts.mono,
                  cursor: resetting ? "default" : "pointer",
                  transition: "background 0.15s", opacity: resetting ? 0.5 : 1,
                }}
                onMouseEnter={(e) => { if (!resetting) (e.currentTarget.style.background = colors.surface2); }}
                onMouseLeave={(e) => { if (!resetting) (e.currentTarget.style.background = colors.surface1); }}
              >Retry</button>
              <button
                onClick={handleResetBrowserPod}
                disabled={resetting}
                title="Dispose + reboot BrowserPod using the API key from settings"
                style={{
                  padding: "5px 14px", border: `1px solid ${colors.border}`,
                  borderRadius: "3px", background: "transparent", color: colors.textSecondary,
                  fontSize: "10px", fontFamily: fonts.mono,
                  cursor: resetting ? "default" : "pointer",
                  transition: "background 0.15s", opacity: resetting ? 0.5 : 1,
                }}
                onMouseEnter={(e) => { if (!resetting) (e.currentTarget.style.background = colors.surface2); }}
                onMouseLeave={(e) => { if (!resetting) (e.currentTarget.style.background = "transparent"); }}
              >{resetting ? "Rebooting…" : "⚙ Reset BP"}</button>
              <button
                onClick={() => ideStore.getState().setTerminalOpen(false)}
                disabled={resetting}
                style={{
                  padding: "5px 14px", border: `1px solid ${colors.border}`,
                  borderRadius: "3px", background: "transparent", color: colors.textMuted,
                  fontSize: "10px", fontFamily: fonts.mono,
                  cursor: resetting ? "default" : "pointer",
                  transition: "background 0.15s", opacity: resetting ? 0.5 : 1,
                }}
                onMouseEnter={(e) => { if (!resetting) (e.currentTarget.style.background = colors.surface1); }}
                onMouseLeave={(e) => { if (!resetting) (e.currentTarget.style.background = "transparent"); }}
              >Close</button>
            </div>
          </div>
        )}

        {/* xterm mount point */}
        <div
          ref={containerRef}
          style={{
            flex: 1, width: "100%",
            padding: "4px", boxSizing: "border-box",
            overflow: "hidden",
            display: error || connecting ? "none" : "block",
          }}
        />
      </div>
    </div>
  );
}
