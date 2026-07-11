import { ComponentChildren, toChildArray } from "preact";
import { useEffect, useRef } from "preact/hooks";

interface MessageListProps {
  children: ComponentChildren;
  outerRef?: { current: HTMLDivElement | null };
}

export function MessageList({ children, outerRef }: MessageListProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = outerRef ?? internalRef;
  const childrenCountRef = useRef(0);
  const childrenLen = toChildArray(children).length;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 100;
    if (isNearBottom || childrenLen > childrenCountRef.current) {
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight;
      });
    }
    childrenCountRef.current = childrenLen;
  });

  return (
    <div
      ref={containerRef}
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
      style={{
        flex: "1",
        minHeight: "0",
        overflowY: "auto",
        padding: "6px",
        fontSize: "12px",
        scrollBehavior: "smooth",
        position: "relative",
      }}
    >
      {children}
    </div>
  );
}
