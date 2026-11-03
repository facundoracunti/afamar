import React, { useState } from 'react';
import { Search, Plus, Trash2, PackageCheck } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { assignPendingPoolRequirement, getPendingPoolRequirements, getPoolStock, createPool, updatePool, deletePool } from '@/api/resources/poolStock';
import http from '@/api/http';
import { useList } from '../../api/hooks';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { Pagination } from '../../components/ui/Pagination';
import { formatCurrencyValue } from '../../utils/formatters';
import type { PendingPoolRequirement, Pool, PoolType } from '../../types/poolStock';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { PoolFormModal, type PoolFormState } from '../../components/pool-stock/PoolFormModal/PoolFormModal';
import { PoolMovementsModal } from '../../components/pool-stock/PoolMovementsModal/PoolMovementsModal';
import { useEntityList } from '../../hooks/useEntityList';
import { POOLS_KEY } from '../../hooks/useFormReferences';
import { useNotify } from '../../context/NotificationContext';
import { parseApiError } from '../../utils/error';
import styles from './PoolStockPage.module.css';

const s = styles as unknown as Record<string, string>;

const POOL_STOCK_KEY = ['pool-stock'] as const;

export default function PoolStockPage() {
  const [showForm, setShowForm] = useState(false);
  const [showMov, setShowMov] = useState<Pool | null>(null);
  const [editItem, setEditItem] = useState<Pool | null>(null);

  const queryClient = useQueryClient();
  const notify = useNotify();
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [assignQuantities, setAssignQuantities] = useState<Record<number, number>>({});

  const pendingQuery = useQuery({
    queryKey: ['pool-stock', 'pending-requirements'],
    queryFn: async () => (await getPendingPoolRequirements()).data,
  });
  const pending = (pendingQuery.data || []) as PendingPoolRequirement[];

  const { items: poolTypes } = useList<PoolType>(
    ['pool-types'],
    async () => {
      const res = await http.get('/references/pool-types');
      return (res.data as PoolType[]) || [];
    }
  );

  const list: ReturnType<typeof useEntityList<Pool, number>> = useEntityList<Pool, number>({
    queryKey: POOL_STOCK_KEY,
    listFetcher: async ({ skip, limit }) =>
      getPoolStock({ search: list.search || undefined, skip, limit }),
    deleteFn: (id) => deletePool(id),
    pageSize: 10,
    successMessage: 'Pileta eliminada correctamente',
    errorMessage: 'Error al eliminar pileta',
  });
  const { items: data, loading, total, page, pageSize, setPage, refetch, search, setSearch, deleteId, requestDelete, cancelDelete, confirmDelete } = list;

  const handleOpenForm = (item: Pool | null = null) => {
    setEditItem(item);
    setShowForm(true);
  };

  const handleSave = async (form: PoolFormState) => {
    const payload = form as unknown as Record<string, unknown>;
    if (editItem) {
      await updatePool(editItem.id, payload);
    } else {
      await createPool(payload);
    }
    setShowForm(false);
    refetch();
    // Keep the Budget/WorkOrder form's "AGREGAR PILETA" catalogue in sync:
    // mark the pools reference stale so a new pool shows up there too.
    await queryClient.invalidateQueries({ queryKey: POOLS_KEY });
  };

  const handleOpenMov = (pileta: Pool) => {
    setShowMov(pileta);
  };

  const handleAssign = async (item: PendingPoolRequirement) => {
    if (assigningId !== null) return;
    const quantity = assignQuantities[item.requirement_id] || 0;
    if (quantity <= 0) {
      notify('Ingresá una cantidad positiva para asignar', 'error');
      return;
    }
    setAssigningId(item.requirement_id);
    try {
      const response = await assignPendingPoolRequirement(item.requirement_id, quantity);
      const assigned = Number((response.data as { assigned_quantity?: number }).assigned_quantity || 0);
      notify(
        assigned < quantity
          ? `Se asignaron ${assigned} unidades. El resto queda pendiente por falta de stock.`
          : `Se asignaron ${assigned} unidades a la OT ${item.work_order_number}`,
        'success',
      );
      setAssignQuantities((current) => ({ ...current, [item.requirement_id]: 0 }));
      await Promise.all([
        pendingQuery.refetch(),
        refetch(),
        queryClient.invalidateQueries({ queryKey: POOLS_KEY }),
      ]);
    } catch (error) {
      notify(parseApiError(error, 'No se pudo asignar la pileta'), 'error');
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className={s['poolStock']}>
      <div className={s['poolStock__header']}>
        <h1 className={s['poolStock__title']}>Stock de Piletas</h1>
        <button className="btn btn-primary" onClick={() => handleOpenForm()}>
          <Plus size={16} /> Nueva Pileta
        </button>
      </div>

      <div className={s['poolStock__toolbar']}>
        <div className={s['poolStock__search']}>
          <Search size={18} color="#94a3b8" />
          <input
            className="input"
            placeholder="Buscar por marca o modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <section className={`card ${s['poolStock__pending']}`} aria-labelledby="pending-pools-title">
        <div className={s['poolStock__pending-header']}>
          <div>
            <h2 id="pending-pools-title" className={s['poolStock__pending-title']}>Piletas pendientes de conseguir</h2>
            <p className={s['poolStock__pending-subtitle']}>
              La mercadería se asigna manualmente después de ingresar al inventario.
            </p>
          </div>
          <span className={s['poolStock__pending-count']}>{pending.length} pendientes</span>
        </div>
        {pendingQuery.isLoading ? <LoadingSpinner /> : pending.length === 0 ? (
          <p className={s['poolStock__pending-empty']}>No hay piletas pendientes.</p>
        ) : (
          <div className={s['poolStock__pending-list']}>
            {pending.map((item) => {
              const requested = assignQuantities[item.requirement_id] || 0;
              const busy = assigningId === item.requirement_id;
              return (
                <article className={s['poolStock__pending-item']} key={item.requirement_id}>
                  <div className={s['poolStock__pending-info']}>
                    <strong>{item.pool_brand} {item.pool_model}</strong>
                    <span>OT {item.work_order_number} · {item.client_name}</span>
                  </div>
                  <div className={s['poolStock__pending-metrics']}>
                    <span>Requeridas <b>{item.required_quantity}</b></span>
                    <span>Asignadas <b>{item.allocated_quantity}</b></span>
                    <span className={s['poolStock__pending-missing']}>Pendientes <b>{item.pending_quantity}</b></span>
                    <span>Disponible <b>{item.available_quantity}</b></span>
                  </div>
                  <div className={s['poolStock__pending-action']}>
                    <label>
                      Asignar
                      <input
                        aria-label={`Cantidad a asignar OT ${item.work_order_number} ${item.pool_model}`}
                        type="number"
                        min={1}
                        max={item.pending_quantity}
                        value={requested || ''}
                        disabled={busy || item.available_quantity <= 0 || !item.pool_id}
                        onChange={(event) => setAssignQuantities((current) => ({
                          ...current,
                          [item.requirement_id]: Math.max(0, Number(event.target.value) || 0),
                        }))}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => void handleAssign(item)}
                      disabled={busy || requested <= 0 || item.available_quantity <= 0 || !item.pool_id}
                    >
                      <PackageCheck size={15} /> {busy ? 'ASIGNANDO...' : 'Asignar'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {loading ? <LoadingSpinner /> : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Tipo</th>
                  <th>Material</th>
                  <th>Precio</th>
                  <th>Cantidad</th>
                  <th className={s['poolStock__th-actions']}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => {
                  const currency = p.currency || 'ARS';
                  return (
                    <tr key={p.id}>
                      <td className={s['poolStock__brand']}>{p.brand}</td>
                      <td>{p.model}</td>
                      <td><span className={`badge badge-info ${s['poolStock__type-badge']}`}>{p.pool_type_name || 'Simple'}</span></td>
                      <td>{p.material || '-'}</td>
                      <td className={`${s['poolStock__price']}${currency === 'USD' ? ' ' + s['poolStock__price--usd'] : ''}`}>
                        {formatCurrencyValue(Number(p.price || 0), { currency })}
                      </td>
                      <td>
                        <span className={`${s['poolStock__quantity']} ${p.quantity > 0 ? s['poolStock__quantity--positive'] : s['poolStock__quantity--zero']}`}>{p.quantity}</span>
                      </td>
                      <td>
                        <div className={s['poolStock__actions-cell']}>
                          <button className={`btn btn-outline ${s['poolStock__btn-sm']}`} onClick={() => handleOpenForm(p)}>Editar</button>
                          <button className={`btn btn-success ${s['poolStock__btn-sm']}`} onClick={() => handleOpenMov(p)} title="Movimientos">
                            <Plus size={14} />
                          </button>
                          <button className={`btn btn-danger ${s['poolStock__btn-sm']}`} onClick={() => requestDelete(p.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {data.length === 0 && (
                  <tr><td colSpan={7} className={s['poolStock__empty-row']}>No hay piletas en stock</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className={s['poolStock__mobile-list']}>
            {data.map((p) => {
              const currency = p.currency || 'ARS';
              return (
                <article className={s['poolStock__card']} key={p.id}>
                  <div className={s['poolStock__cardHeader']}>
                    <div>
                      <div className={s['poolStock__cardBrand']}>{p.brand}</div>
                      <div className={s['poolStock__cardModel']}>{p.model}</div>
                    </div>
                    <span className={`badge badge-info ${s['poolStock__type-badge']}`}>
                      {p.pool_type_name || 'Simple'}
                    </span>
                  </div>
                  <div className={s['poolStock__cardMaterial']}>
                    Material: {p.material || '-'}
                  </div>
                  <div className={s['poolStock__cardPrice']}>
                    <span className={s['poolStock__cardPriceLabel']}>Precio</span>
                    <strong className={s['poolStock__cardPriceValue']}>
                      {formatCurrencyValue(Number(p.price || 0), { currency })}
                    </strong>
                  </div>
                  <div className={s['poolStock__cardInventory']}>
                    <span>Disponible</span>
                    <strong
                      className={`${s['poolStock__cardQty']} ${p.quantity > 0 ? '' : s['poolStock__cardQty--out']}`}
                    >
                      {p.quantity}
                    </strong>
                  </div>
                  <div className={s['poolStock__cardActions']}>
                    <button className="btn btn-outline" onClick={() => handleOpenForm(p)}>
                      Editar
                    </button>
                    <button
                      className="btn btn-success"
                      onClick={() => handleOpenMov(p)}
                      title="Movimientos"
                    >
                      <Plus size={14} /> <span>Movimientos</span>
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => requestDelete(p.id)}
                      aria-label={`Eliminar ${p.brand} ${p.model}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              );
            })}
            {data.length === 0 && (
              <div className={s['poolStock__empty']}>No hay piletas en stock</div>
            )}
          </div>
        </div>
      )}

      <PoolFormModal
        isOpen={showForm}
        editItem={editItem}
        poolTypes={poolTypes}
        onSave={handleSave}
        onClose={() => setShowForm(false)}
      />

      <PoolMovementsModal
        isOpen={!!showMov}
        pool={showMov}
        onClose={() => setShowMov(null)}
        onMovementAdded={refetch}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
        title="Eliminar pileta"
        message="¿Estás seguro?"
        confirmLabel="Eliminar"
        danger
      />

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="piletas" />
    </div>
  );
}
