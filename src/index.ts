/**
 * Agent for Perchance Generator (standalone, with ai-text-plugin)
 * Entry point — imports here are bundled into dist/agent.js
 */

import { agentLoop } from "./agent-loop.js";
import { setApiKey, getApiKey, validateApiKey } from "./tools/web-search.js";
import { initContextTools } from "./tools/index.js";
import { storageGet, storageSet } from "./storage.js";
import { renderPanel, renderSetup, type AgentPanelRef } from "./ui/index.js";
import { getLocale, setLocale as setI18nLocale, type Locale } from "./i18n/index.js";
import { buildContext } from "./context-manager.js";
import { extractMemories, formatMemories } from "./memory.js";
import { initMessageStore, addMessage } from "./message-store.js";

// ─── Build Constants (injected by esbuild) ──────────────────
declare const __VERSION__: string;
declare const __COMMIT__: string;
declare const __BUILD_TIME__: string;

// ─── Globals ────────────────────────────────────────────────
let agentProcessing = false;
let panel: AgentPanelRef | null = null;
let currentToolCallId: string | null = null;

// ─── Version Banner ─────────────────────────────────────────
function printBanner() {
  console.log("🤖 Agent v" + __VERSION__ + "+" + __COMMIT__);
  console.log("   Build: " + __BUILD_TIME__);
  console.log("   https://github.com/Fahell/perchance-ide");
}

// ─── API Key Storage (localStorage) ─────────────────────────
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
  return storageGet<string>(INPUT_ENABLED_STORAGE) !== "false";
}

function saveInputEnabled(enabled: boolean): void {
  storageSet(INPUT_ENABLED_STORAGE, String(enabled));
}

function loadLocale(): Locale {
  return getLocale();
}

// ─── Environment Validation ──────────────────────────────────
function validateEnvironment(): boolean {
  if (typeof window.ai !== "function") {
    console.error("❌ [Agent] window.ai not found — ai-text-plugin not loaded?");
    console.log("💡 [Agent] Make sure you have 'ai = {import:ai-text-plugin}' in your list panel.");
    return false;
  }
  return true;
}

// ─── Agent Message Handler ───────────────────────────────────
async function handleSendMessage(text: string): Promise<void> {
  console.log("🤖 [Agent] Processing:", text.slice(0, 80));

  // Store user message
  addMessage({ role: "user", content: text });
  panel?.addUserMessage(text);

  // Build context with token-aware summarization
  const ctx = await buildContext(text);
  console.log("🧠 [Agent] Context: ~" + ctx.totalTokens + " tokens, " + ctx.recentMessages.length + " messages" + (ctx.summarizedCount > 0 ? ", summarized " + ctx.summarizedCount + " older messages" : ""));

  // Run agent loop with structured context
  const agentContext = {
    summary: ctx.summary,
    recentMessages: ctx.recentMessages,
    memories: formatMemories(),
  };

  const response = await agentLoop(
    text,
    agentContext,
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
      if (currentToolCallId) {
        panel?.updateToolCall(currentToolCallId, {
          args,
          result: result.slice(0, 5000),
          status: "success",
        });
        currentToolCallId = null;
      }
    },
    (toolName, args) => {
      currentToolCallId = panel?.addToolCall(toolName, args) ?? null;
    },
    (toolName, args, error) => {
      if (currentToolCallId) {
        panel?.updateToolCall(currentToolCallId, {
          args,
          error,
          status: "error",
        });
        currentToolCallId = null;
      }
    }
  );

  console.log("🤖 [Agent] Response:", response.slice(0, 100));

  // Show response in Preact panel
  panel?.setResponse(response);

  // Store assistant message
  addMessage({ role: "assistant", content: response });

  // Extract memories in background (non-blocking)
  extractMemories(text, response).catch(() => {});
}

// ─── Start Agent ─────────────────────────────────────────────
function startAgent() {
  // Initialize message store (load persisted messages)
  initMessageStore();

  // Render Preact panel
  panel = renderPanel(document.body, {
    version: __VERSION__,
    commit: __COMMIT__,
    currentApiKey: getApiKey(),
    panelMode: loadPanelMode(),
    locale: loadLocale(),
    userName: "",
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
    onLocaleChange: (locale) => {
      setI18nLocale(locale);
      console.log("🌐 [Agent] Locale:", locale);
    },
    onSendMessage: (text: string) => {
      if (agentProcessing) {
        console.log("⏳ [Agent] Already processing, ignoring panel input");
        return;
      }
      agentProcessing = true;
      panel?.setStatus("thinking");
      handleSendMessage(text)
        .catch((err) => {
          console.error("❌ [Agent] Error:", err);
          panel?.setResponse(`Error: ${err instanceof Error ? err.message : String(err)}`);
        })
        .finally(() => {
          agentProcessing = false;
          panel?.setStatus("idle");
        });
    },
  });

  // Register context tools (search_history, get_messages)
  initContextTools();

  console.log("✅ [Agent] Ready!");
  console.log("💡 [Agent] Type in the sidebar panel to start.");
}

// ─── Bootstrap ──────────────────────────────────────────────
function bootstrap() {
  printBanner();

  if (!validateEnvironment()) return;

  const savedKey = loadApiKey();
  if (savedKey) {
    setApiKey(savedKey);
    console.log("🔑 [Agent] API key loaded from localStorage");
    startAgent();
  } else {
    console.log("🔑 [Agent] No API key found — showing setup screen");
    renderSetup(document.body, {
      version: __VERSION__ + "+" + __COMMIT__,
      locale: loadLocale(),
      onSetupComplete: startAgent,
      validateApiKey,
      saveApiKey: (key: string) => {
        saveApiKey(key);
        setApiKey(key);
        console.log("🔑 [Agent] API key saved to localStorage");
      },
    });
  }
}

// ─── Run ────────────────────────────────────────────────────
bootstrap();
