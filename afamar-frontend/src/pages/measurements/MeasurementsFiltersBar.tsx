/**
 * Filters bar of the measurements list page: status tabs + search + agenda
 * date filter.
 *
 * Extracted verbatim from `MeasurementsListPage.tsx`: same styles, same
 * texts, same handlers.
 */
import React from 'react';
import { Search, CalendarDays } from 'lucide-react';
import { todayLocalISO } from '../../utils/formatters';
import { t } from '../../utils/translate';
import { SearchInput } from '../../components/ui/SearchInput/SearchInput';
import styles from './MeasurementsListPage.module.css';

const s = styles as unknown as Record<string, string>;

/** Tabs reemplazan el dropdown de estados: '' muestra todos los estados. */
export type StatusTab = '' | 'PENDING' | 'DONE' | 'CANCELLED';

const STATUS_TABS: StatusTab[] = ['', 'PENDING', 'DONE', 'CANCELLED'];

interface MeasurementsFiltersBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  activeStatus: StatusTab;
  onStatusChange: (status: StatusTab) => void;
  statusCounts: Record<string, number>;
  dateFilter: string;
  onDateFilterChange: (value: string) => void;
  dateFilterEnabled: boolean;
  onDateFilterToggle: () => void;
}

export function MeasurementsFiltersBar({
  search,
  onSearchChange,
  activeStatus,
  onStatusChange,
  statusCounts,
  dateFilter,
  onDateFilterChange,
  dateFilterEnabled,
  onDateFilterToggle,
}: MeasurementsFiltersBarProps) {
  return (
    <div className={s['measurements__filters']}>
      <div className={s['measurements__tabs']} role="group" aria-label="Filtrar mediciones por estado">
        {STATUS_TABS.map((status) => {
          const count = status
            ? (statusCounts[status] || 0)
            : Object.values(statusCounts).reduce((sum, c) => sum + c, 0);
          return (
            <button
              key={status || 'ALL'}
              type="button"
              className={`${s['measurements__tab']} ${activeStatus === status ? s['measurements__tab--active'] : ''}`}
              onClick={() => onStatusChange(status)}
              aria-pressed={activeStatus === status}
            >
              {status === '' ? 'Todas' : t(status)}
              <span className={s['measurements__tab-count']}>{count}</span>
            </button>
          );
        })}
      </div>

      <SearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="Buscar por cliente, teléfono o dirección..."
        leftIcon={<Search size={18} />}
      />
      <div className={s['measurements__date-group']}>
        <CalendarDays size={16} className={s['measurements__date-icon']} aria-hidden="true" />
        <input
          type="date"
          className={`input ${s['measurements__filter']}`}
          value={dateFilter}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            onDateFilterChange(e.target.value);
          }}
          disabled={!dateFilterEnabled}
          aria-label="Fecha de la agenda"
        />
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            onDateFilterChange(todayLocalISO());
          }}
          title="Ir a hoy"
        >
          Hoy
        </button>
        <button
          type="button"
          className={`btn ${dateFilterEnabled ? 'btn-outline' : 'btn-primary'}`}
          onClick={onDateFilterToggle}
          title={dateFilterEnabled ? 'Mostrar las mediciones de cualquier fecha' : 'Filtrar por día'}
        >
          {dateFilterEnabled ? 'Limpiar fecha' : 'Filtrar por día'}
        </button>
      </div>
    </div>
  );
}
