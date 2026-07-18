/**
 * SettingsModal — IDE settings with tool toggles and inline API key configuration.
 *
 * API key inputs are placed directly next to their corresponding tool toggles,
 * with a "test connection" button that validates the key before activation.
 */

import { useEffect, useState } from "preact/hooks";
import { LOCALES, LOCALE_LABELS, t, type Locale } from "../i18n/index.js";
import { ideStore } from "../store.js";
import { validateApiKey } from "../tools/web-search.js";
import { validateBrowserPodKey, isCrossOriginIsolated } from "../browserpod/manager.js";
import { Modal } from "./Modal.js";
import { colors, fonts } from "./theme.js";

interface SettingsModalProps {
  isOpen: boolean;
  currentKey: string;
  locale: Locale;
  onClose: () => void;
  onSave: (key: string) => Promise<boolean>;
  onLocaleChange: (locale: Locale) => void;
}

// ─── Sub-components ────────────────────────────────────────

interface ToggleRowProps {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  locale: Locale;
}

function ToggleRow({ label, description, value, onChange, locale }: ToggleRowProps) {
  const [highlight, setHighlight] = useState(false);

  function handleChange(e: Event) {
    const v = (e.target as HTMLSelectElement).value === "on";
    onChange(v);
    setHighlight(true);
    setTimeout(() => setHighlight(false), 400);
  }

  return (
    <div
      style={{
        marginBottom: "10px",
        padding: "10px 12px",
        background: colors.surface1,
        border: `1px solid ${highlight ? colors.textMuted : colors.border}`,
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => { if (!highlight) (e.currentTarget as HTMLElement).style.borderColor = colors.borderEmphasis; }}
      onMouseLeave={(e) => { if (!highlight) (e.currentTarget as HTMLElement).style.borderColor = colors.border; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <label style={{ color: colors.textSecondary, fontSize: "11px", fontFamily: fonts.mono }}>
          {label}
        </label>
        <select
          value={value ? "on" : "off"}
          onChange={handleChange}
          style={{
            fontFamily: fonts.mono,
            fontSize: "10px",
            background: colors.surface2,
            color: colors.text,
            border: `1px solid ${colors.border}`,
            padding: "3px 6px",
            outline: "none",
            cursor: "pointer",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = colors.textMuted)}
          onBlur={(e) => (e.currentTarget.style.borderColor = colors.border)}
        >
          <option value="on">{t("settings.toggle.on", locale)}</option>
          <option value="off">{t("settings.toggle.off", locale)}</option>
        </select>
      </div>
      <div style={{ color: colors.textMuted, fontSize: "9px", marginTop: "4px", fontFamily: fonts.mono }}>
        {description}
      </div>
    </div>
  );
}

interface KeyRowProps {
  label: string;
  value: string;
  placeholder: string;
  maskedPreview: string;
  onValueChange: (v: string) => void;
  onTest: (key: string) => Promise<boolean | string>;
  locale: Locale;
}

function KeyRow({ label, value, placeholder, maskedPreview, onValueChange, onTest, locale }: KeyRowProps) {
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testError, setTestError] = useState<string | null>(null);

  async function handleTest() {
    if (!value.trim()) {
      setTestStatus("error");
      setTestError(null);
      return;
    }
    setTestStatus("testing");
    setTestError(null);
    const result = await onTest(value.trim());
    if (result === true) {
      setTestStatus("success");
      setTestError(null);
    } else if (result === false) {
      setTestStatus("error");
      setTestError(null);
    } else {
      // result is a string error message
      setTestStatus("error");
      setTestError(result);
    }
  }

  const statusColor = testStatus === "success" ? colors.statusDone
    : testStatus === "error" ? "#e8a84c"
    : colors.textMuted;

  return (
    <div style={{
      padding: "8px 12px 10px",
      marginTop: "-6px",
      marginBottom: "10px",
      background: colors.surface2,
      border: `1px solid ${colors.border}`,
      borderTop: "none",
    }}>
      <label style={{
        color: colors.textMuted, fontSize: "9px", display: "block",
        marginBottom: "4px", fontFamily: fonts.mono, letterSpacing: "1px", textTransform: "uppercase",
      }}>
        {label}
      </label>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <input
          type="password"
          value={value}
          onInput={(e) => { onValueChange((e.target as HTMLInputElement).value); setTestStatus("idle"); }}
          placeholder={placeholder}
          aria-label={label}
          style={{
            flex: 1,
            padding: "6px 8px",
            border: `1px solid ${colors.border}`,
            background: colors.inputBg,
            color: colors.text,
            fontSize: "10px",
            fontFamily: fonts.mono,
            outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = colors.textMuted)}
          onBlur={(e) => (e.currentTarget.style.borderColor = colors.border)}
        />
        <button
          onClick={handleTest}
          disabled={testStatus === "testing"}
          style={{
            padding: "6px 10px",
            border: `1px solid ${testStatus === "success" ? colors.textSecondary : colors.text}`,
            background: "transparent",
            color: testStatus === "testing" ? colors.textMuted : colors.text,
            fontSize: "10px",
            fontFamily: fonts.mono,
            cursor: testStatus === "testing" ? "default" : "pointer",
            whiteSpace: "nowrap",
            transition: "opacity 0.15s",
            opacity: testStatus === "testing" ? 0.6 : 1,
          }}
        >
          {testStatus === "testing" ? t("settings.validating", locale)
            : testStatus === "success" ? t("settings.validate.success", locale)
            : t("settings.validate", locale)}
        </button>
      </div>
      {maskedPreview && (
        <div style={{
          color: colors.textMuted, fontSize: "9px", marginTop: "4px",
          fontFamily: fonts.mono, opacity: 0.7,
        }}>
          {t("settings.apiKey.current", locale).replace("{key}", maskedPreview)}
        </div>
      )}
      {testStatus === "error" && (
        <div style={{
          color: statusColor, fontSize: "9px", marginTop: "4px",
          fontFamily: fonts.mono,
        }}>
          {testError || t("settings.validate.error", locale)}
        </div>
      )}
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      margin: "16px 0 8px",
      color: colors.textMuted,
      fontSize: "9px",
      fontFamily: fonts.mono,
      letterSpacing: "1px",
      textTransform: "uppercase",
    }}>
      <span>{label}</span>
      <div style={{ flex: 1, height: "1px", background: colors.border }} />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────

export function SettingsModal({ isOpen, currentKey, locale, onClose, onSave, onLocaleChange }: SettingsModalProps) {
  const [jinaKey, setJinaKey] = useState(currentKey);

  // Sync local state from store on open
  const settings = ideStore.getState().settings;
  const [autoSave, setAutoSave] = useState(settings.autoSave);
  const [fontSize, setFontSize] = useState(settings.fontSize);
  const [wordWrap, setWordWrap] = useState(settings.wordWrap);
  const [tabSize, setTabSize] = useState(settings.tabSize);
  const [toolWeb, setToolWeb] = useState(settings.toolWebEnabled);
  const [toolCtx, setToolCtx] = useState(settings.toolContextEnabled);
  const [toolVfs, setToolVfs] = useState(settings.toolVfsEnabled);
  const [toolTerm, setToolTerm] = useState(settings.toolTerminalEnabled);
  const [toolNode, setToolNode] = useState(settings.toolNodeEnabled);
  const [bpKey, setBpKey] = useState(settings.browserPodApiKey);
  const [termFontSize, setTermFontSize] = useState(settings.terminalFontSize ?? 13);

  // Subscribe to store to stay in sync
  useEffect(() => {
    if (!isOpen) return;
    return ideStore.subscribe((s) => {
      const st = s.settings;
      setAutoSave(st.autoSave);
      setFontSize(st.fontSize);
      setWordWrap(st.wordWrap);
      setTabSize(st.tabSize);
      setToolWeb(st.toolWebEnabled);
      setToolCtx(st.toolContextEnabled);
      setToolVfs(st.toolVfsEnabled);
      setToolTerm(st.toolTerminalEnabled);
      setToolNode(st.toolNodeEnabled);
      setBpKey(st.browserPodApiKey);
      setTermFontSize(st.terminalFontSize ?? 13);
    });
  }, [isOpen]);

  // Reset Jina key state when modal opens
  useEffect(() => {
    if (isOpen) {
      setJinaKey(currentKey);
    }
  }, [isOpen, currentKey]);

  function updateSetting<K extends keyof typeof settings>(field: K, value: (typeof settings)[K]) {
    ideStore.getState().updateSettings({ [field]: value } as any);
  }

  /** Localized label for each Jina validation error code. */
  const jinaErrorI18nKey: Record<string, string> = {
    invalid_key: "settings.validate.invalidKey",
    no_credit: "settings.validate.noCredit",
    rate_limited: "settings.validate.rateLimited",
    network: "settings.validate.network",
  };

  /** Test Jina key — validate and persist only on success */
  async function testJinaKey(key: string): Promise<boolean | string> {
    const result = await validateApiKey(key);
    if (result.ok) {
      await onSave(key);
      setJinaKey(key);
      return true;
    }
    // Map machine-readable code → localized message; fall back to result.message
    // (short English with HTTP status) if i18n fails for the active locale.
    const i18nKey = jinaErrorI18nKey[result.code];
    return (i18nKey && t(i18nKey, locale)) || result.message;
  }

  /** Test BrowserPod key — validate and persist only on success */
  async function testBrowserPodKey(key: string): Promise<boolean | string> {
    // Check cross-origin isolation first — BrowserPod requires it for SharedArrayBuffer
    if (!isCrossOriginIsolated()) {
      console.warn("[SettingsModal] Cannot test BrowserPod key: page is not cross-origin isolated");
      return "Page is not cross-origin isolated — requires COOP & COEP headers";
    }
    const result = await validateBrowserPodKey(key);
    if (result.ok) {
      setBpKey(key);
      updateSetting("browserPodApiKey", key);
      return true;
    }
    return result.error || false;
  }

  const maskedJinaKey = currentKey
    ? currentKey.slice(0, 8) + "..." + currentKey.slice(-4)
    : "";

  const maskedBpKey = bpKey
    ? bpKey.slice(0, 6) + "..." + bpKey.slice(-4)
    : "";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("settings.title", locale)} wide>
      {/* ── EDITOR ─────────────────────────────────────── */}
      <SectionHeader label={t("settings.section.editor", locale)} />

      {/* Language selector */}
      <div
        style={{
          marginBottom: "10px",
          padding: "10px 12px",
          background: colors.surface1,
          border: `1px solid ${colors.border}`,
          transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = colors.borderEmphasis)}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = colors.border)}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label htmlFor="settings-lang" style={{ color: colors.textSecondary, fontSize: "11px", fontFamily: fonts.mono }}>
            {t("settings.language", locale)}
          </label>
          <select
            id="settings-lang"
            value={locale}
            onChange={(e) => onLocaleChange((e.target as HTMLSelectElement).value as Locale)}
            style={{
              fontFamily: fonts.mono,
              fontSize: "10px",
              background: colors.surface2,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              padding: "3px 6px",
              outline: "none",
              cursor: "pointer",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = colors.textMuted)}
            onBlur={(e) => (e.currentTarget.style.borderColor = colors.border)}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>{LOCALE_LABELS[l]}</option>
            ))}
          </select>
        </div>
      </div>

      <ToggleRow
        label={t("settings.autoSave", locale)}
        description={t("settings.autoSave.desc", locale)}
        value={autoSave}
        onChange={(v) => { setAutoSave(v); updateSetting("autoSave", v); }}
        locale={locale}
      />

      {/* Font size */}
      <div
        style={{
          marginBottom: "10px",
          padding: "10px 12px",
          background: colors.surface1,
          border: `1px solid ${colors.border}`,
          transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = colors.borderEmphasis)}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = colors.border)}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label style={{ color: colors.textSecondary, fontSize: "11px", fontFamily: fonts.mono }}>
            {t("settings.fontSize", locale)}
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <input
              type="number"
              value={fontSize}
              min={10}
              max={24}
              step={1}
              onInput={(e) => {
                const v = Math.max(10, Math.min(24, parseInt((e.target as HTMLInputElement).value) || 14));
                setFontSize(v);
                updateSetting("fontSize", v);
              }}
              aria-label={t("settings.fontSize", locale)}
              style={{
                width: "48px",
                padding: "3px 6px",
                fontFamily: fonts.mono,
                fontSize: "10px",
                background: colors.surface2,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                outline: "none",
                textAlign: "center",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = colors.textMuted)}
              onBlur={(e) => (e.currentTarget.style.borderColor = colors.border)}
            />
            <span style={{ color: colors.textMuted, fontSize: "9px", fontFamily: fonts.mono }}>px</span>
          </div>
        </div>
        <div style={{ color: colors.textMuted, fontSize: "9px", marginTop: "4px", fontFamily: fonts.mono }}>
          {t("settings.fontSize.desc", locale)}
        </div>
      </div>

      <ToggleRow
        label={t("settings.wordWrap", locale)}
        description={t("settings.wordWrap.desc", locale)}
        value={wordWrap}
        onChange={(v) => { setWordWrap(v); updateSetting("wordWrap", v); }}
        locale={locale}
      />

      {/* Tab size */}
      <div
        style={{
          marginBottom: "10px",
          padding: "10px 12px",
          background: colors.surface1,
          border: `1px solid ${colors.border}`,
          transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = colors.borderEmphasis)}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = colors.border)}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label style={{ color: colors.textSecondary, fontSize: "11px", fontFamily: fonts.mono }}>
            {t("settings.tabSize", locale)}
          </label>
          <select
            value={tabSize}
            onChange={(e) => {
              const v = parseInt((e.target as HTMLSelectElement).value) as 2 | 4 | 8;
              setTabSize(v);
              updateSetting("tabSize", v);
            }}
            style={{
              fontFamily: fonts.mono,
              fontSize: "10px",
              background: colors.surface2,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              padding: "3px 6px",
              outline: "none",
              cursor: "pointer",
              transition: "border-color 0.15s",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = colors.textMuted)}
            onBlur={(e) => (e.currentTarget.style.borderColor = colors.border)}
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={8}>8</option>
          </select>
        </div>
        <div style={{ color: colors.textMuted, fontSize: "9px", marginTop: "4px", fontFamily: fonts.mono }}>
          {t("settings.tabSize.desc", locale)}
        </div>
      </div>

      {/* Terminal font size (P8) */}
      <div
        style={{
          marginBottom: "10px",
          padding: "10px 12px",
          background: colors.surface1,
          border: `1px solid ${colors.border}`,
          transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = colors.borderEmphasis)}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = colors.border)}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label style={{ color: colors.textSecondary, fontSize: "11px", fontFamily: fonts.mono }}>
            {t("settings.terminalFontSize", locale)}
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <input
              type="number"
              value={termFontSize}
              min={10}
              max={20}
              step={1}
              onInput={(e) => {
                const v = Math.max(10, Math.min(20, parseInt((e.target as HTMLInputElement).value) || 13));
                setTermFontSize(v);
                updateSetting("terminalFontSize", v);
              }}
              aria-label={t("settings.terminalFontSize", locale)}
              style={{
                width: "48px",
                padding: "3px 6px",
                fontFamily: fonts.mono,
                fontSize: "10px",
                background: colors.surface2,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                outline: "none",
                textAlign: "center",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = colors.textMuted)}
              onBlur={(e) => (e.currentTarget.style.borderColor = colors.border)}
            />
            <span style={{ color: colors.textMuted, fontSize: "9px", fontFamily: fonts.mono }}>px</span>
          </div>
        </div>
        <div style={{ color: colors.textMuted, fontSize: "9px", marginTop: "4px", fontFamily: fonts.mono }}>
          {t("settings.terminalFontSize.desc", locale)}
        </div>
      </div>

      {/* ── AGENT TOOLS ────────────────────────────────── */}
      <SectionHeader label={t("settings.section.tools", locale)} />

      {/* ── Web Tools + Jina Key ── */}
      <ToggleRow
        label={t("settings.tools.web", locale)}
        description={t("settings.tools.web.desc", locale)}
        value={toolWeb}
        onChange={(v) => { setToolWeb(v); updateSetting("toolWebEnabled", v); }}
        locale={locale}
      />
      <KeyRow
        label={t("settings.apiKey", locale)}
        value={jinaKey}
        placeholder={t("settings.apiKey.placeholder", locale)}
        maskedPreview={maskedJinaKey}
        onValueChange={(v) => { setJinaKey(v); }}
        onTest={testJinaKey}
        locale={locale}
      />

      <ToggleRow
        label={t("settings.tools.context", locale)}
        description={t("settings.tools.context.desc", locale)}
        value={toolCtx}
        onChange={(v) => { setToolCtx(v); updateSetting("toolContextEnabled", v); }}
        locale={locale}
      />
      <ToggleRow
        label={t("settings.tools.files", locale)}
        description={t("settings.tools.files.desc", locale)}
        value={toolVfs}
        onChange={(v) => { setToolVfs(v); updateSetting("toolVfsEnabled", v); }}
        locale={locale}
      />
      <ToggleRow
        label={t("settings.tools.terminal", locale)}
        description={t("settings.tools.terminal.desc", locale)}
        value={toolTerm}
        onChange={(v) => { setToolTerm(v); updateSetting("toolTerminalEnabled", v); }}
        locale={locale}
      />

      {/* ── Node.js Tools + BrowserPod Key ── */}
      <ToggleRow
        label={t("settings.tools.node", locale)}
        description={t("settings.tools.node.desc", locale)}
        value={toolNode}
        onChange={(v) => { setToolNode(v); updateSetting("toolNodeEnabled", v); }}
        locale={locale}
      />
      <KeyRow
        label={t("settings.browserPodApiKey", locale)}
        value={bpKey}
        placeholder={t("settings.browserPodApiKey.placeholder", locale)}
        maskedPreview={maskedBpKey}
        onValueChange={(v) => { setBpKey(v); updateSetting("browserPodApiKey", v); }}
        onTest={testBrowserPodKey}
        locale={locale}
      />

      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          width: "100%",
          padding: "8px",
          marginTop: "8px",
          border: `1px solid ${colors.border}`,
          background: "transparent",
          color: colors.textMuted,
          fontSize: "11px",
          fontFamily: fonts.mono,
          cursor: "pointer",
          letterSpacing: "0.5px",
          transition: "opacity 0.15s",
        }}
        onMouseOver={(e) => (e.currentTarget.style.opacity = "0.7")}
        onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
      >
        {t("settings.close", locale)}
      </button>
    </Modal>
  );
}
