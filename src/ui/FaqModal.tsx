import { h } from "preact";
import { colors, fonts } from "./theme.js";
import { t, type Locale } from "../i18n/index.js";

interface FaqModalProps {
  isOpen: boolean;
  locale?: Locale;
  onClose: () => void;
}

const FAQ_ITEMS = [
  {
    q: "Where is the source code?",
    a: "You can access the project via the GitHub repository at https://github.com/Fahell/perchance-ide",
  },
  {
    q: "What is this?",
    a: "A Perchance generator that uses the ai-text-plugin internally. The sidebar panel runs an AI agent with web search, context management, and memory extraction.",
  },
  {
    q: "Do I need an API key?",
    a: "You need a Jina.ai API key for the agent's web search tool. It's free. Your key is stored locally and never shared.",
  },
  {
    q: "How do I use the generator?",
    a: "Open the sidebar panel and type your message. The agent will think, use tools if needed, and respond. You can also write text/code in the middle editor panel and send it to the agent.",
  },
  {
    q: "Will this be updated?",
    a: "Yes! This is an active project. More panels and features are planned.",
  },
];

export function FaqModal({ isOpen, locale, onClose }: FaqModalProps) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: "0",
        left: "0",
        right: "0",
        bottom: "0",
        background: "rgba(0,0,0,0.85)",
        zIndex: "1000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.bg,
          padding: "16px",
          maxWidth: "400px",
          width: "92%",
          maxHeight: "80vh",
          overflowY: "auto",
          border: `1px solid ${colors.border}`,
          fontFamily: fonts.mono,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h3 style={{ margin: "0", color: colors.textSecondary, fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase" }}>
            {t("faq.title", locale) || "faq"}
          </h3>
          <span
            onClick={onClose}
            style={{ color: colors.textMuted, cursor: "pointer", fontSize: "11px" }}
          >
            [x]
          </span>
        </div>

        {/* FAQ Items */}
        {FAQ_ITEMS.map((item, i) => (
          <div key={i} style={{ marginBottom: "14px", padding: "10px 12px", background: colors.surface1, border: `1px solid ${colors.border}` }}>
            <div style={{ color: colors.text, fontSize: "10px", fontWeight: "600", marginBottom: "6px", lineHeight: "1.4" }}>
              {item.q}
            </div>
            <div style={{ color: colors.textMuted, fontSize: "10px", lineHeight: "1.5" }}>
              {item.a}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
