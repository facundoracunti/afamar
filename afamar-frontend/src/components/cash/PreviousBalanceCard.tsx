import React from 'react';
import { Wallet } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface Props {
  previousBalance: number;
  cerrada: boolean;
  editMode: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onChange: (value: number) => void;
}

export default function PreviousBalanceCard({ previousBalance, cerrada, editMode, onEdit, onCancel, onSave, onChange }: Props) {
  return (
    <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 } as React.CSSProperties}>
      <Wallet size={22} style={{ color: '#64748b' } as React.CSSProperties} />
      <span style={{ fontWeight: 600, fontSize: 15, color: '#475569' } as React.CSSProperties}>Saldo Anterior:</span>
      {editMode ? (
        <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center' } as React.CSSProperties}>
          <input
            className="input"
            type="number"
            step="0.01"
            style={{ width: 160 } as React.CSSProperties}
            value={previousBalance}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
            autoFocus
          />
          <button className="btn btn-primary" style={{ padding: '6px 14px' } as React.CSSProperties} onClick={onSave}>Guardar</button>
          <button className="btn btn-outline" style={{ padding: '6px 14px' } as React.CSSProperties} onClick={onCancel}>Cancelar</button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 } as React.CSSProperties}>
          <span style={{ fontWeight: 700, fontSize: 20, color: '#1e293b' } as React.CSSProperties}>{formatCurrency(previousBalance)}</span>
          {!cerrada && (
            <button className="btn btn-outline no-print" style={{ padding: '4px 10px', fontSize: 12 } as React.CSSProperties} onClick={onEdit}>Editar</button>
          )}
        </div>
      )}
    </div>
  );
}
