/**
 * Accessible Modal component — ARIA dialog with focus trapping.
 *
 * Features:
 * - `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
 * - Focus trap: Tab/Shift+Tab cycle within modal
 * - Escape key closes the modal
 * - Focus restoration: saves activeElement on open, restores on close
 * - Overlay click to close (with stopPropagation on inner content)
 */

import { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { colors, fonts } from "./theme.js";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ComponentChildren;
  /** Optional wider maxWidth (default: "380px") */
  wide?: boolean;
}

// ─── Focus trap helper ──────────────────────────────────────
function trapFocus(e: KeyboardEvent, container: HTMLElement | null) {
  if (!container || e.key !== "Tab") return;
  const focusable = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

// ─── Component ──────────────────────────────────────────────
export function Modal({ isOpen, onClose, title, children, wide }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2, 10)}`);

  // Focus management
  useEffect(() => {
    if (!isOpen) return;
    previousFocus.current = document.activeElement as HTMLElement;
    // Focus the first focusable element inside the modal
    const dialog = dialogRef.current;
    if (dialog) {
      const focusable = dialog.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      // Delay to ensure DOM is rendered
      requestAnimationFrame(() => focusable?.focus());
    }
    return () => {
      previousFocus.current?.focus();
    };
  }, [isOpen]);

  // Escape key + focus trap
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      trapFocus(e, dialogRef.current);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId.current}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.bg,
          padding: "20px",
          maxWidth: wide ? "480px" : "380px",
          width: "90%",
          border: `1px solid ${colors.border}`,
        }}
      >
        <h3
          id={titleId.current}
          style={{
            margin: "0 0 16px",
            color: colors.textSecondary,
            fontSize: "11px",
            fontFamily: fonts.mono,
            letterSpacing: "1px",
            textTransform: "uppercase",
          }}
        >
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}
