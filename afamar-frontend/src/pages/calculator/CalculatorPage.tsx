import React, { useState } from 'react';
import { Grid3x3, Trash2, Plus, RotateCcw } from 'lucide-react';
import { usePlateCalculator, type Pieza } from '../../hooks/usePlateCalculator/usePlateCalculator';
import styles from './CalculatorPage.module.css';

const s = styles as unknown as Record<string, string>;

interface NuevaPiezaState {
  largo: string;
  ancho: string;
  cantidad: string;
}

export default function Calculator() {
  const [piezas, setPiezas] = useState<Pieza[]>([]);
  const [nuevaPieza, setNuevaPieza] = useState<NuevaPiezaState>({ largo: '', ancho: '', cantidad: '1' });
  const [plateW, setPlateW] = useState(3.00);
  const [plateH, setPlateH] = useState(1.80);

  const { placasNecesarias, utilizacion, desperdicio, totalM2, totalM2Bruto: _totalM2Bruto, barModifier } = usePlateCalculator(piezas, plateW, plateH);

  const handleInputChange = (field: string, value: string) => {
    setNuevaPieza((prev) => ({ ...prev, [field]: value }));
  };

  const agregarPieza = () => {
    const largo = parseFloat(nuevaPieza.largo);
    const ancho = parseFloat(nuevaPieza.ancho);
    const cantidad = parseInt(nuevaPieza.cantidad, 10) || 1;
    if (!largo || !ancho || largo <= 0 || ancho <= 0) return;
    setPiezas((prev) => [...prev, { id: Date.now(), largo, ancho, cantidad }]);
    setNuevaPieza({ largo: '', ancho: '', cantidad: '1' });
  };

  const eliminarPieza = (id: number) => {
    setPiezas((prev) => prev.filter((p) => p.id !== id));
  };

  const limpiarTodo = () => {
    setPiezas([]);
    setNuevaPieza({ largo: '', ancho: '', cantidad: '1' });
  };

  const plateArea = plateW * plateH;
  const barTextClass = `${s['calculator__progressFill']} ${s[`calculator__progressFill--${barModifier}`]}`;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      agregarPieza();
    }
  };

  return (
    <div className={s['calculator']}>
      <div className={s['calculator__header']}>
        <h1 className={s['calculator__title']}>
          <Grid3x3 size={24} /> Calculadora de Placa
        </h1>
        {piezas.length > 0 && (
          <button className="btn btn-outline" onClick={limpiarTodo}>
            <RotateCcw size={16} /> Limpiar todo
          </button>
        )}
      </div>

      <div className={s['calculator__plateCard']}>
        <div className={s['calculator__plateRow']}>
          <div className={s['calculator__plateIconWrap']}>
            <Grid3x3 size={20} />
          </div>
          <div className={s['calculator__plateBody']}>
            <div className={s['calculator__plateTitle']}>Placa estándar</div>
            <div className={s['calculator__plateDimensions']}>
              <input className={`input ${s['calculator__plateInput']}`} type="number" step="0.01"
                value={plateW} onChange={(e) => setPlateW(Number(e.target.value) || 0)} />
              <span className={s['calculator__plateSeparator']}>×</span>
              <input className={`input ${s['calculator__plateInput']}`} type="number" step="0.01"
                value={plateH} onChange={(e) => setPlateH(Number(e.target.value) || 0)} />
              <span className={s['calculator__plateTotal']}>(Total: {plateArea.toFixed(2)} m²)</span>
            </div>
            <div className={s['calculator__plateNote']}>
              Corte de disco: +3 mm por lado por pieza
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 } as React.CSSProperties}>
        <h2 className="section-title" style={{ fontSize: 15, marginBottom: 16 } as React.CSSProperties}>Agregar Pieza</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'end' } as React.CSSProperties}>
          <div className="form-group" style={{ marginBottom: 0 } as React.CSSProperties}>
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
          <div className="form-group" style={{ marginBottom: 0 } as React.CSSProperties}>
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
          <div className="form-group" style={{ marginBottom: 0 } as React.CSSProperties}>
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
          <button className="btn btn-primary" onClick={agregarPieza} style={{ height: 42, alignSelf: 'end' } as React.CSSProperties}>
            <Plus size={16} /> Agregar Pieza
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 } as React.CSSProperties}>
        <h2 className="section-title" style={{ fontSize: 15, marginBottom: 16 } as React.CSSProperties}>Piezas</h2>
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
                <th style={{ width: 60 } as React.CSSProperties}></th>
              </tr>
            </thead>
            <tbody>
              {piezas.map((p, i) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 } as React.CSSProperties}>{i + 1}</td>
                  <td>{p.largo.toFixed(2)} m</td>
                  <td>{p.ancho.toFixed(2)} m</td>
                  <td>{(p.largo * p.ancho).toFixed(5)}</td>
                  <td>{p.cantidad}</td>
                  <td style={{ fontWeight: 600 } as React.CSSProperties}>{(p.largo * p.ancho * p.cantidad).toFixed(5)}</td>
                  <td>
                    <button className="btn btn-danger" style={{ padding: '4px 8px' } as React.CSSProperties} onClick={() => eliminarPieza(p.id)} title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {piezas.length === 0 && (
                <tr>
                  <td colSpan={7} className={s['calculator__emptyRow']}>
                    No hay piezas agregadas. Agregue piezas para comenzar el cálculo.
                  </td>
                </tr>
              )}
            </tbody>
            {piezas.length > 0 && (
              <tfoot>
                <tr className={s['calculator__tfootRow']}>
                  <td colSpan={4}></td>
                  <td className={s['calculator__tfootCell']}>TOTAL</td>
                  <td className={`${s['calculator__tfootCell']} ${s['calculator__tfootCell--highlight']}`}>
                    {totalM2.toFixed(5)} m²
                  </td>
                  <td className={s['calculator__tfootCell']}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {piezas.length > 0 && (
        <div className="card">
          <h2 className="section-title" style={{ fontSize: 15, marginBottom: 16 } as React.CSSProperties}>Resultados</h2>

          <div className={s['calculator__statGrid']}>
            <div className={s['calculator__statCard']}>
              <div className={s['calculator__statLabel']}>Total M²</div>
              <div className={s['calculator__statValue']}>{totalM2.toFixed(2)}</div>
            </div>
            <div className={`${s['calculator__statCard']} ${s['calculator__statCard--info']}`}>
              <div className={s['calculator__statLabel']}>Placas necesarias</div>
              <div className={`${s['calculator__statValue']} ${s['calculator__statValue--info']}`}>{placasNecesarias}</div>
            </div>
            <div className={`${s['calculator__statCard']} ${s['calculator__statCard--success']}`}>
              <div className={s['calculator__statLabel']}>Utilización</div>
              <div className={`${s['calculator__statValue']} ${s['calculator__statValue--success']}`}>{utilizacion.toFixed(1)}%</div>
            </div>
            <div className={`${s['calculator__statCard']} ${s['calculator__statCard--danger']}`}>
              <div className={s['calculator__statLabel']}>Desperdicio</div>
              <div className={`${s['calculator__statValue']} ${s['calculator__statValue--danger']}`}>{desperdicio.toFixed(1)}%</div>
            </div>
          </div>

          <div style={{ marginTop: 8 } as React.CSSProperties}>
            <div className={s['calculator__progressMeta']}>
              <span>Utilización</span>
              <span className={s['calculator__progressValue']}>{utilizacion.toFixed(1)}%</span>
            </div>
            <div className={s['calculator__progressTrack']}>
              <div
                className={barTextClass}
                style={{ width: `${Math.min(utilizacion, 100)}%` } as React.CSSProperties}
              >
                {utilizacion >= 15 && `${utilizacion.toFixed(0)}%`}
              </div>
            </div>
            <div className={s['calculator__progressScale']}>
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
