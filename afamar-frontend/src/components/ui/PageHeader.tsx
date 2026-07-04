import type { ReactNode } from "react";
import styles from "./PageHeader.module.css";

interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
}

export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <h1 className={styles.header__title}>{title}</h1>
      {actions && <div className={styles.header__toolbar}>{actions}</div>}
    </header>
  );
}
