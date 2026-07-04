/**
 * Repetition detector — prevents the agent from getting stuck in loops
 * by tracking consecutive identical tool calls.
 */

// ─── Types ──────────────────────────────────────────────────
interface ToolCallFingerprint {
  toolName: string;
  argsHash: string;
}

// ─── RepetitionDetector ─────────────────────────────────────
export class RepetitionDetector {
  private recent: ToolCallFingerprint[] = [];
  private consecutiveIdentical = 0;

  private hash(args: Record<string, any>): string {
    return JSON.stringify(args, Object.keys(args).sort());
  }

  /**
   * Check if the current tool call is repetitive.
   * Returns 'ok' if no repetition, 'warn' if 3+ consecutive identical, 'interrupt' if 5+.
   */
  check(toolName: string, args: Record<string, any>): "ok" | "warn" | "interrupt" {
    const fp: ToolCallFingerprint = { toolName, argsHash: this.hash(args) };

    const last = this.recent[this.recent.length - 1];
    if (last && last.toolName === fp.toolName && last.argsHash === fp.argsHash) {
      this.consecutiveIdentical++;
    } else {
      this.consecutiveIdentical = 1;
    }

    this.recent.push(fp);

    if (this.consecutiveIdentical >= 5) return "interrupt";
    if (this.consecutiveIdentical >= 3) return "warn";
    return "ok";
  }
}
