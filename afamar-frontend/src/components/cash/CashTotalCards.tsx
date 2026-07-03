import React from 'react';
import { Banknote } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface Props {
  suma: number;
  totalSalidas: number;
  saldoActualNum: number;
  efectivoReal: number;
}

export default function CashTotalCards({ suma, totalSalidas, saldoActualNum, efectivoReal }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 } as React.CSSProperties}>
      <div className="card" style={{ textAlign: 'center' } as React.CSSProperties}>
        <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' } as React.CSSProperties}>Suma</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' } as React.CSSProperties}>{formatCurrency(suma)}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 } as React.CSSProperties}>Saldo Ant. + Ingresos</div>
      </div>
      <div className="card" style={{ textAlign: 'center' } as React.CSSProperties}>
        <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' } as React.CSSProperties}>Total Salidas</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' } as React.CSSProperties}>{formatCurrency(totalSalidas)}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 } as React.CSSProperties}>Suma de egresos del día</div>
      </div>
      <div className="card" style={{ textAlign: 'center' } as React.CSSProperties}>
        <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' } as React.CSSProperties}>Saldo Actual</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1e40af' } as React.CSSProperties}>{formatCurrency(saldoActualNum)}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 } as React.CSSProperties}>Suma - Salidas</div>
      </div>
      <div className="card" style={{ textAlign: 'center', border: '2px solid #16a34a', background: '#f0fdf4' } as React.CSSProperties}>
        <div style={{ fontSize: 13, color: '#166534', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 } as React.CSSProperties}>
          <Banknote size={16} /> Caja del Día
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#16a34a' } as React.CSSProperties}>{formatCurrency(efectivoReal)}</div>
        <div style={{ fontSize: 11, color: '#166534', marginTop: 4, opacity: 0.7 } as React.CSSProperties}>
          Efectivo real en cajón (excluye TB)
        </div>
      </div>
    </div>
  );
}
