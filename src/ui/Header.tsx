import { h } from "preact";
import { colors } from "./theme.js";

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
      padding: "6px 8px",
      borderBottom: `1px solid ${colors.border}`,
      flexShrink: "0",
    }}>
      <span style={{ color: colors.accent, fontSize: "13px", fontWeight: "600" }}>
        🤖 Agent
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "9px", color: colors.textMuted }}>
          v{version}+{commit}
        </span>
        <button
          onClick={onSettings}
          style={{
            background: "none",
            border: `1px solid ${colors.border}`,
            color: colors.textMuted,
            fontSize: "10px",
            padding: "1px 6px",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          ⚙️
        </button>
      </div>
    </div>
  );
}
