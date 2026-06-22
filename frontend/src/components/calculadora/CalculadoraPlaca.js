import React, { useState } from 'react';
import { Grid3x3, Trash2, Plus, RotateCcw } from 'lucide-react';

export default function CalculadoraPlaca() {
  const [piezas, setPiezas] = useState([]);
  const [nuevaPieza, setNuevaPieza] = useState({ largo: '', ancho: '', cantidad: 1 });
  const [plateW, setPlateW] = useState(3.00);
  const [plateH, setPlateH] = useState(1.80);

  const handleInputChange = (field, value) => {
    setNuevaPieza((prev) => ({ ...prev, [field]: value }));
  };

  const agregarPieza = () => {
    const largo = parseFloat(nuevaPieza.largo);
    const ancho = parseFloat(nuevaPieza.ancho);
    const cantidad = parseInt(nuevaPieza.cantidad, 10) || 1;
    if (!largo || !ancho || largo <= 0 || ancho <= 0) return;
    setPiezas((prev) => [...prev, { id: Date.now(), largo, ancho, cantidad }]);
    setNuevaPieza({ largo: '', ancho: '', cantidad: 1 });
  };

  const eliminarPieza = (id) => {
    setPiezas((prev) => prev.filter((p) => p.id !== id));
  };

  const limpiarTodo = () => {
    setPiezas([]);
    setNuevaPieza({ largo: '', ancho: '', cantidad: 1 });
  };

  const ANCHO_DISCO = 0.003;
  const totalM2 = piezas.reduce((sum, p) => sum + p.largo * p.ancho * p.cantidad, 0);
  const totalM2Bruto = piezas.reduce((sum, p) => sum + (p.largo + ANCHO_DISCO) * (p.ancho + ANCHO_DISCO) * p.cantidad, 0);
  const plateArea = plateW * plateH;

  // 2D Bin Packing (Guillotine Cut)
  const items = [];
  piezas.forEach(p => {
    for (let i = 0; i < (p.cantidad || 1); i++) {
      items.push({ w: p.largo + ANCHO_DISCO * 2, h: p.ancho + ANCHO_DISCO * 2 });
    }
  });

  let placasNecesarias = 0;
  let utilizacion = 0;
  let desperdicio = 0;

  if (items.length > 0) {
    items.sort((a, b) => (b.w * b.h) - (a.w * a.h));
    const bins = [];

    for (const piece of items) {
      let placed = false;
      for (let bi = 0; bi < bins.length && !placed; bi++) {
        const freeRects = bins[bi];
        let bestIdx = -1;
        let bestWaste = Infinity;
        let bestOrient = null;

        for (let ri = 0; ri < freeRects.length; ri++) {
          const r = freeRects[ri];
          for (const o of [{ w: piece.w, h: piece.h }, { w: piece.h, h: piece.w }]) {
            if (o.w <= r.w && o.h <= r.h && (r.w - o.w) * (r.h - o.h) < bestWaste) {
              bestWaste = (r.w - o.w) * (r.h - o.h);
              bestIdx = ri;
              bestOrient = o;
            }
          }
        }

        if (bestIdx >= 0) {
          const r = freeRects[bestIdx];
          freeRects.splice(bestIdx, 1);
          if (r.w - bestOrient.w > 0)
            freeRects.push({ x: r.x + bestOrient.w, y: r.y, w: r.w - bestOrient.w, h: bestOrient.h });
          if (r.h - bestOrient.h > 0)
            freeRects.push({ x: r.x, y: r.y + bestOrient.h, w: r.w, h: r.h - bestOrient.h });
          placed = true;
        }
      }

      if (!placed) {
        bins.push([{ x: 0, y: 0, w: plateW, h: plateH }]);
        const freeRects = bins[bins.length - 1];
        const r = freeRects[0];
        const o = (piece.w <= r.w && piece.h <= r.h)
          ? { w: piece.w, h: piece.h }
          : { w: piece.h, h: piece.w };
        freeRects.splice(0, 1);
        if (r.w - o.w > 0) freeRects.push({ x: o.w, y: 0, w: r.w - o.w, h: o.h });
        if (r.h - o.h > 0) freeRects.push({ x: 0, y: o.h, w: r.w, h: r.h - o.h });
      }
    }

    placasNecesarias = bins.length;
    const totalArea = items.reduce((s, p) => s + p.w * p.h, 0);
    utilizacion = (totalArea / (placasNecesarias * plateW * plateH)) * 100;
    desperdicio = 100 - utilizacion;
  }

  const barColor = utilizacion >= 80 ? '#22c55e' : utilizacion >= 60 ? '#f59e0b' : '#ef4444';

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      agregarPieza();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Grid3x3 size={24} /> Calculadora de Placa
        </h1>
        {piezas.length > 0 && (
          <button className="btn btn-outline" onClick={limpiarTodo}>
            <RotateCcw size={16} /> Limpiar todo
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: 8, borderRadius: 8, background: '#e0f2fe' }}>
            <Grid3x3 size={20} color="#0284c7" />
          </div>
          <div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 2 }}>Placa estándar</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="input" type="number" step="0.01" style={{ width: 70, fontSize: 16, fontWeight: 700, textAlign: 'center', padding: '4px 6px' }}
                value={plateW} onChange={(e) => setPlateW(Number(e.target.value) || 0)} /> 
              <span style={{ fontSize: 18, color: '#64748b' }}>×</span>
              <input className="input" type="number" step="0.01" style={{ width: 70, fontSize: 16, fontWeight: 700, textAlign: 'center', padding: '4px 6px' }}
                value={plateH} onChange={(e) => setPlateH(Number(e.target.value) || 0)} />
              <span style={{ fontSize: 14, color: '#64748b', fontWeight: 400 }}>(Total: {plateArea.toFixed(2)} m²)</span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
              Corte de disco: +3 mm por lado por pieza
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="section-title" style={{ fontSize: 15, marginBottom: 16 }}>Agregar Pieza</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Largo (m)</label>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={nuevaPieza.largo}
              onChange={(e) => handleInputChange('largo', e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Ancho (m)</label>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={nuevaPieza.ancho}
              onChange={(e) => handleInputChange('ancho', e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Cantidad</label>
            <input
              className="input"
              type="number"
              min="1"
              step="1"
              value={nuevaPieza.cantidad}
              onChange={(e) => handleInputChange('cantidad', e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <button className="btn btn-primary" onClick={agregarPieza} style={{ height: 42, alignSelf: 'end' }}>
            <Plus size={16} /> Agregar Pieza
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="section-title" style={{ fontSize: 15, marginBottom: 16 }}>Piezas</h2>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Largo</th>
                <th>Ancho</th>
                <th>M² c/u</th>
                <th>Cantidad</th>
                <th>Total M²</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {piezas.map((p, i) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{i + 1}</td>
                  <td>{p.largo.toFixed(2)} m</td>
                  <td>{p.ancho.toFixed(2)} m</td>
                  <td>{(p.largo * p.ancho).toFixed(5)}</td>
                  <td>{p.cantidad}</td>
                  <td style={{ fontWeight: 600 }}>{(p.largo * p.ancho * p.cantidad).toFixed(5)}</td>
                  <td>
                    <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => eliminarPieza(p.id)} title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {piezas.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
                    No hay piezas agregadas. Agregue piezas para comenzar el cálculo.
                  </td>
                </tr>
              )}
            </tbody>
            {piezas.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc' }}>
                  <td colSpan={4}></td>
                  <td style={{ fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>TOTAL</td>
                  <td style={{ fontWeight: 700, borderTop: '2px solid #e2e8f0', color: '#1e40af' }}>
                    {totalM2.toFixed(5)} m²
                  </td>
                  <td style={{ borderTop: '2px solid #e2e8f0' }}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {piezas.length > 0 && (
        <div className="card">
          <h2 className="section-title" style={{ fontSize: 15, marginBottom: 16 }}>Resultados</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Total M²</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{totalM2.toFixed(2)}</div>
            </div>
            <div style={{ background: '#f0f9ff', padding: '16px', borderRadius: 10, border: '1px solid #bae6fd', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Placas necesarias</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1e40af' }}>{placasNecesarias}</div>
            </div>
            <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: 10, border: '1px solid #bbf7d0', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Utilización</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{utilizacion.toFixed(1)}%</div>
            </div>
            <div style={{ background: '#fef2f2', padding: '16px', borderRadius: 10, border: '1px solid #fecaca', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Desperdicio</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#dc2626' }}>{desperdicio.toFixed(1)}%</div>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: '#64748b' }}>
              <span>Utilización</span>
              <span style={{ fontWeight: 600, color: barColor }}>{utilizacion.toFixed(1)}%</span>
            </div>
            <div style={{ width: '100%', height: 24, background: '#e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(utilizacion, 100)}%`,
                height: '100%',
                background: barColor,
                borderRadius: 12,
                transition: 'width 0.4s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: 'white',
                minWidth: utilizacion > 0 ? '32px' : '0',
              }}>
                {utilizacion >= 15 && `${utilizacion.toFixed(0)}%`}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: '#94a3b8' }}>
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
