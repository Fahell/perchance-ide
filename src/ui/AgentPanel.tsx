import { useEffect, useRef, useState } from "preact/hooks";
import { t, type Locale } from "../i18n/index.js";
import type { IdeState } from "../store.js";
import { ideStore } from "../store.js";
import { AgentMessage } from "./AgentMessage.js";
import { CodeEditor } from "./CodeEditor.js";
import { ContextViewer } from "./ContextViewer.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { FaqModal } from "./FaqModal.js";
import { Footer } from "./Footer.js";
import { Header } from "./Header.js";
import { MessageList } from "./MessageList.js";
import { RightPanel } from "./RightPanel.js";
import { ScrollFAB } from "./ScrollFAB.js";
import { SettingsModal } from "./SettingsModal.js";
import { colors, fonts } from "./theme.js";
import { ThinkingIndicator } from "./ThinkingIndicator.js";
import type { AgentStatus, PanelMode, ToolCallEntry } from "./types.js";
import { UserMessage } from "./UserMessage.js";

export interface AgentPanelProps {
  version: string;
  commit: string;
  currentApiKey: string;
  panelMode: PanelMode;
  userName?: string;
  locale?: Locale;
  onSettingsSave: (key: string) => Promise<boolean>;
  onPanelModeChange: (mode: PanelMode) => void;
  inputEnabled: boolean;
  onInputEnabledChange: (enabled: boolean) => void;
  onLocaleChange: (locale: Locale) => void;
  onSendMessage: (text: string) => void;
  onCancel?: () => void;
}

export interface AgentPanelRef {
  addUserMessage(content: string): void;
  setStatus(status: AgentStatus): void;
  addToolCall(name: string, args: Record<string, unknown>): string;
  updateToolCall(id: string, updates: Partial<ToolCallEntry>): void;
  setResponse(response: string): void;
}

export function AgentPanel({ version, commit, currentApiKey, panelMode: initialPanelMode, userName, locale: initialLocale, onSettingsSave, onPanelModeChange, inputEnabled: initialInputEnabled, onInputEnabledChange, onLocaleChange, onSendMessage, onCancel }: AgentPanelProps) {
  const [store, setStore] = useState<IdeState>(ideStore.getState());
  useEffect(() => ideStore.subscribe((s) => setStore(s)), []);
  const { messages, agentStatus } = store;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [apiKey, setApiKey] = useState(currentApiKey);
  const [panelMode, setPanelMode] = useState<PanelMode>(initialPanelMode);
  const [inputEnabled, setInputEnabled] = useState(initialInputEnabled);
  const [locale, setLocale] = useState<Locale>(initialLocale || "en");
  const scrollRef = useRef<HTMLDivElement>(null);

  const handlePanelModeChange = (mode: PanelMode) => {
    setPanelMode(mode);
    onPanelModeChange(mode);
  };

  const handleInputEnabledChange = (enabled: boolean) => {
    setInputEnabled(enabled);
    onInputEnabledChange(enabled);
  };

  const handleLocaleChange = (l: Locale) => {
    setLocale(l);
    onLocaleChange(l);
  };

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
                    {panelMode === "tools-only" ? (
                      <span>{t("panel.compact", locale)}</span>
                    ) : (
                      <span>
                        {t("panel.ready", locale)}<span style={{ animation: "cursor-blink 1s step-end infinite" }}>|</span>
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "9px", color: colors.textMuted }}>v{version}+{commit}</div>
                </div>
              )}

              {(() => {
                const isCompact = panelMode === "tools-only";
                const filtered = isCompact
                  ? messages.filter((msg) => {
                      if (msg.role === "user") return false;
                      if (msg.toolCalls.length > 0) return true;
                      if (agentStatus !== "idle") return true;
                      return false;
                    })
                  : messages;

                if (isCompact && messages.length > 0 && filtered.length === 0 && agentStatus === "idle") {
                  return (
                    <div style={{ padding: "12px", textAlign: "center", color: colors.textMuted, fontSize: "10px", fontFamily: fonts.mono }}>
                      {t("panel.compact", locale)}
                    </div>
                  );
                }

                const elements: preact.VNode[] = [];
                filtered.forEach((msg, i) => {
                  const prev = filtered[i - 1];
                  if (prev && prev.role !== msg.role) {
                    elements.push(<div key={`sep-${i}`} className="msg-turn-separator" />);
                  }
                  if (msg.role === "user") {
                    elements.push(<UserMessage key={msg.id} content={msg.content} userName={userName} locale={locale} />);
                  } else {
                    elements.push(
                      <AgentMessage
                        key={msg.id}
                        message={msg}
                        agentStatus={agentStatus}
                        compact={isCompact}
                        locale={locale}
                      />
                    );
                  }
                });
                return elements;
              })()}

              {/* Thinking gap */}
              {agentStatus === "thinking" && messages.length > 0 && messages[messages.length - 1].role === "user" && (
                <>
                  <div className="msg-turn-separator" />
                  <ThinkingIndicator />
                </>
              )}

            </MessageList>
            </ErrorBoundary>

            {/* Scroll-to-bottom FAB */}
            <ScrollFAB scrollRef={scrollRef} />
          </div>

          {/* Status line */}
          <div className={`status-line${agentStatus !== "idle" ? ` status-line--${agentStatus}` : ""}`} />

          {/* Footer */}
          <Footer
            onSettings={() => setSettingsOpen(true)}
            onContext={() => setContextOpen(true)}
            inputEnabled={inputEnabled}
            onSend={onSendMessage}
            disabled={agentStatus !== "idle"}
            onCancel={onCancel}
            locale={locale}
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
        panelMode={panelMode}
        inputEnabled={inputEnabled}
        onClose={() => setSettingsOpen(false)}
        onSave={async (key) => {
          const ok = await onSettingsSave(key);
          if (ok) setApiKey(key);
          return ok;
        }}
        onPanelModeChange={handlePanelModeChange}
        onInputEnabledChange={handleInputEnabledChange}
        locale={locale}
        onLocaleChange={handleLocaleChange}
      />
    </div>
  );
}
