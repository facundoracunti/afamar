import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, Eye } from 'lucide-react';
import { getPresupuestosOnline, deletePresupuestoOnline } from '../../services/api';
import { formatDate } from '../../utils/formatters';
import ConfirmDialog from '../common/ConfirmDialog';
import Loading from '../common/Loading';

export default function PresupuestosOnlineList() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const load = () => {
    setLoading(true);
    getPresupuestosOnline({ search: search || undefined }).then((res) => {
      setData(res.data);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [search]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await deletePresupuestoOnline(deleteId);
    setDeleteId(null);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>PRESUPUESTOS EN LÍNEA</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => navigate('/presupuestos')}>
            ← PRESUPUESTOS LOCAL
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/presupuestos-online/nuevo')}>
            <Plus size={16} /> Nuevo Presupuesto Online
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 250 }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input className="input" placeholder="Buscar por número o cliente..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 40 }} />
          </div>
        </div>
      </div>

      {loading ? <Loading /> : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Cliente</th>
                  <th>Tipo de Obra</th>
                  <th>Fecha</th>
                  <th>Total ARS</th>
                  <th>Total USD</th>
                  <th>Consolidado</th>
                  <th style={{ width: 80 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/presupuestos-online/${p.id}`)}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{p.numero}</td>
                    <td>{p.cliente || '-'}</td>
                    <td>{p.tipo_obra || '-'}</td>
                    <td>{p.fecha || formatDate(p.created_at)}</td>
                    <td style={{ fontWeight: 600 }}>$ {(p.total_neto_ars || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td style={{ fontWeight: 600, color: '#059669' }}>USD {(p.total_neto_usd || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td style={{ fontWeight: 700, color: '#dc2626' }}>$ {(p.total_consolidado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-outline" style={{ padding: '4px 6px' }} onClick={() => navigate(`/presupuestos-online/${p.id}`)}>
                          <Eye size={14} />
                        </button>
                        <button className="btn btn-danger" style={{ padding: '4px 6px' }} onClick={() => setDeleteId(p.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No hay presupuestos en línea</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Eliminar" message="¿Estás seguro?" />
    </div>
  );
}
