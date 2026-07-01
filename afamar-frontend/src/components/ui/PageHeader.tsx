import { Link } from "react-router-dom";
import styles from "./PageHeader.module.css";

interface PageHeaderProps {
  title: string;
  addLink?: string;
  addLabel?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, addLink, addLabel, children }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <h1 className={styles.header__title}>{title}</h1>
      <div className={styles.header__toolbar}>
        {children}
        {addLink && (
          <Link to={addLink} className={styles.header__addBtn}>
            {addLabel || "+ Nuevo"}
          </Link>
        )}
      </div>
    </header>
  );
}
