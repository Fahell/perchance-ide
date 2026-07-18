/**
 * UI tests for SettingsModal — KeyRow visibility + onTest success/failure paths.
 *
 * PR-2 audit fix: KeyRow input fields must always be visible, not gated behind
 * their corresponding tool toggle. The previous UX required the user to enable
 * "Web search" or "Node.js tools" first before the API key field would appear,
 * forcing an awkward two-step setup.
 *
 * Setup pattern: vi.hoisted to define mock factories, vi.mock to swap modules,
 * then preact render() directly into a jsdom container. No testing-library
 * dependency required.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "preact";

// ─── Hoisted mock factories (referenced inside vi.mock which is hoisted) ───
//
// SettingsModal has TWO keystroke handlers:
//   - Jina:    onValueChange={(v) => setJinaKey(v)}                       — local state only
//   - BrowserPod: onValueChange={(v) => { setBpKey(v); updateSetting(...) } } — local + store
//
// For BrowserPod tests we initialize the key via mockSettings.browserPodApiKey
// (instead of dispatching input events) to bypass the keystroke-driven
// updateSetting call, so test assertions about post-click persist behavior
// are isolated to the test-validation path. For Jina tests we DO dispatch
// input events because Jina has no keystroke side effect.

const {
  mockSettings,
  mockUpdateSettings,
  mockSubscribe,
  mockValidateApiKey,
  mockValidateBrowserPodKey,
  mockIsCrossOriginIsolated,
} = vi.hoisted(() => {
  const defaultSettings = {
    locale: "en",
    fontSize: 14,
    wordWrap: true,
    tabSize: 2,
    autoSave: true,
    toolWebEnabled: false,
    toolContextEnabled: true,
    toolVfsEnabled: true,
    toolTerminalEnabled: true,
    toolNodeEnabled: false,
    browserPodApiKey: "",
  };
  return {
    mockSettings: defaultSettings,
    mockUpdateSettings: vi.fn(),
    mockSubscribe: vi.fn(() => () => undefined),
    mockValidateApiKey: vi.fn(),
    mockValidateBrowserPodKey: vi.fn(),
    mockIsCrossOriginIsolated: vi.fn(() => true),
  };
});

vi.mock("../store.js", () => ({
  ideStore: {
    getState: () => ({ settings: mockSettings, updateSettings: mockUpdateSettings }),
    subscribe: mockSubscribe,
  },
}));

vi.mock("../tools/web-search.js", () => ({
  validateApiKey: mockValidateApiKey,
}));

vi.mock("../browserpod/manager.js", () => ({
  validateBrowserPodKey: mockValidateBrowserPodKey,
  isCrossOriginIsolated: mockIsCrossOriginIsolated,
}));

// Minimal i18n proxy — return key as-is so we can assert on labels
vi.mock("../i18n/index.js", () => ({
  LOCALES: ["en"],
  LOCALE_LABELS: { en: "EN" },
  t: (k: string) => k,
}));

import { SettingsModal } from "./SettingsModal.js";

// ─── Helpers ────────────────────────────────────────────────

function renderModal(initialKey = "") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const onClose = vi.fn();
  const onSave = vi.fn();
  const onLocaleChange = vi.fn();
  render(
    <SettingsModal
      isOpen
      currentKey={initialKey}
      locale="en"
      onClose={onClose}
      onSave={onSave}
      onLocaleChange={onLocaleChange}
    />,
    container,
  );
  return { container, onClose, onSave, onLocaleChange };
}

function findRowByLabel(container: HTMLElement, labelText: string): HTMLElement | null {
  // The KeyRow renders an uppercased label with the i18n key as text.
  // Walk up to the KeyRow container that wraps the input + button.
  const labels = container.querySelectorAll("label");
  for (const lbl of Array.from(labels)) {
    if (lbl.textContent === labelText) {
      return lbl.parentElement;
    }
  }
  return null;
}

async function flushPromises(): Promise<void> {
  // Preact in jsdom uses `requestAnimationFrame` (rAF, ~16.6ms) for its
  // deferred re-render queue — not microtasks. A loop of setTimeout(0) drains
  // microtasks faster than rAF can fire, leaving the DOM/closure stale with
  // the previous render's `value`. A single 50ms wait reliably outpaces rAF
  // and gives Preact room to commit the new render before assertions run.
  await new Promise((r) => setTimeout(r, 50));
}

async function typeInto(input: HTMLInputElement, value: string): Promise<void> {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  // Wait for Preact to re-render with the new value before any subsequent
  // click handler runs (handles closed-over useState reads).
  await flushPromises();
}

// ─── Test lifecycle ─────────────────────────────────────────

beforeEach(() => {
  mockSettings.toolWebEnabled = false;
  mockSettings.toolNodeEnabled = false;
  mockSettings.browserPodApiKey = "";
  mockUpdateSettings.mockReset();
  mockSubscribe.mockClear();
  mockValidateApiKey.mockReset();
  mockValidateBrowserPodKey.mockReset();
  mockIsCrossOriginIsolated.mockReturnValue(true);
});

afterEach(() => {
  document.body.innerHTML = "";
});

// ─── Gate removal regression (PR-2 primary change) ──────────

describe("PR-2: KeyRow visibility (always visible regardless of toggle)", () => {
  it("shows Jina KeyRow even when toolWebEnabled = false", () => {
    mockSettings.toolWebEnabled = false;
    const { container } = renderModal();
    const row = findRowByLabel(container, "settings.apiKey");
    expect(row).not.toBeNull();
    const input = row?.querySelector("input[type='password']") as HTMLInputElement | null;
    expect(input).not.toBeNull();
  });

  it("shows BrowserPod KeyRow even when toolNodeEnabled = false", () => {
    mockSettings.toolNodeEnabled = false;
    const { container } = renderModal();
    const row = findRowByLabel(container, "settings.browserPodApiKey");
    expect(row).not.toBeNull();
    const input = row?.querySelector("input[type='password']") as HTMLInputElement | null;
    expect(input).not.toBeNull();
  });

  it("shows both KeyRows when both toggles are OFF", () => {
    mockSettings.toolWebEnabled = false;
    mockSettings.toolNodeEnabled = false;
    const { container } = renderModal();
    expect(findRowByLabel(container, "settings.apiKey")).not.toBeNull();
    expect(findRowByLabel(container, "settings.browserPodApiKey")).not.toBeNull();
  });

  it("shows both KeyRows when both toggles are ON", () => {
    mockSettings.toolWebEnabled = true;
    mockSettings.toolNodeEnabled = true;
    const { container } = renderModal();
    expect(findRowByLabel(container, "settings.apiKey")).not.toBeNull();
    expect(findRowByLabel(container, "settings.browserPodApiKey")).not.toBeNull();
  });
});

// ─── Jina test-connection flow ──────────────────────────────

describe("SettingsModal — Jina (web search) test flow", () => {
  it("calls validateApiKey on test click and persists via onSave on success", async () => {
    mockValidateApiKey.mockResolvedValue({ ok: true });
    const { container, onSave } = renderModal();
    const row = findRowByLabel(container, "settings.apiKey")!;
    const input = row.querySelector("input[type='password']") as HTMLInputElement;
    const button = row.querySelector("button") as HTMLButtonElement;

    await typeInto(input, "jina_test_key_abcdef");
    button.click();
    await flushPromises();

    expect(mockValidateApiKey).toHaveBeenCalledWith("jina_test_key_abcdef");
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("jina_test_key_abcdef");
  });

  it("does NOT call onSave when validateApiKey returns false", async () => {
    mockValidateApiKey.mockResolvedValue({ ok: false, code: "invalid_key", message: "HTTP 401 Unauthorized" });
    const { container, onSave } = renderModal();
    const row = findRowByLabel(container, "settings.apiKey")!;
    const input = row.querySelector("input[type='password']") as HTMLInputElement;
    const button = row.querySelector("button") as HTMLButtonElement;

    await typeInto(input, "bad_key");
    button.click();
    await flushPromises();

    expect(mockValidateApiKey).toHaveBeenCalledWith("bad_key");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows generic error label when validateApiKey fails", async () => {
    mockValidateApiKey.mockResolvedValue({ ok: false, code: "invalid_key", message: "HTTP 401 Unauthorized" });
    const { container } = renderModal();
    const row = findRowByLabel(container, "settings.apiKey")!;
    const input = row.querySelector("input[type='password']") as HTMLInputElement;
    const button = row.querySelector("button") as HTMLButtonElement;

    await typeInto(input, "bad_key");
    button.click();
    await flushPromises();

    // Invalid-key code maps to settings.validate.invalidKey via i18n proxy
    const rowText = row.textContent || "";
    expect(rowText).toContain("settings.validate.invalidKey");
  });
});

// ─── PR-3 — Jina error code rendering ──────────────────────

describe("SettingsModal — PR-3 Jina error code rendering", () => {
  it("renders settings.validate.invalidKey when code is 'invalid_key'", async () => {
    mockValidateApiKey.mockResolvedValue({
      ok: false,
      code: "invalid_key",
      message: "HTTP 401 Unauthorized",
    });
    const { container } = renderModal();
    const row = findRowByLabel(container, "settings.apiKey")!;
    const input = row.querySelector("input[type='password']") as HTMLInputElement;
    const button = row.querySelector("button") as HTMLButtonElement;

    await typeInto(input, "bad_key");
    button.click();
    await flushPromises();

    const rowText = row.textContent || "";
    expect(rowText).toContain("settings.validate.invalidKey");
    expect(rowText).not.toContain("settings.validate.error"); // generic fallback gone
  });

  it("renders settings.validate.noCredit when code is 'no_credit'", async () => {
    mockValidateApiKey.mockResolvedValue({
      ok: false,
      code: "no_credit",
      message: "HTTP 402 Payment Required",
    });
    const { container } = renderModal();
    const row = findRowByLabel(container, "settings.apiKey")!;
    const input = row.querySelector("input[type='password']") as HTMLInputElement;
    const button = row.querySelector("button") as HTMLButtonElement;

    await typeInto(input, "exhausted_key");
    button.click();
    await flushPromises();

    const rowText = row.textContent || "";
    expect(rowText).toContain("settings.validate.noCredit");
  });

  it("renders settings.validate.rateLimited when code is 'rate_limited'", async () => {
    mockValidateApiKey.mockResolvedValue({
      ok: false,
      code: "rate_limited",
      message: "HTTP 429 Too Many Requests",
    });
    const { container } = renderModal();
    const row = findRowByLabel(container, "settings.apiKey")!;
    const input = row.querySelector("input[type='password']") as HTMLInputElement;
    const button = row.querySelector("button") as HTMLButtonElement;

    await typeInto(input, "rate_limited_key");
    button.click();
    await flushPromises();

    const rowText = row.textContent || "";
    expect(rowText).toContain("settings.validate.rateLimited");
  });

  it("renders settings.validate.network when code is 'network'", async () => {
    mockValidateApiKey.mockResolvedValue({
      ok: false,
      code: "network",
      message: "Failed to fetch",
    });
    const { container } = renderModal();
    const row = findRowByLabel(container, "settings.apiKey")!;
    const input = row.querySelector("input[type='password']") as HTMLInputElement;
    const button = row.querySelector("button") as HTMLButtonElement;

    await typeInto(input, "any_key");
    button.click();
    await flushPromises();

    const rowText = row.textContent || "";
    expect(rowText).toContain("settings.validate.network");
  });
});

// ─── BrowserPod test-connection flow ────────────────────────
//
// The BrowserPod input's onValueChange ALREADY auto-persists via
// updateSetting("browserPodApiKey", v) on every keystroke. To isolate the
// "test-validation persistence" semantics from the "keystroke persistence" we
// initialize the key via mockSettings and trigger clicks only — no input events.

describe("SettingsModal — BrowserPod (Node tools) test flow", () => {
  const BP_TEST_KEY = "bp_test_key_abcdef1234";

  it("calls validateBrowserPodKey on test click and persists via updateSetting on success", async () => {
    mockSettings.browserPodApiKey = BP_TEST_KEY;
    mockValidateBrowserPodKey.mockResolvedValue({ ok: true });
    const { container } = renderModal();
    const row = findRowByLabel(container, "settings.browserPodApiKey")!;
    const button = row.querySelector("button") as HTMLButtonElement;

    button.click();
    await flushPromises();

    expect(mockValidateBrowserPodKey).toHaveBeenCalledWith(BP_TEST_KEY);
    // Exactly one updateSetting call — driven solely by the test-success path,
    // not by keystroke events (we did not dispatch input events).
    expect(mockUpdateSettings).toHaveBeenCalledTimes(1);
    expect(mockUpdateSettings).toHaveBeenCalledWith({ browserPodApiKey: BP_TEST_KEY });
  });

  it("does NOT call updateSetting when validateBrowserPodKey returns ok: false", async () => {
    mockSettings.browserPodApiKey = BP_TEST_KEY;
    mockValidateBrowserPodKey.mockResolvedValue({ ok: false, error: "Bad key" });
    const { container } = renderModal();
    const row = findRowByLabel(container, "settings.browserPodApiKey")!;
    const button = row.querySelector("button") as HTMLButtonElement;

    button.click();
    await flushPromises();

    expect(mockValidateBrowserPodKey).toHaveBeenCalledWith(BP_TEST_KEY);
    // Zero calls: no keystroke events + no success path
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  it("shows the validation error string when validateBrowserPodKey returns ok: false", async () => {
    mockSettings.browserPodApiKey = BP_TEST_KEY;
    mockValidateBrowserPodKey.mockResolvedValue({
      ok: false,
      error: "BrowserPod boot failed: 401 Unauthorized",
    });
    const { container } = renderModal();
    const row = findRowByLabel(container, "settings.browserPodApiKey")!;
    const button = row.querySelector("button") as HTMLButtonElement;

    button.click();
    await flushPromises();

    const rowText = row.textContent || "";
    expect(rowText).toContain("BrowserPod boot failed: 401 Unauthorized");
  });

  it("shows cross-origin isolation error WITHOUT calling validateBrowserPodKey", async () => {
    mockIsCrossOriginIsolated.mockReturnValue(false);
    mockSettings.browserPodApiKey = BP_TEST_KEY;
    const { container } = renderModal();
    const row = findRowByLabel(container, "settings.browserPodApiKey")!;
    const button = row.querySelector("button") as HTMLButtonElement;

    button.click();
    await flushPromises();

    expect(mockIsCrossOriginIsolated).toHaveBeenCalled();
    expect(mockValidateBrowserPodKey).not.toHaveBeenCalled();
    const rowText = row.textContent || "";
    expect(rowText).toContain("cross-origin isolated");
  });
});

// ─── Store subscription sanity ──────────────────────────────

describe("SettingsModal — store subscription", () => {
  it("subscribes to store changes when modal is open", async () => {
    renderModal();
    // useEffect is deferred; flushPreact's render queue before asserting.
    await flushPromises();
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it("propagates settings.browserPodApiKey changes from store into masked preview", async () => {
    mockSettings.browserPodApiKey = "initial_key_xyz";
    const { container } = renderModal();
    await flushPromises();
    const row = findRowByLabel(container, "settings.browserPodApiKey")!;
    expect(row).not.toBeNull();

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    // Cast through any[] because vi.fn() without an explicit generic infers
    // mock.calls as a length-0 tuple, indexing into which fails typecheck.
    const firstCallArgs = mockSubscribe.mock.calls[0] as unknown as Array<(s: { settings: typeof mockSettings }) => void> | undefined;
    expect(firstCallArgs).toBeDefined();
    const subscriberCb = firstCallArgs![0];

    // Simulate external settings update (e.g., from PR-1 reactive lifecycle persist)
    subscriberCb({
      settings: {
        ...mockSettings,
        browserPodApiKey: "updated_key_abcdef",
      },
    });

    // Subscriber-driven setBpKey schedules a Preact rerender via rAF (~16ms).
    // Without this drain, row.textContent would still reflect the original
    // "initial_key_xyz" mask ("initia..._xyz") instead of the new mask.
    await flushPromises();

    // Mask: bpKey.slice(0, 6) + "..." + bpKey.slice(-4) = "update" + "..." + "cdef"
    // Assert the masked prefix chunk "update" and suffix chunk "cdef" — NOT
    // the full unmasked key, which never appears in the DOM.
    const rowText = row.textContent || "";
    expect(rowText).toContain("update");
    expect(rowText).toContain("cdef");
  });
});
