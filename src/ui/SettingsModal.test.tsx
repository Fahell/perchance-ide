/**
 * UI tests for SettingsModal — KeyRow visibility + onTest success/failure paths.
 *
 * History:
 * - PR-2: KeyRow always visible regardless of tool toggle state.
 * - PR-3: Jina HTTP error code classification surfaces in SettingsModal copy.
 * - Preact act() audit: empirical fixes (microtask loops, 50ms rAF wait, native
 *   `act()` from preact/test-utils) all left 8 of the 17 tests failing with
 *   the same root cause — Preact's render queue closing over the stale
 *   `value=""` from the initial render before state updates committed.
 *
 *   Root cause was diagnosed as a CJS/ESM Preact dual-package hazard under
 *   Vitest v4 + jsdom: the components import the ESM Preact hooks, but the
 *   manual flushPromises and preact/test-utils `act()` only patched the
 *   CommonJS Preact instance, leaving async rerenders queued on the ESM
 *   instance and never drained before assertions.
 *
 * - This file rewrites all 18 tests on top of @testing-library/preact +
 *   @testing-library/user-event + @testing-library/jest-dom. Together these
 *   resolve the ESM Preact instance, drain Preact's scheduler between
 *   `user.type` and `user.click`, and register `toBeInTheDocument` /
 *   `toHaveTextContent` matchers (registered globally via
 *   `vitest.setup.ts: import "@testing-library/jest-dom/vitest"`).
 *
 *   Manual `flushPromises`, `typeInto`, `clickAct`, `findRowByLabel` helpers
 *   are no longer needed and have been removed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";

// ─── Hoisted mock factories (referenced inside vi.mock which is hoisted) ───
//
// SettingsModal has TWO keystroke handlers:
//   - Jina:    onValueChange={(v) => setJinaKey(v)}                       — local state only
//   - BrowserPod: onValueChange={(v) => { setBpKey(v); updateSetting(...) } } — local + store
//
// For BrowserPod tests we initialize the key via mockSettings.browserPodApiKey
// (instead of dispatching input events) to bypass the keystroke-driven
// updateSetting call, so test assertions are isolated to the test path.
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

// Minimal i18n proxy — return key as-is so we can assert on labels.
// Exception: settings.apiKey.current must contain a "{key}" placeholder so that
// the .replace("{key}", maskedPreview) call in SettingsModal.tsx (line ~127)
// actually substitutes the masked value. Without this the masked-preview div
// renders the literal key string and the reactive-sync test cannot observe
// the change.
vi.mock("../i18n/index.js", () => ({
  LOCALES: ["en"],
  LOCALE_LABELS: { en: "EN" },
  t: (k: string) =>
    k === "settings.apiKey.current" ? "current: {key}" : k,
}));

import { SettingsModal } from "./SettingsModal.js";

// ─── Helpers ────────────────────────────────────────────────

const JINA_LABEL = "settings.apiKey";
const BP_LABEL = "settings.browserPodApiKey";

function renderModal(initialKey = "") {
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
  );
  return { onClose, onSave, onLocaleChange };
}

/**
 * Locate the test button inside a KeyRow given its input aria-label.
 * KeyRow structure: outer container > [label, flex row > input+button].
 * To stay robust to nested DOM changes, walk up from the input until we
 * find a sibling button.
 */
function getKeyRowButton(labelText: string): HTMLButtonElement {
  const input = screen.getByLabelText(labelText) as HTMLInputElement;
  // The flex row containing input+button is a direct parent.
  return input.parentElement!.querySelector("button") as HTMLButtonElement;
}

/** Get the outer KeyRow container (the one with the masked preview). */
function getKeyRowContainer(labelText: string): HTMLElement {
  const input = screen.getByLabelText(labelText) as HTMLInputElement;
  // input.parentElement === flex row, .parentElement === outer KeyRow container
  return input.parentElement!.parentElement as HTMLElement;
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
  cleanup();
});

// ─── Gate removal regression (PR-2 primary change) ──────────

describe("PR-2: KeyRow visibility (always visible regardless of toggle)", () => {
  it("shows Jina KeyRow even when toolWebEnabled = false", () => {
    mockSettings.toolWebEnabled = false;
    renderModal();
    expect(screen.getByLabelText(JINA_LABEL)).toBeInTheDocument();
  });

  it("shows BrowserPod KeyRow even when toolNodeEnabled = false", () => {
    mockSettings.toolNodeEnabled = false;
    renderModal();
    expect(screen.getByLabelText(BP_LABEL)).toBeInTheDocument();
  });

  it("shows both KeyRows when both toggles are OFF", () => {
    mockSettings.toolWebEnabled = false;
    mockSettings.toolNodeEnabled = false;
    renderModal();
    expect(screen.getByLabelText(JINA_LABEL)).toBeInTheDocument();
    expect(screen.getByLabelText(BP_LABEL)).toBeInTheDocument();
  });

  it("shows both KeyRows when both toggles are ON", () => {
    mockSettings.toolWebEnabled = true;
    mockSettings.toolNodeEnabled = true;
    renderModal();
    expect(screen.getByLabelText(JINA_LABEL)).toBeInTheDocument();
    expect(screen.getByLabelText(BP_LABEL)).toBeInTheDocument();
  });
});

// ─── Jina test-connection flow ──────────────────────────────

describe("SettingsModal — Jina (web search) test flow", () => {
  it("calls validateApiKey on test click and persists via onSave on success", async () => {
    const user = userEvent.setup();
    mockValidateApiKey.mockResolvedValue({ ok: true });
    const { onSave } = renderModal();
    const input = screen.getByLabelText(JINA_LABEL);
    const button = getKeyRowButton(JINA_LABEL);

    // userEvent.type fires input events one char at a time AND drains Preact's
    // render queue between them. The final input state is committed before
    // user.click() runs, so the button's onClick closure captures value=, not "".
    await user.type(input, "jina_test_key_abcdef");
    await user.click(button);

    expect(mockValidateApiKey).toHaveBeenCalledTimes(1);
    expect(mockValidateApiKey).toHaveBeenCalledWith("jina_test_key_abcdef");
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("jina_test_key_abcdef");
  });

  it("does NOT call onSave when validateApiKey returns false", async () => {
    const user = userEvent.setup();
    mockValidateApiKey.mockResolvedValue({
      ok: false,
      code: "invalid_key",
      message: "HTTP 401 Unauthorized",
    });
    const { onSave } = renderModal();
    const input = screen.getByLabelText(JINA_LABEL);
    const button = getKeyRowButton(JINA_LABEL);

    await user.type(input, "bad_key");
    await user.click(button);

    await waitFor(() => {
      // Asserting on the mock gives Preact's async rerender time to commit
      // the error state into the DOM.
      expect(mockValidateApiKey).toHaveBeenCalledWith("bad_key");
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows settings.validate.invalidKey label when validateApiKey fails", async () => {
    const user = userEvent.setup();
    mockValidateApiKey.mockResolvedValue({
      ok: false,
      code: "invalid_key",
      message: "HTTP 401 Unauthorized",
    });
    renderModal();
    const input = screen.getByLabelText(JINA_LABEL);
    const button = getKeyRowButton(JINA_LABEL);

    await user.type(input, "bad_key");
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText("settings.validate.invalidKey")).toBeInTheDocument();
    });
  });
});

// ─── PR-3 — Jina error code rendering ──────────────────────

describe("SettingsModal — PR-3 Jina error code rendering", () => {
  const cases: Array<[string, string, string]> = [
    ["invalid_key", "settings.validate.invalidKey", "bad_key"],
    ["no_credit", "settings.validate.noCredit", "exhausted_key"],
    ["rate_limited", "settings.validate.rateLimited", "rate_limited_key"],
    ["network", "settings.validate.network", "any_key"],
  ];

  for (const [code, expectedLabel, typeValue] of cases) {
    it(`renders ${expectedLabel} when code is '${code}'`, async () => {
      const user = userEvent.setup();
      mockValidateApiKey.mockResolvedValue({
        ok: false,
        code,
        message: "synthetic error message",
      });
      renderModal();
      const input = screen.getByLabelText(JINA_LABEL);
      const button = getKeyRowButton(JINA_LABEL);

      await user.type(input, typeValue);
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(expectedLabel)).toBeInTheDocument();
      });
    });
  }

  it("does NOT show the generic settings.validate.error label when code-specific key is present", async () => {
    const user = userEvent.setup();
    mockValidateApiKey.mockResolvedValue({
      ok: false,
      code: "invalid_key",
      message: "HTTP 401 Unauthorized",
    });
    renderModal();
    const input = screen.getByLabelText(JINA_LABEL);
    const button = getKeyRowButton(JINA_LABEL);

    await user.type(input, "bad_key");
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText("settings.validate.invalidKey")).toBeInTheDocument();
    });
    // The generic settings.validate.error should NOT also appear
    expect(screen.queryByText("settings.validate.error")).toBeNull();
  });
});

// ─── BrowserPod test-connection flow ────────────────────────

describe("SettingsModal — BrowserPod (Node tools) test flow", () => {
  const BP_TEST_KEY = "bp_test_key_abcdef1234";

  it("calls validateBrowserPodKey on test click and persists via updateSetting on success", async () => {
    const user = userEvent.setup();
    mockSettings.browserPodApiKey = BP_TEST_KEY;
    mockValidateBrowserPodKey.mockResolvedValue({ ok: true });
    renderModal();
    const button = getKeyRowButton(BP_LABEL);

    await user.click(button);

    expect(mockValidateBrowserPodKey).toHaveBeenCalledTimes(1);
    expect(mockValidateBrowserPodKey).toHaveBeenCalledWith(BP_TEST_KEY);
    expect(mockUpdateSettings).toHaveBeenCalledTimes(1);
    expect(mockUpdateSettings).toHaveBeenCalledWith({ browserPodApiKey: BP_TEST_KEY });
  });

  it("does NOT call updateSetting when validateBrowserPodKey returns ok: false", async () => {
    const user = userEvent.setup();
    mockSettings.browserPodApiKey = BP_TEST_KEY;
    mockValidateBrowserPodKey.mockResolvedValue({ ok: false, error: "Bad key" });
    renderModal();
    const button = getKeyRowButton(BP_LABEL);

    await user.click(button);

    await waitFor(() => {
      expect(mockValidateBrowserPodKey).toHaveBeenCalledWith(BP_TEST_KEY);
    });
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  it("shows the validation error string when validateBrowserPodKey returns ok: false", async () => {
    const user = userEvent.setup();
    mockSettings.browserPodApiKey = BP_TEST_KEY;
    mockValidateBrowserPodKey.mockResolvedValue({
      ok: false,
      error: "BrowserPod boot failed: 401 Unauthorized",
    });
    renderModal();
    const button = getKeyRowButton(BP_LABEL);

    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText(/BrowserPod boot failed: 401 Unauthorized/)).toBeInTheDocument();
    });
  });

  it("shows cross-origin isolation error WITHOUT calling validateBrowserPodKey", async () => {
    const user = userEvent.setup();
    mockIsCrossOriginIsolated.mockReturnValue(false);
    mockSettings.browserPodApiKey = BP_TEST_KEY;
    renderModal();
    const button = getKeyRowButton(BP_LABEL);

    await user.click(button);

    await waitFor(() => {
      expect(mockIsCrossOriginIsolated).toHaveBeenCalled();
      expect(mockValidateBrowserPodKey).not.toHaveBeenCalled();
    });
    expect(screen.getByText(/cross-origin isolated/i)).toBeInTheDocument();
  });
});

// ─── Store subscription sanity ──────────────────────────────

describe("SettingsModal — store subscription", () => {
  it("subscribes to store changes when modal is open", async () => {
    renderModal();
    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalled();
    });
  });

  it("propagates settings.browserPodApiKey changes from store into masked preview", async () => {
    mockSettings.browserPodApiKey = "initial_key_xyz";
    renderModal();
    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalledTimes(1);
    });

    const firstCallArgs = mockSubscribe.mock.calls[0] as unknown as
      | Array<(s: { settings: typeof mockSettings }) => void>
      | undefined;
    expect(firstCallArgs).toBeDefined();
    const subscriberCb = firstCallArgs![0];

    // Simulate external settings update (PR-1 reactive lifecycle persist)
    subscriberCb({
      settings: {
        ...mockSettings,
        browserPodApiKey: "updated_key_abcdef",
      },
    });

    // Masked preview = slice(0, 6) + "..." + slice(-4) = "update" + "..." + "cdef".
    // Scope to the BP KeyRow container so we don't accidentally match Jina labels.
    const rowContainer = getKeyRowContainer(BP_LABEL);
    await waitFor(() => {
      expect(rowContainer).toHaveTextContent(/update.*cdef/);
    });
  });
});
