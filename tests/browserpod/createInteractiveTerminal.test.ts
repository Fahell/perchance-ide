/**
 * createInteractiveTerminal — regression tests.
 *
 * Background: the spec for `terminal-connect-bug-spec.md`. A pre-flight
 * `pod.run("/bin/true")` was previously inserted on the freshly-created
 * interactive terminal handle (commit 2e3101f). Because /bin/true exits
 * in microseconds, BrowserPod finalized the terminal's internal stream
 * promise before the subsequent `pod.run("/bin/bash")` could subscribe.
 * Its internals crashed with
 *   `Cannot read properties of undefined (reading 'catch')`,
 *   which propagated as `Failed to connect: …` in the terminal panel.
 *
 * Fix: delete the on-interactive-terminal health check entirely. The
 * headless `_healthCheck()` at the top of `createInteractiveTerminal()`
 * already exercises the WebSocket via `this.terminal`, covering the
 * failure class that the extra check was meant to catch.
 *
 * These tests treat `mockPod.run` invocations as the source of truth
 * (call count + arguments per `terminal` handle) and confirm that ONLY
 * the headless `/bin/true` and the interactive `/bin/bash` are issued.
 *
 * Test isolation: every setup / teardown awaits the affected async work.
 * Earlier versions called `browserPodManager.dispose()` without awaiting,
 * which leaked the suspended `await this.pod.dispose()` body across tests
 * and intermittently cleared `pod` before the next test body's first sync
 * check — producing a haunting "BrowserPod not initialized" pattern on
 * alternating tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MockPodFs } from "../../src/test-helpers/mock-pod-fs.js";
import { browserPodManager } from "../../src/browserpod/manager.js";

describe("createInteractiveTerminal — on-interactive-terminal /bin/true crash regression", () => {
  let mockPod: MockPodFs;
  let runSpy: ReturnType<typeof vi.spyOn>;
  let createCustomTerminalSpy: ReturnType<typeof vi.fn>;
  /** Sentinel returned by createCustomTerminal so tests can tell the
   *  interactive handle apart from the headless `this.terminal = {}`. */
  let interactiveHandle: Record<string, unknown>;

  beforeEach(async () => {
    mockPod = new MockPodFs();
    // Await the dispose so any in-flight `await this.pod.dispose()` in
    // its body completes BEFORE we re-set `pod` via __setTestPod below.
    await browserPodManager.dispose();
    browserPodManager.__setTestPod(mockPod);

    interactiveHandle = { __kind: "interactive", write: vi.fn(), resize: vi.fn() };
    createCustomTerminalSpy = vi.fn().mockResolvedValue(interactiveHandle);
    (mockPod as any).createCustomTerminal = createCustomTerminalSpy;

    runSpy = vi.spyOn(mockPod, "run");
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    // Body is sync, but the signature is async — awaiting makes the contract
    // explicit and avoids any future regressions if MockPodFs.dispose grows awaits.
    await mockPod.dispose();
  });

  it("[regression] does NOT call pod.run with /bin/true on the interactive handle", async () => {
    await browserPodManager.createInteractiveTerminal({
      cols: 80,
      rows: 24,
      onOutput: () => {},
    });

    const trueOnInteractive = runSpy.mock.calls.filter(
      ([cmd, _args, opts]: [string, string[], any]) =>
        cmd === "/bin/true" && opts?.terminal === interactiveHandle
    );
    expect(trueOnInteractive).toHaveLength(0);
  });

  it("calls createCustomTerminal exactly once and pod.run exactly twice (1 health + 1 bash)", async () => {
    await browserPodManager.createInteractiveTerminal({
      cols: 80,
      rows: 24,
      onOutput: () => {},
    });

    expect(createCustomTerminalSpy).toHaveBeenCalledTimes(1);
    expect(runSpy).toHaveBeenCalledTimes(2);

    const [first, second] = runSpy.mock.calls;
    // Headless `_healthCheck` /bin/true uses `this.terminal = {}` (not interactive)
    expect(first[0]).toBe("/bin/true");
    expect((first[2] as any).terminal).not.toBe(interactiveHandle);
    // Interactive /bin/bash spawn uses the interactive handle created moments earlier
    expect(second[0]).toBe("/bin/bash");
    expect((second[2] as any).terminal).toBe(interactiveHandle);
  });

  it("spawns bash with cwd=/home/user and HOME env", async () => {
    await browserPodManager.createInteractiveTerminal({
      cols: 80,
      rows: 24,
      onOutput: () => {},
    });

    const bashCalls = runSpy.mock.calls.filter(([cmd]) => cmd === "/bin/bash");
    expect(bashCalls).toHaveLength(1);
    const [, args, opts] = bashCalls[0] as [string, string[], any];
    expect(args).toEqual([]);
    expect(opts.cwd).toBe("/home/user");
    expect(opts.env).toContain("HOME=/home/user");
  });

  it("returns a bridge whose .write() delegates to interactive handle.write()", async () => {
    const bridge = await browserPodManager.createInteractiveTerminal({
      cols: 80,
      rows: 24,
      onOutput: () => {},
    });

    bridge.write("ls -la\n");
    expect((interactiveHandle.write as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("ls -la\n");

    bridge.resize(120, 30);
    expect((interactiveHandle.resize as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(120, 30);
  });

  it("falls back to handle.input() when handle.write() is absent", async () => {
    const altHandle = { __kind: "interactive", input: vi.fn() };
    (mockPod as any).createCustomTerminal = vi.fn().mockResolvedValue(altHandle);

    const bridge = await browserPodManager.createInteractiveTerminal({
      cols: 80,
      rows: 24,
      onOutput: () => {},
    });

    bridge.write("npm test\n");
    expect(altHandle.input).toHaveBeenCalledWith("npm test\n");
  });

  it("logs a warning (does not throw) when neither .write() nor .input() exists", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bareHandle = { __kind: "interactive" };
    (mockPod as any).createCustomTerminal = vi.fn().mockResolvedValue(bareHandle);

    const bridge = await browserPodManager.createInteractiveTerminal({
      cols: 80,
      rows: 24,
      onOutput: () => {},
    });

    bridge.write("hello");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Terminal handle has no .write()"));
  });

  it("disposeInteractiveTerminal clears the interactive handle reference", async () => {
    await browserPodManager.createInteractiveTerminal({
      cols: 80,
      rows: 24,
      onOutput: () => {},
    });

    expect((browserPodManager as any).interactiveTerminal).toBe(interactiveHandle);
    await browserPodManager.disposeInteractiveTerminal();
    expect((browserPodManager as any).interactiveTerminal).toBeNull();
  });

  it("writes the custom .bashrc only once across repeated createInteractiveTerminal() calls", async () => {
    const createFileSpy = vi.spyOn(mockPod, "createFile");

    await browserPodManager.createInteractiveTerminal({
      cols: 80,
      rows: 24,
      onOutput: () => {},
    });
    await browserPodManager.createInteractiveTerminal({
      cols: 80,
      rows: 24,
      onOutput: () => {},
    });

    const bashrcWrites = createFileSpy.mock.calls.filter(
      ([path]: [string, ...unknown[]]) => path === "/home/user/.bashrc"
    );
    expect(bashrcWrites).toHaveLength(1);
  });

  it("throws exactly 'connection lost' when the headless _healthCheck rejects", async () => {
    // The headless /bin/true call is the first one run() sees.
    runSpy.mockRejectedValueOnce(new Error("WebSocket CLOSED"));

    await expect(
      browserPodManager.createInteractiveTerminal({
        cols: 80,
        rows: 24,
        onOutput: () => {},
      })
    ).rejects.toThrow(/^BrowserPod connection lost/);
  });

  it("throws when createCustomTerminal returns no terminal handle (undefined)", async () => {
    (mockPod as any).createCustomTerminal = vi.fn().mockResolvedValue(undefined);

    await expect(
      browserPodManager.createInteractiveTerminal({
        cols: 80,
        rows: 24,
        onOutput: () => {},
      })
    ).rejects.toThrow(/createCustomTerminal returned no terminal handle/);
  });

  it("resets _bashrcWritten to false when dispose() runs (so reset BP re-writes .bashrc cleanly)", async () => {
    await browserPodManager.createInteractiveTerminal({
      cols: 80,
      rows: 24,
      onOutput: () => {},
    });
    expect((browserPodManager as any)._bashrcWritten).toBe(true);

    await browserPodManager.dispose();
    expect((browserPodManager as any)._bashrcWritten).toBe(false);
  });

  it("writes .bashrc BEFORE invoking /bin/bash (ordering guard)", async () => {
    const createFileSpy = vi.spyOn(mockPod, "createFile");

    await browserPodManager.createInteractiveTerminal({
      cols: 80,
      rows: 24,
      onOutput: () => {},
    });

    const bashrcWriteIdx = createFileSpy.mock.calls.findIndex(
      ([path]: [string, ...unknown[]]) => path === "/home/user/.bashrc"
    );
    const bashRunIdx = runSpy.mock.calls.findIndex(
      ([cmd]: [string]) => cmd === "/bin/bash"
    );

    expect(bashrcWriteIdx).toBeGreaterThanOrEqual(0);
    expect(bashRunIdx).toBeGreaterThanOrEqual(0);
    expect(bashrcWriteIdx).toBeLessThan(bashRunIdx);
  });
});
