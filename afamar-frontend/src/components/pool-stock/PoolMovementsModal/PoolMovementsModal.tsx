import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PackagePlus, PackageMinus } from 'lucide-react';
import { Modal } from '../../ui/Modal/Modal';
import { getPoolMovements, createPoolMovement } from '@/api/resources/poolStock';
import type { Pool, PoolMovement } from '../../../types/poolStock';
import { t as translate } from '../../../utils/translate';
import styles from '../../../pages/pool-stock/PoolStockPage.module.css';

const s = styles as unknown as Record<string, string>;

interface PoolMovementsModalProps {
  isOpen: boolean;
  pool: Pool | null;
  onClose: () => void;
  onMovementAdded: () => void;
}

export function PoolMovementsModal({ isOpen, pool, onClose, onMovementAdded }: PoolMovementsModalProps) {
  const [movimientos, setMovimientos] = useState<PoolMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [movForm, setMovForm] = useState({ type: 'Ingreso', quantity: 1, description: '' });

  useEffect(() => {
    if (isOpen && pool) {
      setLoading(true);
      getPoolMovements(pool.id)
        .then((res) => setMovimientos(res.data))
        .finally(() => setLoading(false));
    }
  }, [isOpen, pool]);

  const handleAddMov = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pool) return;
    await createPoolMovement(pool.id, movForm);
    const res = await getPoolMovements(pool.id);
    setMovimientos(res.data);
    onMovementAdded();
    setMovForm({ type: 'Ingreso', quantity: 1, description: '' });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Movimientos - ${pool?.brand} ${pool?.model}`}
      width="600px"
    >
      <div className={s['poolStock__mov-section']}>
        <h4 className={s['poolStock__mov-title']}>Registrar Movimiento</h4>
        <form onSubmit={handleAddMov} className={s['poolStock__mov-form']}>
          <select
            className={`input ${s['poolStock__mov-type']}`}
            value={movForm.type}
            onChange={(e) => setMovForm({ ...movForm, type: e.target.value })}
          >
            <option value="Ingreso">Ingreso</option>
            <option value="Egreso">Egreso</option>
          </select>
          <input
            className={`input ${s['poolStock__mov-qty']}`}
            type="number"
            min="1"
            value={movForm.quantity}
            onChange={(e) => setMovForm({ ...movForm, quantity: Number(e.target.value) })}
          />
          <input
            className={`input ${s['poolStock__mov-desc']}`}
            placeholder="Descripción"
            value={movForm.description}
            onChange={(e) => setMovForm({ ...movForm, description: e.target.value })}
          />
          <button type="submit" className="btn btn-primary">
            {movForm.type === 'Ingreso' ? <PackagePlus size={14} /> : <PackageMinus size={14} />} Registrar
          </button>
        </form>
      </div>

      <h4 className={s['poolStock__mov-title']}>Historial</h4>
      {loading ? (
        <div className={s['poolStock__mov-empty']}>Cargando...</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Tipo</th><th>Cantidad</th><th>Descripción</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {movimientos.map((m) => {
                const typeLabel = translate(m.type);
                const isIngreso = typeLabel === 'Ingreso';
                const rawNotes = m.notes ?? m.description ?? '';
                const woMatch = rawNotes.match(/^\[WO:(\d+)\]\s*(.*)$/);
                const workOrderId = woMatch ? Number(woMatch[1]) : null;
                const displayNotes = woMatch ? woMatch[2] : rawNotes;
                return (
                  <tr key={m.id}>
                    <td>
                      <span className={`badge ${isIngreso ? 'badge-approved' : 'badge-rejected'}`}>
                        {typeLabel}
                      </span>
                    </td>
                    <td className={s['poolStock__mov-qty-cell']}>{m.quantity}</td>
                    <td>
                      {displayNotes || '-'}
                      {workOrderId ? (
                        <>
                          {' '}
                          <Link
                            to={`/admin/work-orders/${workOrderId}`}
                            className={s['poolStock__mov-ot-link']}
                            title="Ir a la orden de trabajo"
                          >
                            (ver OT)
                          </Link>
                        </>
                      ) : null}
                    </td>
                    <td>{new Date(m.created_at || '').toLocaleDateString('es-AR')}</td>
                  </tr>
                );
              })}
              {movimientos.length === 0 && (
                <tr><td colSpan={4} className={s['poolStock__mov-empty']}>Sin movimientos registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
