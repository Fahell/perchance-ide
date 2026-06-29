import { h } from "preact";
import { useState } from "preact/hooks";
import { colors, fonts } from "./theme.js";
import { t, type Locale } from "../i18n/index.js";

interface SetupScreenProps {
  version: string;
  locale?: Locale;
  onSetupComplete: () => void;
  validateApiKey: (key: string) => Promise<boolean>;
  saveApiKey: (key: string) => void;
}

export function SetupScreen({ version, locale, onSetupComplete, validateApiKey, saveApiKey }: SetupScreenProps) {
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<"idle" | "validating" | "error" | "success">("idle");
  const [error, setError] = useState("");

  async function handleSave() {
    if (!key.trim()) {
      setError(t("setup.error.empty", locale));
      setStatus("error");
      return;
    }
    setStatus("validating");
    const valid = await validateApiKey(key.trim());
    if (valid) {
      saveApiKey(key.trim());
      setStatus("success");
      setTimeout(() => onSetupComplete(), 800);
    } else {
      setError(t("setup.error.invalid", locale));
      setStatus("error");
    }
  }

  return (
    <div style={{
      fontFamily: fonts.mono,
      padding: "24px",
      background: colors.bg,
      color: colors.text,
      height: "100vh",
      margin: "0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
    }}>
      <div style={{ maxWidth: "400px", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h2 style={{ margin: "0", color: colors.text, fontSize: "14px", fontFamily: fonts.mono, letterSpacing: "2px", textTransform: "uppercase" }}>
            agent
          </h2>
          <span style={{ fontSize: "9px", color: colors.textMuted, fontFamily: fonts.mono }}>v{version}</span>
        </div>

        <div style={{
          background: colors.surface1,
          padding: "20px",
          border: `1px solid ${colors.border}`,
        }}>
          <h3 style={{ margin: "0 0 12px", color: colors.textSecondary, fontSize: "11px", fontFamily: fonts.mono, letterSpacing: "1px", textTransform: "uppercase" }}>
            [ setup ] {t("setup.title", locale)}
          </h3>
          <p style={{ color: colors.textSecondary, fontSize: "11px", margin: "0 0 12px", lineHeight: "1.6", fontFamily: fonts.mono }}>
            {t("setup.desc", locale)}
          </p>
          <ol style={{ color: colors.textSecondary, fontSize: "11px", margin: "0 0 16px", paddingLeft: "16px", lineHeight: "2", fontFamily: fonts.mono }}>
            <li>{t("setup.step1", locale)} <span onClick={() => window.open("https://jina.ai/?sui=apikey", "_blank")} style={{ color: colors.text, textDecoration: "underline", cursor: "pointer" }}>jina.ai/?sui=apikey</span></li>
            <li>{t("setup.step2", locale)}</li>
            <li>{t("setup.step3", locale)}</li>
            <li>{t("setup.step4", locale)}</li>
          </ol>

          <input
            type="password"
            placeholder="jina_xxx..."
            value={key}
            onInput={(e) => setKey((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            style={{
              width: "100%",
              padding: "8px 10px",
              border: `1px solid ${colors.border}`,
              background: colors.surface2,
              color: colors.text,
              fontSize: "11px",
              fontFamily: fonts.mono,
              boxSizing: "border-box",
              outline: "none",
              marginBottom: "10px",
            }}
          />

          {status === "error" && (
            <div style={{ color: colors.statusError, fontSize: "10px", marginBottom: "8px", fontFamily: fonts.mono }}>
              [!!] {error}
            </div>
          )}
          {status === "success" && (
            <div style={{ color: colors.textSecondary, fontSize: "10px", marginBottom: "8px", fontFamily: fonts.mono }}>
              [ok] {t("setup.success", locale)}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={status === "validating"}
            style={{
              width: "100%",
              padding: "8px",
              border: `1px solid ${colors.text}`,
              background: "transparent",
              color: status === "validating" ? colors.textMuted : colors.text,
              fontSize: "11px",
              fontFamily: fonts.mono,
              cursor: "pointer",
              letterSpacing: "0.5px",
            }}
          >
            {status === "validating" ? t("setup.validating", locale) : t("setup.save", locale)}
          </button>
          <button
            onClick={onSetupComplete}
            style={{
              width: "100%",
              padding: "6px",
              border: `1px solid ${colors.border}`,
              background: "transparent",
              color: colors.textMuted,
              fontSize: "10px",
              fontFamily: fonts.mono,
              cursor: "pointer",
              marginTop: "6px",
              letterSpacing: "0.5px",
            }}
          >
            {t("setup.skip", locale)}
          </button>
        </div>

        <p style={{ color: colors.textMuted, fontSize: "9px", textAlign: "center", marginTop: "14px", fontFamily: fonts.mono }}>
          {t("setup.note", locale)}
        </p>
      </div>
    </div>
  );
}
