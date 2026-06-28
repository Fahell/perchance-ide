import { h, ComponentChildren } from "preact";
import { useRef, useEffect } from "preact/hooks";
import { colors } from "./theme.js";

interface MessageListProps {
  children: ComponentChildren;
}

export function MessageList({ children }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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
      }}
    >
      {children}
    </div>
  );
}
