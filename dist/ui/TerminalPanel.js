import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
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
 */
import { useEffect, useRef, useState, useCallback } from "preact/hooks";
import { browserPodManager } from "../browserpod/manager.js";
import { pullProjectFilesFromPod } from "../tools/shell-tools.js";
import { ideStore } from "../store.js";
import { colors, fonts } from "./theme.js";
const MIN_HEIGHT = 100;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 250;
export function TerminalPanel({ visible }) {
    const containerRef = useRef(null);
    const podTermRef = useRef(null);
    const wasVisibleRef = useRef(false);
    const [height, setHeight] = useState(DEFAULT_HEIGHT);
    const draggingRef = useRef(false);
    const startYRef = useRef(0);
    const startHeightRef = useRef(0);
    // Initialize BrowserPod interactive terminal when panel becomes visible
    useEffect(() => {
        if (!visible || !containerRef.current)
            return;
        let disposed = false;
        async function init() {
            // Import xterm CSS dynamically (BrowserPod's createDefaultTerminal needs it)
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "https://cdn.jsdelivr.net/npm/@xterm/xterm@6.0.0/css/xterm.min.css";
            if (!document.querySelector('link[href*="xterm"]')) {
                document.head.appendChild(link);
            }
            if (disposed || !containerRef.current)
                return;
            // Connect to BrowserPod interactive terminal
            // createDefaultTerminal(element) creates its OWN xterm instance internally
            if (browserPodManager.isReady()) {
                try {
                    const podTerminal = await browserPodManager.createInteractiveTerminal(containerRef.current);
                    if (!disposed) {
                        podTermRef.current = podTerminal;
                        console.log("[TerminalPanel] Interactive terminal connected");
                    }
                }
                catch (err) {
                    console.error("[TerminalPanel] Failed to connect interactive terminal:", err);
                    if (!disposed && containerRef.current) {
                        containerRef.current.innerHTML = `<div style="color:#e74c3c;padding:8px;font-family:monospace;font-size:12px;">Failed to connect: ${err instanceof Error ? err.message : String(err)}</div>`;
                    }
                }
            }
            else {
                if (!disposed && containerRef.current) {
                    containerRef.current.innerHTML = `<div style="color:#f39c12;padding:8px;font-family:monospace;font-size:12px;">BrowserPod not ready. Enable Node.js tools in Settings.</div>`;
                }
            }
        }
        init();
        return () => {
            disposed = true;
            podTermRef.current = null;
            // Clear container so next mount gets a fresh element for createDefaultTerminal
            if (containerRef.current) {
                containerRef.current.innerHTML = "";
            }
        };
    }, [visible]);
    // Trigger Pod→VFS sync when panel is hidden
    useEffect(() => {
        if (wasVisibleRef.current && !visible) {
            pullProjectFilesFromPod().catch((err) => {
                console.warn("[TerminalPanel] Pod→VFS sync on hide failed:", err);
            });
        }
        wasVisibleRef.current = visible;
    }, [visible]);
    // Resize drag handlers
    const onMouseDown = useCallback((e) => {
        e.preventDefault();
        draggingRef.current = true;
        startYRef.current = e.clientY;
        startHeightRef.current = height;
        document.body.style.cursor = "ns-resize";
        document.body.style.userSelect = "none";
    }, [height]);
    useEffect(() => {
        function onMouseMove(e) {
            if (!draggingRef.current)
                return;
            const delta = startYRef.current - e.clientY;
            const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeightRef.current + delta));
            setHeight(newHeight);
        }
        function onMouseUp() {
            if (!draggingRef.current)
                return;
            draggingRef.current = false;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        }
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        return () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };
    }, []);
    function handleClose() {
        ideStore.getState().setTerminalOpen(false);
    }
    if (!visible)
        return null;
    return (_jsxs("div", { style: {
            borderTop: `1px solid ${colors.border}`,
            height: `${height}px`,
            minHeight: `${MIN_HEIGHT}px`,
            maxHeight: `${MAX_HEIGHT}px`,
            flexShrink: 0,
            background: colors.bg,
            position: "relative",
            display: "flex",
            flexDirection: "column",
        }, children: [_jsx("div", { onMouseDown: onMouseDown, style: {
                    height: "4px",
                    cursor: "ns-resize",
                    background: "transparent",
                    flexShrink: 0,
                    position: "relative",
                    zIndex: 10,
                }, title: "Drag to resize", children: _jsx("div", { style: {
                        position: "absolute",
                        left: "50%",
                        top: "1px",
                        transform: "translateX(-50%)",
                        width: "30px",
                        height: "2px",
                        background: colors.border,
                        borderRadius: "1px",
                    } }) }), _jsxs("div", { style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "3px 8px",
                    borderBottom: `1px solid ${colors.border}`,
                    background: colors.surface1,
                    flexShrink: 0,
                }, children: [_jsx("span", { style: {
                            fontSize: "10px",
                            fontFamily: fonts.mono,
                            color: colors.textSecondary,
                        }, children: "TERMINAL (Node.js / Bash)" }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [_jsx("span", { style: {
                                    fontSize: "9px",
                                    fontFamily: fonts.mono,
                                    color: colors.textMuted,
                                }, children: browserPodManager.isReady() ? "● connected" : "○ disconnected" }), _jsx("button", { onClick: handleClose, title: "Close terminal", style: {
                                    background: "none",
                                    border: "none",
                                    color: colors.textMuted,
                                    fontSize: "14px",
                                    cursor: "pointer",
                                    padding: "0 2px",
                                    lineHeight: 1,
                                    fontFamily: fonts.mono,
                                }, children: "\u00D7" })] })] }), _jsx("div", { ref: containerRef, style: {
                    flex: 1,
                    width: "100%",
                    padding: "4px",
                    boxSizing: "border-box",
                    overflow: "hidden",
                } })] }));
}
