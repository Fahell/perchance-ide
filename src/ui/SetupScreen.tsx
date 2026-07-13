/**
 * SetupScreen — first-run onboarding guide.
 *
 * Shown once on first launch. Explains what the IDE is, lists features,
 * and informs about optional API keys for web search and Node.js tools.
 * User can skip and configure API keys later in Settings.
 */

import { h } from "preact";
import { useState } from "preact/hooks";
import { colors, fonts } from "./theme.js";
import { t, type Locale } from "../i18n/index.js";

interface SetupScreenProps {
  version: string;
  locale?: Locale;
  onSetupComplete: () => void;
}

export function SetupScreen({ version, locale, onSetupComplete }: SetupScreenProps) {
  const [showDetails, setShowDetails] = useState(false);

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
      <div style={{ maxWidth: "420px", width: "100%" }}>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h2 style={{
            margin: "0 0 4px",
            color: colors.text,
            fontSize: "16px",
            fontFamily: fonts.mono,
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}>
            {t("onboarding.greeting", locale)}
          </h2>
          <span style={{ fontSize: "9px", color: colors.textMuted, fontFamily: fonts.mono }}>
            v{version}
          </span>
        </div>

        {/* ── Description ── */}
        <div style={{
          background: colors.surface1,
          padding: "20px",
          border: `1px solid ${colors.border}`,
          marginBottom: "12px",
        }}>
          <p style={{
            color: colors.textSecondary,
            fontSize: "11px",
            margin: "0 0 16px",
            lineHeight: "1.7",
            fontFamily: fonts.mono,
          }}>
            {t("onboarding.description", locale)}
          </p>

          {/* What is this? toggle */}
          <div
            onClick={() => setShowDetails(!showDetails)}
            style={{
              cursor: "pointer",
              color: colors.textMuted,
              fontSize: "10px",
              fontFamily: fonts.mono,
              userSelect: "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: showDetails ? "12px" : "0",
              transition: "margin 0.2s",
            }}
          >
            <span style={{ display: "inline-block", transition: "transform 0.2s", transform: showDetails ? "rotate(90deg)" : "rotate(0deg)" }}>
              ▶
            </span>
            <span>{t("onboarding.whatIs", locale)}</span>
          </div>

          {showDetails && (
            <div style={{
              borderTop: `1px solid ${colors.border}`,
              paddingTop: "12px",
            }}>
              <div style={{ marginBottom: "10px" }}>
                <div style={{ color: colors.text, fontSize: "10px", fontFamily: fonts.mono, marginBottom: "4px" }}>
                  ✦ {t("onboarding.features.editor", locale)}
                </div>
                <div style={{ color: colors.text, fontSize: "10px", fontFamily: fonts.mono, marginBottom: "4px" }}>
                  ✦ {t("onboarding.features.agent", locale)}
                </div>
                <div style={{ color: colors.text, fontSize: "10px", fontFamily: fonts.mono }}>
                  ✦ {t("onboarding.features.python", locale)}
                </div>
              </div>

              {/* API Keys info */}
              <div style={{
                marginTop: "14px",
                padding: "10px 12px",
                background: colors.surface2,
                border: `1px solid ${colors.border}`,
              }}>
                <div style={{
                  color: colors.textMuted,
                  fontSize: "9px",
                  fontFamily: fonts.mono,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}>
                  {t("onboarding.keys", locale)}
                </div>
                <div style={{
                  color: colors.textSecondary,
                  fontSize: "10px",
                  fontFamily: fonts.mono,
                  lineHeight: "1.6",
                }}>
                  {t("onboarding.keys.desc", locale)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Start Button ── */}
        <button
          onClick={onSetupComplete}
          style={{
            width: "100%",
            padding: "10px",
            border: `1px solid ${colors.text}`,
            background: "transparent",
            color: colors.text,
            fontSize: "11px",
            fontFamily: fonts.mono,
            cursor: "pointer",
            letterSpacing: "1px",
            textTransform: "uppercase",
            transition: "opacity 0.15s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = "0.7")}
          onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
        >
          {t("onboarding.start", locale)}
        </button>

        {/* ── Footer ── */}
        <p style={{
          color: colors.textMuted,
          fontSize: "9px",
          textAlign: "center",
          marginTop: "14px",
          fontFamily: fonts.mono,
          lineHeight: "1.5",
        }}>
          {t("onboarding.versionInfo", locale)?.replace("{version}", version)}
        </p>
      </div>
    </div>
  );
}
