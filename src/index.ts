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
  // Render initial content in the iframe window
  document.body.innerHTML = `
    <div style="font-family: system-ui; padding: 20px; background: #1a1a2e; color: #eee; height: 100vh; margin: 0;">
      <h2 style="margin: 0 0 10px 0; color: #00d4ff;">🤖 Agent Panel</h2>
      <p style="color: #888; font-size: 14px;">Window is active. Agent is running.</p>
      <div id="agent-output" style="margin-top: 20px;"></div>
    </div>
  `;

  // Open the window
  oc.window.show();
  console.log("🪟 [Agent] Window opened");
}

// ─── Command Handler ────────────────────────────────────────
const AGENT_PREFIX = "/agent";

function isAgentCommand(content: string): boolean {
  return content.trim().startsWith(AGENT_PREFIX);
}

function handleCommand(content: string): void {
  const cmd = content.trim();

  if (cmd === "/agent open") {
    oc.window.show();
    console.log("🪟 [Agent] Window opened");
    return;
  }

  if (cmd === "/agent close") {
    oc.window.hide();
    console.log("🪟 [Agent] Window closed");
    return;
  }
}

// ─── Message Pipeline (intercepts BEFORE AI sees) ───────────
function setupPipeline() {
  // Hide agent commands from the AI so it doesn't respond
  oc.messageRenderingPipeline.push(({ message, reader }: { message: OcMessage; reader: string }) => {
    if (reader === "ai" && isAgentCommand(message.content)) {
      message.content = ""; // AI sees nothing → no response
    }
  });
}

// ─── Bootstrap ──────────────────────────────────────────────
function bootstrap() {
  console.log("🚀 [Agent] Loading...");
  console.log("   oc:", typeof oc);
  console.log("   generateText:", typeof oc.generateText);
  console.log("   thread.messages:", oc.thread?.messages?.length ?? "N/A");

  // Setup pipeline first (intercepts commands before AI sees them)
  setupPipeline();

  // Setup window
  setupWindow();

  // Listen for new messages
  oc.thread.on("MessageAdded", async ({ message }: { message: OcMessage }) => {
    console.log("📨 [Agent] MessageAdded:", message.author, "→", message.content.slice(0, 80));

    // Handle commands
    if (message.author === "user" && isAgentCommand(message.content)) {
      handleCommand(message.content);
      // Remove the command message from chat
      const idx = oc.thread.messages.indexOf(message);
      if (idx !== -1) {
        oc.thread.messages.splice(idx, 1);
      }
      return;
    }
  });

  console.log("✅ [Agent] Ready!");
}

// ─── Run ────────────────────────────────────────────────────
if (validateEnvironment()) {
  bootstrap();
}
