import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { Locale } from "../i18n/index.js";
import { t } from "../i18n/index.js";
import { archiveConversation, getArchivedConversations, restoreConversation, deleteArchivedConversation } from "../message-store.js";
import type { ArchivedConversation } from "../message-store.js";
import type { IdeState } from "../store.js";
import { ideStore } from "../store.js";
import { storageGet, storageSet } from "../storage.js";
import { ChatMessages } from "./ChatMessages.js";
import { CodeEditor } from "./CodeEditor.js";
import { ContextViewer } from "./ContextViewer.js";
import { EditorFooter } from "./EditorFooter.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { FaqModal } from "./FaqModal.js";
import { FileSearchModal } from "./FileSearchModal.js";
import { Footer } from "./Footer.js";
import { Header } from "./Header.js";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts.js";
import { MessageList } from "./MessageList.js";
import { Modal } from "./Modal.js";
import { RightPanel } from "./RightPanel.js";
import { ScrollFAB } from "./ScrollFAB.js";
import { SettingsModal } from "./SettingsModal.js";
import { TerminalPanel } from "./TerminalPanel.js";
import { ResizeHandle } from "./ResizeHandle.js";
import { colors, fonts } from "./theme.js";
import type { AgentStatus, ToolCallEntry } from "./types.js";

export interface AgentPanelProps {
  version: string;
  commit: string;
  currentApiKey: string;
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

export function AgentPanel({ version, commit, currentApiKey, locale: initialLocale, onSettingsSave, onLocaleChange, onSendMessage, onCancel, onContinue }: AgentPanelProps) {
  const [store, setStore] = useState<IdeState>(ideStore.getState());
  useEffect(() => ideStore.subscribe((s) => setStore(s)), []);
  const { messages, agentStatus } = store;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [showFileSearch, setShowFileSearch] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [apiKey, setApiKey] = useState(currentApiKey);
  const [locale, setLocale] = useState<Locale>(initialLocale || "en");
  const [rightWidth, setRightWidth] = useState(300);
  const [chatWidth, setChatWidth] = useState(() => {
    const saved = storageGet<number>("chat:width");
    return saved && saved >= 200 ? saved : 300;
  });
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [archivedConversations, setArchivedConversations] = useState<ArchivedConversation[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const onResizePanel = useCallback((delta: number) => {
    // Handle is on the LEFT edge of the right panel:
    // Drag LEFT → delta negative (currentPos < startPos) → w - (-|delta|) = WIDER
    // Drag RIGHT → delta positive (currentPos > startPos) → w - delta = NARROWER
    setRightWidth((w) => Math.max(200, Math.min(window.innerWidth * 0.5, w - delta)));
  }, []);

  const onResizeChat = useCallback((delta: number) => {
    setChatWidth((w) => {
      const nw = Math.max(200, Math.min(500, w + delta));
      storageSet("chat:width", nw);
      return nw;
    });
  }, []);

  // Load archived conversation count on mount
  useEffect(() => {
    getArchivedConversations().then(setArchivedConversations).catch(() => {});
  }, []);

  const handleLocaleChange = (l: Locale) => {
    setLocale(l);
    onLocaleChange(l);
    ideStore.getState().updateSettings({ locale: l });
  };

  const handleNewConversation = async () => {
    if (agentStatus !== "idle") return;
    if (store.messages.length === 0) return;
    const id = await archiveConversation();
    if (!id) return;
    ideStore.getState().clearMessages();
    const updated = await getArchivedConversations();
    setArchivedConversations(updated);
  };

  const handleOpenHistory = async () => {
    const updated = await getArchivedConversations();
    setArchivedConversations(updated);
    setHistoryOpen(true);
  };

  const handleRestoreConversation = async (convId: string) => {
    const restored = await restoreConversation(convId);
    if (restored.length > 0) {
      ideStore.getState().clearMessages();
      for (const msg of restored) {
        if (msg.role === "user") {
          ideStore.getState().addUserMessage(msg.content);
        } else if (msg.role === "assistant") {
          ideStore.getState().appendAgentResponse(msg.content);
        }
      }
      setHistoryOpen(false);
    }
  };

  const handleDeleteConversation = async (convId: string) => {
    await deleteArchivedConversation(convId);
    const updated = await getArchivedConversations();
    setArchivedConversations(updated);
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
      <Header version={version} commit={commit} agentStatus={agentStatus} onFaq={() => setFaqOpen(true)} />

      {/* ─── 3-Column Layout ──────────────────────────────── */}
      <div style={{
        display: "flex",
        flex: "1",
        minHeight: "0",
        overflow: "hidden",
      }}>

        {/* ── Left: Sidebar Panel (chat) ── */}
        {sidebarVisible && (
          <div style={{
            width: `${chatWidth}px`,
            minWidth: "200px",
            display: "flex",
            flexDirection: "column",
            borderRight: `1px solid ${colors.border}`,
            flexShrink: 0,
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "6px 12px",
              borderBottom: `1px solid ${colors.border}`,
              flexShrink: 0,
            }}>
              <span style={{ color: colors.textSecondary, fontSize: "10px", fontFamily: fonts.mono, letterSpacing: "1px", textTransform: "uppercase" }}>
                chat
              </span>
              <button
                onClick={() => setSidebarVisible(false)}
                title="Hide sidebar"
                style={{
                  background: "none",
                  border: "none",
                  color: colors.textMuted,
                  fontSize: "11px",
                  cursor: "pointer",
                  fontFamily: fonts.mono,
                  padding: "2px 4px",
                }}
              >
                ◀
              </button>
            </div>

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
                    onContinue={onContinue}
                  />

                </MessageList>
              </ErrorBoundary>

              {/* Scroll-to-bottom FAB */}
              <ScrollFAB scrollRef={scrollRef} />
            </div>

            {/* Status line */}
            <div className={`status-line${agentStatus !== "idle" ? ` status-line--${agentStatus}` : ""}`} />

            {/* Footer (chat) */}
            <Footer
              onSettings={() => setSettingsOpen(true)}
              onContext={() => setContextOpen(true)}
              onNew={handleNewConversation}
              onHistory={handleOpenHistory}
              inputEnabled={true}
              onSend={onSendMessage}
              disabled={agentStatus !== "idle"}
              onCancel={onCancel}
              locale={locale}
              conversationCount={archivedConversations.length}
            />
          </div>
        )}

        {/* Collapse expand button when sidebar hidden */}
        {!sidebarVisible && (
          <button
            onClick={() => setSidebarVisible(true)}
            title="Show sidebar"
            style={{
              width: "16px",
              minWidth: "16px",
              background: "transparent",
              border: "none",
              borderRight: `1px solid ${colors.border}`,
              color: colors.textMuted,
              fontSize: "10px",
              cursor: "pointer",
              fontFamily: fonts.mono,
              padding: "0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ▶
          </button>
        )}

        {/* Resize handle for chat sidebar */}
        {sidebarVisible && <ResizeHandle direction="horizontal" onResize={onResizeChat} />}

        {/* ── Middle: Code Editor + Terminal ──────────────── */}
        <div style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column" }}>
          <ErrorBoundary name="CodeEditor">
            <CodeEditor
              locale={locale}
            />
          </ErrorBoundary>

          {/* Terminal Panel (in editor column, above EditorFooter) */}
          {store.terminalOpen && (
            <ErrorBoundary name="TerminalPanel">
              <TerminalPanel visible={store.terminalOpen} />
            </ErrorBoundary>
          )}

          {/* Editor Footer with terminal toggle */}
          <EditorFooter
            terminalOpen={store.terminalOpen}
            onToggleTerminal={() => ideStore.getState().setTerminalOpen(!store.terminalOpen)}
          />
        </div>

        {/* ── Right: Resizable panel ────────────────────── */}
        <ResizeHandle direction="horizontal" onResize={onResizePanel} />
        <div style={{ width: `${rightWidth}px`, minWidth: "200px", flexShrink: 0 }}>
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

      {/* ── Conversation History Modal ── */}
      <Modal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} title="Conversations">
        {archivedConversations.length === 0 ? (
          <div style={{ color: colors.textMuted, fontSize: "10px", fontFamily: fonts.mono, textAlign: "center", padding: "20px" }}>
            No archived conversations.
          </div>
        ) : (
          <div style={{ maxHeight: "300px", overflowY: "auto" }}>
            {archivedConversations.map((conv) => (
              <div
                key={conv.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  marginBottom: "4px",
                  background: colors.surface1,
                  border: `1px solid ${colors.border}`,
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onClick={() => handleRestoreConversation(conv.id)}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = colors.textMuted)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = colors.border)}
              >
                <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                  <div style={{
                    color: colors.textSecondary,
                    fontSize: "10px",
                    fontFamily: fonts.mono,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {conv.label}
                  </div>
                  <div style={{
                    color: colors.textMuted,
                    fontSize: "9px",
                    fontFamily: fonts.mono,
                    marginTop: "2px",
                  }}>
                    {conv.messageCount} messages · {new Date(conv.timestamp).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                  title="Delete conversation"
                  style={{
                    background: "none",
                    border: "none",
                    color: colors.textMuted,
                    fontSize: "11px",
                    cursor: "pointer",
                    fontFamily: fonts.mono,
                    padding: "2px 6px",
                    flexShrink: 0,
                    opacity: 0.6,
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
                >
                  [del]
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => setHistoryOpen(false)}
          style={{
            width: "100%",
            padding: "8px",
            marginTop: "8px",
            border: `1px solid ${colors.border}`,
            background: "transparent",
            color: colors.textMuted,
            fontSize: "11px",
            fontFamily: fonts.mono,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </Modal>
    </div>
  );
}


