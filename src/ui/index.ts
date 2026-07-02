/**
 * UI entry point — renders AgentPanel into a container
 */

import { h, render } from "preact";
import type { Locale } from "../i18n/index.js";
import { ideStore } from "../store.js";
import type { AgentPanelRef } from "./AgentPanel.js";
import { AgentPanel, type AgentPanelProps } from "./AgentPanel.js";
import { injectAnimations } from "./animations.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { SetupScreen } from "./SetupScreen.js";

export type { AgentPanelRef } from "./AgentPanel.js";

export function renderPanel(container: HTMLElement, props: AgentPanelProps & { onCancel?: () => void }): AgentPanelRef {
  injectAnimations();
  render(h(ErrorBoundary, { name: "AgentPanel", fallback: fullPageFallback }, h(AgentPanel, props)), container);

  // Return actions that index.ts can call — directly via store
  return {
    addUserMessage(content: string) {
      ideStore.getState().addUserMessage(content);
    },
    setStatus(status: any) {
      ideStore.getState().setAgentStatus(status);
    },
    addToolCall(name: string, args: Record<string, unknown>): string {
      return ideStore.getState().addToolCall(name, args);
    },
    updateToolCall(id: string, updates: any) {
      ideStore.getState().updateToolCall(id, updates);
    },
    setResponse(response: string) {
      ideStore.getState().appendAgentResponse(response);
    },
  };
}

export function renderSetup(container: HTMLElement, props: {
  version: string;
  locale?: Locale;
  onSetupComplete: () => void;
  validateApiKey: (key: string) => Promise<boolean>;
  saveApiKey: (key: string) => void;
}): void {
  injectAnimations();
  render(h(ErrorBoundary, { name: "SetupScreen" }, h(SetupScreen, props)), container);
}

/** Full-page error fallback for the entire AgentPanel */
function fullPageFallback(error: Error, retry: () => void) {
  return h("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      background: "#000000",
      color: "#888888",
      fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      fontSize: "12px",
      textAlign: "center",
      padding: "20px",
      gap: "12px",
    },
  }, [
    h("div", { style: { fontSize: "18px", color: "#cccccc" } }, "⚠️ Agent Panel"),
    h("div", { style: { fontSize: "10px", color: "#444444", maxWidth: "300px" } }, error.message || "Something went wrong"),
    h("button", {
      onClick: () => window.location.reload(),
      style: {
        background: "none",
        border: "1px solid #333333",
        color: "#888888",
        fontSize: "10px",
        padding: "4px 10px",
        cursor: "pointer",
        fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      },
    }, "[Reload]"),
  ]);
}
