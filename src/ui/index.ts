/**
 * UI entry point — renders AgentPanel into a container
 */

import { h, render } from "preact";
import { injectAnimations } from "./animations.js";
import { AgentPanel, type AgentPanelProps } from "./AgentPanel.js";
import { SetupScreen } from "./SetupScreen.js";
import type { AgentPanelRef } from "./AgentPanel.js";

export type { AgentPanelRef } from "./AgentPanel.js";
export { LottieAnim } from "./LottieAnim.js";

export function renderPanel(container: HTMLElement, props: AgentPanelProps): AgentPanelRef {
  injectAnimations();
  render(h(AgentPanel, props), container);

  // Return actions that index.ts can call
  return {
    addUserMessage(content: string) {
      (window as any).__agentPanelActions?.addUserMessage(content);
    },
    setStatus(status: any) {
      (window as any).__agentPanelActions?.setStatus(status);
    },
    addToolCall(name: string, args: Record<string, unknown>): string {
      return (window as any).__agentPanelActions?.addToolCall(name, args) ?? "";
    },
    updateToolCall(id: string, updates: any) {
      (window as any).__agentPanelActions?.updateToolCall(id, updates);
    },
    setResponse(response: string) {
      (window as any).__agentPanelActions?.setResponse(response);
    },
  };
}

export function renderSetup(container: HTMLElement, props: {
  version: string;
  onSetupComplete: () => void;
  validateApiKey: (key: string) => Promise<boolean>;
  saveApiKey: (key: string) => void;
}): void {
  injectAnimations();
  render(h(SetupScreen, props), container);
}
