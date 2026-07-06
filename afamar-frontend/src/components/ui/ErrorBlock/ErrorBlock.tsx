import styles from "./ErrorBlock.module.css";

interface ErrorBlockProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorBlock({ message, onRetry, retryLabel = "Reintentar" }: ErrorBlockProps) {
  return (
    <div className={styles.errorBlock}>
      <p className={styles.errorBlock__message}>{message}</p>
      {onRetry && (
        <button type="button" className={styles.errorBlock__retry} onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}
