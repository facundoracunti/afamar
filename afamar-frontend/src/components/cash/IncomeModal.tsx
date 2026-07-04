import React, { useState } from 'react';
import { Search } from 'lucide-react';
import Modal from '../../components/common/Modal';
import { getWorkOrders } from '@/api/resources/workOrders';
import { formatCurrency } from '../../utils/formatters';
import { PAYMENT_METHODS, folderStatusClass } from './cashUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: Record<string, unknown>) => Promise<void>;
}

export default function IncomeModal({ isOpen, onClose, onSubmit }: Props) {
  const [incomeForm, setIncomeForm] = useState<Record<string, unknown>>({
    amount: '', paymentMethod: 'CASH', folderStatus: 'MEASUREMENT',
    orderNumber: '', clientName: '', orden_id: null, orden_total: null,
  });
  const [orderSearch, setOrderSearch] = useState<string>('');
  const [orderResults, setOrderResults] = useState<Record<string, unknown>[]>([]);
  const [showOrderSearch, setShowOrderSearch] = useState<boolean>(false);

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
      orden_id: orden.id as number,
      orderNumber: orden.number as string,
      clientName: (orden.client_name as string) || '',
      amount: (orden.total as number) || '',
      folderStatus: (orden.status as string) ? (orden.status as string) : '',
      orden_total: (orden.total as number) || null,
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
      date: '',
      type: 'INCOME',
      amount: Number(incomeForm.amount),
      description: incomeForm.orderNumber
        ? `Pago ${incomeForm.orderNumber} - ${incomeForm.clientName}`
        : `Ingreso manual - ${(incomeForm.clientName as string) || ''}`,
      payment_method: incomeForm.paymentMethod,
      folder_status: mapFolderStatus(incomeForm.folderStatus as string),
      order_id: incomeForm.orden_id,
      order_number: incomeForm.orderNumber,
      order_total: incomeForm.orden_total,
      client_name: incomeForm.clientName,
    });
  };

  const resetForm = () => {
    setIncomeForm({ amount: '', paymentMethod: 'CASH', folderStatus: 'MEASUREMENT', orderNumber: '', clientName: '', orden_id: null, orden_total: null });
    setOrderSearch('');
    setOrderResults([]);
    setShowOrderSearch(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title="Agregar Ingreso" width="550px">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Vincular a Orden</label>
          <div style={{ position: 'relative' } as React.CSSProperties}>
            <div style={{ display: 'flex', gap: 8 } as React.CSSProperties}>
              <input
                className="input" placeholder="Buscar orden por número o cliente..."
                value={orderSearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => searchOrders(e.target.value)}
                style={{ flex: 1, paddingLeft: 36 } as React.CSSProperties}
                onFocus={() => setShowOrderSearch(true)}
              />
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' } as React.CSSProperties} />
              <button type="button" className="btn btn-outline" onClick={() => { setShowOrderSearch(false); setOrderSearch(''); setOrderResults([]); }}>Limpiar</button>
            </div>
            {showOrderSearch && orderResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto',
              } as React.CSSProperties}>
                {orderResults.map((o: Record<string, unknown>) => (
                  <div key={o.id as number} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 14 } as React.CSSProperties}
                    onClick={() => selectOrder(o)}
                    onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { (e.target as HTMLDivElement).style.background = '#f8fafc'; }}
                    onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { (e.target as HTMLDivElement).style.background = 'transparent'; }}>
                    <strong style={{ fontFamily: 'monospace' } as React.CSSProperties}>{(o.number as string)}</strong> — {(o.client_name as string) || 'Sin cliente'}
                    <span style={{ cssFloat: 'right', color: '#64748b', fontSize: 12 } as React.CSSProperties}>{formatCurrency(o.total as number)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {!!incomeForm.orderNumber && (
          <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, marginBottom: 12, fontSize: 14, color: '#166534', border: '1px solid #bbf7d0' } as React.CSSProperties}>
            Orden seleccionada: <strong>{incomeForm.orderNumber as string}</strong>
            {!!incomeForm.clientName && ` — ${incomeForm.clientName as string}`}
            {!!incomeForm.orden_total && (
              <div style={{ marginTop: 6, fontSize: 13, color: '#475569' } as React.CSSProperties}>
                Total original: <strong>{formatCurrency(incomeForm.orden_total as number)}</strong>
                {' | '}Saldo restante estimado:{' '}
                <strong style={{ color: '#dc2626' } as React.CSSProperties}>
                  {formatCurrency(
                    Math.max(0, Number(incomeForm.orden_total) - Number((incomeForm.amount as string) || 0))
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
            <label>Monto (Seña) *</label>
            <input className="input" type="number" step="0.01" min="0" required
              placeholder="Monto real que paga el cliente"
              value={incomeForm.amount as string}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIncomeForm({ ...incomeForm, amount: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Forma de Pago</label>
            <select className="input" value={incomeForm.paymentMethod as string}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setIncomeForm({ ...incomeForm, paymentMethod: e.target.value })}>
              {PAYMENT_METHODS.map((f: string) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Estado Carpeta</label>
            {incomeForm.folderStatus ? (
              <div style={{ padding: '10px 14px', background: '#f1f5f9', borderRadius: 8, fontSize: 14, color: '#475569', border: '1px solid #e2e8f0' } as React.CSSProperties}>
                <span className={`badge ${folderStatusClass(incomeForm.folderStatus as string)}`} style={{ fontSize: 13 } as React.CSSProperties}>
                  {incomeForm.folderStatus as string}
                </span>
                <span style={{ marginLeft: 8, fontSize: 12, color: '#94a3b8' } as React.CSSProperties}>(asignado automático)</span>
              </div>
            ) : (
              <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#94a3b8', border: '1px solid #e2e8f0' } as React.CSSProperties}>
                Sin orden vinculada
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 } as React.CSSProperties}>
          <button type="button" className="btn btn-outline" onClick={() => { resetForm(); onClose(); }}>Cancelar</button>
          <button type="submit" className="btn btn-success">Registrar Ingreso</button>
        </div>
      </form>
    </Modal>
  );
}
