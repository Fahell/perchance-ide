import { h } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { colors, fonts } from "./theme.js";
import type { AgentStatus } from "./types.js";

/**
 * Terminal-style thinking animation keyed to the real agent status.
 *
 * Shows a shimmer label + typewriter lines with > prefix.
 * Fragments reflect what the agent is actually doing.
 */

interface ThinkingIndicatorProps {
  status?: AgentStatus;
}

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: "",
  thinking: "thinking",
  searching: "searching",
  scraping: "reading",
  responding: "responding",
};

const FRAGMENTS: Record<Exclude<AgentStatus, "idle">, string[]> = {
  thinking: [
    "analyzing request...",
    "loading context...",
    "preparing response...",
    "processing...",
  ],
  searching: [
    "querying web...",
    "fetching results...",
    "parsing content...",
    "filtering results...",
  ],
  scraping: [
    "reading page...",
    "extracting content...",
    "parsing data...",
    "processing...",
  ],
  responding: [
    "composing...",
    "formatting output...",
    "preparing...",
  ],
};

const LINE_COUNT = 2;

function pickFragment(status: Exclude<AgentStatus, "idle">): string {
  const pool = FRAGMENTS[status];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function ThinkingIndicator({ status = "thinking" }: ThinkingIndicatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Reset
    container.innerHTML = "";

    const activeStatus = (status !== "idle" ? status : "thinking") as Exclude<AgentStatus, "idle">;
    const labelText = STATUS_LABELS[activeStatus];

    // Shimmer label
    const label = document.createElement("div");
    label.className = "shimmer-text";
    label.style.cssText = `font-family:${fonts.mono};font-size:11px;letter-spacing:1px;margin-bottom:4px;`;
    label.textContent = labelText;
    container.appendChild(label);

    // Terminal lines container
    const linesWrap = document.createElement("div");

    const lines: HTMLDivElement[] = [];
    for (let i = 0; i < LINE_COUNT; i++) {
      const line = document.createElement("div");
      line.style.cssText = `font-family:${fonts.mono};font-size:11px;line-height:1.5;height:1.5em;white-space:nowrap;overflow:hidden;opacity:0.3;transition:opacity 0.15s ease;`;
      const prefix = document.createElement("span");
      prefix.style.cssText = `color:${colors.textMuted};margin-right:6px;user-select:none;`;
      prefix.textContent = ">";
      line.appendChild(prefix);
      linesWrap.appendChild(line);
      lines.push(line);
    }
    container.appendChild(linesWrap);

    // Animation state
    const buffer = ["", ""];
    let currentLineIdx = 0;
    let currentText = "";
    let targetText = pickFragment(activeStatus);
    let charIndex = 0;
    let phase: "type" | "pause" | "scroll" = "type";
    let phaseEnd = 0;

    function updateDisplay() {
      for (let i = 0; i < LINE_COUNT; i++) {
        const line = lines[i];
        const prefix = line.firstChild as HTMLElement;
        const isActive = i === currentLineIdx && phase === "type";
        line.style.opacity = isActive ? "1" : "0.3";
        while (prefix.nextSibling) line.removeChild(prefix.nextSibling);
        line.appendChild(document.createTextNode(buffer[i] || ""));
        if (isActive) {
          const cursor = document.createElement("span");
          cursor.style.cssText = `display:inline-block;width:6px;height:1em;background:${colors.text};margin-left:2px;vertical-align:text-bottom;animation:cursor-blink 0.7s steps(1) infinite;`;
          line.appendChild(cursor);
        }
      }
    }

    function scrollUp() {
      buffer[0] = buffer[1];
      buffer[1] = "";
      currentLineIdx = 1;
      currentText = "";
      targetText = pickFragment(activeStatus);
      charIndex = 0;
    }

    function tick() {
      const now = Date.now();

      if (phase === "type") {
        if (!targetText) {
          targetText = pickFragment(activeStatus);
          charIndex = 0;
        }
        const burst = Math.random() > 0.5 ? 6 : Math.random() > 0.25 ? 4 : 2;
        for (let i = 0; i < burst && charIndex < targetText.length; i++) {
          currentText += targetText[charIndex];
          charIndex++;
        }
        buffer[currentLineIdx] = currentText;

        if (charIndex >= targetText.length) {
          phase = Math.random() > 0.35 ? "pause" : "scroll";
          phaseEnd = phase === "pause" ? now + 100 + Math.random() * 400 : now + 30;
        }
      } else if (phase === "pause") {
        if (now >= phaseEnd) {
          phase = "scroll";
          phaseEnd = now + 30;
        }
      } else if (phase === "scroll") {
        if (now >= phaseEnd) {
          if (currentLineIdx < LINE_COUNT - 1) {
            currentLineIdx++;
            currentText = "";
            targetText = pickFragment(activeStatus);
            charIndex = 0;
            phase = "type";
          } else {
            scrollUp();
            phase = "type";
          }
        }
      }

      updateDisplay();
    }

    intervalRef.current = setInterval(tick, 16);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status]);

  return (
    <div
      ref={containerRef}
      style={{
        padding: "6px 10px",
        overflow: "hidden",
      }}
    />
  );
}
