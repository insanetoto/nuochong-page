"use client";

import { useI18n } from "../_lib/i18n";
import { Modal } from "./Modal";

export function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel,
  cancelLabel,
  danger = false,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}) {
  const { t } = useI18n();

  return (
    <Modal
      title={title}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <button
            type="button"
            className="bs-btn bs-btn-ghost"
            onClick={onCancel}
          >
            {cancelLabel ?? t.common.cancel}
          </button>
          <button
            type="button"
            className={`bs-btn ${danger ? "bs-btn-danger" : "bs-btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel ?? t.common.confirm}
          </button>
        </>
      }
    >
      <p className="bs-confirm-message">{message}</p>
    </Modal>
  );
}
