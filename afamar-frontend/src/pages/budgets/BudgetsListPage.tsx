import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2, FileDown, FileOutput, Eye, Send, Mail } from 'lucide-react';
import {
  getBudgetsUnified,
  deleteBudget,
  updateBudget,
  convertBudgetToWorkOrder,
  getBudgetPdf,
  sendBudgetEmail,
  mapBudgetStatusToApi,
} from '@/api/resources/budgets';
import {
  deleteOnlineBudget,
  convertOnlineBudgetToWorkOrder,
} from '@/api/resources/onlineBudgets';
import { useList, useDelete } from '../../api/hooks';
import { formatDate } from '../../utils/formatters';
import CurrencyDisplay from '../../components/ui/CurrencyDisplay';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loading from '../../components/common/Loading';
import type { UnifiedBudget } from '../../types/budget';
import styles from './BudgetsListPage.module.css';

const s = styles as unknown as Record<string, string>;

const BUDGETS_KEY = ['budgets', 'unified'] as const;

export default function BudgetsList() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState(searchParams.get('estado') || '');
  const [deleteId, setDeleteId] = useState<string | number | null>(null);
  const [deleteTipo, setDeleteTipo] = useState<string | null>(null);

  useEffect(() => {
    const e = searchParams.get('estado') || 'PENDIENTE';
    setEstado(e);
  }, [searchParams]);

  const { items: data, loading, load } = useList<UnifiedBudget>(
    [...BUDGETS_KEY, search, estado],
    async () => {
      const res = await getBudgetsUnified({ search: search || undefined, estado: estado || undefined });
      return (res.data as UnifiedBudget[]) || [];
    }
  );

  const deleteMutation = useDelete<unknown, string | number>(
    BUDGETS_KEY,
    async (id) => {
      if (deleteTipo === 'online') await deleteOnlineBudget(id as string);
      else await deleteBudget(id as string);
    },
    { invalidateKeys: [BUDGETS_KEY] }
  );

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
    setDeleteTipo(null);
  };

  const handleCambiarEstado = async (id: string | number, nuevoEstado: string) => {
    await updateBudget(id as string, mapBudgetStatusToApi(nuevoEstado));
    load();
  };

  const handleConvertirOnline = async (id: string | number) => {
    if (!window.confirm('Convertir este presupuesto online en Orden de Trabajo? Se copiaran todos los items.')) return;
    try {
      const res = await convertOnlineBudgetToWorkOrder(id as string);
      navigate(`/admin/work-orders/${(res.data as Record<string, unknown>).orden_id as string}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      alert(error.response?.data?.detail || 'Error al convertir');
    }
  };

  const handleConvertir = async (id: string | number) => {
    if (!window.confirm('Convertir este presupuesto en Orden de Trabajo? Se copiara toda la informacion.')) return;
    try {
      const res = await convertBudgetToWorkOrder(id as string);
      navigate(`/admin/work-orders/${(res.data as Record<string, unknown>).orden_id as string}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      alert(error.response?.data?.detail || 'Error al convertir');
    }
  };

  const handleEnviarWhatsApp = (presupuesto: UnifiedBudget) => {
    const telefono = (presupuesto.clientPhone || '').replace(/[^\d]/g, '');
    const nombre = presupuesto.clientName || '';
    const pdfUrl = getBudgetPdf(presupuesto.id as unknown as string);
    const saludo = nombre ? `Hola ${nombre}! ` : '';
    const mensaje = `${saludo}Te enviamos el presupuesto formal de AFAMAR Marmoles & Granitos. Podes revisarlo e imprimirlo desde el siguiente link: ${pdfUrl}`;
    const whatsappUrl = telefono
      ? `https://api.whatsapp.com/send?phone=${telefono}&text=${encodeURIComponent(mensaje)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleEnviarEmail = async (id: string | number) => {
    try {
      await sendBudgetEmail(id as string);
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
              {data.map((p: UnifiedBudget) => (
                <tr
                  key={p.type + '-' + p.id}
                  className={s['budgets__row']}
                  onClick={() =>
                    navigate(p.type === 'online' ? `/admin/online-budgets/${p.id}` : `/admin/budgets/${p.id}`)
                  }
                >
                  <td className={s['budgets__td']}>
                    <div className={s['budgets__numero']}>{p.number}</div>
                    {p.workOrderNumber && (
                      <div className={s['budgets__numeroSub']}>{'-> '}{p.workOrderNumber}</div>
                    )}
                  </td>
                  <td className={s['budgets__td']}>
                    {formatDate((p.date || '').split('T')[0]) || '-'}
                  </td>
                  <td className={s['budgets__td']}>{p.clientName || '-'}</td>
                  <td className={s['budgets__td']}>{p.clientPhone || '-'}</td>
                  <td className={s['budgets__td'] + ' ' + s['budgets__material']}>
                    {(() => {
                      if (p.materials && p.materials.length > 0)
                        return [...new Set(p.materials.map((m: { name: string }) => m.name.trim()))].join(' - ');
                      if (p.type === 'online' && p.items?.length) {
                        const mats = p.items
                          .filter(
                            (i: { detail: string }) =>
                              i.detail &&
                              i.detail !== 'LONGITUD' &&
                              ![
                                'BASEBOARDS',
                                'CUTOUT_SINK',
                                'CUTOUT_DROPIN_SINK',
                                'BRACKETS',
                                'CUTOUT_COOKTOP',
                                'FINISHING',
                                'POOL_MOD',
                              ].includes(i.detail),
                          )
                          .map((i: { detail: string }) => i.detail.trim());
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
                    title={p.designObservations || ''}
                  >
                    {(() => {
                      const txt = p.designObservations || '';
                      return txt.length > 60 ? txt.slice(0, 60) + '...' : txt || '-';
                    })()}
                  </td>
                  <td className={s['budgets__td'] + ' ' + s['budgets__total']}>
                    <CurrencyDisplay value={p.total} />
                  </td>
                  <td className={s['budgets__td']}>
                    {p.status === 'CONVERTED_TO_OT' ? (
                      <span className={s['budgets__status'] + ' ' + s['budgets__status--done']}>
                        CONCRETADO
                      </span>
                    ) : p.type === 'online' ? (
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
                            p.type === 'online'
                              ? `/admin/online-budgets/${p.id}`
                              : `/admin/budgets/${p.id}`,
                          )
                        }
                      >
                        <Eye size={12} /> Ver
                      </button>
                      {p.type !== 'online' && p.status === 'PENDING' && (
                        <button
                          type="button"
                          className="btn btn-success"
                          style={{ padding: '3px 8px', fontSize: 11 }}
                          onClick={() => handleCambiarEstado(p.id, 'APPROVED')}
                        >
                          Aprobar
                        </button>
                      )}
                      {p.type !== 'online' && p.status === 'APPROVED' && (
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '3px 8px', fontSize: 11, background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 4 }}
                          onClick={() => handleConvertir(p.id)}
                        >
                          <FileOutput size={11} /> Convertir a OT
                        </button>
                      )}
                      {p.type === 'online' && (
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '3px 8px', fontSize: 11, background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 4 }}
                          onClick={() => handleConvertirOnline(p.id)}
                        >
                          <FileOutput size={11} /> Convertir a OT
                        </button>
                      )}
                      {p.type !== 'online' && p.status === 'CONVERTED_TO_OT' && p.workOrderNumber && (
                        <button
                          type="button"
                          className={s['budgets__ot']}
                          onClick={() => navigate(`/admin/work-orders?search=${p.workOrderNumber}`)}
                        >
                          OT {p.workOrderNumber}
                        </button>
                      )}
                      {p.type !== 'online' && ['PENDING', 'APPROVED'].includes(p.status) && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '3px 8px', fontSize: 11 }}
                          onClick={() => handleCambiarEstado(p.id, 'REJECTED')}
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
                        onClick={() => window.open(getBudgetPdf(p.id as unknown as string), '_blank')}
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
                            setDeleteTipo(p.type);
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
