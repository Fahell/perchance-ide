import { jsx as _jsx } from "preact/jsx-runtime";
import { useEffect, useRef } from "preact/hooks";
import { colors, fonts } from "./theme.js";
/**
 * Terminal-style thinking animation.
 * "thinking" shimmer label + 3 typewriter lines with > prefix.
 * Uses DOM manipulation for 60fps — no React re-renders.
 */
const FRAGMENTS = [
    "analyzing context...",
    "retrieving memory_0x7f3a",
    "pattern match: 94.2%",
    "tokenizing input stream",
    "inference step 1/12",
    "activating layer_7",
    "gradient descent ok",
    "checking constraints",
    "rewriting query plan",
    "embedding space scan",
    "similarity: 0.8912",
    "backprop delta: 0.003",
    "pruning tree nodes",
    "evaluating branch_a",
    "evaluating branch_b",
    "confidence: 0.97",
    "merging outputs",
    "validating syntax",
    "resolving references",
    "compiling response",
    "ranking candidates",
    "filtering noise",
    "cross-ref: confirmed",
    "latent vector ready",
    "attention heads: 8/8",
    "dropout: disabled",
    "batch norm: stable",
    "loss: 0.0021",
    "epoch: converged",
    "sampling temperature 0.7",
    "top_p: 0.92",
    "generating tokens...",
    "decoding sequence",
    "post-processing...",
    "final check pass",
    "output buffer ready",
    "streaming...",
    "optimizing path",
    "cache hit: 0x4a2b",
    "context window: 78%",
    "rotary embed: applied",
    "rope scaling: on",
    "kv cache: allocated",
    "prefill: complete",
    "decoding: active",
    "logits: normalized",
    "softmax: computed",
    "argmax: selected",
    "sampling: multinomial",
    "repetition penalty: 1.1",
    "stop sequence: found",
    "tool call: pending",
    "function: parse_json",
    "schema: validated",
    "retry: 0/3",
    "streaming chunk #14",
    "buffer flush",
    "checkpoint: saved",
    "consensus: reached",
    "uncertainty: low",
    "hallucination check: pass",
    "safety filter: pass",
    "format: markdown",
    "rendering...",
    "done.",
];
const LINE_COUNT = 3;
function pickFragment() {
    return FRAGMENTS[Math.floor(Math.random() * FRAGMENTS.length)];
}
export function ThinkingIndicator() {
    const containerRef = useRef(null);
    const intervalRef = useRef(null);
    useEffect(() => {
        const container = containerRef.current;
        if (!container)
            return;
        // Create DOM structure
        container.innerHTML = "";
        // Shimmer label
        const label = document.createElement("div");
        label.className = "shimmer-text";
        label.style.cssText = `font-family:${fonts.mono};font-size:11px;letter-spacing:1px;margin-bottom:4px;`;
        label.textContent = "thinking";
        container.appendChild(label);
        // Terminal lines container
        const linesWrap = document.createElement("div");
        const lines = [];
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
        const buffer = ["", "", ""];
        let currentLineIdx = 0;
        let currentText = "";
        let targetText = "";
        let charIndex = 0;
        let phase = "type";
        let phaseEnd = 0;
        function updateDisplay() {
            for (let i = 0; i < LINE_COUNT; i++) {
                const line = lines[i];
                const prefix = line.firstChild;
                const isActive = i === currentLineIdx && phase === "type";
                line.style.opacity = isActive ? "1" : "0.3";
                // Clear all text nodes after prefix
                while (prefix.nextSibling)
                    line.removeChild(prefix.nextSibling);
                line.appendChild(document.createTextNode(buffer[i] || ""));
                if (isActive) {
                    // Blinking cursor
                    const cursor = document.createElement("span");
                    cursor.style.cssText = `display:inline-block;width:6px;height:1em;background:${colors.text};margin-left:2px;vertical-align:text-bottom;animation:cursor-blink 0.7s steps(1) infinite;`;
                    line.appendChild(cursor);
                }
            }
        }
        function scrollUp() {
            buffer[0] = buffer[1];
            buffer[1] = buffer[2];
            buffer[2] = "";
            currentLineIdx = 2;
            currentText = "";
            targetText = "";
            charIndex = 0;
        }
        function tick() {
            const now = Date.now();
            if (phase === "type") {
                if (!targetText) {
                    targetText = pickFragment();
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
            }
            else if (phase === "pause") {
                if (now >= phaseEnd) {
                    phase = "scroll";
                    phaseEnd = now + 30;
                }
            }
            else if (phase === "scroll") {
                if (now >= phaseEnd) {
                    if (currentLineIdx < 2) {
                        currentLineIdx++;
                        currentText = "";
                        targetText = "";
                        charIndex = 0;
                        phase = "type";
                    }
                    else {
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
    }, []);
    return (_jsx("div", { ref: containerRef, style: {
            padding: "6px 10px",
            overflow: "hidden",
        } }));
}
