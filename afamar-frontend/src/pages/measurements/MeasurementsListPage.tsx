import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Trash2 } from 'lucide-react';
import { getMeasurements, deleteMeasurement } from '@/api/resources/measurements';
import { estadosMedicion, formatDate } from '../../utils/formatters';
import EstadoBadge from '../../components/ui/EstadoBadge';
import type { Medicion } from '../../types/medicion';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loading from '../../components/common/Loading';
import styles from './MeasurementsListPage.module.css';

const s = styles as unknown as Record<string, string>;

export default function MedicionesList() {
  const [data, setData] = useState<Medicion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const navigate = useNavigate();

  const load = (): void => {
    setLoading(true);
    getMeasurements({ search: search || undefined, estado: estadoFiltro || undefined }).then((res: { data: Medicion[] }) => {
      setData(res.data);
      setLoading(false);
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [search, estadoFiltro]);

  const handleDelete = async (): Promise<void> => {
    if (!deleteId) return;
    await deleteMeasurement(deleteId);
    setDeleteId(null);
    load();
  };

  return (
    <div className={s['measurements']}>
      <div className={s['measurements__header']}>
        <h1 className={s['measurements__title']}>Agenda de Mediciones</h1>
        <div className={s['measurements__actions']}>
          <button className="btn btn-primary" onClick={() => navigate('/admin/measurements/new')}>
            <Plus size={16} /> Nueva Medición
          </button>
        </div>
      </div>

      <div className={s['measurements__filters']}>
        <div className={s['measurements__search']}>
          <Search size={18} className={s['measurements__search-icon']} />
          <input
            className="input"
            placeholder="Buscar por cliente, teléfono o dirección..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={`input ${s['measurements__filter']}`}
          value={estadoFiltro}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEstadoFiltro(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {estadosMedicion.map((e: string) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {loading ? <Loading /> : (
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
              {data.map((m: Medicion) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.cliente_nombre}</td>
                  <td>{m.cliente_telefono || '-'}</td>
                  <td>{m.cliente_direccion || '-'}</td>
                  <td>{formatDate(m.fecha_programada)}</td>
                  <td>{m.hora_programada || '-'}</td>
                  <td><EstadoBadge estado={m.estado || ''} /></td>
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
                <tr><td colSpan={7} className={s['measurements__empty']}>No hay mediciones registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Eliminar medición" message="¿Estás seguro?" />
    </div>
  );
}