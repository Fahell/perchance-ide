/**
 * Agent for Perchance Generator (standalone, with ai-text-plugin)
 * Entry point — imports here are bundled into dist/agent.js
 */

import { agentLoop, continueResponse } from "./agent-loop.js";
import { buildContext } from "./context-manager.js";
import { dbLoadVfs } from "./db.js";
import { getLocale, setLocale as setI18nLocale, type Locale } from "./i18n/index.js";
import { flushPendingEvents, initMapperDispatcher } from "./mapper-dispatcher.js";
import { extractMemories, formatMemories } from "./memory.js";
import { addMessage, initMessageStore } from "./message-store.js";
import { storageGet, storageSet } from "./storage.js";
import { loadSettings } from "./store.js";
import { initContextTools, initNodeTools, initShellTools, initTerminalTools, initVfsTools, initWebTools } from "./tools/index.js";
import { getApiKey, setApiKey, validateApiKey } from "./tools/web-search.js";
import { isAiAvailable } from "./types.js";
import { renderPanel, renderSetup, type AgentPanelRef } from "./ui/index.js";
import { initHashes } from "./vfs-events.js";
import { vfsLoadAll } from "./vfs.js";

const INPUT_ENABLED = true; // panel input is always enabled

// ─── Build Constants (injected by esbuild) ──────────────────
declare const __VERSION__: string;
declare const __COMMIT__: string;
declare const __BUILD_TIME__: string;

// ─── Globals ────────────────────────────────────────────────
let agentProcessing = false;
let panel: AgentPanelRef | null = null;
let currentToolCallId: string | null = null;
let currentCancelController: AbortController | null = null;

// ─── Version Banner ─────────────────────────────────────────
function printBanner() {
  console.log("🤖 Agent v" + __VERSION__ + "+" + __COMMIT__);
  console.log("   Build: " + __BUILD_TIME__);
  console.log("   https://github.com/Fahell/perchance-ide");
}

// ─── API Key Storage (localStorage) ─────────────────────────
const API_KEY_STORAGE = "agent:jina_key";

function loadApiKey(): string | null {
  return storageGet<string>(API_KEY_STORAGE) ?? null;
}

function saveApiKey(key: string): void {
  storageSet(API_KEY_STORAGE, key);
}

function loadLocale(): Locale {
  return getLocale();
}

// ─── Environment Validation ──────────────────────────────────
function validateEnvironment(): boolean {
  if (!isAiAvailable()) {
    console.error("❌ [Agent] ai-text-plugin not found!");
    console.log("💡 [Agent] Make sure your list panel has:");
    console.log('   agentAi = {import:ai-text-plugin}');
    console.log("   Then reload the generator.");
    return false;
  }
  return true;
}

// ─── Agent Message Handler ───────────────────────────────────
async function handleSendMessage(text: string, signal?: AbortSignal): Promise<void> {
  console.log("🤖 [Agent] Processing:", text.slice(0, 80));

  // Store user message
  await addMessage({ role: "user", content: text });
  panel?.addUserMessage(text);

  // Build context with token-aware summarization
  const ctx = await buildContext(text);
  console.log("🧠 [Agent] Context: ~" + ctx.totalTokens + " tokens, " + ctx.recentMessages.length + " messages" + (ctx.summarizedCount > 0 ? ", summarized " + ctx.summarizedCount + " older messages" : ""));

  // Check for cancellation before starting agent loop
  if (signal?.aborted) return;

  // Run agent loop with structured context
  const agentContext = {
    summary: ctx.summary,
    recentMessages: ctx.recentMessages,
    memories: await formatMemories(),
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
    },
    signal
  );

  console.log("🤖 [Agent] Response:", response.slice(0, 100));

  // Show response in Preact panel
  panel?.setResponse(response);

  // Store assistant message
  await addMessage({ role: "assistant", content: response });

  // Extract memories in background (non-blocking)
  extractMemories(text, response).catch(() => { });

  // Flush pending mapper events after agent finishes
  flushPendingEvents();
}

// ─── Start Agent ─────────────────────────────────────────────
async function startAgent() {
  // Initialize message store (load persisted messages)
  // Fire-and-forget: startup must not block rendering
  initMessageStore().catch((e) => console.error("[Agent] initMessageStore failed:", e));

  // Load editor settings from localStorage
  loadSettings();

  // Restore VFS from IndexedDB
  // Fire-and-forget: VFS loads incrementally, no need to block
  dbLoadVfs().then((entries) => {
    vfsLoadAll(entries);
    initHashes();
    initMapperDispatcher(() => agentProcessing);
    console.log("📁 [Agent] VFS restored: " + entries.length + " entries");
  }).catch((e) => console.error("[Agent] dbLoadVfs failed:", e));

  // Render Preact panel
  panel = renderPanel(document.body, {
    version: __VERSION__,
    commit: __COMMIT__,
    currentApiKey: getApiKey(),
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
      currentCancelController = new AbortController();
      panel?.setStatus("thinking");
      handleSendMessage(text, currentCancelController.signal)
        .catch((err) => {
          console.error("❌ [Agent] Error:", err);
          panel?.setResponse(`Error: ${err instanceof Error ? err.message : String(err)}`);
        })
        .finally(() => {
          agentProcessing = false;
          currentCancelController = null;
          panel?.setStatus("idle");
        });
    },
    onCancel: () => {
      if (currentCancelController) {
        console.log("🛑 [Agent] User requested cancellation");
        currentCancelController.abort();
        panel?.setStatus("idle");
      }
    },
    onContinue: async (content: string) => {
      if (agentProcessing) return;
      agentProcessing = true;
      try {
        const newText = await continueResponse(content);
        panel?.continueResponse(newText);
      } catch (err) {
        console.error("❌ [Agent] Continue failed:", err);
      } finally {
        agentProcessing = false;
      }
    },
  });

  // Register web tools (web_search, scrape_url)
  initWebTools();

  // Register context tools (search_history, get_messages)
  initContextTools();

  // Register VFS tools (read_file, write_file, etc.)
  initVfsTools();

  // Register terminal tools (run_python, execute_script, install_package)
  initTerminalTools();

  // Register Node.js tools (BrowserPod) — conditional on settings
  const { ideStore } = await import("./store.js");
  if (ideStore.getState().settings.toolNodeEnabled) {
    initNodeTools();
    initShellTools();
    const bpKey = ideStore.getState().settings.browserPodApiKey;
    if (bpKey) {
      import("./browserpod/manager.js").then(({ browserPodManager }) => {
        browserPodManager.boot({ apiKey: bpKey }).then((ok) => {
          if (ok) {
            ideStore.getState().setBrowserPodStatus("ready");
            // Enable real-time VFS → Pod sync for editor changes
            browserPodManager.subscribeToVfsChanges();
          } else {
            ideStore.getState().setBrowserPodStatus("error", browserPodManager.getError() ?? undefined);
          }
        });
      });
    }
  }

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
