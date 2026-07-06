import { useEffect, useRef } from "react";
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
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) btnRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <h3 className={styles.dialog__title}>{title}</h3>
        <p className={styles.dialog__message}>{message}</p>
        <div className={styles.dialog__actions}>
          <button
            ref={btnRef}
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
