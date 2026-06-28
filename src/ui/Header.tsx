import { h } from "preact";
import { colors, fonts } from "./theme.js";

interface HeaderProps {
  version: string;
  commit: string;
}

export function Header({ version, commit }: HeaderProps) {
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
      <span style={{ fontSize: "9px", color: colors.textMuted, fontFamily: fonts.mono }}>
        v{version}+{commit}
      </span>
    </div>
  );
}
