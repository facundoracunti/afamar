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

type DistributionUnit = {
  placed: number;
  unplaced: number;
  expected: number;
};

function distributionKey(item: { pieceId: number; pieceIndex: number }): string {
  return `${item.pieceId}:${item.pieceIndex}`;
}

function distributionSummary(plates: PlateLayout[], unplaced: PackAction[]) {
  const units = new Map<string, DistributionUnit>();

  for (const piece of plates.flatMap((plate) => plate.pieces)) {
    const key = distributionKey(piece);
    const current = units.get(key) ?? { placed: 0, unplaced: 0, expected: 1 };
    current.placed += 1;
    current.expected = Math.max(current.expected, piece.split?.total ?? 1);
    units.set(key, current);
  }

  for (const piece of unplaced) {
    const key = distributionKey(piece);
    const current = units.get(key) ?? { placed: 0, unplaced: 0, expected: 1 };
    current.unplaced += 1;
    current.expected = Math.max(current.expected, piece.split?.total ?? 1);
    units.set(key, current);
  }

  const total = units.size;
  const distributed = [...units.values()].filter(
    (unit) => unit.unplaced === 0 && unit.placed >= unit.expected,
  ).length;

  return { total, distributed, unplaced: total - distributed };
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
  const distribution = distributionSummary(plates, unplaced);

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

      {distribution.total > 0 && (
        <div className={s['plateResultsDistribution']} aria-label="Resumen de distribución">
          <span className={s['plateResultsDistributionMain']}>
            {distribution.distributed} de {distribution.total} piezas distribuidas
          </span>
          {distribution.unplaced > 0 && (
            <span className={s['plateResultsDistributionUnplaced']}>
              {distribution.unplaced} sin ubicar
            </span>
          )}
          <span className={s['plateResultsDistributionPlates']}>
            {plates.length} {plates.length === 1 ? 'placa' : 'placas'}
          </span>
        </div>
      )}

      {unplaced.length > 0 && (
        <div className={s['plateResultsUnplaced']}>
          <strong>No entraron por superar el tamaño de la placa:</strong>{' '}
          {unplaced
            .map((u) => `${u.nombre || `Pieza ${u.pieceIndex + 1}`} (${fmt(u.largo)}×${fmt(u.ancho)})`)
            .join(', ')}
        </div>
      )}

      {plates.length > 1 && (
        <div className={s['plateResultsTabsHeader']}>
          <span className={s['plateResultsTabsHint']}>Consultá el gráfico de cada placa:</span>
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

      {/* Sección SOLO-IMPRESIÓN: itera TODAS las placas del resultado, cada una
          con su hoja de corte SVG + Tabla de Despiece/Leyenda. Invisible en
          pantalla (display:none); al imprimir reemplaza a la placa activa del
          canvas interactivo y deja una hoja limpia por placa (break-after:
          page en el CSS @media print). */}
      <div className={s['plateResultsPrintAll']} data-testid="plate-results-print-all">
        {plates.map((pl) => (
          <section
            key={pl.index}
            className={s['plateResultsPrintPlate']}
            aria-label={`Hoja de corte Placa #${pl.index + 1}`}
          >
            <PlateCutMap
              plate={pl}
              plateW={plateW}
              plateH={plateH}
              kerf={kerf}
              title={`Placa #${pl.index + 1}`}
            />
          </section>
        ))}
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
