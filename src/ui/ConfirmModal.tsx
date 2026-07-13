/**
 * ConfirmModal — accessible confirmation dialog.
 *
 * Replaces native window.confirm() with a consistent modal that matches
 * the app's design system. Supports optional custom labels and a "don't
 * show again" experience.
 */

import { useEffect, useRef } from "preact/hooks";
import { t, type Locale } from "../i18n/index.js";
import { Modal } from "./Modal.js";
import { colors, fonts } from "./theme.js";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  locale?: Locale;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  locale,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus the confirm button when opened
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => confirmRef.current?.focus());
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <div style={{ marginBottom: "16px" }}>
        <p style={{
          color: colors.textSecondary,
          fontSize: "11px",
          fontFamily: fonts.mono,
          lineHeight: "1.5",
          margin: 0,
        }}>
          {message}
        </p>
      </div>
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          style={{
            padding: "6px 10px",
            border: `1px solid ${colors.border}`,
            background: "transparent",
            color: colors.textMuted,
            fontSize: "10px",
            fontFamily: fonts.mono,
            cursor: "pointer",
          }}
        >
          {cancelLabel ?? t("confirmModal.cancel", locale)}
        </button>
        <button
          ref={confirmRef}
          onClick={onConfirm}
          style={{
            padding: "6px 10px",
            border: `1px solid ${danger ? "#e8a84c" : colors.text}`,
            background: danger ? "rgba(232, 168, 76, 0.1)" : "transparent",
            color: danger ? "#e8a84c" : colors.text,
            fontSize: "10px",
            fontFamily: fonts.mono,
            cursor: "pointer",
          }}
        >
          {confirmLabel ?? t("confirmModal.confirm", locale)}
        </button>
      </div>
    </Modal>
  );
}
