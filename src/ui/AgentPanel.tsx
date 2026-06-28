import { h } from "preact";
import { useState, useCallback } from "preact/hooks";
import { colors } from "./theme.js";
import { Header } from "./Header.js";
import { MessageList } from "./MessageList.js";
import { UserMessage } from "./UserMessage.js";
import { AgentMessage } from "./AgentMessage.js";
import { SettingsModal } from "./SettingsModal.js";
import type { AgentStatus, PanelMessage, ToolCallEntry } from "./types.js";

let msgCounter = 0;
function nextId(): string {
  return `msg-${++msgCounter}-${Date.now()}`;
}

export interface AgentPanelProps {
  version: string;
  commit: string;
  currentApiKey: string;
  onSettingsSave: (key: string) => Promise<boolean>;
}

export interface AgentPanelRef {
  addUserMessage(content: string): void;
  setStatus(status: AgentStatus): void;
  addToolCall(name: string, args: Record<string, unknown>): string;
  updateToolCall(id: string, updates: Partial<ToolCallEntry>): void;
  setResponse(response: string): void;
}

export function AgentPanel({ version, commit, currentApiKey, onSettingsSave }: AgentPanelProps) {
  const [messages, setMessages] = useState<PanelMessage[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(currentApiKey);

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
      fontFamily: "system-ui, -apple-system, sans-serif",
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
          }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>🤖</div>
            <div style={{ fontSize: "13px", marginBottom: "4px" }}>Olá! Envie uma mensagem para começar.</div>
            <div style={{ fontSize: "10px" }}>v{version}+{commit}</div>
          </div>
        )}

        {messages.map((msg) =>
          msg.role === "user" ? (
            <UserMessage key={msg.id} content={msg.content} />
          ) : (
            <AgentMessage
              key={msg.id}
              message={msg}
              agentStatus={agentStatus}
            />
          )
        )}
      </MessageList>

      <SettingsModal
        isOpen={settingsOpen}
        currentKey={apiKey}
        onClose={() => setSettingsOpen(false)}
        onSave={async (key) => {
          const ok = await onSettingsSave(key);
          if (ok) setApiKey(key);
          return ok;
        }}
      />
    </div>
  );
}
