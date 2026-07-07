/**
 * Repetition detector — prevents the agent from getting stuck in loops
 * by tracking consecutive identical tool calls.
 */
// ─── RepetitionDetector ─────────────────────────────────────
export class RepetitionDetector {
    recent = [];
    consecutiveIdentical = 0;
    hash(args) {
        return JSON.stringify(args, Object.keys(args).sort());
    }
    /**
     * Check if the current tool call is repetitive.
     * Returns 'ok' if no repetition, 'warn' if 3+ consecutive identical, 'interrupt' if 5+.
     */
    check(toolName, args) {
        const fp = { toolName, argsHash: this.hash(args) };
        const last = this.recent[this.recent.length - 1];
        if (last && last.toolName === fp.toolName && last.argsHash === fp.argsHash) {
            this.consecutiveIdentical++;
        }
        else {
            this.consecutiveIdentical = 1;
        }
        this.recent.push(fp);
        if (this.consecutiveIdentical >= 5)
            return "interrupt";
        if (this.consecutiveIdentical >= 3)
            return "warn";
        return "ok";
    }
}
