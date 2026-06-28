import { h } from "preact";
import { useState, useCallback } from "preact/hooks";
import { colors, fonts } from "./theme.js";
import { Header } from "./Header.js";
import { MessageList } from "./MessageList.js";
import { UserMessage } from "./UserMessage.js";
import { AgentMessage } from "./AgentMessage.js";
import { SettingsModal } from "./SettingsModal.js";
import { LottieAnim } from "./LottieAnim.js";
import type { AgentStatus, PanelMode, PanelMessage, ToolCallEntry } from "./types.js";

const SEARCH_LOTTIE_URL = "https://lottie.host/d662511b-0326-4c1f-b48a-ac0329ec5102/co1Y6Wlb4z.json";

let msgCounter = 0;
function nextId(): string {
  return `msg-${++msgCounter}-${Date.now()}`;
}

export interface AgentPanelProps {
  version: string;
  commit: string;
  currentApiKey: string;
  panelMode: PanelMode;
  onSettingsSave: (key: string) => Promise<boolean>;
  onPanelModeChange: (mode: PanelMode) => void;
}

export interface AgentPanelRef {
  addUserMessage(content: string): void;
  setStatus(status: AgentStatus): void;
  addToolCall(name: string, args: Record<string, unknown>): string;
  updateToolCall(id: string, updates: Partial<ToolCallEntry>): void;
  setResponse(response: string): void;
}

export function AgentPanel({ version, commit, currentApiKey, panelMode: initialPanelMode, onSettingsSave, onPanelModeChange }: AgentPanelProps) {
  const [messages, setMessages] = useState<PanelMessage[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(currentApiKey);
  const [panelMode, setPanelMode] = useState<PanelMode>(initialPanelMode);

  const handlePanelModeChange = (mode: PanelMode) => {
    setPanelMode(mode);
    onPanelModeChange(mode);
  };

  // ── Exposed actions (used via ref from index.ts) ────────
  const addUserMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content, toolCalls: [], timestamp: Date.now() },
    ]);
  }, []);

  const setStatus = useCallback((status: AgentStatus) => {
    setAgentStatus(status);
  }, []);

  const addToolCall = useCallback((name: string, args: Record<string, unknown>): string => {
    const tcId = `tc-${++msgCounter}-${Date.now()}`;
    const entry: ToolCallEntry = { id: tcId, name, args, status: "running" };

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "agent") {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...last,
          toolCalls: [...last.toolCalls, entry],
        };
        return updated;
      }
      // Create new agent message
      return [
        ...prev,
        { id: nextId(), role: "agent", content: "", toolCalls: [entry], timestamp: Date.now() },
      ];
    });

    return tcId;
  }, []);

  const updateToolCall = useCallback((id: string, updates: Partial<ToolCallEntry>) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "agent") {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...last,
          toolCalls: last.toolCalls.map((tc) =>
            tc.id === id ? { ...tc, ...updates } : tc
          ),
        };
        return updated;
      }
      return prev;
    });
  }, []);

  const setResponse = useCallback((response: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "agent") {
        const updated = [...prev];
        updated[updated.length - 1] = { ...last, content: response };
        return updated;
      }
      return [
        ...prev,
        { id: nextId(), role: "agent", content: response, toolCalls: [], timestamp: Date.now() },
      ];
    });
    setAgentStatus("idle");
  }, []);

  // Store actions on a global for index.ts to access
  if (typeof window !== "undefined") {
    (window as any).__agentPanelActions = {
      addUserMessage,
      setStatus,
      addToolCall,
      updateToolCall,
      setResponse,
    } satisfies AgentPanelRef;
  }

  return (
    <div style={{
      fontFamily: fonts.mono,
      background: colors.bg,
      color: colors.text,
      height: "100vh",
      margin: "0",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
      overflow: "hidden",
    }}>
      <Header
        version={version}
        commit={commit}
        onSettings={() => setSettingsOpen(true)}
      />

      <MessageList>
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
                <span>compact — tool calls only</span>
              ) : (
                <span>
                  ready<span style={{ animation: "cursor-blink 1s step-end infinite" }}>|</span>
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
                compact — tool calls only
              </div>
            );
          }

          return filtered.map((msg) =>
            msg.role === "user" ? (
              <UserMessage key={msg.id} content={msg.content} />
            ) : (
              <AgentMessage
                key={msg.id}
                message={msg}
                agentStatus={agentStatus}
                compact={isCompact}
              />
            )
          );
        })()}

        {/* Search Lottie — visible while web_search executes */}
        {agentStatus === "searching" && (
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
            <LottieAnim src={SEARCH_LOTTIE_URL} size={40} loop={true} autoplay={true} />
          </div>
        )}
      </MessageList>

      <SettingsModal
        isOpen={settingsOpen}
        currentKey={apiKey}
        panelMode={panelMode}
        onClose={() => setSettingsOpen(false)}
        onSave={async (key) => {
          const ok = await onSettingsSave(key);
          if (ok) setApiKey(key);
          return ok;
        }}
        onPanelModeChange={handlePanelModeChange}
      />
    </div>
  );
}
