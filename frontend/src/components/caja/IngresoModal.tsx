import React, { useState } from 'react';
import { Search } from 'lucide-react';
import Modal from '../../components/common/Modal';
import { getOrdenes } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import { FORMAS_PAGO, estadoCarpetaClass } from './cajaUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: Record<string, unknown>) => Promise<void>;
}

export default function IngresoModal({ isOpen, onClose, onSubmit }: Props) {
  const [ingresoForm, setIngresoForm] = useState<Record<string, unknown>>({
    monto: '', forma_pago: 'Efectivo', estado_carpeta: 'Medición',
    orden_numero: '', cliente_nombre: '', orden_id: null, orden_total: null,
  });
  const [ordenSearch, setOrdenSearch] = useState<string>('');
  const [ordenResults, setOrdenResults] = useState<Record<string, unknown>[]>([]);
  const [showOrdenSearch, setShowOrdenSearch] = useState<boolean>(false);

  const searchOrdenes = async (q: string) => {
    setOrdenSearch(q);
    if (q.length < 2) { setOrdenResults([]); return; }
    try {
      const res = await getOrdenes({ search: q, limit: 10 });
      setOrdenResults((res.data as Record<string, unknown>[]) || []);
    } catch { setOrdenResults([]); }
  };

  const selectOrden = (orden: Record<string, unknown>) => {
    setIngresoForm({
      ...ingresoForm,
      orden_id: orden.id as number,
      orden_numero: orden.numero as string,
      cliente_nombre: (orden.cliente_nombre as string) || '',
      monto: (orden.total as number) || '',
      estado_carpeta: (orden.estado as string) ? (orden.estado as string) : '',
      orden_total: (orden.total as number) || null,
    });
    setShowOrdenSearch(false);
    setOrdenSearch('');
    setOrdenResults([]);
  };

  const mapEstadoCarpeta = (estado: string): string => {
    const map: Record<string, string> = {
      'MEDICION': 'Medición',
      'TALLER': 'Taller',
      'TERMINADA': 'Terminada',
      'ENTREGADA': 'Entregada',
    };
    return map[estado] || estado;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ingresoForm.monto || Number(ingresoForm.monto) <= 0) return;
    await onSubmit({
      fecha: '',
      tipo: 'INGRESO',
      monto: Number(ingresoForm.monto),
      concepto: ingresoForm.orden_numero
        ? `Pago ${ingresoForm.orden_numero} - ${ingresoForm.cliente_nombre}`
        : `Ingreso manual - ${(ingresoForm.cliente_nombre as string) || ''}`,
      forma_pago: ingresoForm.forma_pago,
      estado_carpeta: mapEstadoCarpeta(ingresoForm.estado_carpeta as string),
      orden_id: ingresoForm.orden_id,
      orden_numero: ingresoForm.orden_numero,
      orden_total: ingresoForm.orden_total,
      cliente_nombre: ingresoForm.cliente_nombre,
    });
  };

  const resetForm = () => {
    setIngresoForm({ monto: '', forma_pago: 'Efectivo', estado_carpeta: 'Medición', orden_numero: '', cliente_nombre: '', orden_id: null, orden_total: null });
    setOrdenSearch('');
    setOrdenResults([]);
    setShowOrdenSearch(false);
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
                value={ordenSearch}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => searchOrdenes(e.target.value)}
                style={{ flex: 1, paddingLeft: 36 } as React.CSSProperties}
                onFocus={() => setShowOrdenSearch(true)}
              />
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' } as React.CSSProperties} />
              <button type="button" className="btn btn-outline" onClick={() => { setShowOrdenSearch(false); setOrdenSearch(''); setOrdenResults([]); }}>Limpiar</button>
            </div>
            {showOrdenSearch && ordenResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto',
              } as React.CSSProperties}>
                {ordenResults.map((o: Record<string, unknown>) => (
                  <div key={o.id as number} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 14 } as React.CSSProperties}
                    onClick={() => selectOrden(o)}
                    onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { (e.target as HTMLDivElement).style.background = '#f8fafc'; }}
                    onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { (e.target as HTMLDivElement).style.background = 'transparent'; }}>
                    <strong style={{ fontFamily: 'monospace' } as React.CSSProperties}>{(o.numero as string)}</strong> — {(o.cliente_nombre as string) || 'Sin cliente'}
                    <span style={{ cssFloat: 'right', color: '#64748b', fontSize: 12 } as React.CSSProperties}>{formatCurrency(o.total as number)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {!!ingresoForm.orden_numero && (
          <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, marginBottom: 12, fontSize: 14, color: '#166534', border: '1px solid #bbf7d0' } as React.CSSProperties}>
            Orden seleccionada: <strong>{ingresoForm.orden_numero as string}</strong>
            {!!ingresoForm.cliente_nombre && ` — ${ingresoForm.cliente_nombre as string}`}
            {!!ingresoForm.orden_total && (
              <div style={{ marginTop: 6, fontSize: 13, color: '#475569' } as React.CSSProperties}>
                Total original: <strong>{formatCurrency(ingresoForm.orden_total as number)}</strong>
                {' | '}Saldo restante estimado:{' '}
                <strong style={{ color: '#dc2626' } as React.CSSProperties}>
                  {formatCurrency(
                    Math.max(0, Number(ingresoForm.orden_total) - Number((ingresoForm.monto as string) || 0))
                  )}
                </strong>
              </div>
            )}
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label>Cliente</label>
            <input className="input" value={ingresoForm.cliente_nombre as string}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIngresoForm({ ...ingresoForm, cliente_nombre: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Monto (Seña) *</label>
            <input className="input" type="number" step="0.01" min="0" required
              placeholder="Monto real que paga el cliente"
              value={ingresoForm.monto as string}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIngresoForm({ ...ingresoForm, monto: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Forma de Pago</label>
            <select className="input" value={ingresoForm.forma_pago as string}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setIngresoForm({ ...ingresoForm, forma_pago: e.target.value })}>
              {FORMAS_PAGO.map((f: string) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Estado Carpeta</label>
            {ingresoForm.estado_carpeta ? (
              <div style={{ padding: '10px 14px', background: '#f1f5f9', borderRadius: 8, fontSize: 14, color: '#475569', border: '1px solid #e2e8f0' } as React.CSSProperties}>
                <span className={`badge ${estadoCarpetaClass(ingresoForm.estado_carpeta as string)}`} style={{ fontSize: 13 } as React.CSSProperties}>
                  {ingresoForm.estado_carpeta as string}
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
