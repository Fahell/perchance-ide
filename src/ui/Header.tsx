import { h } from "preact";
import { colors, fonts } from "./theme.js";

interface HeaderProps {
  version: string;
  commit: string;
  onFaq?: () => void;
}

export function Header({ version, commit, onFaq }: HeaderProps) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 12px",
      borderBottom: `1px solid ${colors.border}`,
      flexShrink: "0",
    }}>
      <span style={{ color: colors.textSecondary, fontSize: "12px", fontWeight: "600", fontFamily: fonts.mono, letterSpacing: "0.5px" }}>
        agent
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {onFaq && (
          <span
            onClick={onFaq}
            style={{ color: colors.textSecondary, cursor: "pointer", fontSize: "11px", fontFamily: fonts.mono, padding: "2px 4px" }}
          >
            [?]
          </span>
        )}
        <span style={{ fontSize: "10px", color: colors.textSecondary, fontFamily: fonts.mono }}>
          v{version}+{commit}
        </span>
      </div>
    </div>
  );
}
