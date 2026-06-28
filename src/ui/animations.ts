/**
 * CSS animations injected into document head
 */

const ANIMATION_CSS = `
@keyframes agent-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes agent-slide-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
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
