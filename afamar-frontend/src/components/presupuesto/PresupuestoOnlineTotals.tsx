import React from 'react';

interface Props {
  totalArs: number;
  totalUsd: number;
  totalConsolidado: number;
  dolarDia: number;
  hayUSD: boolean;
}

export default function PresupuestoOnlineTotals({ totalArs, totalUsd, totalConsolidado, dolarDia, hayUSD }: Props) {
  return (
    <div className="card" style={{ marginBottom: 16 } as React.CSSProperties}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, alignItems: 'center', flexWrap: 'wrap' } as React.CSSProperties}>
        <div style={{ textAlign: 'right' } as React.CSSProperties}>
          <div style={{ fontSize: 13, color: '#64748b' } as React.CSSProperties}>TOTAL NETO ARS</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' } as React.CSSProperties}>$ {totalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
        </div>
        {hayUSD && (
          <div style={{ textAlign: 'right' } as React.CSSProperties}>
            <div style={{ fontSize: 13, color: '#64748b' } as React.CSSProperties}>TOTAL NETO USD</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#059669' } as React.CSSProperties}>USD {totalUsd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
          </div>
        )}
        <div style={{ textAlign: 'right', background: '#dc2626', color: 'white', padding: '10px 24px', borderRadius: 8 } as React.CSSProperties}>
          <div style={{ fontSize: 12, fontWeight: 600 } as React.CSSProperties}>TOTAL CONSOLIDADO</div>
          {hayUSD && (<div style={{ fontSize: 14, fontWeight: 400, opacity: 0.8 } as React.CSSProperties}>{`(ARS + USD x $${Number(dolarDia).toLocaleString('es-AR')})`}</div>)}
          <div style={{ fontSize: 22, fontWeight: 800 } as React.CSSProperties}>$ {totalConsolidado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>
    </div>
  );
}
