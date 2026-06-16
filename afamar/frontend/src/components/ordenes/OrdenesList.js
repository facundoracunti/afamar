import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2, ChevronRight, ChevronLeft, FileDown } from 'lucide-react';
import { getOrdenes, deleteOrden, updateOrden, getOrdenPdf } from '../../services/api';
import { formatCurrency, formatDate, badgeClass, estadosOrden } from '../../utils/formatters';
import ConfirmDialog from '../common/ConfirmDialog';
import Loading from '../common/Loading';

export default function OrdenesList() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [estado, setEstado] = useState(searchParams.get('estado') || '');
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
    setEstado(searchParams.get('estado') || '');
  }, [searchParams]);

  const load = () => {
    setLoading(true);
    getOrdenes({ search: search || undefined, estado: estado || undefined }).then((res) => {
      setData(res.data);
      setLoading(false);
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [search, estado]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteOrden(deleteId);
    setDeleteId(null);
    load();
  };

  const avanzarEstado = async (o) => {
    const idx = estadosOrden.indexOf(o.estado);
    if (idx < estadosOrden.length - 1) {
      await updateOrden(o.id, { estado: estadosOrden[idx + 1] });
      load();
    }
  };

  const retrocederEstado = async (o) => {
    const idx = estadosOrden.indexOf(o.estado);
    if (idx > 0) {
      await updateOrden(o.id, { estado: estadosOrden[idx - 1] });
      load();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Órdenes de Trabajo</h1>
        <button className="btn btn-primary" onClick={() => navigate('/ordenes/nuevo')}>
          <Plus size={16} /> Nueva Orden
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 250 }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input className="input" placeholder="Buscar por número o cliente..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 40 }} />
          </div>
          <select className="input" style={{ width: 220 }} value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Activas</option>
            {estadosOrden.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
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
                  <th>Estado</th>
                  <th>Total</th>
                  <th>Seña</th>
                  <th>Saldo</th>
                  <th>Fecha Entrega</th>
                  <th style={{ width: 110 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map((o) => (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/ordenes/${o.id}`)}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{o.numero}</td>
                    <td>{o.cliente_nombre || '-'}</td>
                    <td><span className={badgeClass(o.estado)}>{o.estado}</span></td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(o.total)}</td>
                    <td>{formatCurrency(o.sena_recibida)}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(o.saldo_pendiente)}</td>
                    <td>{formatDate(o.fecha_entrega)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {o.estado !== estadosOrden[0] && (
                          <button className="btn btn-outline" style={{ padding: '4px 6px' }} onClick={() => retrocederEstado(o)} title="Retroceder estado">
                            <ChevronLeft size={14} />
                          </button>
                        )}
                        {o.estado !== estadosOrden[estadosOrden.length - 1] && (
                          <button className="btn btn-outline" style={{ padding: '4px 6px' }} onClick={() => avanzarEstado(o)} title="Avanzar estado">
                            <ChevronRight size={14} />
                          </button>
                        )}
                        <button className="btn btn-outline" style={{ padding: '4px 6px' }} onClick={() => window.open(getOrdenPdf(o.id), '_blank')} title="Descargar PDF">
                          <FileDown size={14} />
                        </button>
                        <button className="btn btn-danger" style={{ padding: '4px 6px' }} onClick={() => setDeleteId(o.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No hay órdenes de trabajo</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Eliminar orden" message="¿Estás seguro?" />
    </div>
  );
}
