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
    if (childrenLen > childrenCountRef.current || isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
    childrenCountRef.current = childrenLen;
  }, [childrenLen]);

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
