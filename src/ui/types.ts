/**
 * Panel-specific types
 */

export type AgentStatus = "idle" | "thinking" | "searching" | "scraping" | "responding";

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
