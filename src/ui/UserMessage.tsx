import { t, type Locale } from "../i18n/index.js";
import { formatAbsoluteTime, formatRelativeTime } from "./formatRelativeTime.js";
import { colors, fonts } from "./theme.js";

interface UserMessageProps {
  content: string;
  userName?: string;
  locale?: Locale;
  timestamp?: number;
}

export function UserMessage({ content, userName, locale, timestamp }: UserMessageProps) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "flex-end",
      animation: "agent-slide-in 0.2s ease-out",
    }}>
      <div style={{
        maxWidth: "85%",
        padding: "8px 12px",
        background: colors.surface2,
        borderRight: `2px solid ${colors.borderEmphasis}`,
        fontSize: "13px",
        lineHeight: "1.5",
        color: colors.text,
        fontFamily: fonts.mono,
        wordBreak: "break-word",
      }}>
        <div style={{ color: colors.textMuted, fontSize: "9px", fontWeight: "600", marginBottom: "4px", fontFamily: fonts.mono, letterSpacing: "1px", textTransform: "uppercase" }}>
          {userName || t("user.you", locale)}
        </div>
        <div>{content}</div>
        {timestamp && (
          <div
            title={formatAbsoluteTime(timestamp, locale)}
            style={{ color: colors.textMuted, fontSize: "9px", marginTop: "4px", fontFamily: fonts.mono }}
          >
            {formatRelativeTime(timestamp, locale)}
          </div>
        )}
      </div>
    </div>
  );
}
