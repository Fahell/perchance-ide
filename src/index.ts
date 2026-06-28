/**
 * Agent for Perchance AI Character Chat
 * Entry point — imports here are bundled into dist/agent.js
 */

import type { Oc, OcMessage } from "./types.js";
import { agentLoop } from "./agent-loop.js";
import { setApiKey, getApiKey, validateApiKey } from "./tools/web-search.js";
import { storageGet, storageSet, initStorage } from "./storage.js";
import { renderPanel, renderSetup, type AgentPanelRef } from "./ui/index.js";

// ─── Build Constants (injected by esbuild) ──────────────────
declare const __VERSION__: string;
declare const __COMMIT__: string;
declare const __BUILD_TIME__: string;

// ─── Globals ────────────────────────────────────────────────
const oc: Oc = window.oc;
let agentProcessing = false;
let panel: AgentPanelRef | null = null;
const MAX_HISTORY_MESSAGES = 10;

// ─── Version Banner ─────────────────────────────────────────
function printBanner() {
  console.log("🤖 Agent v" + __VERSION__ + "+" + __COMMIT__);
  console.log("   Build: " + __BUILD_TIME__);
  console.log("   https://github.com/Fahell/agent-perchance");
}

// ─── API Key Storage (customData) ───────────────────────────
const API_KEY_STORAGE = "agent:jina_key";
const PANEL_MODE_STORAGE = "agent:panel_mode";
const INPUT_ENABLED_STORAGE = "agent:input_enabled";

function loadApiKey(): string | null {
  return storageGet<string>(API_KEY_STORAGE) ?? null;
}

function saveApiKey(key: string): void {
  storageSet(API_KEY_STORAGE, key);
}

function loadPanelMode(): "full" | "tools-only" {
  const v = storageGet<string>(PANEL_MODE_STORAGE);
  return v === "tools-only" ? "tools-only" : "full";
}

function savePanelMode(mode: "full" | "tools-only"): void {
  storageSet(PANEL_MODE_STORAGE, mode);
}

function loadInputEnabled(): boolean {
  return storageGet<string>(INPUT_ENABLED_STORAGE) === "true";
}

function saveInputEnabled(enabled: boolean): void {
  storageSet(INPUT_ENABLED_STORAGE, String(enabled));
}

// ─── Environment Validation ──────────────────────────────────
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

// ─── Command Handler ────────────────────────────────────────
function isAgentCommand(content: string): boolean {
  const cmd = content.trim();
  return cmd.startsWith("/agent");
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

  // Show user message in Preact panel
  panel?.addUserMessage(message.content);

  // Extract conversation history
  const history = oc.thread.messages
    .filter((m) => (m.author === "user" || m.author === "ai") && m !== message)
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.author === "user" ? "user" as const : "assistant" as const, content: m.content }));

  // Run agent loop with panel callbacks
  const response = await agentLoop(
    oc,
    message.content,
    history,
    (status) => {
      console.log("🤖 [Agent]", status);
      const s = status.toLowerCase();
      if (s.includes("search") || s.includes("searching")) {
        panel?.setStatus("searching");
      } else if (s.includes("scrape") || s.includes("scrape_url") || s.includes("read")) {
        panel?.setStatus("scraping");
      } else if (s.includes("retry")) {
        panel?.setStatus("thinking");
      } else if (s.includes("thinking")) {
        panel?.setStatus("thinking");
      } else {
        panel?.setStatus("responding");
      }
    },
    (toolName, args, result) => {
      const id = panel?.addToolCall(toolName, args);
      if (id) {
        panel?.updateToolCall(id, {
          result: result.slice(0, 5000),
          status: "success",
        });
      }
    }
  );

  console.log("🤖 [Agent] Response:", response.slice(0, 100));

  // Show response in Preact panel
  panel?.setResponse(response);

  // Push to Perchance chat
  oc.thread.messages.push({
    author: "ai",
    content: response,
  });
}

// ─── Start Agent (registers handlers) ────────────────────────
function startAgent() {
  // Render Preact panel
  panel = renderPanel(document.body, {
    version: __VERSION__,
    commit: __COMMIT__,
    currentApiKey: getApiKey(),
    panelMode: loadPanelMode(),
    onSettingsSave: async (key: string) => {
      const valid = await validateApiKey(key);
      if (valid) {
        saveApiKey(key);
        setApiKey(key);
        return true;
      }
      return false;
    },
    onPanelModeChange: (mode) => {
      savePanelMode(mode);
      console.log("📊 [Agent] Panel mode:", mode);
    },
    inputEnabled: loadInputEnabled(),
    onInputEnabledChange: (enabled) => {
      saveInputEnabled(enabled);
      console.log("📊 [Agent] Panel input:", enabled ? "enabled" : "disabled");
    },
    onSendMessage: (text: string) => {
      if (agentProcessing) {
        console.log("⏳ [Agent] Already processing, ignoring panel input");
        return;
      }
      // Include suppression flags directly so the internal generator
      // never picks it up — avoids the race condition where
      // getBotReply fires before our MessageAdded handler can set them.
      oc.thread.messages.push({
        author: "user",
        content: text,
        expectsReply: false,
        hiddenFrom: ["ai"],
      });
    },
  });

  oc.window.show();
  console.log("🪟 [Agent] Window opened");

  // Register message handler
  oc.thread.on("MessageAdded", async function({ message }: { message: OcMessage }) {
    // Suppress internal generator by setting flags directly on the message object.
    if (message.author === "user") {
      message.expectsReply = false;
      if (!message.hiddenFrom) message.hiddenFrom = [];
      if (!message.hiddenFrom.includes("ai")) message.hiddenFrom.push("ai");
      console.log("🛡️ [Agent] Set expectsReply=false, hiddenFrom=[ai] on user message");
    }

    // Remove messages from Perchance's internal generator while our agent is running
    if (message.author === "ai" && agentProcessing) {
      const idx = oc.thread.messages.indexOf(message);
      if (idx !== -1) {
        oc.thread.messages.splice(idx, 1);
        console.log("🗑️ [Agent] Removed internal generator message");
      }
      return;
    }

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

    // Process user message
    agentProcessing = true;
    panel?.setStatus("thinking");
    try {
      await handleUserMessage(message);
    } catch (err) {
      console.error("❌ [Agent] Error:", err);
      panel?.setResponse(`Error: ${err instanceof Error ? err.message : String(err)}`);
      oc.thread.messages.push({
        author: "ai",
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      agentProcessing = false;
      panel?.setStatus("idle");
    }
  });

  console.log("✅ [Agent] Ready!");
}

// ─── Bootstrap ──────────────────────────────────────────────
function bootstrap() {
  printBanner();

  if (!validateEnvironment()) return;

  initStorage(oc);

  const savedKey = loadApiKey();
  if (savedKey) {
    setApiKey(savedKey);
    console.log("🔑 [Agent] API key loaded from customData");
    startAgent();
  } else {
    console.log("🔑 [Agent] No API key found — showing setup screen");
    renderSetup(document.body, {
      version: __VERSION__ + "+" + __COMMIT__,
      onSetupComplete: startAgent,
      validateApiKey,
      saveApiKey: (key: string) => {
        saveApiKey(key);
        setApiKey(key);
        console.log("🔑 [Agent] API key saved to customData");
      },
    });
    oc.window.show();
  }
}

// ─── Run ────────────────────────────────────────────────────
bootstrap();
