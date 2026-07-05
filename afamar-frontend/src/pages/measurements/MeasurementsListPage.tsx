import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Trash2 } from 'lucide-react';
import { getMeasurements, deleteMeasurement } from '@/api/resources/measurements';
import { useList, useDelete } from '../../api/hooks';
import { measurementStatuses, formatDate } from '../../utils/formatters';
import { t } from '../../utils/translate';
import { StatusBadge } from '../../components/ui/StatusBadge';
import type { Measurement } from '../../types/measurement';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput';
import { EmptyState } from '../../components/ui/EmptyState';
import styles from './MeasurementsListPage.module.css';

const s = styles as unknown as Record<string, string>;

const MEASUREMENTS_KEY = ['measurements'] as const;

export default function MeasurementsList() {
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const navigate = useNavigate();

  const { items: data, loading } = useList<Measurement>(
    [...MEASUREMENTS_KEY, search, estadoFiltro],
    async () => {
      const res = await getMeasurements({ search: search || undefined, status: estadoFiltro || undefined });
      return (res.data as Measurement[]) || [];
    }
  );

  const deleteMutation = useDelete<unknown, number>(
    MEASUREMENTS_KEY,
    async (id) => { await deleteMeasurement(id); },
    { invalidateKeys: [MEASUREMENTS_KEY] }
  );

  const handleDelete = async (): Promise<void> => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
  };

  return (
    <div className={s['measurements']}>
      <PageHeader
        title="Agenda de Mediciones"
        actions={
          <button className="btn btn-primary" onClick={() => navigate('/admin/measurements/new')}>
            <Plus size={16} /> Nueva Medición
          </button>
        }
      />

      <div className={s['measurements__filters']}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por cliente, teléfono o dirección..."
          leftIcon={<Search size={18} />}
        />
        <select
          className={`input ${s['measurements__filter']}`}
          value={estadoFiltro}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEstadoFiltro(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {measurementStatuses.map((e: string) => <option key={e} value={e}>{t(e)}</option>)}
        </select>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className={s['measurements__table']}>
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Dirección</th>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Estado</th>
                <th style={{ width: 100 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.map((m: Measurement) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.client_name}</td>
                  <td>{m.client_phone || '-'}</td>
                  <td>{m.client_address || '-'}</td>
                  <td>{formatDate(m.scheduled_date)}</td>
                  <td>{m.scheduled_time || '-'}</td>
                  <td><StatusBadge status={m.status || ''} /></td>
                  <td>
                    <div className={s['measurements__cell-actions']}>
                      <button className="btn btn-outline" onClick={() => navigate(`/admin/measurements/${m.id}`)}>
                        <Eye size={14} />
                      </button>
                      <button className="btn btn-danger" onClick={() => setDeleteId(m.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={7}><EmptyState message="No hay mediciones registradas" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog open={!!deleteId} onCancel={() => setDeleteId(null)} onConfirm={handleDelete} title="Eliminar medición" message="¿Estás seguro?" confirmLabel="Eliminar" danger />
    </div>
  );
}