/**
 * TerminalPanel — Interactive terminal UI component using xterm.js.
 *
 * Connects to BrowserPod via createDefaultTerminal(element) for
 * interactive Node.js/Bash sessions. The agent's headless terminal
 * (createCustomTerminal) remains separate and unaffected.
 *
 * Lifecycle:
 * - Mount: creates xterm.Terminal, attaches FitAddon, calls manager.createInteractiveTerminal()
 * - Unmount: disposes terminal instance, cleans up DOM
 * - Resize: FitAddon.fit() on container resize via ResizeObserver
 */

import { useEffect, useRef } from "preact/hooks";
import { browserPodManager } from "../browserpod/manager.js";
import { pullProjectFilesFromPod } from "../tools/shell-tools.js";
import { colors, fonts } from "./theme.js";

interface TerminalPanelProps {
  visible: boolean;
}

export function TerminalPanel({ visible }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const fitRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null);
  const podTermRef = useRef<unknown>(null);
  const wasVisibleRef = useRef(false);

  // Initialize xterm when panel becomes visible
  useEffect(() => {
    if (!visible || !containerRef.current) return;

    let disposed = false;

    async function init() {
      // Dynamic imports — keeps xterm out of initial bundle
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");

      if (disposed || !containerRef.current) return;

      // Import xterm CSS dynamically
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/@xterm/xterm@6.0.0/css/xterm.min.css";
      document.head.appendChild(link);

      const fitAddon = new FitAddon();
      const terminal = new Terminal({
        theme: {
          background: colors.bg,
          foreground: colors.text,
          cursor: colors.text,
          selectionBackground: "rgba(255, 255, 255, 0.15)",
        },
        fontFamily: fonts.mono,
        fontSize: 12,
        cursorBlink: true,
        cursorStyle: "block",
        allowProposedApi: true,
      });

      terminal.loadAddon(fitAddon);
      terminal.open(containerRef.current!);

      // Fit after open to calculate correct dimensions
      requestAnimationFrame(() => {
        if (!disposed) {
          try {
            fitAddon.fit();
          } catch {
            // Fit may fail if container has zero dimensions — safe to ignore
          }
        }
      });

      termRef.current = terminal;
      fitRef.current = fitAddon;

      // Connect to BrowserPod interactive terminal
      // createDefaultTerminal(element) is the official API for interactive terminals
      if (browserPodManager.isReady()) {
        try {
          const podTerminal = await browserPodManager.createInteractiveTerminal(containerRef.current!);
          if (!disposed) {
            podTermRef.current = podTerminal;
            console.log("[TerminalPanel] Interactive terminal connected");
          }
        } catch (err) {
          console.error("[TerminalPanel] Failed to connect interactive terminal:", err);
          terminal.writeln(`\r\n\x1b[31mFailed to connect terminal: ${err instanceof Error ? err.message : String(err)}\x1b[0m`);
        }
      } else {
        terminal.writeln("\r\n\x1b[33mBrowserPod not ready. Enable Node.js tools in Settings.\x1b[0m");
      }
    }

    init();

    // ResizeObserver for responsive fit
    let observer: ResizeObserver | null = null;
    if (containerRef.current) {
      observer = new ResizeObserver(() => {
        if (fitRef.current && !disposed) {
          try {
            fitRef.current.fit();
          } catch {
            // Safe to ignore during transitions
          }
        }
      });
      observer.observe(containerRef.current);
    }

    return () => {
      disposed = true;
      observer?.disconnect();
      termRef.current?.dispose();
      termRef.current = null;
      fitRef.current = null;
      podTermRef.current = null;
    };
  }, [visible]);

  // Re-fit when visibility toggles back on + trigger Pod→VFS sync on hide
  useEffect(() => {
    if (visible && fitRef.current) {
      requestAnimationFrame(() => {
        try {
          fitRef.current?.fit();
        } catch {
          // Safe to ignore
        }
      });
    }

    // When terminal panel is hidden after being visible, reconcile Pod → VFS.
    // This captures any file changes made via interactive terminal (by user or agent).
    if (wasVisibleRef.current && !visible) {
      pullProjectFilesFromPod().catch((err: unknown) => {
        console.warn("[TerminalPanel] Pod→VFS sync on hide failed:", err);
      });
    }
    wasVisibleRef.current = visible;
  }, [visible]);

  if (!visible) return null;

  return (
    <div style={{
      borderTop: `1px solid ${colors.border}`,
      height: "250px",
      minHeight: "120px",
      flexShrink: "0",
      background: colors.bg,
      position: "relative",
    }}>
      {/* Header bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 8px",
        borderBottom: `1px solid ${colors.border}`,
        background: colors.surface1,
      }}>
        <span style={{
          fontSize: "10px",
          fontFamily: fonts.mono,
          color: colors.textSecondary,
        }}>
          TERMINAL (Node.js / Bash)
        </span>
        <span style={{
          fontSize: "9px",
          fontFamily: fonts.mono,
          color: colors.textMuted,
        }}>
          {browserPodManager.isReady() ? "● connected" : "○ disconnected"}
        </span>
      </div>

      {/* xterm container */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "calc(100% - 25px)",
          padding: "4px",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
