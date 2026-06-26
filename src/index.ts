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

// ─── Shortcuts ──────────────────────────────────────────────
function setupShortcuts() {
  const shortcuts = [
    {
      name: "🟢 Open Agent",
      message: "/agent open",
      autoSend: true,
      insertionType: "replace" as const,
      clearAfterSend: true,
    },
    {
      name: "🔴 Close Agent",
      message: "/agent close",
      autoSend: true,
      insertionType: "replace" as const,
      clearAfterSend: true,
    },
  ];

  // Set shortcuts on the current thread
  oc.thread.shortcutButtons = shortcuts;
  console.log("🔘 [Agent] Shortcuts registered:", shortcuts.map((s) => s.name));
}

// ─── Command Handler ────────────────────────────────────────
function handleCommand(message: OcMessage): boolean {
  const content = message.content.trim();

  // /agent open
  if (content === "/agent open") {
    oc.window.show();
    console.log("🪟 [Agent] Window opened via command");
    return true; // handled (suppress message)
  }

  // /agent close
  if (content === "/agent close") {
    oc.window.hide();
    console.log("🪟 [Agent] Window closed via command");
    return true; // handled (suppress message)
  }

  return false; // not a command
}

// ─── Bootstrap ──────────────────────────────────────────────
function bootstrap() {
  console.log("🚀 [Agent] Loading...");
  console.log("   oc:", typeof oc);
  console.log("   generateText:", typeof oc.generateText);
  console.log("   thread.messages:", oc.thread?.messages?.length ?? "N/A");

  // Setup window and shortcuts
  setupWindow();
  setupShortcuts();

  // Listen for new messages
  oc.thread.on("MessageAdded", async ({ message }: { message: OcMessage }) => {
    console.log("📨 [Agent] MessageAdded:", message.author, "→", message.content.slice(0, 80));

    // Handle commands
    if (message.author === "user") {
      if (handleCommand(message)) {
        // Remove the command message from chat
        oc.thread.messages.pop();
        return;
      }
    }
  });

  console.log("✅ [Agent] Ready!");
}

// ─── Run ────────────────────────────────────────────────────
if (validateEnvironment()) {
  bootstrap();
}
