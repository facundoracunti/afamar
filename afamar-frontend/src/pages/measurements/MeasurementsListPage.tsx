import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Trash2 } from 'lucide-react';
import { getMediciones, deleteMedicion } from '../../services/api';
import { estadosMedicion, formatDate } from '../../utils/formatters';
import EstadoBadge from '../../components/ui/EstadoBadge';
import type { Medicion } from '../../types/medicion';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loading from '../../components/common/Loading';

export default function MedicionesList() {
  const [data, setData] = useState<Medicion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const navigate = useNavigate();

  const load = (): void => {
    setLoading(true);
    getMediciones({ search: search || undefined, estado: estadoFiltro || undefined }).then((res: { data: Medicion[] }) => {
      setData(res.data);
      setLoading(false);
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [search, estadoFiltro]);

  const handleDelete = async (): Promise<void> => {
    if (!deleteId) return;
    await deleteMedicion(deleteId);
    setDeleteId(null);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Agenda de Mediciones</h1>
        <button className="btn btn-primary" onClick={() => navigate('/admin/mediciones/nuevo')}>
          <Plus size={16} /> Nueva Medición
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 250 }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' } as React.CSSProperties} />
            <input className="input" placeholder="Buscar por cliente, teléfono o dirección..." value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} style={{ paddingLeft: 40 }} />
          </div>
          <select className="input" style={{ width: 180 }} value={estadoFiltro} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEstadoFiltro(e.target.value)}>
            <option value="">Todos los estados</option>
            {estadosMedicion.map((e: string) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      </div>

      {loading ? <Loading /> : (
        <div className="card">
          <div className="table-container">
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
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-outline" style={{ padding: '4px 8px' }} onClick={() => navigate(`/admin/mediciones/${m.id}`)}>
                          <Eye size={14} />
                        </button>
                        <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => setDeleteId(m.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No hay mediciones registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Eliminar medición" message="¿Estás seguro?" />
    </div>
  );
}
