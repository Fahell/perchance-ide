import { colors, fonts } from "./theme.js";
import type { AgentStatus } from "./types.js";

interface HeaderProps {
  version: string;
  commit: string;
  agentStatus: AgentStatus;
  onFaq?: () => void;
}

export function Header({ version, commit, agentStatus, onFaq }: HeaderProps) {
  const isActive = agentStatus !== "idle";

  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 12px",
      borderBottom: `1px solid ${colors.border}`,
      flexShrink: "0",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* Minimal status dot */}
        <div style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: isActive ? colors.text : "transparent",
          transition: "background 0.3s",
          opacity: isActive ? 1 : 0.3,
          animation: isActive ? "status-dot-pulse 1.5s ease-in-out infinite" : "none",
        }} />
        <span style={{ color: colors.textSecondary, fontSize: "12px", fontWeight: "600", fontFamily: fonts.mono, letterSpacing: "0.5px" }}>
          agent
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {onFaq && (
          <button
            onClick={onFaq}
            style={{ color: colors.textSecondary, cursor: "pointer", fontSize: "11px", fontFamily: fonts.mono, padding: "2px 4px", background: "none", border: "none", display: "inline" }}
          >
            [?]
          </button>
        )}
        <span style={{ fontSize: "10px", color: colors.textSecondary, fontFamily: fonts.mono }}>
          v{version}+{commit}
        </span>
      </div>
    </div>
  );
}
