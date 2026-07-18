/**
 * BrowserPod Reactive Lifecycle — PR-1 unit tests.
 *
 * Verifies that store.ts subscribers correctly drive browserPodManager.boot
 * and browserPodManager.dispose in response to settings changes (toolNodeEnabled,
 * browserPodApiKey) at runtime. Uses __setTestPod(MockPodFs) to inspect manager
 * state transitions through spies without touching the real BrowserPod CDN.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MockPodFs } from "../../src/test-helpers/mock-pod-fs.js";
import { ideStore } from "../../src/store.js";
import { browserPodManager } from "../../src/browserpod/manager.js";

// Mock vfs-persist (store.ts + sync-utils.ts both touch it)
vi.mock("../../src/vfs-persist.js", () => ({
  scheduleVfsPersist: vi.fn(),
  flushVfsPersist: vi.fn(),
  markDirty: vi.fn(),
  markDeleted: vi.fn(),
  markRenamed: vi.fn(),
  initHashes: vi.fn(),
  getDebounceMs: vi.fn().mockReturnValue(2000),
  setDebounceMs: vi.fn(),
}));

// Stub the VFS→Pod sync so we can assert it was called without needing
// real VFS data. The dynamic import in store.ts will hit this stub via
// vi.mock path resolution.
vi.mock("../../src/tools/sync-utils.js", () => ({
  syncVfsToPod: vi.fn().mockResolvedValue(undefined),
  writeToVfs: vi.fn(),
}));

async function flush(): Promise<void> {
  // Two microtask ticks — store.ts subscriber uses dynamic import which
  // resolves on the first tick, then runs the boot/dispose chain on the
  // second tick.
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

describe("BrowserPod reactive lifecycle (PR-1)", () => {
  let mockPod: MockPodFs;
  let bootSpy: ReturnType<typeof vi.spyOn>;
  let disposeSpy: ReturnType<typeof vi.spyOn>;
  let subscribeSpy: ReturnType<typeof vi.spyOn>;
  let syncVfsToPodMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockPod = new MockPodFs();
    browserPodManager.__setTestPod(mockPod);
    // __setTestPod sets status=ready + pod=mockPod + config={apiKey:"test"}.
    // Dispose() cleans it back to idle, matching what `loadSettings() → no
    // active state ends look like after the initial path completes.
    browserPodManager.dispose();

    // Real-style boot mock: updates internal config + status to mimic a successful
    // boot. Subscriber reads browserPodManager.getStatus() and getConfig() to drive
    // identity/state checks; without this, the sameKey and loading branches aren't
    // exercised correctly in subsequent tests.
    bootSpy = vi.spyOn(browserPodManager, "boot").mockImplementation(async (config: any) => {
      (browserPodManager as any).config = config;
      (browserPodManager as any).status = "ready";
      return true;
    });
    disposeSpy = vi.spyOn(browserPodManager, "dispose").mockResolvedValue(undefined);
    subscribeSpy = vi
      .spyOn(browserPodManager, "subscribeToVfsChanges")
      .mockReturnValue(() => {});

    const syncModule = await import("../../src/tools/sync-utils.js");
    syncVfsToPodMock = vi.mocked(syncModule.syncVfsToPod);
    syncVfsToPodMock.mockClear();
    syncVfsToPodMock.mockResolvedValue(undefined);

    // Reset settings to a known pristine state, then "arm" the reactive
    // subscriber: any settings change fires the subscriber once, but the
    // first fire (after module load) is a no-op due to the `primed` flag.
    // Without arming here, tests would observe the subscriber treating
    // their own updateSettings as the initial priming fire.
    ideStore.setState((s) => ({
      ...s,
      settings: {
        ...s.settings,
        toolNodeEnabled: false,
        browserPodApiKey: "",
        locale: "en-arming",
      },
      browserPodStatus: "idle",
    }));
    await flush();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockPod.dispose();
  });

  it("does NOT boot when toggle is ON but no key is set", async () => {
    ideStore.getState().updateSettings({ toolNodeEnabled: true });
    await flush();

    expect(bootSpy).not.toHaveBeenCalled();
    expect(subscribeSpy).not.toHaveBeenCalled();
    expect(syncVfsToPodMock).not.toHaveBeenCalled();
  });

  it("boots + subscribes + bulk-syncs when toggling ON WITH a key", async () => {
    ideStore.getState().updateSettings({
      toolNodeEnabled: true,
      browserPodApiKey: "bp_test_a",
    });
    await flush();

    expect(bootSpy).toHaveBeenCalledTimes(1);
    const bootArg = bootSpy.mock.calls[0]?.[0];
    expect(bootArg).toBeDefined();
    expect(bootArg.apiKey).toBe("bp_test_a");
    expect(bootArg.nodeVersion).toBe("22");

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(syncVfsToPodMock).toHaveBeenCalledTimes(1);
    expect(ideStore.getState().browserPodStatus).toBe("ready");
  });

  it("disposes when toggling OFF (after previously being ON+key)", async () => {
    // Activate first.
    ideStore.getState().updateSettings({
      toolNodeEnabled: true,
      browserPodApiKey: "bp_test_b",
    });
    await flush();
    expect(bootSpy).toHaveBeenCalledTimes(1);

    disposeSpy.mockClear();

    // Now disable.
    ideStore.getState().updateSettings({ toolNodeEnabled: false });
    await flush();

    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(ideStore.getState().browserPodStatus).toBe("idle");
  });

  it("re-boots with the NEW key when only the key changes (toggle stays ON)", async () => {
    ideStore.getState().updateSettings({
      toolNodeEnabled: true,
      browserPodApiKey: "bp_first",
    });
    await flush();
    expect(bootSpy).toHaveBeenCalledTimes(1);

    bootSpy.mockClear();
    subscribeSpy.mockClear();
    syncVfsToPodMock.mockClear();

    ideStore.getState().updateSettings({ browserPodApiKey: "bp_second" });
    await flush();

    expect(bootSpy).toHaveBeenCalledTimes(1);
    expect(bootSpy.mock.calls[0]?.[0].apiKey).toBe("bp_second");
    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(syncVfsToPodMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT re-trigger when identical settings are applied twice", async () => {
    ideStore.getState().updateSettings({
      toolNodeEnabled: true,
      browserPodApiKey: "bp_same",
    });
    await flush();
    const initial = bootSpy.mock.calls.length;

    // Same values, new updateSettings call (zustand still fires subscribe
    // because settings object identity changes via spread).
    ideStore.getState().updateSettings({
      toolNodeEnabled: true,
      browserPodApiKey: "bp_same",
    });
    await flush();

    expect(bootSpy.mock.calls.length).toBe(initial);
  });

  it("disposes when the key is cleared even if toggle stays ON", async () => {
    ideStore.getState().updateSettings({
      toolNodeEnabled: true,
      browserPodApiKey: "bp_temp",
    });
    await flush();
    expect(bootSpy).toHaveBeenCalledTimes(1);

    disposeSpy.mockClear();

    ideStore.getState().updateSettings({ browserPodApiKey: "" });
    await flush();

    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(ideStore.getState().browserPodStatus).toBe("idle");
  });

  it("skips activation when boot is in-flight (status === loading)", async () => {
    // Override the default boot mock to simulate real boot's lifecycle:
    // idle → loading → (await) → ready. The subscriber reads manager.status
    // directly; without setting it on the manager object, the loading-guard
    // branch in the subscriber is never exercised.
    bootSpy.mockRestore();
    bootSpy = vi.spyOn(browserPodManager, "boot").mockImplementation(async (config: any) => {
      (browserPodManager as any).config = config;
      (browserPodManager as any).status = "loading";
      await new Promise((r) => setTimeout(r, 50));
      (browserPodManager as any).status = "ready";
      return true;
    });

    ideStore.getState().updateSettings({
      toolNodeEnabled: true,
      browserPodApiKey: "bp_race",
    });
    // Wait until boot has started; while we wait, manager.status === "loading".
    await new Promise((r) => setTimeout(r, 25));
    expect(bootSpy.mock.calls.length).toBe(1);

    // Fire a SECOND change while the first boot is still in-flight.
    // Subscriber should see manager.status === "loading" and skip the second boot.
    const bootCallsBefore = bootSpy.mock.calls.length;
    ideStore.getState().updateSettings({ browserPodApiKey: "bp_race_2" });
    await flush();

    expect(bootSpy.mock.calls.length).toBe(bootCallsBefore);

    // Settle the in-flight boot (no further subscriber assertions — we just need
    // to ensure no unhandled promise rejection).
    await new Promise((r) => setTimeout(r, 75));
  });
});
