import styles from "./LoadingSpinner.module.css";

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = "Cargando..." }: LoadingSpinnerProps) {
  return (
    <div className={styles.spinner}>
      <div className={styles.spinner__dot} />
      <p>{message}</p>
    </div>
  );
}
