import { h } from "preact";
import { colors, fonts } from "./theme.js";

interface HeaderProps {
  version: string;
  commit: string;
  onSettings: () => void;
}

export function Header({ version, commit, onSettings }: HeaderProps) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "6px 10px",
      borderBottom: `1px solid ${colors.border}`,
      flexShrink: "0",
    }}>
      <span style={{ color: colors.textSecondary, fontSize: "11px", fontWeight: "600", fontFamily: fonts.mono, letterSpacing: "0.5px" }}>
        agent
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "9px", color: colors.textMuted, fontFamily: fonts.mono }}>
          v{version}+{commit}
        </span>
        <button
          onClick={onSettings}
          style={{
            background: "none",
            border: "none",
            color: colors.textMuted,
            fontSize: "11px",
            padding: "0",
            cursor: "pointer",
            fontFamily: fonts.mono,
          }}
        >
          [ = ]
        </button>
      </div>
    </div>
  );
}
