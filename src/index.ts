/**
 * Agent for Perchance AI Character Chat
 * Entry point — imports here are bundled into dist/agent.js
 */

import type { Oc, OcMessage } from "./types.js";

// ─── Globals ────────────────────────────────────────────────
const oc: Oc = window.oc;

// ─── Validation ─────────────────────────────────────────────
function validateEnvironment(): boolean {
  if (!oc) {
    console.error("❌ [Agent] window.oc not found — are you running inside Perchance?");
    return false;
  }
  if (!oc.thread) {
    console.error("❌ [Agent] oc.thread not available");
    return false;
  }
  if (typeof oc.generateText !== "function") {
    console.error("❌ [Agent] oc.generateText not available");
    return false;
  }
  return true;
}

// ─── Window Management ──────────────────────────────────────
function setupWindow() {
  document.body.innerHTML = `
    <div style="font-family: system-ui; padding: 20px; background: #1a1a2e; color: #eee; height: 100vh; margin: 0;">
      <h2 style="margin: 0 0 10px 0; color: #00d4ff;">🤖 Agent Panel</h2>
      <p style="color: #888; font-size: 14px;">Window is active. Agent is running.</p>
      <div id="agent-output" style="margin-top: 20px;"></div>
    </div>
  `;
  oc.window.show();
  console.log("🪟 [Agent] Window opened");
}

// ─── Command Handler ────────────────────────────────────────
function isAgentCommand(content: string): boolean {
  return content.trim().startsWith("/agent");
}

function handleCommand(content: string): void {
  const cmd = content.trim();
  if (cmd === "/agent open") {
    oc.window.show();
    console.log("🪟 [Agent] Window opened");
  } else if (cmd === "/agent close") {
    oc.window.hide();
    console.log("🪟 [Agent] Window closed");
  }
}

// ─── Bootstrap ──────────────────────────────────────────────
function bootstrap() {
  console.log("🚀 [Agent] Loading...");

  // Setup window (iframe content)
  setupWindow();

  // SYNCHRONOUS handler — critical to prevent race condition with AI
  oc.thread.on("MessageAdded", function({ message }: { message: OcMessage }) {
    if (message.author !== "user") return;
    if (!isAgentCommand(message.content)) return;

    console.log("📨 [Agent] Command:", message.content);

    // 1) Prevent AI from replying to this message
    message.expectsReply = false;

    // 2) Hide from AI entirely
    message.hiddenFrom = ["ai"];

    // 3) Execute the command
    handleCommand(message.content);

    // 4) Delete the message from chat after a tick (so AI has already skipped it)
    setTimeout(() => {
      const idx = oc.thread.messages.indexOf(message);
      if (idx !== -1) oc.thread.messages.splice(idx, 1);
    }, 100);
  });

  console.log("✅ [Agent] Ready!");
}

// ─── Run ────────────────────────────────────────────────────
if (validateEnvironment()) {
  bootstrap();
}
