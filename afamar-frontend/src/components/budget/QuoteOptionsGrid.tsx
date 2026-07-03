import React from 'react';

interface Alternativa {
  name: string;
  category: string;
  currency: string;
  costoMaterialBase: number;
  totalFinalARS: number;
  length: number;
  width: number;
  cantidad: number;
}

interface TrabajoComun {
  concepto: string;
  total: number;
}

interface Props {
  alternativas?: Alternativa[];
  detalleTrabajosComunes?: TrabajoComun[];
  tipoCambio?: number;
  presupuestoId?: number | string;
  onConvertirAlternativa?: (idx: number) => void;
  modoUSD?: boolean;
}

// JSX-side helper because lucide icons & HTML entities are not used here.
const QuoteOptionsGrid = ({ alternativas, detalleTrabajosComunes, tipoCambio = 1000, presupuestoId, onConvertirAlternativa, modoUSD = false }: Props) => {
  const listaAlternativas: Alternativa[] = alternativas && alternativas.length > 0 ? alternativas : [
    { name: 'GRIS MARA', category: 'GRANITOS', currency: 'ARS', costoMaterialBase: 180000, totalFinalARS: 390000, length: 2.1, width: 2, cantidad: 1 },
    { name: 'TAJ MAHAL', category: 'SINTERIZADOS', currency: 'USD', costoMaterialBase: 350, totalFinalARS: 560000, length: 2.1, width: 2, cantidad: 1 }
  ];

  const listaTrabajos: TrabajoComun[] = detalleTrabajosComunes && detalleTrabajosComunes.length > 0 ? detalleTrabajosComunes : [
    { concepto: 'CUTOUT_SINK - Apertura y pegado de pileta', total: 60000 },
    { concepto: 'Pileta JOHNSON e 44', total: 150000 }
  ];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', marginTop: '24px', width: '100%' } as React.CSSProperties}>
      <h3 style={{ fontSize: '12px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' } as React.CSSProperties}>
        Opciones de Cotización Disponibles
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' } as React.CSSProperties}>
        {listaAlternativas.map((mat: Alternativa, idx: number) => {
          const esTarjetaUSD = mat.currency === 'USD';
          const t_cambio = tipoCambio || 1000;

          return (
            <div
              key={idx}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative'
              } as React.CSSProperties}
            >
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '6px',
                backgroundColor: esTarjetaUSD ? '#f59e0b' : '#3b82f6',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px'
              } as React.CSSProperties} />

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } as React.CSSProperties}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '900',
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    backgroundColor: esTarjetaUSD ? '#fef3c7' : '#dbeafe',
                    color: esTarjetaUSD ? '#b45309' : '#1d4ed8',
                    textTransform: 'uppercase'
                  } as React.CSSProperties}>
                    Alternativa {String.fromCharCode(65 + idx)}
                  </span>
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' } as React.CSSProperties}>
                    {mat.cantidad || 1} pza. ({Number(mat.length * mat.width || 1.216).toFixed(2)} m²)
                  </span>
                </div>

                <h4 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: '0 0 4px 0', textTransform: 'uppercase' } as React.CSSProperties}>
                  {mat.name}
                </h4>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '20px' } as React.CSSProperties}>
                  {mat.category}
                </div>

                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '16px' } as React.CSSProperties}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0', fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' } as React.CSSProperties}>
                    <span>Concepto</span>
                    <span>Subtotal</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' } as React.CSSProperties}>
                    <span style={{ fontSize: '13px', color: '#475569', fontWeight: '500' } as React.CSSProperties}>Costo Material base:</span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' } as React.CSSProperties}>
                      {modoUSD && tipoCambio > 0
                        ? `USD $${Number(esTarjetaUSD ? mat.costoMaterialBase : mat.costoMaterialBase / tipoCambio).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : esTarjetaUSD
                          ? `USD $${Number(mat.costoMaterialBase).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                          : `$ ${Number(mat.costoMaterialBase).toLocaleString('es-AR')}`
                      }
                    </span>
                  </div>

                  {listaTrabajos.map((job: TrabajoComun, i: number) => {
                    const valorAdicional = esTarjetaUSD ? (job.total / t_cambio) : job.total;
                    return (
                      <div
                        key={i}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0' } as React.CSSProperties}
                      >
                        <span style={{ fontSize: '12px', color: '#64748b', maxWidth: '65%', textTransform: 'uppercase', lineHeight: '1.2' } as React.CSSProperties}>
                          {job.concepto.replace('CUTOUT_SINK - ', '')}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155', whiteSpace: 'nowrap', paddingLeft: '8px' } as React.CSSProperties}>
                          {modoUSD && tipoCambio > 0
                            ? `USD $${Number(esTarjetaUSD ? job.total / tipoCambio : job.total / tipoCambio).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : esTarjetaUSD
                              ? `USD $${Number(valorAdicional).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `$ ${Number(job.total).toLocaleString('es-AR')}`
                          }
                        </span>
                      </div>
                    );
                  })}

                </div>
              </div>

              <div style={{ marginTop: '24px' } as React.CSSProperties}>
                <div style={{
                  backgroundColor: '#2563eb',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                  boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
                  color: '#ffffff'
                } as React.CSSProperties}>
                  <span style={{ display: 'block', fontSize: '9px', fontWeight: '800', color: '#bfdbfe', textTransform: 'uppercase', letterSpacing: '0.1em' } as React.CSSProperties}>
                    TOTAL PRESUPUESTO
                  </span>

                  <span style={{ display: 'block', fontSize: '24px', fontWeight: '900', letterSpacing: '-0.02em', marginTop: '2px' } as React.CSSProperties}>
                    {modoUSD && tipoCambio > 0
                      ? `USD $${Number(mat.totalFinalARS / tipoCambio).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : `$ ${Math.round(mat.totalFinalARS).toLocaleString('es-AR')}`
                    }
                  </span>

                  {modoUSD && tipoCambio > 0 ? null : esTarjetaUSD && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.2)' } as React.CSSProperties}>
                      <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: '700', color: '#eff6ff', backgroundColor: 'rgba(29, 78, 216, 0.5)', padding: '2px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' } as React.CSSProperties}>
                        {`Ref. USD $${Number(mat.totalFinalARS / t_cambio).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {presupuestoId && onConvertirAlternativa && (
                <button
                  type="button"
                  style={{
                    marginTop: 10, width: '100%', padding: '8px 12px', fontSize: 12,
                    fontWeight: 700, backgroundColor: '#059669', color: '#fff',
                    border: 'none', borderRadius: 8, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  } as React.CSSProperties}
                  onClick={() => onConvertirAlternativa(idx)}
                >
                  <span style={{ fontSize: 14, lineHeight: 1 } as React.CSSProperties}>+</span>
                  Convertir Alternativa en OT
                </button>
              )}

            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuoteOptionsGrid;
