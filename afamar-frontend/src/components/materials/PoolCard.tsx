// @ts-nocheck
import React from 'react';

interface PoolCardProps {
  pt: Record<string, unknown>;
  idx: number;
  piletas: Record<string, unknown>[];
  readOnly: boolean;
  updatePileta: (idx: number, field: string, value: unknown) => void;
  removePileta: (idx: number) => void;
  formPiletas: Record<string, unknown>[];
  update: (field: string, value: unknown) => void;
  num: (v: unknown) => number;
}

export default function PoolCard({ pt, idx, piletas, readOnly, updatePileta, removePileta, formPiletas, update, num }: PoolCardProps) {
  return (
    <div key={idx} style={{ marginBottom: 8, padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{pt.brand as string} - {pt.model as string}</span>
        <button type="button" onClick={() => removePileta(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16 }} disabled={readOnly}>✕</button>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div className="form-group" style={{ margin: 0, width: 70 }}>
          <label style={{ fontSize: 11 }}>Cant.</label>
          <input className="input" type="number" min="1" style={{ fontSize: 12, padding: '4px 6px' }}
            value={pt.quantity || 1} onChange={(e) => updatePileta(idx, 'quantity', num(e.target.value))} disabled={readOnly} />
        </div>
        <div className="form-group" style={{ margin: 0, flex: 1 }}>
          <label style={{ fontSize: 11 }}>Moneda</label>
          <select className="input" style={{ fontSize: 12, padding: '4px 6px' }} value={pt.currency as string} onChange={(e) => {
            const mon = e.target.value;
            const pdata = piletas.find((p: Record<string, unknown>) => p.id === Number(pt.pool_id));
            const precio = pdata ? (mon === 'USD' ? (pdata.price_usd as number || 0) : (pdata.price as number || 0)) : (pt.price as number);
            const list = [...formPiletas];
            list[idx] = { ...list[idx], currency: mon as 'ARS' | 'USD', price: precio };
            update('pools_data', list);
          }} disabled={readOnly}>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div className="form-group" style={{ margin: 0, flex: 2 }}>
          <label style={{ fontSize: 11 }}>Precio</label>
          <input className="input" type="number" step="0.01" style={{ fontSize: 12, padding: '4px 6px' }}
            value={pt.price || ''} onChange={(e) => updatePileta(idx, 'price', num(e.target.value))} disabled={readOnly} />
        </div>
      </div>
    </div>
  );
}
