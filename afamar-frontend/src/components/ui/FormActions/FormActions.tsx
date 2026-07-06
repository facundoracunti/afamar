import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./FormActions.module.css";

interface FormActionsProps {
  loading?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
  cancelLabel?: string;
  children?: ReactNode;
}

export function FormActions({
  loading,
  submitLabel = "Guardar",
  onCancel,
  cancelLabel = "Cancelar",
  children,
}: FormActionsProps) {
  const navigate = useNavigate();
  const handleCancel = onCancel || (() => navigate(-1));

  return (
    <div className={styles.actions}>
      {children}
      <button type="submit" className={styles.actions__submit} disabled={loading}>
        {loading ? "Guardando..." : submitLabel}
      </button>
      <button type="button" className={styles.actions__cancel} onClick={handleCancel}>
        {cancelLabel}
      </button>
    </div>
  );
}
