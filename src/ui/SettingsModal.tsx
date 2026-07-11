import { useEffect, useState } from "preact/hooks";
import { LOCALES, LOCALE_LABELS, t, type Locale } from "../i18n/index.js";
import { ideStore } from "../store.js";
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

interface InputRowProps {
  label: string;
  description: string;
  value: string;
  placeholder: string;
  maskedPreview: string;
  onInput: (v: string) => void;
}

function InputRow({ label, description, value, placeholder, maskedPreview, onInput }: InputRowProps) {
  return (
    <div style={{ marginBottom: "10px" }}>
      <label style={{ color: colors.textMuted, fontSize: "9px", display: "block", marginBottom: "4px", fontFamily: fonts.mono, letterSpacing: "1px", textTransform: "uppercase" }}>
        {label}
      </label>
      <input
        type="password"
        value={value}
        onInput={(e) => onInput((e.target as HTMLInputElement).value)}
        placeholder={placeholder}
        aria-label={label}
        style={{
          width: "100%",
          padding: "8px 10px",
          border: `1px solid ${colors.border}`,
          background: colors.surface1,
          color: colors.text,
          fontSize: "11px",
          fontFamily: fonts.mono,
          boxSizing: "border-box",
          outline: "none",
          transition: "border-color 0.15s",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = colors.textMuted)}
        onBlur={(e) => (e.currentTarget.style.borderColor = colors.border)}
      />
      <div style={{ color: colors.textMuted, fontSize: "9px", marginTop: "4px", fontFamily: fonts.mono }}>
        {description}
      </div>
      {maskedPreview && (
        <div style={{ color: colors.textMuted, fontSize: "9px", marginTop: "2px", fontFamily: fonts.mono, opacity: 0.7 }}>
          current: {maskedPreview}
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
  const [key, setKey] = useState(currentKey);
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState(false);

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
    });
  }, [isOpen]);

  // Reset API key state when modal opens
  useEffect(() => {
    if (isOpen) {
      setKey(currentKey);
      setMsg("");
      setSaved(false);
    }
  }, [isOpen, currentKey]);

  function updateSetting<K extends keyof typeof settings>(field: K, value: (typeof settings)[K]) {
    ideStore.getState().updateSettings({ [field]: value } as any);
  }

  async function handleSave() {
    if (!key.trim()) {
      setMsg(t("settings.apiKey.error.empty", locale));
      setSaved(false);
      return;
    }
    setMsg(t("settings.apiKey.validating", locale));
    setSaved(false);
    const ok = await onSave(key.trim());
    if (ok) {
      setMsg(t("settings.apiKey.saved", locale));
      setSaved(true);
    } else {
      setMsg(t("settings.apiKey.error.invalid", locale));
      setSaved(false);
    }
  }

  const maskedKey = currentKey
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

      {/* ── AGENT TOOLS ────────────────────────────────── */}
      <SectionHeader label={t("settings.section.tools", locale)} />

      <ToggleRow
        label={t("settings.tools.web", locale)}
        description={t("settings.tools.web.desc", locale)}
        value={toolWeb}
        onChange={(v) => { setToolWeb(v); updateSetting("toolWebEnabled", v); }}
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
      <ToggleRow
        label={t("settings.tools.node", locale)}
        description={t("settings.tools.node.desc", locale)}
        value={toolNode}
        onChange={(v) => { setToolNode(v); updateSetting("toolNodeEnabled", v); }}
        locale={locale}
      />

      {/* ── API KEYS ───────────────────────────────────── */}
      <SectionHeader label={t("settings.section.keys", locale)} />

      <InputRow
        label={t("settings.browserPodApiKey", locale)}
        description={t("settings.browserPodApiKey.current", locale).replace("{key}", maskedBpKey || "none")}
        value={bpKey}
        placeholder={t("settings.browserPodApiKey.placeholder", locale)}
        maskedPreview=""
        onInput={(v) => { setBpKey(v); updateSetting("browserPodApiKey", v); }}
      />

      <div
        style={{
          padding: "10px 12px",
          marginBottom: "10px",
          background: colors.surface2,
          border: `1px solid ${colors.border}`,
          transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = colors.borderEmphasis)}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = colors.border)}
      >
        <label htmlFor="settings-api-key" style={{ color: colors.textMuted, fontSize: "9px", display: "block", marginBottom: "4px", fontFamily: fonts.mono, letterSpacing: "1px", textTransform: "uppercase" }}>
          {t("settings.apiKey", locale)}
        </label>
        <input
          id="settings-api-key"
          type="password"
          value={key}
          onInput={(e) => { setKey((e.target as HTMLInputElement).value); setSaved(false); setMsg(""); }}
          placeholder={t("settings.apiKey.placeholder", locale)}
          aria-label={t("settings.apiKey", locale)}
          style={{
            width: "100%",
            padding: "8px 10px",
            border: `1px solid ${colors.border}`,
            background: colors.surface1,
            color: colors.text,
            fontSize: "11px",
            fontFamily: fonts.mono,
            boxSizing: "border-box",
            outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = colors.textMuted)}
          onBlur={(e) => (e.currentTarget.style.borderColor = colors.border)}
        />
        {maskedKey && (
          <div style={{ color: colors.textMuted, fontSize: "9px", marginTop: "4px", fontFamily: fonts.mono, opacity: 0.7 }}>
            {t("settings.apiKey.current", locale).replace("{key}", maskedKey)}
          </div>
        )}

        {/* Save button + message inline */}
        <div style={{ display: "flex", gap: "8px", marginTop: "8px", alignItems: "center" }}>
          <button
            onClick={handleSave}
            style={{
              padding: "6px 12px",
              border: `1px solid ${saved ? colors.textSecondary : colors.text}`,
              background: "transparent",
              color: saved ? colors.textSecondary : colors.text,
              fontSize: "10px",
              fontFamily: fonts.mono,
              cursor: "pointer",
              letterSpacing: "0.5px",
              transition: "opacity 0.15s",
              opacity: 1,
            }}
            onMouseOver={(e) => (e.currentTarget.style.opacity = "0.7")}
            onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
          >
            {saved ? t("settings.apiKey.saved", locale) : t("settings.save", locale)}
          </button>
          {msg && !saved && (
            <span style={{
              fontSize: "10px",
              color: msg.includes("[ok]") ? colors.textSecondary : msg.includes("[!!]") ? colors.statusError : colors.textMuted,
              fontFamily: fonts.mono,
            }}>
              {msg}
            </span>
          )}
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          width: "100%",
          padding: "8px",
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
