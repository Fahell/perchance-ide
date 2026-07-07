import { useEffect, useRef, useState } from "preact/hooks";
import type { Locale } from "../i18n/index.js";
import { t } from "../i18n/index.js";
import { clearMessages as clearPersistedMessages } from "../message-store.js";
import type { IdeState } from "../store.js";
import { ideStore } from "../store.js";
import { ChatMessages } from "./ChatMessages.js";
import { CodeEditor } from "./CodeEditor.js";
import { ContextViewer } from "./ContextViewer.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { FaqModal } from "./FaqModal.js";
import { FileSearchModal } from "./FileSearchModal.js";
import { Footer } from "./Footer.js";
import { Header } from "./Header.js";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts.js";
import { MessageList } from "./MessageList.js";
import { RightPanel } from "./RightPanel.js";
import { ScrollFAB } from "./ScrollFAB.js";
import { SettingsModal } from "./SettingsModal.js";
import { TerminalPanel } from "./TerminalPanel.js";
import { colors, fonts } from "./theme.js";
import type { AgentStatus, ToolCallEntry } from "./types.js";

export interface AgentPanelProps {
  version: string;
  commit: string;
  currentApiKey: string;
  userName?: string;
  locale?: Locale;
  onSettingsSave: (key: string) => Promise<boolean>;
  onLocaleChange: (locale: Locale) => void;
  onSendMessage: (text: string) => void;
  onCancel?: () => void;
  onContinue?: (content: string) => void;
}

export interface AgentPanelRef {
  addUserMessage(content: string): void;
  setStatus(status: AgentStatus): void;
  addToolCall(name: string, args: Record<string, unknown>): string;
  updateToolCall(id: string, updates: Partial<ToolCallEntry>): void;
  setResponse(response: string): void;
  continueResponse(text: string): void;
}

export function AgentPanel({ version, commit, currentApiKey, userName, locale: initialLocale, onSettingsSave, onLocaleChange, onSendMessage, onCancel, onContinue }: AgentPanelProps) {
  const [store, setStore] = useState<IdeState>(ideStore.getState());
  useEffect(() => ideStore.subscribe((s) => setStore(s)), []);
  const { messages, agentStatus } = store;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [showFileSearch, setShowFileSearch] = useState(false);
  const [apiKey, setApiKey] = useState(currentApiKey);
  const [locale, setLocale] = useState<Locale>(initialLocale || "en");
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleLocaleChange = (l: Locale) => {
    setLocale(l);
    onLocaleChange(l);
  };

  const handleClearConversation = async () => {
    if (agentStatus !== "idle") return;
    if (!confirm("Clear all messages? This cannot be undone.")) return;
    ideStore.getState().clearMessages();
    await clearPersistedMessages();
  };

  // ── Global keyboard shortcuts ──────────────────────────
  useKeyboardShortcuts({
    settingsOpen,
    contextOpen,
    faqOpen,
    agentStatus,
    locale,
    setSettingsOpen,
    setContextOpen,
    setFaqOpen,
    setShowFileSearch,
  });

  return (
    <div style={{
      fontFamily: fonts.mono,
      background: colors.bg,
      color: colors.text,
      width: "100%",
      height: "100vh",
      margin: "0",
      padding: "0",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
      overflow: "hidden",
    }}>
      <Header version={version} commit={commit} onFaq={() => setFaqOpen(true)} />

      {/* ─── 3-Column Layout ──────────────────────────────── */}
      <div style={{
        display: "flex",
        flex: "1",
        minHeight: "0",
        overflow: "hidden",
      }}>

        {/* ── Left: Sidebar Panel (chat + tools + status) ── */}
        <div style={{
          width: "300px",
          minWidth: "300px",
          display: "flex",
          flexDirection: "column",
          borderRight: `1px solid ${colors.border}`,
        }}>
          {/* Messages area */}
          <div style={{ position: "relative", flex: "1", minHeight: "0", display: "flex", flexDirection: "column" }}>
            <ErrorBoundary name="MessageList">
              <MessageList outerRef={scrollRef}>
                {messages.length === 0 && (
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: colors.textMuted,
                    textAlign: "center",
                    padding: "20px",
                    fontFamily: fonts.mono,
                  }}>
                    <div style={{ fontSize: "12px", marginBottom: "6px" }}>
                      <span>
                        {t("panel.ready", locale)}<span style={{ animation: "cursor-blink 1s step-end infinite" }}>|</span>
                      </span>
                    </div>
                    <div style={{ fontSize: "9px", color: colors.textMuted }}>v{version}+{commit}</div>
                  </div>
                )}

                <ChatMessages
                  messages={messages}
                  agentStatus={agentStatus}
                  locale={locale}
                  userName={userName}
                  onContinue={onContinue}
                />

              </MessageList>
            </ErrorBoundary>

            {/* Scroll-to-bottom FAB */}
            <ScrollFAB scrollRef={scrollRef} />
          </div>

          {/* Status line */}
          <div className={`status-line${agentStatus !== "idle" ? ` status-line--${agentStatus}` : ""}`} />

          {/* Terminal Panel (above footer when open) */}
          {store.terminalOpen && (
            <ErrorBoundary name="TerminalPanel">
              <TerminalPanel visible={store.terminalOpen} />
            </ErrorBoundary>
          )}

          {/* Footer */}
          <Footer
            onSettings={() => setSettingsOpen(true)}
            onContext={() => setContextOpen(true)}
            onClear={handleClearConversation}
            inputEnabled={true}
            onSend={onSendMessage}
            disabled={agentStatus !== "idle"}
            onCancel={onCancel}
            locale={locale}
            terminalOpen={store.terminalOpen}
            onToggleTerminal={() => ideStore.getState().setTerminalOpen(!store.terminalOpen)}
          />
        </div>

        {/* ── Middle: Code Editor ─────────────────────────── */}
        <div style={{ flex: "1", minWidth: "0" }}>
          <ErrorBoundary name="CodeEditor">
            <CodeEditor
              locale={locale}
            />
          </ErrorBoundary>
        </div>

        {/* ── Right: Placeholder panel ───────────────────── */}
        <div style={{ width: "300px", minWidth: "300px" }}>
          <ErrorBoundary name="RightPanel">
            <RightPanel locale={locale} />
          </ErrorBoundary>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────── */}
      <ContextViewer
        isOpen={contextOpen}
        locale={locale}
        onClose={() => setContextOpen(false)}
        onRefresh={() => setContextOpen(false)}
      />

      <FaqModal
        isOpen={faqOpen}
        locale={locale}
        onClose={() => setFaqOpen(false)}
      />

      <SettingsModal
        isOpen={settingsOpen}
        currentKey={apiKey}
        onClose={() => setSettingsOpen(false)}
        onSave={async (key) => {
          const ok = await onSettingsSave(key);
          if (ok) setApiKey(key);
          return ok;
        }}
        locale={locale}
        onLocaleChange={handleLocaleChange}
      />

      <FileSearchModal
        isOpen={showFileSearch}
        onClose={() => setShowFileSearch(false)}
        locale={locale}
      />
    </div>
  );
}
