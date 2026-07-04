import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2, ChevronRight, ChevronLeft, FileDown } from 'lucide-react';
import { getWorkOrders, deleteWorkOrder, updateWorkOrder, getWorkOrderPdf, mapWorkOrderStatusToApi } from '@/api/resources/workOrders';
import { useList, useDelete } from '../../api/hooks';
import { formatDate, orderStatuses } from '../../utils/formatters';
import CurrencyDisplay from '../../components/ui/CurrencyDisplay';
import { StatusBadge } from '../../components/ui/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loading from '../../components/common/Loading';
import styles from './WorkOrdersListPage.module.css';

const s = styles as unknown as Record<string, string>;

const WORK_ORDERS_KEY = ['work-orders'] as const;

export default function WorkOrdersList() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState<string>(searchParams.get('search') || '');
  const [estado, setEstado] = useState<string>(searchParams.get('estado') || '');
  const [deleteId, setDeleteId] = useState<number | string | null>(null);

  useEffect(() => {
    setSearch(searchParams.get('search') || '');
    setEstado(searchParams.get('estado') || '');
  }, [searchParams]);

  const { items: data, loading, load } = useList<Record<string, unknown>>(
    [...WORK_ORDERS_KEY, search, estado],
    async () => {
      const res = await getWorkOrders({ search: search || undefined, estado: estado || undefined });
      return (res.data as Record<string, unknown>[]) || [];
    }
  );

  const deleteMutation = useDelete<unknown, number | string>(
    WORK_ORDERS_KEY,
    async (id) => { await deleteWorkOrder(id); },
    { invalidateKeys: [WORK_ORDERS_KEY] }
  );

  const handleDelete = async () => {
    if (deleteId === null) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const avanzarEstado = async (o: Record<string, unknown>) => {
    const idx = orderStatuses.indexOf(o.status as string);
    if (idx < orderStatuses.length - 1) {
      await updateWorkOrder(o.id as string, mapWorkOrderStatusToApi(orderStatuses[idx + 1]));
      load();
    }
  };

  const retrocederEstado = async (o: Record<string, unknown>) => {
    const idx = orderStatuses.indexOf(o.status as string);
    if (idx > 0) {
      await updateWorkOrder(o.id as string, mapWorkOrderStatusToApi(orderStatuses[idx - 1]));
      load();
    }
  };

  return (
    <div className={s['workOrders']}>
      <div className={s['workOrders__header']}>
        <h1 className={s['workOrders__title']}>Ordenes de Trabajo</h1>
        <div className={s['workOrders__actions'] || ''}>
          <button className="btn btn-primary" onClick={() => navigate('/admin/work-orders/new')}>
            <Plus size={16} /> Nueva Orden
          </button>
        </div>
      </div>

      <div className={s['workOrders__filters']}>
        <div className={s['workOrders__search'] || ''}>
          <Search size={18} color="#94a3b8" />
          <input
            className="input"
            placeholder="Buscar por numero o cliente..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input"
          style={{ width: 260 }}
          value={estado}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEstado(e.target.value)}
        >
          <option value="">Activas (En Medicion / Taller)</option>
          <option value="TERMINADA">Terminadas (En Local)</option>
          <option value="ENTREGADA">Entregadas</option>
        </select>
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
                  <tr key={o.id as number} style={{ cursor: 'pointer' } as React.CSSProperties} onClick={() => navigate(`/admin/work-orders/${o.id as number}`)}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' } as React.CSSProperties}>{(o as Record<string, unknown>).number as string}</td>
                    <td>{(o as Record<string, unknown>).client_name as string || '-'}</td>
                    <td><StatusBadge status={(o as Record<string, unknown>).status as string} /></td>
                    <td style={{ fontWeight: 600 } as React.CSSProperties}><CurrencyDisplay value={(o as Record<string, unknown>).total as number} style={{ fontWeight: 600 }} /></td>
                    <td><CurrencyDisplay value={(o as Record<string, unknown>).deposit_received as number} /></td>
                    <td style={{ fontWeight: 600 } as React.CSSProperties}><CurrencyDisplay value={(o as Record<string, unknown>).balance_due as number} style={{ fontWeight: 600 }} /></td>
                    <td>{formatDate((o as Record<string, unknown>).delivery_date as string)}</td>
                    <td onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 } as React.CSSProperties}>
                        {(o as Record<string, unknown>).status as string !== orderStatuses[0] && (
                          <button className="btn btn-outline" style={{ padding: '4px 6px' } as React.CSSProperties} onClick={() => retrocederEstado(o)} title="Retroceder estado">
                            <ChevronLeft size={14} />
                          </button>
                        )}
                        {(o as Record<string, unknown>).status as string !== orderStatuses[orderStatuses.length - 1] && (
                          <button className="btn btn-outline" style={{ padding: '4px 6px' } as React.CSSProperties} onClick={() => avanzarEstado(o)} title="Avanzar estado">
                            <ChevronRight size={14} />
                          </button>
                        )}
                        <button className="btn btn-outline" style={{ padding: '4px 6px' } as React.CSSProperties}                         onClick={() => window.open(getWorkOrderPdf((o as Record<string, unknown>).id as string), '_blank')} title="Descargar PDF">
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
