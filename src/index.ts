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

// ─── Bootstrap ──────────────────────────────────────────────
function bootstrap() {
  console.log("🚀 [Agent] Loading...");
  console.log("   oc:", typeof oc);
  console.log("   generateText:", typeof oc.generateText);
  console.log("   thread.messages:", oc.thread?.messages?.length ?? "N/A");

  // Listen for new messages
  oc.thread.on("MessageAdded", async ({ message }: { message: OcMessage }) => {
    console.log("📨 [Agent] MessageAdded:", message.author, "→", message.content.slice(0, 80));

    // Example: intercept user messages
    if (message.author === "user") {
      // TODO: agent logic here
    }
  });

  console.log("✅ [Agent] Ready!");
}

// ─── Run ────────────────────────────────────────────────────
if (validateEnvironment()) {
  bootstrap();
}
