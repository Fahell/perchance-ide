/**
 * TerminalPanel — Interactive terminal UI component using BrowserPod's
 * built-in xterm.js via createDefaultTerminal(element).
 *
 * IMPORTANT: We do NOT create our own xterm.Terminal instance.
 * BrowserPod.createDefaultTerminal(element) creates and manages its own
 * xterm instance internally. Creating a separate one causes conflicts
 * (cursor blinks but no shell connected).
 *
 * Features:
 * - Resize handle on top edge for vertical resizing
 * - Close button in header
 * - Pod→VFS sync when panel is hidden
 * - Loading state while connecting
 * - Error state using Preact instead of innerHTML
 * - Persisted height across sessions
 */

import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { browserPodManager } from "../browserpod/manager.js";
import { pullProjectFilesFromPod } from "../tools/shell-tools.js";
import { ideStore } from "../store.js";
import { storageGet, storageSet } from "../storage.js";
import { ResizeHandle } from "./ResizeHandle.js";
import { colors, fonts } from "./theme.js";

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
  } catch (err) {
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

export function TerminalPanel({ visible }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wasVisibleRef = useRef(false);
  const [height, setHeight] = useState(loadSavedHeight);
  const [maximized, setMaximized] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const podReady = browserPodManager.isReady();
  const terminalFontSize = ideStore.getState().settings.terminalFontSize ?? 13;

  // Persist height when it changes
  useEffect(() => {
    storageSet(STORAGE_KEY, height);
  }, [height]);

  // Initialize BrowserPod interactive terminal when panel becomes visible
  useEffect(() => {
    if (!visible || !containerRef.current) return;

    let disposed = false;
    setConnecting(true);
    setError(null);

    async function init() {
      // Import xterm CSS dynamically (BrowserPod's createDefaultTerminal needs it)
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/@xterm/xterm@6.0.0/css/xterm.min.css";
      if (!document.querySelector('link[href*="xterm"]')) {
        document.head.appendChild(link);
      }

      if (disposed || !containerRef.current) return;

      // Connect to BrowserPod interactive terminal
      if (browserPodManager.isReady()) {
        try {
          // Restore bash history before starting the shell (P10)
          await loadBashHistory();

          await browserPodManager.createInteractiveTerminal(containerRef.current!);
          if (!disposed) {
            setConnecting(false);
            console.log("[TerminalPanel] Interactive terminal connected");

            // Auto-focus the xterm textarea so the user can start typing immediately
            setTimeout(() => {
              if (!disposed && containerRef.current) {
                const textarea = containerRef.current.querySelector("textarea");
                if (textarea) {
                  textarea.focus();
                  console.log("[TerminalPanel] Auto-focused terminal");
                }
              }
            }, 150); // Small delay to let xterm.js finish DOM setup
          }
        } catch (err) {
          if (!disposed) {
            setConnecting(false);
            setError(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      } else {
        if (!disposed) {
          setConnecting(false);
          setError("BrowserPod not ready. Enable Node.js tools in Settings.");
        }
      }
    }

    init();

    return () => {
      disposed = true;
      setConnecting(false);
      setError(null);
      // Dispose interactive shell + terminal so the next mount starts fresh
      browserPodManager.disposeInteractiveTerminal().catch(() => {});
      // Clear container so next mount gets a fresh element for createDefaultTerminal
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
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
    // Save history before closing (P10)
    saveBashHistory();
    ideStore.getState().setTerminalOpen(false);
  }

  function handleMaximize() {
    setMaximized((m) => {
      if (m) {
        // Restore: go back to saved height
        setHeight(loadSavedHeight());
      } else {
        // Maximize: save current height, then go to max
        storageSet(STORAGE_KEY, height);
        setHeight(MAX_HEIGHT);
      }
      return !m;
    });
  }

  function handleRestart() {
    // Save history, then force re-initialization
    saveBashHistory();
    setRetryKey((k) => k + 1);
  }

  // Compute the effective display height
  const displayHeight = maximized ? MAX_HEIGHT : height;
  // CSS zoom for terminal font scaling (P8)
  const zoom = Math.max(0.6, Math.min(2.0, terminalFontSize / 13));

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
      {/* Shared ResizeHandle */}
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
          {/* Restart button (P9) */}
          {!connecting && !error && (
            <button
              onClick={handleRestart}
              title="Restart shell"
              style={{
                background: "none",
                border: "none",
                color: colors.textMuted,
                fontSize: "10px",
                cursor: "pointer",
                padding: "1px 5px",
                fontFamily: fonts.mono,
                borderRadius: "2px",
                transition: "background 0.1s, color 0.1s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = colors.surface2; (e.currentTarget as HTMLElement).style.color = colors.text; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = colors.textMuted; }}
            >
              ↻
            </button>
          )}
          {/* Maximize button (P7) */}
          <button
            onClick={handleMaximize}
            title={maximized ? "Restore height" : "Maximize"}
            style={{
              background: "none",
              border: "none",
              color: colors.textMuted,
              fontSize: "10px",
              cursor: "pointer",
              padding: "1px 5px",
              fontFamily: fonts.mono,
              borderRadius: "2px",
              transition: "background 0.1s, color 0.1s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = colors.surface2; (e.currentTarget as HTMLElement).style.color = colors.text; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = colors.textMuted; }}
          >
            {maximized ? "⊟" : "⊞"}
          </button>
          {/* Status indicator with colored dot */}
          <span style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "9px",
            fontFamily: fonts.mono,
            color: colors.textMuted,
          }}>
            <span style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: connecting
                ? "none"
                : error
                  ? "#f87171"
                  : podReady
                    ? "#4ade80"
                    : colors.textMuted,
              animation: connecting ? "status-dot-pulse 1s ease-in-out infinite" : "none",
              border: connecting ? "1px solid #666" : "none",
              flexShrink: 0,
            }} />
            {connecting ? "connecting..." : error ? "error" : podReady ? "connected" : "disconnected"}
          </span>
          <button
            onClick={handleClose}
            title="Close terminal"
            style={{
              background: "none",
              border: "none",
              color: colors.textMuted,
              fontSize: "14px",
              cursor: "pointer",
              padding: "2px 6px",
              lineHeight: 1,
              fontFamily: fonts.mono,
              borderRadius: "2px",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = colors.surface2)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            ×
          </button>
        </div>
      </div>

      {/* Content area */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}>
        {/* Loading state */}
        {connecting && (
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: colors.bg,
            zIndex: 5,
          }}>
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}>
              <span style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: colors.textSecondary,
                animation: "status-dot-pulse 1s ease-in-out infinite",
              }} />
              <span style={{
                fontSize: "10px",
                fontFamily: fonts.mono,
                color: colors.textMuted,
              }}>
                connecting to terminal...
              </span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div style={{
            padding: "16px 12px",
            color: "#e74c3c",
            fontSize: "11px",
            fontFamily: fonts.mono,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}>
            <span>⚠ {error}</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setRetryKey((k) => k + 1)}
                style={{
                  padding: "5px 14px",
                  border: `1px solid ${colors.border}`,
                  borderRadius: "3px",
                  background: colors.surface1,
                  color: colors.text,
                  fontSize: "10px",
                  fontFamily: fonts.mono,
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = colors.surface2)}
                onMouseLeave={(e) => (e.currentTarget.style.background = colors.surface1)}
              >
                Retry
              </button>
              <button
                onClick={() => ideStore.getState().setTerminalOpen(false)}
                style={{
                  padding: "5px 14px",
                  border: `1px solid ${colors.border}`,
                  borderRadius: "3px",
                  background: "transparent",
                  color: colors.textMuted,
                  fontSize: "10px",
                  fontFamily: fonts.mono,
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = colors.surface1)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* xterm container — BrowserPod's createDefaultTerminal mounts here */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            width: "100%",
            padding: "4px",
            boxSizing: "border-box",
            overflow: "hidden",
            display: error || connecting ? "none" : "block",
            zoom: zoom,
          }}
        />
      </div>
    </div>
  );
}
