import { t, type Locale } from "../i18n/index.js";
import { Modal } from "./Modal.js";
import { colors, fonts } from "./theme.js";

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
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("faq.title", locale) || "faq"} wide>
      <div style={{ fontFamily: fonts.mono }}>
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
    </Modal>
  );
}
