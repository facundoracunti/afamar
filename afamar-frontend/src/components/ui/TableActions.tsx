import type { ReactNode } from "react";
import styles from "./TableActions.module.css";

interface TableActionsProps {
  children: ReactNode;
}

export function TableActions({ children }: TableActionsProps) {
  return <div className={styles.actions}>{children}</div>;
}
