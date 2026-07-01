import styles from "./TableActions.module.css";

interface TableActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  children?: React.ReactNode;
}

export function TableActions({ onEdit, onDelete, children }: TableActionsProps) {
  return (
    <td className={styles.actions}>
      {children}
      {onEdit && (
        <button type="button" className={styles.actions__btn} onClick={onEdit}>
          Editar
        </button>
      )}
      {onDelete && (
        <button type="button" className={`${styles.actions__btn} ${styles["actions__btn--danger"]}`} onClick={onDelete}>
          Eliminar
        </button>
      )}
    </td>
  );
}
