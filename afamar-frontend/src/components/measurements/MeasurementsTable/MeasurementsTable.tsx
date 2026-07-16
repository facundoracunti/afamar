import React from 'react';
import { Eye, Trash2, ArrowUp, ArrowUpDown, ArrowDown } from 'lucide-react';
import { formatDate } from '../../../utils/formatters';
import { StatusBadge } from '../../ui/StatusBadge';
import { EmptyState } from '../../ui/EmptyState/EmptyState';
import type { Measurement } from '../../../types/measurement';
import styles from './MeasurementsTable.module.css';

const s = styles as unknown as Record<string, string>;

type SortField = 'client_name' | 'client_phone' | 'client_address' | 'scheduled_date' | 'scheduled_time' | 'status';
type SortDir = 'asc' | 'desc';

interface SortHeaderProps {
  field: SortField;
  label: string;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
  style?: React.CSSProperties;
}

function SortHeader({ field, label, currentField, currentDir, onSort, style }: SortHeaderProps) {
  const isActive = currentField === field;
  const Icon = !isActive ? ArrowUpDown : currentDir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      onClick={() => onSort(field)}
      className={s['m-table__th-sortable']}
      style={style}
      aria-sort={isActive ? (currentDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span className={s['m-table__th-label']}>{label}</span>
      <Icon size={12} className={s['m-table__sort-icon']} aria-hidden="true" />
    </th>
  );
}

interface MeasurementsTableProps {
  visibleRows: Measurement[];
  sortField: SortField;
  sortDir: SortDir;
  dateFilter: string;
  dateFilterEnabled: boolean;
  onSort: (field: SortField) => void;
  onView: (id: number) => void;
  onDelete: (id: number) => void;
}

export function MeasurementsTable({
  visibleRows,
  sortField,
  sortDir,
  dateFilter,
  dateFilterEnabled,
  onSort,
  onView,
  onDelete,
}: MeasurementsTableProps) {
  return (
    <div className={s['m-table']}>
      <table>
        <thead>
          <tr>
            <SortHeader field="client_name" label="Cliente" currentField={sortField} currentDir={sortDir} onSort={onSort} />
            <SortHeader field="client_phone" label="Teléfono" currentField={sortField} currentDir={sortDir} onSort={onSort} />
            <SortHeader field="client_address" label="Dirección" currentField={sortField} currentDir={sortDir} onSort={onSort} />
            <SortHeader field="scheduled_date" label="Fecha" currentField={sortField} currentDir={sortDir} onSort={onSort} />
            <SortHeader field="scheduled_time" label="Hora" currentField={sortField} currentDir={sortDir} onSort={onSort} />
            <SortHeader field="status" label="Estado" currentField={sortField} currentDir={sortDir} onSort={onSort} />
            <th style={{ width: 100 }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((m: Measurement) => (
            <tr key={m.id}>
              <td style={{ fontWeight: 600 }}>{m.client_name}</td>
              <td>{m.client_phone || '-'}</td>
              <td>{m.client_address || '-'}</td>
              <td>{formatDate(m.scheduled_date)}</td>
              <td>{m.scheduled_time || '-'}</td>
              <td><StatusBadge status={m.status || ''} /></td>
              <td>
                <div className={s['m-table__cell-actions']}>
                  <button className="btn btn-outline" onClick={() => onView(m.id)}>
                    <Eye size={14} />
                  </button>
                  <button className="btn btn-danger" onClick={() => onDelete(m.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {visibleRows.length === 0 && (
            <tr>
              <td colSpan={7}>
                <EmptyState
                  message={
                    dateFilterEnabled
                      ? `No hay mediciones programadas para el ${formatDate(dateFilter)}.`
                      : 'No hay mediciones registradas.'
                  }
                />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
