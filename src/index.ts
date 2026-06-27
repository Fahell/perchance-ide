/**
 * Agent for Perchance AI Character Chat
 * Entry point — imports here are bundled into dist/agent.js
 */

import type { Oc, OcMessage } from "./types.js";
import { agentLoop } from "./agent-loop.js";

// ─── Build Constants (injected by esbuild) ──────────────────
declare const __VERSION__: string;
declare const __COMMIT__: string;
declare const __BUILD_TIME__: string;

// ─── Globals ────────────────────────────────────────────────
const oc: Oc = window.oc;

// ─── Version Banner ─────────────────────────────────────────
function printBanner() {
  console.log("🤖 Agent v" + __VERSION__ + "+" + __COMMIT__);
  console.log("   Build: " + __BUILD_TIME__);
  console.log("   https://github.com/Fahell/agent-perchance");
}

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
    <div style="font-family: system-ui; padding: 16px; background: #1a1a2e; color: #eee; height: 100vh; margin: 0; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="margin: 0; color: #00d4ff; font-size: 16px;">🤖 Agent Panel</h2>
        <span style="font-size: 11px; color: #666;">v${__VERSION__}+${__COMMIT__} · ${__BUILD_TIME__}</span>
      </div>
      <div id="agent-output" style="flex: 1; overflow-y: auto; font-size: 13px;"></div>
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

// ─── Window Helpers ─────────────────────────────────────────
function appendToOutput(html: string) {
  const output = document.getElementById("agent-output");
  if (output) {
    output.innerHTML += html;
    output.scrollTop = output.scrollHeight;
  }
}

// ─── Agent Message Handler ──────────────────────────────────
async function handleUserMessage(message: OcMessage): Promise<void> {
  console.log("🤖 [Agent] Processing:", message.content.slice(0, 80));

  appendToOutput(`<div style="margin: 8px 0; padding: 8px; background: #16213e; border-radius: 6px; border-left: 3px solid #00d4ff;">
    <div style="color: #00d4ff; font-weight: bold;">📨 ${message.content.slice(0, 80)}</div>
  </div>`);

  // Run the agent loop
  const response = await agentLoop(
    oc,
    message.content,
    (status) => {
      console.log("🤖 [Agent]", status);
    },
    (toolName, args, result) => {
      // Show tool results in the window
      const query = args.query || args.url || "";
      const preview = result.slice(0, 300).replace(/\n/g, " ");
      appendToOutput(`<div style="margin: 4px 0 4px 12px; padding: 6px; background: #0f3460; border-radius: 4px; border-left: 2px solid #4ade80;">
        <div style="color: #4ade80; font-size: 12px;">🔧 ${toolName}: ${query}</div>
        <div style="color: #aaa; font-size: 11px; margin-top: 4px;">${preview}...</div>
      </div>`);
    }
  );

  console.log("🤖 [Agent] Response:", response.slice(0, 100));

  // Push ONLY the final AI response to the chat (no tool calls, no search results)
  oc.thread.messages.push({
    author: "ai",
    content: response,
  });

  appendToOutput(`<div style="margin: 4px 0 8px 12px; padding: 6px; background: #1a1a2e; border-radius: 4px; border-left: 2px solid #00d4ff;">
    <div style="color: #00d4ff; font-size: 12px;">✅ Response sent to chat (${response.length} chars)</div>
  </div>`);
}

// ─── Bootstrap ──────────────────────────────────────────────
function bootstrap() {
  printBanner();
  console.log("🚀 [Agent] Loading...");

  // Setup window (iframe content)
  setupWindow();

  // CRITICAL: Pipeline runs BEFORE AI sees the message
  // This prevents the default AI from responding to ANY user message
  oc.messageRenderingPipeline.push(({ message, reader }: { message: OcMessage; reader: string }) => {
    if (reader === "ai" && message.author === "user") {
      message.expectsReply = false;
      message.hiddenFrom = ["ai"];
      console.log("🛡️ [Agent] Pipeline: blocked AI from seeing user message");
    }
  });

  oc.thread.on("MessageAdded", function({ message }: { message: OcMessage }) {
    if (message.author !== "user") return;

    // Handle /agent commands
    if (isAgentCommand(message.content)) {
      handleCommand(message.content);
      setTimeout(() => {
        const idx = oc.thread.messages.indexOf(message);
        if (idx !== -1) oc.thread.messages.splice(idx, 1);
      }, 100);
      return;
    }

    // Handle regular messages — run agent loop
    console.log("📨 [Agent] Processing:", message.content.slice(0, 80));

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
