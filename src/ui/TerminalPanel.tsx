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
const STORAGE_KEY = "terminal:height";

function loadSavedHeight(): number {
  const saved = storageGet<number>(STORAGE_KEY);
  if (saved && saved >= MIN_HEIGHT && saved <= MAX_HEIGHT) return saved;
  return 250;
}

export function TerminalPanel({ visible }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wasVisibleRef = useRef(false);
  const [height, setHeight] = useState(loadSavedHeight);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const podReady = browserPodManager.isReady();

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
          await browserPodManager.createInteractiveTerminal(containerRef.current!);
          if (!disposed) {
            setConnecting(false);
            console.log("[TerminalPanel] Interactive terminal connected");
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
  }, [visible]);

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
    ideStore.getState().setTerminalOpen(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      borderTop: `1px solid ${colors.border}`,
      height: `${height}px`,
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
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
            padding: "12px",
            color: "#e74c3c",
            fontSize: "11px",
            fontFamily: fonts.mono,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}>
            <span>⚠ {error}</span>
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
          }}
        />
      </div>
    </div>
  );
}
