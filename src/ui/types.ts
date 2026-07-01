/**
 * Panel-specific types
 */

export type AgentStatus = "idle" | "thinking" | "searching" | "scraping" | "responding";
export type PanelMode = "full" | "tools-only";

export interface ToolCallEntry {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: "running" | "success" | "error";
  error?: string;
}

export interface PanelMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  toolCalls: ToolCallEntry[];
  timestamp: number;
}

export interface AgentPanelProps {
  version: string;
  commit: string;
  onStatus?: (status: string) => void;
  onToolResult?: (toolName: string, args: Record<string, unknown>, result: string) => void;
  onResponse?: (response: string) => void;
}
