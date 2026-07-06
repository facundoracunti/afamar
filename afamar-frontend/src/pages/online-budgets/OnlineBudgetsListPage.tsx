import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, Eye, Send } from 'lucide-react';
import { getOnlineBudgets, deleteOnlineBudget } from '@/api/resources/onlineBudgets';
import { useList, useDelete } from '../../api/hooks';
import { formatDate } from '../../utils/formatters';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { SearchInput } from '../../components/ui/SearchInput/SearchInput';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { useNotify } from '../../context/NotificationContext';
import styles from './OnlineBudgetsListPage.module.css';

const s = styles as unknown as Record<string, string>;

const ONLINE_BUDGETS_KEY = ['online-budgets'] as const;

export default function OnlineBudgetsList() {
  const navigate = useNavigate();
  const notify = useNotify();
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
    const cleanPhone = ((p.phone as string) || '').replace(/\D/g, '');
    if (!cleanPhone) { notify('El presupuesto no tiene teléfono de WhatsApp', 'error'); return; }
    const mensaje = `Hola *${(p.clientName as string) || (p.client_name as string) || '-'}*! Te pasamos la cotización de Afamar para tu obra (${(p.workType as string) || (p.work_type as string) || 'sin especificar'}).%0A%0A` +
                    `Podés ver el detalle interactivo y las opciones disponibles ingresando acá:%0A` +
                    `👉 https://afamar.com.ar/presupuesto-online/${p.id as number}%0A%0A` +
                    `Cualquier duda nos avisás!`;
    window.open(`https://wa.me/${cleanPhone}?text=${mensaje}`, '_blank');
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
      <PageHeader
        title="PRESUPUESTOS EN LÍNEA"
        actions={
          <>
            <button className="btn btn-outline" onClick={() => navigate('/admin/budgets')}>
              ← PRESUPUESTOS LOCAL
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/admin/online-budgets/new')}>
              <Plus size={16} /> Nuevo Presupuesto Online
            </button>
          </>
        }
      />

      <div className={s['online-budgets__filters']}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por número o cliente..."
          leftIcon={<Search size={18} />}
        />
      </div>

      {loading ? <LoadingSpinner /> : (
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
                  <td className={s['online-budgets__number']}>{(p.number as string) || (p.numero as string) || ''}</td>
                  <td>{(p.clientName as string) || (p.client_name as string) || '-'}</td>
                  <td>{(p.workType as string) || (p.work_type as string) || '-'}</td>
                  <td>{(p.date as string) || formatDate((p.created_at as string).split('T')[0])}</td>
                  <td className={s['online-budgets__total-ars']}>
                    $ {((p.totalNetArs as number) || (p.total_net_ars as number) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className={s['online-budgets__total-usd']}>
                    USD {((p.totalNetUsd as number) || (p.total_net_usd as number) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className={s['online-budgets__total-cons']}>
                    $ {((p.totalConsolidated as number) || (p.total_consolidated as number) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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
                <tr><td colSpan={8}><EmptyState message="No hay presupuestos en línea" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog open={!!deleteId} onCancel={() => setDeleteId(null)} onConfirm={handleDelete} title="Eliminar" message="¿Estás seguro?" confirmLabel="Eliminar" danger />
    </div>
  );
}