import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, Eye, Send } from 'lucide-react';
import { getOnlineBudgets, deleteOnlineBudget } from '@/api/resources/onlineBudgets';
import { useList, useDelete } from '../../api/hooks';
import { formatDate } from '../../utils/formatters';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loading from '../../components/common/Loading';
import styles from './OnlineBudgetsListPage.module.css';

const s = styles as unknown as Record<string, string>;

const ONLINE_BUDGETS_KEY = ['online-budgets'] as const;

export default function PresupuestosOnlineList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { items: data, loading } = useList<Record<string, unknown>>(
    [...ONLINE_BUDGETS_KEY, search],
    async () => {
      const res = await getOnlineBudgets({ search: search || undefined });
      return (res.data as Record<string, unknown>[]) || [];
    }
  );

  const deleteMutation = useDelete<unknown, number>(
    ONLINE_BUDGETS_KEY,
    async (id) => { await deleteOnlineBudget(id); },
    { invalidateKeys: [ONLINE_BUDGETS_KEY] }
  );

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
      await deleteMutation.mutateAsync(deleteId);
      setDeleteId(null);
    } catch (err: unknown) {
      console.error(err);
    }
  };

  return (
    <div className={s['online-budgets']}>
      <div className={s['online-budgets__header']}>
        <h1 className={s['online-budgets__title']}>PRESUPUESTOS EN LÍNEA</h1>
        <div className={s['online-budgets__actions']}>
          <button className="btn btn-outline" onClick={() => navigate('/admin/budgets')}>
            ← PRESUPUESTOS LOCAL
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/admin/online-budgets/new')}>
            <Plus size={16} /> Nuevo Presupuesto Online
          </button>
        </div>
      </div>

      <div className={s['online-budgets__filters']}>
        <div className={s['online-budgets__search']}>
          <Search size={18} className={s['online-budgets__search-icon']} />
          <input
            className="input"
            placeholder="Buscar por número o cliente..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? <Loading /> : (
        <div className={s['online-budgets__table']}>
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
                <tr
                  key={p.id as number}
                  className={s['online-budgets__row']}
                  onClick={() => navigate(`/admin/online-budgets/${p.id as number}`)}
                >
                  <td className={s['online-budgets__numero']}>{p.numero as string}</td>
                  <td>{(p.cliente as string) || '-'}</td>
                  <td>{(p.tipo_obra as string) || '-'}</td>
                  <td>{(p.fecha as string) || formatDate((p.created_at as string).split('T')[0])}</td>
                  <td className={s['online-budgets__total-ars']}>
                    $ {((p.total_neto_ars as number) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className={s['online-budgets__total-usd']}>
                    USD {((p.total_neto_usd as number) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className={s['online-budgets__total-cons']}>
                    $ {((p.total_consolidado as number) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <div className={s['online-budgets__cell-actions']}>
                      <button className="btn btn-success" title="Enviar por WhatsApp" onClick={() => enviarPorWhatsApp(p)}>
                        <Send size={14} />
                      </button>
                      <button className="btn btn-outline" onClick={() => navigate(`/admin/online-budgets/${p.id as number}`)}>
                        <Eye size={14} />
                      </button>
                      <button className="btn btn-danger" onClick={() => setDeleteId(p.id as number)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={8} className={s['online-budgets__empty']}>No hay presupuestos en línea</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Eliminar" message="¿Estás seguro?" />
    </div>
  );
}
