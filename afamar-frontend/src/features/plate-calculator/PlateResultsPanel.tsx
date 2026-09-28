import React, { useState } from 'react';
import { Printer } from 'lucide-react';
import PlateCutMap from './PlateCutMap';
import type { PlateLayout, PackAction, GuillotineResult } from './guillotinePacker';
import styles from './plateCalculator.module.css';

const s = styles as unknown as Record<string, string>;

export interface PlateResultsPanelProps {
  plates: PlateLayout[];
  plateW: number;
  plateH: number;
  kerf: number;
  platesM2Bought: number;
  totalM2: number;
  utilizacion: number;
  unplaced: PackAction[];
}

function fmt(n: number, digits = 2): string {
  return n.toFixed(digits);
}

/**
 * Panel de resultados de la calculadora de placa: resumen superior (m²
 * comprados vs m² de piezas, % aprovechamiento), pestañas por placa con su
 * hoja de corte SVG y botón para imprimir/exportar el PDF.
 */
export default function PlateResultsPanel({
  plates,
  plateW,
  plateH,
  kerf,
  platesM2Bought,
  totalM2,
  utilizacion,
  unplaced,
}: PlateResultsPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeIndex = Math.min(activeIndex, Math.max(0, plates.length - 1));
  const activePlate = plates[safeIndex];

  const handlePrint = () => {
    window.print();
  };

  const wasteM2 = Math.max(0, platesM2Bought - totalM2);

  return (
    <div className={s['plateResults']}>
      <div className={s['plateResultsSummary']}>
        <div className={s['plateResultsSummaryCol']}>
          <span className={s['plateResultsSummaryLabel']}>Piezas (m²)</span>
          <span className={s['plateResultsSummaryValue']}>{fmt(totalM2)} m²</span>
        </div>
        <div className={s['plateResultsSummaryCol']}>
          <span className={s['plateResultsSummaryLabel']}>Placas a comprar (m²)</span>
          <span className={s['plateResultsSummaryValue']}>
            {plates.length} × {fmt(plateW)}×{fmt(plateH)} = {fmt(platesM2Bought)} m²
          </span>
        </div>
        <div className={s['plateResultsSummaryCol']}>
          <span className={s['plateResultsSummaryLabel']}>Desperdicio (m²)</span>
          <span className={`${s['plateResultsSummaryValue']} ${s['plateResultsSummaryValue--waste']}`}>
            {fmt(wasteM2)} m²
          </span>
        </div>
        <div className={`${s['plateResultsSummaryCol']} ${s['plateResultsSummaryCol--accent']}`}>
          <span className={s['plateResultsSummaryLabel']}>Aprovechamiento</span>
          <span className={`${s['plateResultsSummaryValue']} ${s['plateResultsSummaryValue--accent']}`}>
            {fmt(utilizacion, 1)}%
          </span>
        </div>
      </div>

      {unplaced.length > 0 && (
        <div className={s['plateResultsUnplaced']}>
          <strong>No entraron por superar el tamaño de la placa:</strong>{' '}
          {unplaced
            .map((u) => `${u.nombre || `Pieza ${u.pieceIndex + 1}`} (${fmt(u.largo)}×${fmt(u.ancho)})`)
            .join(', ')}
        </div>
      )}

      {plates.length > 1 && (
        <div className={s['plateResultsTabs']} role="tablist">
          {plates.map((pl, i) => (
            <button
              key={pl.index}
              type="button"
              role="tab"
              aria-selected={i === safeIndex}
              className={`${s['plateResultsTab']} ${
                i === safeIndex ? s['plateResultsTab--active'] : ''
              }`}
              onClick={() => setActiveIndex(i)}
            >
              Placa #{i + 1}
              <span className={s['plateResultsTabPct']}>
                {pl.plateM2 > 0 ? ((pl.usedM2 / pl.plateM2) * 100).toFixed(0) : 0}%
              </span>
            </button>
          ))}
        </div>
      )}

      <div className={s['plateResultsCanvas']}>
        {activePlate ? (
          <PlateCutMap
            plate={activePlate}
            plateW={plateW}
            plateH={plateH}
            kerf={kerf}
            title={plates.length > 1 ? `Placa #${activePlate.index + 1}` : undefined}
          />
        ) : (
          <p>Sin piezas para graficar.</p>
        )}
      </div>

      <div className={s['plateResultsActions']}>
        <button className="btn btn-primary" type="button" onClick={handlePrint}>
          <Printer size={16} /> Imprimir / Exportar Hoja de Corte
        </button>
      </div>
    </div>
  );
}

export type { GuillotineResult as PlatePackResult };