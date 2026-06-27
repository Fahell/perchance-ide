/**
 * Agent for Perchance AI Character Chat
 * Entry point — imports here are bundled into dist/agent.js
 */

import type { Oc, OcMessage } from "./types.js";
import { agentLoop } from "./agent-loop.js";
import { setApiKey, getApiKey, validateApiKey } from "./tools/web-search.js";
import { storageGet, storageSet, initStorage } from "./storage.js";

// ─── Build Constants (injected by esbuild) ──────────────────
declare const __VERSION__: string;
declare const __COMMIT__: string;
declare const __BUILD_TIME__: string;

// ─── Globals ────────────────────────────────────────────────
const oc: Oc = window.oc;
let agentProcessing = false;
const MAX_HISTORY_MESSAGES = 10;

// ─── Version Banner ─────────────────────────────────────────
function printBanner() {
  console.log("🤖 Agent v" + __VERSION__ + "+" + __COMMIT__);
  console.log("   Build: " + __BUILD_TIME__);
  console.log("   https://github.com/Fahell/agent-perchance");
}

// ─── API Key Storage (customData) ───────────────────────────
const API_KEY_STORAGE = "agent:jina_key";

function loadApiKey(): string | null {
  return storageGet<string>(API_KEY_STORAGE) ?? null;
}

function saveApiKey(key: string): void {
  storageSet(API_KEY_STORAGE, key);
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

// ─── Setup Screen ───────────────────────────────────────────
function renderSetupScreen(): void {
  document.body.innerHTML = `
    <div style="font-family: system-ui; padding: 24px; background: #1a1a2e; color: #eee; height: 100vh; margin: 0; display: flex; align-items: center; justify-content: center;">
      <div style="max-width: 480px; width: 100%;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 48px; margin-bottom: 8px;">🤖</div>
          <h2 style="margin: 0; color: #00d4ff; font-size: 20px;">Agent for Perchance</h2>
          <span style="font-size: 11px; color: #666;">v${__VERSION__}+${__COMMIT__}</span>
        </div>
        <div style="background: #16213e; border-radius: 12px; padding: 20px; border: 1px solid #2a3a5e;">
          <h3 style="margin: 0 0 12px 0; color: #eee; font-size: 15px;">⚡ Setup — Chave de API da Jina</h3>
          <p style="color: #aaa; font-size: 13px; margin: 0 0 12px 0; line-height: 1.5;">
            Para usar busca na web, você precisa de uma chave de API <strong style="color: #4ade80;">gratuita</strong> da Jina AI.
          </p>
          <ol style="color: #aaa; font-size: 13px; margin: 0 0 16px 0; padding-left: 20px; line-height: 1.8;">
            <li>Acesse <a href="https://jina.ai/?sui=apikey" target="_blank" style="color: #00d4ff; text-decoration: none;">jina.ai/?sui=apikey</a></li>
            <li>Crie uma conta gratuita (ou faça login)</li>
            <li>Copie sua chave de API</li>
            <li>Cole no campo abaixo</li>
          </ol>
          <div style="margin-bottom: 12px;">
            <input id="api-key-input" type="password" placeholder="jina_xxxxxxxxxxxx..."
              style="width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #2a3a5e; background: #0f3460; color: #eee; font-size: 14px; font-family: monospace; box-sizing: border-box; outline: none;"
            />
          </div>
          <div id="api-key-error" style="display: none; color: #f87171; font-size: 12px; margin-bottom: 8px;"></div>
          <div id="api-key-success" style="display: none; color: #4ade80; font-size: 12px; margin-bottom: 8px;"></div>
          <button id="api-key-save" style="width: 100%; padding: 10px; border-radius: 8px; border: none; background: #00d4ff; color: #1a1a2e; font-size: 14px; font-weight: bold; cursor: pointer;">
            Salvar e Iniciar
          </button>
          <button id="api-key-skip" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #2a3a5e; background: transparent; color: #666; font-size: 12px; cursor: pointer; margin-top: 8px;">
            Pular (sem busca na web)
          </button>
        </div>
        <p style="color: #555; font-size: 11px; text-align: center; margin-top: 16px;">
          ℹ️ Sua chave é salva localmente neste navegador e nunca é compartilhada.
        </p>
      </div>
    </div>
  `;

  const input = document.getElementById("api-key-input") as HTMLInputElement;
  const saveBtn = document.getElementById("api-key-save")!;
  const skipBtn = document.getElementById("api-key-skip")!;
  const errorDiv = document.getElementById("api-key-error")!;
  const successDiv = document.getElementById("api-key-success")!;

  async function handleSave() {
    const key = input.value.trim();
    if (!key) {
      errorDiv.textContent = "Por favor, insira uma chave de API.";
      errorDiv.style.display = "block";
      successDiv.style.display = "none";
      return;
    }

    saveBtn.textContent = "Validando...";
    (saveBtn as HTMLButtonElement).disabled = true;
    errorDiv.style.display = "none";
    successDiv.style.display = "none";

    const valid = await validateApiKey(key);
    if (valid) {
      saveApiKey(key);
      setApiKey(key);
      successDiv.textContent = "✅ Chave válida! Iniciando...";
      successDiv.style.display = "block";
      console.log("🔑 [Agent] API key saved to customData");
      setTimeout(() => startAgent(), 800);
    } else {
      errorDiv.textContent = "❌ Chave inválida. Verifique e tente novamente.";
      errorDiv.style.display = "block";
      saveBtn.textContent = "Salvar e Iniciar";
      (saveBtn as HTMLButtonElement).disabled = false;
    }
  }

  saveBtn.addEventListener("click", handleSave);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") handleSave(); });

  skipBtn.addEventListener("click", () => {
    console.log("⏭️ [Agent] Setup skipped (no API key)");
    startAgent();
  });

  oc.window.show();
}

// ─── Window Management ──────────────────────────────────────
function setupWindow() {
  document.body.innerHTML = `
    <div style="font-family: system-ui; padding: 16px; background: #1a1a2e; color: #eee; height: 100vh; margin: 0; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="margin: 0; color: #00d4ff; font-size: 16px;">🤖 Agent Panel</h2>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 11px; color: #666;">v${__VERSION__}+${__COMMIT__}</span>
          <button id="settings-btn" style="background: none; border: 1px solid #2a3a5e; color: #666; font-size: 11px; padding: 2px 8px; border-radius: 4px; cursor: pointer;">⚙️</button>
        </div>
      </div>
      <div id="agent-output" style="flex: 1; overflow-y: auto; font-size: 13px;"></div>
    </div>
  `;
  document.getElementById("settings-btn")!.addEventListener("click", openSettings);
  oc.window.show();
  console.log("🪟 [Agent] Window opened");
}

// ─── Settings Screen ────────────────────────────────────────
function openSettings() {
  const currentKey = getApiKey();
  const maskedKey = currentKey ? currentKey.slice(0, 8) + "..." + currentKey.slice(-4) : "Nenhuma";

  const overlay = document.createElement("div");
  overlay.id = "settings-overlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;font-family:system-ui;";

  overlay.innerHTML = `
    <div style="background:#16213e;border-radius:12px;padding:20px;max-width:400px;width:90%;border:1px solid #2a3a5e;">
      <h3 style="margin:0 0 12px;color:#eee;font-size:15px;">⚙️ Configurações</h3>
      <div style="margin-bottom:12px;">
        <label style="color:#aaa;font-size:12px;display:block;margin-bottom:4px;">Chave de API da Jina:</label>
        <div style="display:flex;gap:8px;">
          <input id="settings-key-input" type="password" value="${currentKey}" placeholder="jina_xxx..."
            style="flex:1;padding:8px;border-radius:6px;border:1px solid #2a3a5e;background:#0f3460;color:#eee;font-size:13px;font-family:monospace;box-sizing:border-box;outline:none;" />
        </div>
        <div style="color:#666;font-size:11px;margin-top:4px;">Atual: ${maskedKey}</div>
      </div>
      <div id="settings-msg" style="display:none;font-size:12px;margin-bottom:8px;"></div>
      <div style="display:flex;gap:8px;">
        <button id="settings-save" style="flex:1;padding:8px;border-radius:6px;border:none;background:#00d4ff;color:#1a1a2e;font-size:13px;font-weight:bold;cursor:pointer;">Salvar</button>
        <button id="settings-close" style="flex:1;padding:8px;border-radius:6px;border:1px solid #2a3a5e;background:transparent;color:#aaa;font-size:13px;cursor:pointer;">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("settings-close")!.addEventListener("click", () => overlay.remove());
  document.getElementById("settings-save")!.addEventListener("click", async () => {
    const newKey = (document.getElementById("settings-key-input") as HTMLInputElement).value.trim();
    const msg = document.getElementById("settings-msg")!;
    if (!newKey) {
      msg.textContent = "Insira uma chave.";
      msg.style.color = "#f87171";
      msg.style.display = "block";
      return;
    }
    msg.textContent = "Validando...";
      msg.style.color = "#aaa";
    msg.style.display = "block";
    const valid = await validateApiKey(newKey);
    if (valid) {
      saveApiKey(newKey);
      setApiKey(newKey);
      msg.textContent = "✅ Chave salva!";
      msg.style.color = "#4ade80";
      setTimeout(() => overlay.remove(), 1000);
    } else {
      msg.textContent = "❌ Chave inválida.";
      msg.style.color = "#f87171";
    }
  });
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

  // Extract conversation history from thread (last N messages before this one)
  const history = oc.thread.messages
    .filter((m) => (m.author === "user" || m.author === "ai") && m !== message)
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.author === "user" ? "user" as const : "assistant" as const, content: m.content }));

  // Run the agent loop
  const response = await agentLoop(
    oc,
    message.content,
    history,
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

  // Mark processing done BEFORE pushing — so our MessageAdded handler allows it through
  agentProcessing = false;

  // Push ONLY the final AI response to the chat (no tool calls, no search results)
  oc.thread.messages.push({
    author: "ai",
    content: response,
  });

  appendToOutput(`<div style="margin: 4px 0 8px 12px; padding: 6px; background: #1a1a2e; border-radius: 4px; border-left: 2px solid #00d4ff;">
    <div style="color: #00d4ff; font-size: 12px;">✅ Response sent to chat (${response.length} chars)</div>
  </div>`);
}

// ─── Start Agent (registers handlers) ────────────────────────
function startAgent() {
  setupWindow();

  oc.thread.on("MessageAdded", function({ message }: { message: OcMessage }) {
    // Suppress internal generator by setting flags directly on the message object.
    // hiddenFrom: ["ai"] hides from AI only — user still sees the message in chat.
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

    // Handle regular messages — run agent loop
    console.log("📨 [Agent] Processing:", message.content.slice(0, 80));

    agentProcessing = true;

    handleUserMessage(message).catch((err) => {
      agentProcessing = false;
      console.error("❌ [Agent] Error:", err);
      oc.thread.messages.push({
        author: "ai",
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : String(err)}`,
      });
    });
  });

  console.log("✅ [Agent] Ready!");
}

// ─── Bootstrap ──────────────────────────────────────────────
async function bootstrap() {
  printBanner();
  console.log("🚀 [Agent] Loading...");

  // Initialize storage (requires oc to be available)
  initStorage(oc);

  // Load saved API key from customData
  const savedKey = loadApiKey();
  if (savedKey) {
    setApiKey(savedKey);
    console.log("🔑 [Agent] API key loaded from customData");
    startAgent();
  } else {
    console.log("🔑 [Agent] No API key found — showing setup screen");
    renderSetupScreen();
  }
}

// ─── Run ────────────────────────────────────────────────────
if (validateEnvironment()) {
  bootstrap();
}
