"use client";

import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";
import { useI18n } from "../_lib/i18n";

export function Modal({
  title,
  onClose,
  children,
  footer,
  size = "md",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const titleId = useId();
  const { t } = useI18n();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="bs-modal-overlay">
      <button
        type="button"
        className="bs-modal-backdrop"
        aria-label={t.common.close}
        onClick={onClose}
      />
      <div
        className={`bs-modal bs-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="bs-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="bs-modal-close"
            onClick={onClose}
            aria-label={t.common.close}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="bs-modal-body">{children}</div>

        {footer ? <div className="bs-modal-actions">{footer}</div> : null}
      </div>
    </div>
  );
}
