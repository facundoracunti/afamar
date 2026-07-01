import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2, FileDown, FileOutput, Eye, Send, Mail } from 'lucide-react';
import {
  getPresupuestosUnificados,
  deletePresupuesto,
  deletePresupuestoOnline,
  updatePresupuesto,
  convertirAOrden,
  convertirOnlineAOrden,
  getPresupuestoPdf,
  enviarPresupuestoEmail,
} from '../../services/api';
import { formatDate } from '../../utils/formatters';
import CurrencyDisplay from '../../components/ui/CurrencyDisplay';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loading from '../../components/common/Loading';
import type { PresupuestoUnificado } from '../../types/presupuesto';
import styles from './BudgetsListPage.module.css';

const s = styles as unknown as Record<string, string>;

export default function PresupuestosList() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PresupuestoUnificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState(searchParams.get('estado') || '');
  const [deleteId, setDeleteId] = useState<string | number | null>(null);
  const [deleteTipo, setDeleteTipo] = useState<string | null>(null);

  useEffect(() => {
    const e = searchParams.get('estado') || 'PENDIENTE';
    setEstado(e);
  }, [searchParams]);

  const load = () => {
    setLoading(true);
    getPresupuestosUnificados({ search: search || undefined, estado: estado || undefined }).then((res) => {
      setData(res.data as PresupuestoUnificado[]);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, [search, estado]);

  const handleDelete = async () => {
    if (!deleteId) return;
    if (deleteTipo === 'online') await deletePresupuestoOnline(deleteId as string);
    else await deletePresupuesto(deleteId as string);
    setDeleteId(null);
    setDeleteTipo(null);
    load();
  };

  const handleCambiarEstado = async (id: string | number, nuevoEstado: string) => {
    await updatePresupuesto(id as string, { estado: nuevoEstado } as Record<string, unknown>);
    load();
  };

  const handleConvertirOnline = async (id: string | number) => {
    if (!window.confirm('Convertir este presupuesto online en Orden de Trabajo? Se copiaran todos los items.')) return;
    try {
      const res = await convertirOnlineAOrden(id as string);
      navigate(`/admin/work-orders/${(res.data as Record<string, unknown>).orden_id as string}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      alert(error.response?.data?.detail || 'Error al convertir');
    }
  };

  const handleConvertir = async (id: string | number) => {
    if (!window.confirm('Convertir este presupuesto en Orden de Trabajo? Se copiara toda la informacion.')) return;
    try {
      const res = await convertirAOrden(id as string);
      navigate(`/admin/work-orders/${(res.data as Record<string, unknown>).orden_id as string}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      alert(error.response?.data?.detail || 'Error al convertir');
    }
  };

  const handleEnviarWhatsApp = (presupuesto: PresupuestoUnificado) => {
    const telefono = (presupuesto.cliente_telefono || '').replace(/[^\d]/g, '');
    const nombre = presupuesto.cliente_nombre || '';
    const pdfUrl = getPresupuestoPdf(presupuesto.id as unknown as string);
    const saludo = nombre ? `Hola ${nombre}! ` : '';
    const mensaje = `${saludo}Te enviamos el presupuesto formal de AFAMAR Marmoles & Granitos. Podes revisarlo e imprimirlo desde el siguiente link: ${pdfUrl}`;
    const whatsappUrl = telefono
      ? `https://api.whatsapp.com/send?phone=${telefono}&text=${encodeURIComponent(mensaje)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleEnviarEmail = async (id: string | number) => {
    try {
      await enviarPresupuestoEmail(id as string);
      alert('Email enviado correctamente');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      alert(error.response?.data?.detail || 'Error al enviar email');
    }
  };

  return (
    <div className={s['budgets']}>
      <div className={s['budgets__header']}>
        <h1 className={s['budgets__title']}>PRESUPUESTOS LOCAL / WHATSAPP</h1>
        <div className={s['budgets__actions']}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/admin/budgets/new')}
          >
            <Plus size={16} /> Nuevo Presupuesto Local
          </button>
        </div>
      </div>

      <div className={s['budgets__filters']}>
        <div className={s['budgets__search']}>
          <Search size={18} color="#94a3b8" />
          <input
            className="input"
            placeholder="Buscar por Nro / Cliente / Telefono / Material..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input"
          style={{ width: 280 }}
          value={estado}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEstado(e.target.value)}
        >
          <option value="PENDIENTE">PRESUPUESTO LOCAL / WHATSAPP</option>
          <option value="CONVERTIDO A OT">PRESUPUESTOS REALIZADOS</option>
        </select>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div className={s['budgets__table']}>
          <table>
            <thead>
              <tr>
                <th className={s['budgets__th']} style={{ width: 90 }}>
                  Numero
                </th>
                <th className={s['budgets__th']} style={{ width: 95, fontSize: 12 }}>
                  Fecha
                </th>
                <th className={s['budgets__th']} style={{ width: 160 }}>
                  Cliente
                </th>
                <th className={s['budgets__th']} style={{ width: 110 }}>
                  Telefono
                </th>
                <th className={s['budgets__th']} style={{ width: 130 }}>
                  Material
                </th>
                <th className={s['budgets__th']}>Detalles</th>
                <th className={s['budgets__th']} style={{ width: 110 }}>
                  Total
                </th>
                <th className={s['budgets__th']} style={{ width: 100 }}>
                  Estado
                </th>
                <th className={s['budgets__th']} style={{ width: 180 }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((p: PresupuestoUnificado) => (
                <tr
                  key={p.tipo + '-' + p.id}
                  className={s['budgets__row']}
                  onClick={() =>
                    navigate(p.tipo === 'online' ? `/admin/online-budgets/${p.id}` : `/admin/budgets/${p.id}`)
                  }
                >
                  <td className={s['budgets__td']}>
                    <div className={s['budgets__numero']}>{p.numero}</div>
                    {p.orden_trabajo_numero && (
                      <div className={s['budgets__numeroSub']}>-&gt; {p.orden_trabajo_numero}</div>
                    )}
                  </td>
                  <td className={s['budgets__td']}>
                    {formatDate((p.fecha || '').split('T')[0]) || '-'}
                  </td>
                  <td className={s['budgets__td']}>{p.cliente_nombre || '-'}</td>
                  <td className={s['budgets__td']}>{p.cliente_telefono || '-'}</td>
                  <td className={s['budgets__td'] + ' ' + s['budgets__material']}>
                    {(() => {
                      if (p.materiales && p.materiales.length > 0)
                        return [...new Set(p.materiales.map((m: { nombre: string }) => m.nombre.trim()))].join(' - ');
                      if (p.tipo === 'online' && p.items?.length) {
                        const mats = p.items
                          .filter(
                            (i: { detalle: string }) =>
                              i.detalle &&
                              i.detalle !== 'LONGITUD' &&
                              ![
                                'ZOCALOS',
                                'APERTURA + PEGADO PILETA',
                                'APERTURA PILETA APOYO',
                                'MENSULAS',
                                'APERTURA ANAFE',
                                'TERMINACION',
                                'PILETA MOD',
                              ].includes(i.detalle),
                          )
                          .map((i: { detalle: string }) => i.detalle.trim());
                        const zocMat = p.items
                          .filter((i: { material?: string }) => i.material)
                          .map((i: { material?: string }) => (i.material || '').trim());
                        const all = [...new Set([...mats, ...zocMat])];
                        return all.length ? all.join(' - ') : 'Online';
                      }
                      return p.material || '-';
                    })()}
                  </td>
                  <td
                    className={s['budgets__td'] + ' ' + s['budgets__details']}
                    title={p.observaciones_diseno || ''}
                  >
                    {(() => {
                      const txt = p.observaciones_diseno || '';
                      return txt.length > 60 ? txt.slice(0, 60) + '...' : txt || '-';
                    })()}
                  </td>
                  <td className={s['budgets__td'] + ' ' + s['budgets__total']}>
                    <CurrencyDisplay value={p.total} />
                  </td>
                  <td className={s['budgets__td']}>
                    {p.estado === 'CONVERTIDO A OT' ? (
                      <span className={s['budgets__status'] + ' ' + s['budgets__status--done']}>
                        CONCRETADO
                      </span>
                    ) : p.tipo === 'online' ? (
                      <span
                        className={
                          s['budgets__status'] + ' ' + s['budgets__status--pending-online']
                        }
                      >
                        PENDIENTE - ONLINE
                      </span>
                    ) : (
                      <span className={s['budgets__status'] + ' ' + s['budgets__status--pending']}>
                        PENDIENTE
                      </span>
                    )}
                  </td>
                  <td
                    className={s['budgets__td']}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <div className={s['budgets__cell-actions']}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '3px 8px', fontSize: 11 }}
                        onClick={() =>
                          navigate(
                            p.tipo === 'online'
                              ? `/admin/online-budgets/${p.id}`
                              : `/admin/budgets/${p.id}`,
                          )
                        }
                      >
                        <Eye size={12} /> Ver
                      </button>
                      {p.tipo !== 'online' && p.estado === 'PENDIENTE' && (
                        <button
                          type="button"
                          className="btn btn-success"
                          style={{ padding: '3px 8px', fontSize: 11 }}
                          onClick={() => handleCambiarEstado(p.id, 'APROBADO')}
                        >
                          Aprobar
                        </button>
                      )}
                      {p.tipo !== 'online' && p.estado === 'APROBADO' && (
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '3px 8px', fontSize: 11, background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 4 }}
                          onClick={() => handleConvertir(p.id)}
                        >
                          <FileOutput size={11} /> Convertir a OT
                        </button>
                      )}
                      {p.tipo === 'online' && (
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '3px 8px', fontSize: 11, background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 4 }}
                          onClick={() => handleConvertirOnline(p.id)}
                        >
                          <FileOutput size={11} /> Convertir a OT
                        </button>
                      )}
                      {p.tipo !== 'online' && p.estado === 'CONVERTIDO A OT' && p.orden_trabajo_numero && (
                        <button
                          type="button"
                          className={s['budgets__ot']}
                          onClick={() => navigate(`/admin/work-orders?search=${p.orden_trabajo_numero}`)}
                        >
                          OT {p.orden_trabajo_numero}
                        </button>
                      )}
                      {p.tipo !== 'online' && ['PENDIENTE', 'APROBADO'].includes(p.estado) && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '3px 8px', fontSize: 11 }}
                          onClick={() => handleCambiarEstado(p.id, 'RECHAZADO')}
                        >
                          Rechazar
                        </button>
                      )}
                    </div>
                    <div className={s['budgets__cell-actions']}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '3px 8px', fontSize: 11 }}
                        onClick={() => window.open(getPresupuestoPdf(p.id as unknown as string), '_blank')}
                      >
                        <FileDown size={12} /> PDF
                      </button>
                      <button
                        type="button"
                        className="btn btn-success"
                        style={{ padding: '3px 8px', fontSize: 11 }}
                        onClick={() => handleEnviarWhatsApp(p)}
                      >
                        <Send size={12} /> WhatsApp
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '3px 8px', fontSize: 11 }}
                        onClick={() => handleEnviarEmail(p.id)}
                      >
                        <Mail size={12} /> Email
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '3px 6px' }}
                        onClick={() => {
                          setDeleteId(p.id);
                          setDeleteTipo(p.tipo);
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={9} className={s['budgets__empty']}>
                    No hay presupuestos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar presupuesto"
        message="Estas seguro?"
      />
    </div>
  );
}
