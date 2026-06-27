/**
 * Agent for Perchance AI Character Chat
 * Entry point — imports here are bundled into dist/agent.js
 */

import type { Oc, OcMessage } from "./types.js";
import { agentLoop } from "./agent-loop.js";

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

// ─── Agent Message Handler ──────────────────────────────────
async function handleUserMessage(message: OcMessage): Promise<void> {
  console.log("🤖 [Agent] Processing:", message.content.slice(0, 80));

  // Show status in the window
  const output = document.getElementById("agent-output");
  if (output) {
    output.innerHTML += `<div style="margin: 5px 0; color: #00d4ff;">🔍 ${message.content.slice(0, 60)}...</div>`;
  }

  // Run the agent loop (handles tool calls)
  const response = await agentLoop(oc, message.content, (status) => {
    console.log("🤖 [Agent]", status);
  });

  console.log("🤖 [Agent] Response:", response.slice(0, 100));

  // Push the AI response to the chat
  oc.thread.messages.push({
    author: "ai",
    content: response,
  });

  if (output) {
    output.innerHTML += `<div style="margin: 5px 0; color: #4ade80;">✅ Done (${response.length} chars)</div>`;
  }
}

// ─── Bootstrap ──────────────────────────────────────────────
function bootstrap() {
  console.log("🚀 [Agent] Loading...");

  // Setup window (iframe content)
  setupWindow();

  oc.thread.on("MessageAdded", function({ message }: { message: OcMessage }) {
    if (message.author !== "user") return;

    // Handle /agent commands
    if (isAgentCommand(message.content)) {
      message.expectsReply = false;
      message.hiddenFrom = ["ai"];
      handleCommand(message.content);
      setTimeout(() => {
        const idx = oc.thread.messages.indexOf(message);
        if (idx !== -1) oc.thread.messages.splice(idx, 1);
      }, 100);
      return;
    }

    // Handle regular messages — run agent loop
    message.expectsReply = false;
    message.hiddenFrom = ["ai"];

    handleUserMessage(message).catch((err) => {
      console.error("❌ [Agent] Error:", err);
      oc.thread.messages.push({
        author: "ai",
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : String(err)}`,
      });
    });
  });

  console.log("✅ [Agent] Ready!");
}

// ─── Run ────────────────────────────────────────────────────
if (validateEnvironment()) {
  bootstrap();
}
