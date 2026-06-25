import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, Eye, Send } from 'lucide-react';
import { getPresupuestosOnline, deletePresupuestoOnline } from '../../services/api';
import { formatDate } from '../../utils/formatters';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loading from '../../components/common/Loading';

export default function PresupuestosOnlineList() {
  const navigate = useNavigate();
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    getPresupuestosOnline({ search: search || undefined }).then((res: { data: Record<string, unknown>[] }) => {
      setData(res.data);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [search]);

  const enviarPorWhatsApp = (p: Record<string, unknown>) => {
    const telefonoLimpio = ((p.telefono as string) || '').replace(/\D/g, '');
    if (!telefonoLimpio) { alert('El presupuesto no tiene teléfono de WhatsApp'); return; }
    const mensaje = `Hola *${p.cliente as string}*! Te pasamos la cotización de Afamar para tu obra (${(p.tipo_obra as string) || 'sin especificar'}).%0A%0A` +
                    `Podés ver el detalle interactivo y las opciones disponibles ingresando acá:%0A` +
                    `👉 https://afamar.com.ar/presupuesto-online/${p.id as number}%0A%0A` +
                    `Cualquier duda nos avisás!`;
    window.open(`https://wa.me/${telefonoLimpio}?text=${mensaje}`, '_blank');
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deletePresupuestoOnline(deleteId);
      setDeleteId(null);
      load();
    } catch (err: unknown) {
      console.error(err);
    }
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
            <input className="input" placeholder="Buscar por número o cliente..." value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} style={{ paddingLeft: 40 }} />
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
                {data.map((p: Record<string, unknown>) => (
                  <tr key={p.id as number} style={{ cursor: 'pointer' }} onClick={() => navigate(`/presupuestos-online/${p.id as number}`)}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{p.numero as string}</td>
                    <td>{(p.cliente as string) || '-'}</td>
                    <td>{(p.tipo_obra as string) || '-'}</td>
                    <td>{(p.fecha as string) || formatDate((p.created_at as string).split('T')[0])}</td>
                    <td style={{ fontWeight: 600 }}>$ {((p.total_neto_ars as number) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td style={{ fontWeight: 600, color: '#059669' }}>USD {((p.total_neto_usd as number) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td style={{ fontWeight: 700, color: '#dc2626' }}>$ {((p.total_consolidado as number) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-success" style={{ padding: '4px 6px' }} title="Enviar por WhatsApp" onClick={() => enviarPorWhatsApp(p)}>
                          <Send size={14} />
                        </button>
                        <button className="btn btn-outline" style={{ padding: '4px 6px' }} onClick={() => navigate(`/presupuestos-online/${p.id as number}`)}>
                          <Eye size={14} />
                        </button>
                        <button className="btn btn-danger" style={{ padding: '4px 6px' }} onClick={() => setDeleteId(p.id as number)}>
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
