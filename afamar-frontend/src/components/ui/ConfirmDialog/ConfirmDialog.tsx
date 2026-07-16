import { useEffect } from "react";
import { useFocusTrap } from "../../../hooks/useFocusTrap";
import styles from "./ConfirmDialog.module.css";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Aceptar", cancelLabel = "Cancelar", danger, onConfirm, onCancel }: ConfirmDialogProps) {
  const trapRef = useFocusTrap(open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className={styles.overlay}>
      <div
        ref={trapRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <h3 id="confirm-dialog-title" className={styles.dialog__title}>{title}</h3>
        <p className={styles.dialog__message}>{message}</p>
        <div className={styles.dialog__actions}>
          <button
            className={`${styles.dialog__confirm} ${danger ? styles["dialog__confirm--danger"] : ""}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button className={styles.dialog__cancel} onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
