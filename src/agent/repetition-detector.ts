/**
 * Repetition detector — prevents the agent from getting stuck in loops
 * by tracking repeated tool calls within a sliding window.
 *
 * Path arguments are normalized (relative → absolute, collapsed) so that
 * equivalent FS operations (e.g. `mkdir -p src` vs `mkdir -p /home/user/src`)
 * are correctly identified as the same operation.
 */

// ─── RepetitionDetector ─────────────────────────────────────
export class RepetitionDetector {
  private recent: string[] = [];
  private static readonly WINDOW = 8;
  private static readonly WARN_COUNT = 3;
  private static readonly INTERRUPT_COUNT = 5;
  private static readonly FS_COMMANDS = new Set(["mkdir", "touch", "cp", "mv", "rm"]);
  private static readonly CWD = "/home/user";

  /**
   * Build a normalized identity string for a tool call.
   * For FS-mutating commands the target path is resolved to an absolute form
   * so that relative and absolute references to the same file count as identical.
   */
  private normalize(toolName: string, args: Record<string, any>): string {
    // VFS mutation / read tools: normalize the path argument
    if (toolName === "write_file" || toolName === "delete_file" || toolName === "rename_file" || toolName === "read_file") {
      const path = args.path as string | undefined;
      if (path) return `${toolName}:${this.resolvePath(path)}`;
    }

    // Shell commands: detect FS-mutating commands and normalize their target
    if (toolName === "run_shell_command") {
      const command = (args.command as string || "").trim();
      const tokens = command.split(/\s+/);
      const baseCmd = tokens[0] || "";
      if (RepetitionDetector.FS_COMMANDS.has(baseCmd)) {
        const target = this.extractTarget(tokens, 1);
        if (target) return `${toolName}:${baseCmd}:${this.resolvePath(target)}`;
      }
      if (baseCmd === "git" && tokens[1] === "init") {
        return `${toolName}:git:init`;
      }
    }

    // Default: exact argument hash (non-FS commands)
    return `${toolName}:${JSON.stringify(args, Object.keys(args).sort())}`;
  }

  /**
   * Extract the first non-flag argument from a token list, starting at `start`.
   */
  private extractTarget(tokens: string[], start: number): string | null {
    for (let i = start; i < tokens.length; i++) {
      if (tokens[i].startsWith("-")) continue;
      return tokens[i];
    }
    return null;
  }

  /**
   * Resolve a path to a canonical absolute form.
   * Relative paths are resolved against `/home/user` and `/./` / `/../` collapsed.
   */
  private resolvePath(path: string): string {
    const parts = (path.startsWith("/") ? path : `${RepetitionDetector.CWD}/${path}`)
      .split("/")
      .filter(Boolean);
    const result: string[] = [];
    for (const p of parts) {
      if (p === ".") continue;
      if (p === "..") { result.pop(); continue; }
      result.push(p);
    }
    return "/" + result.join("/");
  }

  /**
   * Check if the current tool call is repetitive within the sliding window.
   * Returns 'ok' if no repetition, 'warn' if the same normalized operation
   * appears WARN_COUNT times in the window, 'interrupt' at INTERRUPT_COUNT.
   */
  check(toolName: string, args: Record<string, any>): "ok" | "warn" | "interrupt" {
    const normId = this.normalize(toolName, args);

    this.recent.push(normId);
    if (this.recent.length > RepetitionDetector.WINDOW) {
      this.recent.shift();
    }

    let count = 0;
    for (const id of this.recent) {
      if (id === normId) count++;
    }

    if (count >= RepetitionDetector.INTERRUPT_COUNT) return "interrupt";
    if (count >= RepetitionDetector.WARN_COUNT) return "warn";
    return "ok";
  }
}
