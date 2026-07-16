import React, { useState } from 'react';
import { Search, Plus, Trash2 } from 'lucide-react';
import { getPoolStock, createPool, updatePool, deletePool } from '@/api/resources/poolStock';
import http from '@/api/http';
import { useList, usePaginatedList, useDelete } from '../../api/hooks';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner/LoadingSpinner';
import { Pagination } from '../../components/ui/Pagination';
import { formatCurrencyValue } from '../../utils/formatters';
import type { Pool, PoolType } from '../../types/poolStock';
import { useNotify } from '../../context/NotificationContext';
import { PoolFormModal, type PoolFormState } from '../../components/pool-stock/PoolFormModal/PoolFormModal';
import { PoolMovementsModal } from '../../components/pool-stock/PoolMovementsModal/PoolMovementsModal';
import styles from './PoolStockPage.module.css';

const s = styles as unknown as Record<string, string>;

const POOL_STOCK_KEY = ['pool-stock'] as const;

export default function PoolStockPage() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showMov, setShowMov] = useState<Pool | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editItem, setEditItem] = useState<Pool | null>(null);
  const notify = useNotify();

  const { items: poolTypes } = useList<PoolType>(
    ['pool-types'],
    async () => {
      const res = await http.get('/references/pool-types');
      return (res.data as PoolType[]) || [];
    }
  );

  const { items: data, loading, total, page, pageSize, setPage, refetch } = usePaginatedList<Pool>(
    [...POOL_STOCK_KEY, search],
    async ({ skip, limit }) => {
      return getPoolStock({ search: search || undefined, skip, limit });
    },
    { pageSize: 10 },
  );

  const deleteMutation = useDelete<unknown, number>(
    POOL_STOCK_KEY,
    async (id) => { await deletePool(id); },
    { invalidateKeys: [POOL_STOCK_KEY] }
  );

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
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const handleOpenMov = (pileta: Pool) => {
    setShowMov(pileta);
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
                        <button className={`btn btn-danger ${s['poolStock__btn-sm']}`} onClick={() => setDeleteId(p.id)}>
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
        open={!!deleteId}
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminar pileta"
        message="¿Estás seguro?"
        confirmLabel="Eliminar"
        danger
      />

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="piletas" />
    </div>
  );
}
