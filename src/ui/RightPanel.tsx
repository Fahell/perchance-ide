/**
 * RightPanel — placeholder for the rightmost panel (TBD).
 */

import { h } from "preact";
import { colors, fonts } from "./theme.js";
import { t, type Locale } from "../i18n/index.js";

interface RightPanelProps {
  locale?: Locale;
}

export function RightPanel({ locale }: RightPanelProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      background: colors.bg,
      borderLeft: `1px solid ${colors.border}`,
      padding: "16px",
      textAlign: "center",
      color: colors.textMuted,
      fontFamily: fonts.mono,
      fontSize: "10px",
    }}>
      <div style={{ marginBottom: "8px", opacity: "0.4", fontSize: "24px" }}>
        ⊞
      </div>
      <div>
        {t("rightPanel.placeholder", locale) || "panel coming soon"}
      </div>
    </div>
  );
}
