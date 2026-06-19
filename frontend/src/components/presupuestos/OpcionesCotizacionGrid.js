import React from 'react';

const OpcionesCotizacionGrid = ({ alternativas, detalleTrabajosComunes, tipoCambio = 1000, presupuestoId, onConvertirAlternativa }) => {
  // Datos de contingencia por si las variables vienen vacías o corruptas
  const listaAlternativas = alternativas && alternativas.length > 0 ? alternativas : [
    { nombre: 'GRIS MARA', categoria: 'GRANITOS', moneda: 'ARS', costoMaterialBase: 180000, totalFinalARS: 390000, largo: 2.1, ancho: 2, cant: 1 },
    { nombre: 'TAJ MAHAL', categoria: 'SINTERIZADOS', moneda: 'USD', costoMaterialBase: 350, totalFinalARS: 560000, largo: 2.1, ancho: 2, cant: 1 }
  ];

  const listaTrabajos = detalleTrabajosComunes && detalleTrabajosComunes.length > 0 ? detalleTrabajosComunes : [
    { concepto: 'TRAFORO DE PILETA - APERTURA Y PEGADO DE PILETA', total: 60000 },
    { concepto: 'Pileta JOHNSON e 44', total: 150000 }
  ];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', marginTop: '24px', width: '100%' }}>
      <h3 style={{ fontSize: '12px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
        Opciones de Cotización Disponibles
      </h3>
      
      {/* CONTENEDOR DE DOS COLUMNAS - SEPARA LAS TARJETAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {listaAlternativas.map((mat, idx) => {
          const esTarjetaUSD = mat.moneda === 'USD';
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
              }}
            >
              {/* Barra superior de color decorativa */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '6px',
                backgroundColor: esTarjetaUSD ? '#f59e0b' : '#3b82f6',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px'
              }} />

              <div>
                {/* Encabezado interno de la alternativa */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '900',
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    backgroundColor: esTarjetaUSD ? '#fef3c7' : '#dbeafe',
                    color: esTarjetaUSD ? '#b45309' : '#1d4ed8',
                    textTransform: 'uppercase'
                  }}>
                    Alternativa {String.fromCharCode(65 + idx)}
                  </span>
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>
                    {mat.cant || 1} pza. ({Number(mat.largo * mat.ancho || 1.216).toFixed(2)} m²)
                  </span>
                </div>

                {/* Título del Material */}
                <h4 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: '0 0 4px 0', textTransform: 'uppercase' }}>
                  {mat.nombre}
                </h4>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '20px' }}>
                  {mat.categoria}
                </div>

                {/* CUADRO GRIS DE DESGLOSE (TABULADO LIMPIO) */}
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '16px' }}>
                  
                  {/* Títulos de columnas */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0', fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>
                    <span>Concepto</span>
                    <span>Subtotal</span>
                  </div>

                  {/* Fila: Costo del Material Base */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                    <span style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>Costo Material base:</span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                      {esTarjetaUSD 
                        ? `USD $${Number(mat.costoMaterialBase).toLocaleString('en-US', { minimumFractionDigits: 2 })}` 
                        : `$ ${Number(mat.costoMaterialBase).toLocaleString('es-AR')}`
                      }
                    </span>
                  </div>

                  {/* Filas: Adicionales y Piletas */}
                  {listaTrabajos.map((job, i) => {
                    const valorAdicional = esTarjetaUSD ? (job.total / t_cambio) : job.total;
                    return (
                      <div 
                        key={i} 
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0' }}
                      >
                        <span style={{ fontSize: '12px', color: '#64748b', maxWidth: '65%', textTransform: 'uppercase', lineHeight: '1.2' }}>
                          {job.concepto.replace('TRAFORO DE PILETA - ', '')}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155', whiteSpace: 'nowrap', paddingLeft: '8px' }}>
                          {esTarjetaUSD 
                            ? `USD $${Number(valorAdicional).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : `$ ${Number(job.total).toLocaleString('es-AR')}`
                          }
                        </span>
                      </div>
                    );
                  })}

                </div>
              </div>

              {/* BOTÓN AZUL PREMIUM DEL GRAN TOTAL */}
              <div style={{ marginTop: '24px' }}>
                <div style={{
                  backgroundColor: '#2563eb',
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                  boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
                  color: '#ffffff'
                }}>
                  <span style={{ display: 'block', fontSize: '9px', fontWeight: '800', color: '#bfdbfe', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    TOTAL PRESUPUESTO
                  </span>
                  
                  <span style={{ display: 'block', fontSize: '24px', fontWeight: '900', letterSpacing: '-0.02em', marginTop: '2px' }}>
                    $ {Math.round(mat.totalFinalARS).toLocaleString('es-AR')}
                  </span>

                  {esTarjetaUSD && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                      <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: '700', color: '#eff6ff', backgroundColor: 'rgba(29, 78, 216, 0.5)', padding: '2px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        Ref. USD ${Number(mat.totalFinalARS / t_cambio).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  }}
                  onClick={() => onConvertirAlternativa(idx)}
                >
                  <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
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

export default OpcionesCotizacionGrid;
