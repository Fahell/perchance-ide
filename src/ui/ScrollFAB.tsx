import { h } from "preact";
import { useState, useEffect } from "preact/hooks";
import { colors, fonts } from "./theme.js";

interface ScrollFABProps {
  scrollRef: { current: HTMLDivElement | null };
}

export function ScrollFAB({ scrollRef }: ScrollFABProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setVisible(distFromBottom > 100);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    // Check initial state
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef.current]);

  if (!visible) return null;

  return (
    <button
      onClick={() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }}
      style={{
        position: "absolute",
        bottom: "8px",
        right: "8px",
        background: colors.surface2,
        border: `1px solid ${colors.border}`,
        color: colors.textSecondary,
        fontSize: "11px",
        fontFamily: fonts.mono,
        padding: "4px 8px",
        cursor: "pointer",
        zIndex: 10,
        lineHeight: 1,
      }}
    >
      [↓]
    </button>
  );
}
