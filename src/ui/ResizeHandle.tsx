/**
 * ResizeHandle — draggable resize handle for panels.
 *
 * Supports both horizontal (ew-resize) and vertical (ns-resize) orientations.
 * Uses refs for drag state to avoid re-renders during drag.
 */

import { useCallback, useEffect, useRef } from "preact/hooks";

interface ResizeHandleProps {
  direction: "horizontal" | "vertical";
  onResize: (delta: number) => void;
}

export function ResizeHandle({ direction, onResize }: ResizeHandleProps) {
  const draggingRef = useRef(false);
  const startPosRef = useRef(0);
  const isHorizontal = direction === "horizontal";

  const onMouseDown = useCallback((e: MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    startPosRef.current = isHorizontal ? e.clientX : e.clientY;
    document.body.style.cursor = isHorizontal ? "ew-resize" : "ns-resize";
    document.body.style.userSelect = "none";
  }, [isHorizontal]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      const currentPos = isHorizontal ? e.clientX : e.clientY;
      const delta = currentPos - startPosRef.current;
      onResize(delta);
      startPosRef.current = currentPos;
    }
    function onMouseUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [onResize, isHorizontal]);

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        [isHorizontal ? "width" : "height"]: "4px",
        cursor: isHorizontal ? "ew-resize" : "ns-resize",
        background: "transparent",
        flexShrink: 0,
        position: "relative",
        zIndex: 10,
      }}
      title="Drag to resize"
    >
      <div style={{
        position: "absolute",
        ...(isHorizontal
          ? { top: "50%", left: "1px", transform: "translateY(-50%)", height: "30px", width: "2px" }
          : { left: "50%", top: "1px", transform: "translateX(-50%)", width: "30px", height: "2px" }
        ),
        background: "#222",
        borderRadius: "1px",
      }} />
    </div>
  );
}
