/**
 * CSS animations injected into document head — Monochrome
 */

const ANIMATION_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; }
body { background: #000; }

@keyframes agent-slide-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.shimmer-text {
  background: linear-gradient(90deg, #444 0%, #fff 50%, #444 100%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shimmer 2s infinite linear;
}
@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.skeleton-line {
  height: 12px;
  background: linear-gradient(90deg, #111 25%, #1a1a1a 50%, #111 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  margin: 6px 0;
}
@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: #0a0a0a; }
::-webkit-scrollbar-thumb { background: #333; }
::-webkit-scrollbar-thumb:hover { background: #444; }

/* Markdown content styles */
.md-content { line-height: 1.6; }
.md-content p { margin: 0 0 8px; }
.md-content p:last-child { margin-bottom: 0; }
.md-content strong { color: #fff; font-weight: 700; }
.md-content em { color: #aaa; font-style: italic; }
.md-content code {
  background: #1a1a1a;
  padding: 0.15em 0.4em;
  font-size: 0.9em;
  font-family: 'SF Mono','Cascadia Code','Fira Code','Consolas',monospace;
}
.md-content pre {
  background: #111;
  border: 1px solid #222;
  padding: 8px 10px;
  overflow-x: auto;
  margin: 8px 0;
}
.md-content pre code {
  background: none;
  padding: 0;
  font-size: 11px;
  line-height: 1.5;
}
.md-content a { color: #ccc; text-decoration: underline; }
.md-content a:hover { color: #fff; }
.md-content h1, .md-content h2, .md-content h3,
.md-content h4, .md-content h5, .md-content h6 {
  font-family: 'SF Mono','Cascadia Code','Fira Code','Consolas',monospace;
  color: #fff;
  margin: 12px 0 6px;
}
.md-content h1 { font-size: 16px; }
.md-content h2 { font-size: 14px; }
.md-content h3 { font-size: 13px; }
.md-content ul, .md-content ol {
  padding-left: 20px;
  margin: 6px 0;
}
.md-content li { margin: 2px 0; }
.md-content blockquote {
  border-left: 2px solid #333;
  padding-left: 10px;
  margin: 8px 0;
  color: #888;
}
.md-content hr {
  border: none;
  border-top: 1px solid #222;
  margin: 10px 0;
}

/* Turn separator */
.msg-turn-separator {
  border-top: 1px solid #1a1a1a;
  margin: 6px 0;
}

/* Bottom status line */
@keyframes status-pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.status-line {
  height: 2px;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.3s;
}
.status-line--thinking {
  background: linear-gradient(90deg, #222 0%, #555 50%, #222 100%);
  background-size: 200% 100%;
  animation: status-pulse 1s infinite linear;
}
.status-line--searching {
  background: linear-gradient(90deg, #222 0%, #444 50%, #222 100%);
  background-size: 200% 100%;
  animation: status-pulse 1.5s infinite linear;
}
`;

let injected = false;

export function injectAnimations(): void {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const style = document.createElement("style");
  style.textContent = ANIMATION_CSS;
  document.head.appendChild(style);
}
