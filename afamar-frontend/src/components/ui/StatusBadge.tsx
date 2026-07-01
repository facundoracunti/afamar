import { t } from "@/utils/translate";
import styles from "./StatusBadge.module.css";

interface StatusBadgeProps {
  status: string;
  labels?: Record<string, string>;
}

export function StatusBadge({ status, labels }: StatusBadgeProps) {
  const label = labels ? (labels[status] || status) : t(status);
  return <span className={`${styles.badge} ${styles[`badge--${status}`] || ""}`}>{label}</span>;
}
