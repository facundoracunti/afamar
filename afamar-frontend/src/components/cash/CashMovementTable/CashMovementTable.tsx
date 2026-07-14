import type { ReactNode } from 'react';
import { Trash2, Plus } from 'lucide-react';
import styles from './CashMovementTable.module.css';
import { EmptyState } from '../../ui/EmptyState/EmptyState';

interface CashMovementTableProps {
  title: string;
  icon: ReactNode;
  titleColor: string;
  addLabel: string;
  emptyMessage: string;
  movements: Record<string, unknown>[];
  columns: { key: string; label: string; width?: number; render: (row: Record<string, unknown>) => ReactNode }[];
  closed: boolean;
  onAdd: () => void;
  onDelete: (id: number) => void;
}

export function CashMovementTable({
  title,
  icon,
  titleColor,
  addLabel,
  emptyMessage,
  movements,
  columns,
  closed,
  onAdd,
  onDelete,
}: CashMovementTableProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title} style={{ color: titleColor }}>
          {icon} {title}
        </h3>
        <button
          type="button"
          className={`btn btn-success no-print ${styles['cash-movement__btn-add']}`}
          onClick={onAdd}
          disabled={closed}
        >
          <Plus size={14} /> {addLabel}
        </button>
      </div>
      <div className={`table-container ${styles['cash-movement__table-wrap']}`}>
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                  {c.label}
                </th>
              ))}
              <th className="no-print" style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {movements.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1}>
                  <EmptyState message={emptyMessage} />
                </td>
              </tr>
            ) : (
              movements.map((row) => (
                <tr key={row.id as number}>
                  {columns.map((c) => (
                    <td key={c.key}>{c.render(row)}</td>
                  ))}
                  <td className="no-print">
                    <button
                      type="button"
                      className={`btn ${styles['cash-movement__delete-btn']}`}
                      onClick={() => onDelete(row.id as number)}
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
