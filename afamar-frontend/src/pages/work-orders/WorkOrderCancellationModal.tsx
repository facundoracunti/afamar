import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/ui/Modal/Modal';
import type { WorkOrderPoolRequirement } from '../../types/poolStock';
import styles from './WorkOrderCancellationModal.module.css';

const s = styles as unknown as Record<string, string>;

interface WorkOrderCancellationModalProps {
  open: boolean;
  orderNumber: string;
  requirements: WorkOrderPoolRequirement[];
  loading: boolean;
  hasRegisteredPayments: boolean;
  onClose: () => void;
  onConfirm: (
    recoveries: Array<{ requirement_id: number; recovered_quantity: number }>,
    paymentsConfirmed: boolean,
  ) => void;
}

function poolLabel(requirement: WorkOrderPoolRequirement): string {
  try {
    const snapshot = requirement.pool_snapshot ? JSON.parse(requirement.pool_snapshot) as Record<string, unknown> : {};
    return [snapshot.brand, snapshot.model].filter(Boolean).join(' ') || requirement.pool_key;
  } catch {
    return requirement.pool_key;
  }
}

export default function WorkOrderCancellationModal({
  open,
  orderNumber,
  requirements,
  loading,
  hasRegisteredPayments,
  onClose,
  onConfirm,
}: WorkOrderCancellationModalProps) {
  const [recovered, setRecovered] = useState<Record<number, number>>({});
  const [paymentsConfirmed, setPaymentsConfirmed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPaymentsConfirmed(false);
    setRecovered(
      Object.fromEntries(
        requirements
          .filter((requirement) => requirement.allocated_quantity > 0)
          .map((requirement) => [requirement.id, 0]),
      ),
    );
  }, [open, requirements]);

  const recoveredTotal = useMemo(
    () => Object.values(recovered).reduce((sum, value) => sum + value, 0),
    [recovered],
  );

  const handleConfirm = () => {
    onConfirm(
      requirements
        .filter((requirement) => requirement.allocated_quantity > 0)
        .map((requirement) => ({
          requirement_id: requirement.id,
          recovered_quantity: recovered[requirement.id] ?? 0,
        })),
      paymentsConfirmed,
    );
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Cancelar orden de trabajo" width="680px">
      <div className={s['cancellation__content']}>
        <p className={s['cancellation__intro']}>
          Confirmá la cancelación de <strong>{orderNumber}</strong> e indicá cuántas piletas fueron recuperadas físicamente.
        </p>
        <div className={s['cancellation__notice']}>
          Las unidades no recuperadas no volverán al stock. La operación acepta recuperación cero.
        </div>
        {hasRegisteredPayments && (
          <label className={s['cancellation__payment-warning']}>
            <input
              type="checkbox"
              checked={paymentsConfirmed}
              disabled={loading}
              onChange={(event) => setPaymentsConfirmed(event.target.checked)}
            />
            <span>
              Esta OT tiene pagos registrados. Confirmo que los pagos y movimientos de caja
              permanecerán intactos y que no se generará ninguna devolución automática.
            </span>
          </label>
        )}
        <div className={s['cancellation__list']}>
          {requirements.map((requirement) => (
            <div className={s['cancellation__row']} key={requirement.id}>
              <div className={s['cancellation__pool']}>
                <strong>{poolLabel(requirement)}</strong>
                <span>Asignadas: {requirement.allocated_quantity}</span>
              </div>
              {requirement.allocated_quantity > 0 ? (
                <label className={s['cancellation__field']}>
                  Recuperadas
                  <input
                    type="number"
                    min={0}
                    max={requirement.allocated_quantity}
                    value={recovered[requirement.id] ?? 0}
                    disabled={loading}
                    onChange={(event) => {
                      const value = Math.max(0, Math.min(
                        requirement.allocated_quantity,
                        Number(event.target.value) || 0,
                      ));
                      setRecovered((current) => ({ ...current, [requirement.id]: value }));
                    }}
                  />
                </label>
              ) : (
                <span className={s['cancellation__pending']}>Sin unidades asignadas</span>
              )}
            </div>
          ))}
        </div>
        <div className={s['cancellation__summary']}>
          Volverán al stock: <strong>{recoveredTotal} unidades</strong>
        </div>
        <div className={s['cancellation__actions']}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
            Volver
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleConfirm}
            disabled={loading || (hasRegisteredPayments && !paymentsConfirmed)}
          >
            {loading ? 'CANCELANDO...' : 'Confirmar cancelación'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
