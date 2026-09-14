import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Modal } from '../../ui/Modal/Modal';
import { getWorkOrders } from '@/api/resources/workOrders';
import { useQuery } from '@tanstack/react-query';
import { getActivePaymentMethods } from '@/api/resources/paymentMethods';
import type { PaymentMethod } from '../../../types/paymentMethod';
import { formatCurrency } from '../../../utils/formatters';
import { folderStatusClass } from '../../../constants';
import styles from './IncomeModal.module.css';

const s = styles as unknown as Record<string, string>;

const PAYMENT_METHODS_REF_KEY = ['payment-methods', 'reference'] as const;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: Record<string, unknown>) => Promise<void>;
}

export default function IncomeModal({ isOpen, onClose, onSubmit }: Props) {
  const [incomeForm, setIncomeForm] = useState<Record<string, unknown>>({
    amount: '', paymentMethod: 'EFECTIVO', folderStatus: 'MEASUREMENT',
    orderNumber: '', clientName: '', order_id: null, order_total: null,
  });
  const [orderSearch, setOrderSearch] = useState<string>('');
  const [orderResults, setOrderResults] = useState<Record<string, unknown>[]>([]);
  const [showOrderSearch, setShowOrderSearch] = useState<boolean>(false);

  const { data: paymentMethods = [] } = useQuery<PaymentMethod[]>({
    queryKey: [...PAYMENT_METHODS_REF_KEY],
    queryFn: () => getActivePaymentMethods(),
    staleTime: 5 * 60 * 1000,
  });
  const paymentMethodOptions = paymentMethods.map((pm) => pm.label || pm.name);

  const searchOrders = async (q: string) => {
    setOrderSearch(q);
    if (q.length < 2) { setOrderResults([]); return; }
    try {
      const res = await getWorkOrders({ search: q, limit: 10 });
      setOrderResults((res.data as Record<string, unknown>[]) || []);
    } catch { setOrderResults([]); }
  };

  const selectOrder = (orden: Record<string, unknown>) => {
    setIncomeForm({
      ...incomeForm,
      order_id: orden.id as number,
      orderNumber: orden.number as string,
      clientName: (orden.client_name as string) || '',
      amount: (orden.total as number) || '',
      folderStatus: (orden.status as string) ? (orden.status as string) : '',
      order_total: (orden.total as number) || null,
    });
    setShowOrderSearch(false);
    setOrderSearch('');
    setOrderResults([]);
  };

  const mapFolderStatus = (estado: string): string => {
    const map: Record<string, string> = {
      'MEASUREMENT': 'MEASUREMENT',
      'WORKSHOP': 'WORKSHOP',
      'FINISHED': 'FINISHED',
      'DELIVERED': 'DELIVERED',
    };
    return map[estado] || estado;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!incomeForm.amount || Number(incomeForm.amount) <= 0) return;
    await onSubmit({
      type: 'INCOME',
      amount: Number(incomeForm.amount),
      description: incomeForm.orderNumber
        ? `Pago ${incomeForm.orderNumber} - ${incomeForm.clientName}`
        : `Ingreso manual - ${(incomeForm.clientName as string) || ''}`,
      payment_method: incomeForm.paymentMethod,
      folder_status: mapFolderStatus(incomeForm.folderStatus as string),
      order_id: incomeForm.order_id,
      order_number: incomeForm.orderNumber,
      order_total: incomeForm.order_total,
      client_name: incomeForm.clientName,
    });
  };

  const resetForm = () => {
    setIncomeForm({ amount: '', paymentMethod: 'EFECTIVO', folderStatus: 'MEASUREMENT', orderNumber: '', clientName: '', order_id: null, order_total: null });
    setOrderSearch('');
    setOrderResults([]);
    setShowOrderSearch(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title="Agregar Ingreso" width="550px">
      <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Vincular a Orden (opcional)</label>
            <div className={s['income-modal__search-row']}>
              <div className={s['income-modal__search-inputs']}>
                <input
                  className={`input ${s['income-modal__search-input']}`} placeholder="Buscar orden por número o cliente..."
                  value={orderSearch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => searchOrders(e.target.value)}
                  onFocus={() => setShowOrderSearch(true)}
                />
                <Search size={16} className={s['income-modal__search-icon']} />
                <button type="button" className="btn btn-outline" onClick={() => { setShowOrderSearch(false); setOrderSearch(''); setOrderResults([]); }}>Limpiar</button>
              </div>
              {showOrderSearch && orderResults.length > 0 && (
                <div className={s['income-modal__dropdown']}>
                  {orderResults.map((o: Record<string, unknown>) => (
                    <div key={o.id as number} className={s['income-modal__dropdown-item']}
                      onClick={() => selectOrder(o)}>
                      <strong className={s['income-modal__dropdown-item-number']}>{(o.number as string)}</strong> — {(o.client_name as string) || 'Sin cliente'}
                      <span className={s['income-modal__dropdown-item-total']}>{formatCurrency(o.total as number)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!incomeForm.orderNumber && (
              <small className={s['income-modal__optional-hint']}>
                Dejalo vacío para registrar un ingreso general (ej. accesorio, canilla…).
              </small>
            )}
          </div>

        {!!incomeForm.orderNumber && (
          <div className={s['income-modal__selected']}>
            Orden seleccionada: <strong>{incomeForm.orderNumber as string}</strong>
            {!!incomeForm.clientName && ` — ${incomeForm.clientName as string}`}
            {!!incomeForm.order_total && (
              <div className={s['income-modal__selected-total']}>
                Total original: <strong>{formatCurrency(incomeForm.order_total as number)}</strong>
                {' | '}Saldo restante estimado:{' '}
                <strong className={s['income-modal__selected-balance']}>
                  {formatCurrency(
                    Math.max(0, Number(incomeForm.order_total) - Number((incomeForm.amount as string) || 0))
                  )}
                </strong>
              </div>
            )}
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label>Cliente</label>
            <input className="input" value={incomeForm.clientName as string}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIncomeForm({ ...incomeForm, clientName: e.target.value })} />
          </div>
          <div className="form-group">
            <label>{incomeForm.orderNumber ? 'Monto (Seña) *' : 'Monto *'}</label>
            <input className="input" type="number" step="0.01" min="0" required
              placeholder={incomeForm.orderNumber ? 'Monto real que paga el cliente' : 'Monto del ingreso'}
              value={incomeForm.amount as string}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIncomeForm({ ...incomeForm, amount: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Forma de Pago</label>
            <select className="input" value={incomeForm.paymentMethod as string}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setIncomeForm({ ...incomeForm, paymentMethod: e.target.value })}>
              {paymentMethodOptions.map((label) => <option key={label} value={label}>{label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Estado Carpeta</label>
            {incomeForm.folderStatus ? (
              <div className={s['income-modal__folder-status']}>
                <span className={`badge ${folderStatusClass(incomeForm.folderStatus as string)}`}>
                  {incomeForm.folderStatus as string}
                </span>
                <span className={s['income-modal__folder-label']}>(asignado automático)</span>
              </div>
            ) : (
              <div className={s['income-modal__folder-empty']}>
                Sin orden vinculada
              </div>
            )}
          </div>
        </div>
        <div className={s['income-modal__footer']}>
          <button type="button" className="btn btn-outline" onClick={() => { resetForm(); onClose(); }}>Cancelar</button>
          <button type="submit" className="btn btn-success">Registrar Ingreso</button>
        </div>
      </form>
    </Modal>
  );
}
