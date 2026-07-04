import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  message: string;
  children?: ReactNode;
}

export function EmptyState({ message, children }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyState__message}>{message}</p>
      {children}
    </div>
  );
}
