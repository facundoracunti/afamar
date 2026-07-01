import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2, ChevronRight, ChevronLeft, FileDown } from 'lucide-react';
import { getOrdenes, deleteOrden, updateOrden, getOrdenPdf } from '../../services/api';
import { formatDate, estadosOrden } from '../../utils/formatters';
import CurrencyDisplay from '../../components/ui/CurrencyDisplay';
import EstadoBadge from '../../components/ui/EstadoBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loading from '../../components/common/Loading';

export default function OrdenesList() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState<string>(searchParams.get('search') || '');
  const [estado, setEstado] = useState<string>(searchParams.get('estado') || '');
  const [deleteId, setDeleteId] = useState<number | string | null>(null);

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
    if (deleteId === null) return;
    await deleteOrden(deleteId);
    setDeleteId(null);
    load();
  };

  const avanzarEstado = async (o: Record<string, unknown>) => {
    const idx = estadosOrden.indexOf(o.estado as string);
    if (idx < estadosOrden.length - 1) {
      await updateOrden(o.id as string, { estado: estadosOrden[idx + 1] });
      load();
    }
  };

  const retrocederEstado = async (o: Record<string, unknown>) => {
    const idx = estadosOrden.indexOf(o.estado as string);
    if (idx > 0) {
      await updateOrden(o.id as string, { estado: estadosOrden[idx - 1] });
      load();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 } as React.CSSProperties}>
        <h1 style={{ fontSize: 24, fontWeight: 700 } as React.CSSProperties}>Órdenes de Trabajo</h1>
        <button className="btn btn-primary" onClick={() => navigate('/admin/ordenes/nuevo')}>
          <Plus size={16} /> Nueva Orden
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 } as React.CSSProperties}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' } as React.CSSProperties}>
          <div style={{ position: 'relative', flex: 1, minWidth: 250 } as React.CSSProperties}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' } as React.CSSProperties} />
            <input className="input" placeholder="Buscar por número o cliente..." value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} style={{ paddingLeft: 40 } as React.CSSProperties} />
          </div>
          <select className="input" style={{ width: 260 } as React.CSSProperties} value={estado} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEstado(e.target.value)}>
            <option value="">Activas (En Medición / Taller)</option>
            <option value="TERMINADA">Terminadas (En Local)</option>
            <option value="ENTREGADA">Entregadas</option>
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
                  <th style={{ width: 110 } as React.CSSProperties}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map((o: Record<string, unknown>) => (
                  <tr key={o.id as number} style={{ cursor: 'pointer' } as React.CSSProperties} onClick={() => navigate(`/admin/ordenes/${o.id as number}`)}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' } as React.CSSProperties}>{(o as Record<string, unknown>).numero as string}</td>
                    <td>{(o as Record<string, unknown>).cliente_nombre as string || '-'}</td>
                    <td><EstadoBadge estado={(o as Record<string, unknown>).estado as string} /></td>
                    <td style={{ fontWeight: 600 } as React.CSSProperties}><CurrencyDisplay value={(o as Record<string, unknown>).total as number} style={{ fontWeight: 600 }} /></td>
                    <td><CurrencyDisplay value={(o as Record<string, unknown>).sena_recibida as number} /></td>
                    <td style={{ fontWeight: 600 } as React.CSSProperties}><CurrencyDisplay value={(o as Record<string, unknown>).saldo_pendiente as number} style={{ fontWeight: 600 }} /></td>
                    <td>{formatDate((o as Record<string, unknown>).fecha_entrega as string)}</td>
                    <td onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 } as React.CSSProperties}>
                        {(o as Record<string, unknown>).estado as string !== estadosOrden[0] && (
                          <button className="btn btn-outline" style={{ padding: '4px 6px' } as React.CSSProperties} onClick={() => retrocederEstado(o)} title="Retroceder estado">
                            <ChevronLeft size={14} />
                          </button>
                        )}
                        {(o as Record<string, unknown>).estado as string !== estadosOrden[estadosOrden.length - 1] && (
                          <button className="btn btn-outline" style={{ padding: '4px 6px' } as React.CSSProperties} onClick={() => avanzarEstado(o)} title="Avanzar estado">
                            <ChevronRight size={14} />
                          </button>
                        )}
                        <button className="btn btn-outline" style={{ padding: '4px 6px' } as React.CSSProperties} onClick={() => window.open(getOrdenPdf((o as Record<string, unknown>).id as string), '_blank')} title="Descargar PDF">
                          <FileDown size={14} />
                        </button>
                        <button className="btn btn-danger" style={{ padding: '4px 6px' } as React.CSSProperties} onClick={() => setDeleteId((o as Record<string, unknown>).id as number)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' } as React.CSSProperties}>No hay órdenes de trabajo</td></tr>
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
