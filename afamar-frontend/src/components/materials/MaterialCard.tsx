// @ts-nocheck
import React from 'react';

interface MaterialCardProps {
  mat: Record<string, unknown>;
  idx: number;
  readOnly: boolean;
  updateMaterial: (idx: number, field: string, value: unknown) => void;
  removeMaterial: (idx: number) => void;
  num: (v: unknown) => number;
}

export default function MaterialCard({ mat, idx, readOnly, updateMaterial, removeMaterial, num }: MaterialCardProps) {
  const m2 = Number(mat.length || 0) * Number(mat.width || 0) * (mat.quantity || 1);
  const subtotal = m2 * (mat.currency === 'USD' ? (mat.priceM2Usd || 0) : (mat.priceM2 || 0));
  return (
    <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', color: '#1a202c' }}>{mat.name as string}</span>
          <span style={{ marginLeft: 8, fontSize: 12, color: '#718096', background: '#edf2f7', padding: '2px 8px', borderRadius: 4 }}>{mat.category as string}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: '#4a5568', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={mat.isAlternative as boolean || false}
              onChange={(e) => updateMaterial(idx, 'isAlternative', e.target.checked)}
              disabled={readOnly} style={{ width: 14, height: 14 }} />
            <span>Alternativa</span>
          </label>
          <button type="button" onClick={() => removeMaterial(idx)} style={{ color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }} disabled={readOnly}>✕</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: '#4a5568', display: 'block', marginBottom: 2 }}>Cant.</label>
          <input className="input" type="number" min="1" style={{ width: '100%', padding: '5px 6px', fontSize: 12 }}
            value={mat.quantity || 1} onChange={(e) => updateMaterial(idx, 'quantity', num(e.target.value))} disabled={readOnly} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#4a5568', display: 'block', marginBottom: 2 }}>Largo (mts)</label>
          <input className="input" type="number" step="0.01" style={{ width: '100%', padding: '5px 6px', fontSize: 12 }}
            value={mat.length || ''} onChange={(e) => updateMaterial(idx, 'length', num(e.target.value))} disabled={readOnly} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#4a5568', display: 'block', marginBottom: 2 }}>Ancho (mts)</label>
          <input className="input" type="number" step="0.01" style={{ width: '100%', padding: '5px 6px', fontSize: 12 }}
            value={mat.width || ''} onChange={(e) => updateMaterial(idx, 'width', num(e.target.value))} disabled={readOnly} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#4a5568', display: 'block', marginBottom: 2 }}>Precio M²</label>
          <div style={{ fontSize: 13, fontWeight: 700, color: mat.currency === 'USD' ? '#059669' : '#1e293b', padding: '5px 6px' }}>
            {mat.currency === 'USD' ? `USD ${(mat.priceM2Usd || 0).toLocaleString('es-AR')}` : `$ ${(mat.priceM2 || 0).toLocaleString('es-AR')}`}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f7fafc', padding: 10, borderRadius: 6 }}>
        <div style={{ fontSize: 13, color: '#4a5568' }}>
          <span>Rendimiento: <strong style={{ color: '#2b6cb0' }}>{m2.toFixed(3)} m²</strong></span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#2f855a' }}>
          Subtotal: {mat.currency === 'USD' ? `USD ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : `$ ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
        </div>
      </div>
    </div>
  );
}
