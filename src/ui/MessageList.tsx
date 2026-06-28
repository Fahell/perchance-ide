import { h, ComponentChildren } from "preact";
import { useRef, useEffect } from "preact/hooks";
import { colors } from "./theme.js";

interface MessageListProps {
  children: ComponentChildren;
  outerRef?: { current: HTMLDivElement | null };
}

export function MessageList({ children, outerRef }: MessageListProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = outerRef ?? internalRef;

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  });

  return (
    <div
      ref={containerRef}
      style={{
        flex: "1",
        minHeight: "0",
        overflowY: "auto",
        padding: "8px",
        fontSize: "13px",
        scrollBehavior: "smooth",
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}
