import React from 'react';
import type { PlateLayout, PlacedPiece } from './guillotinePacker';
import styles from './plateCalculator.module.css';

const s = styles as unknown as Record<string, string>;

export interface PlateCutMapProps {
  plate: PlateLayout;
  plateW: number;
  plateH: number;
  kerf: number;
  /** Nombre visible de la placa (ej. "Placa #1"). */
  title?: string;
}

const SCALE = 120; // px por metro (3.00×1.80 → 360×216)

const COLOR_RED = '#e11d48';
const COLOR_BLUE = '#2563eb';
const SCRAP_FILL = '#e5e7eb';

function fmt(n: number): string {
  return n.toFixed(2);
}

/**
 * Renderiza la hoja de corte de una placa en SVG a escala real (proporción
 * exacta 1:1). Las piezas se dibujan en rojo/azul alternado por pieza, con un
 * código corto correlativo (#1..#N) y su Largo × Ancho centrados. El área
 * entre piezas es el desperdicio (fondo gris). Debajo se muestra la
 * "Tabla de Despiece / Leyenda de Cortes" que asocia cada código con su
 * nombre (si la pieza lo tiene), sus medidas en metros y si fue rotada.
 */
export default function PlateCutMap({
  plate,
  plateW,
  plateH,
  kerf,
  title,
}: PlateCutMapProps) {
  const widthPx = plateW * SCALE;
  const heightPx = plateH * SCALE;
  const kerfPx = kerf * SCALE;

  const pieces = plate.pieces;
  const usedPct = plate.plateM2 > 0 ? (plate.usedM2 / plate.plateM2) * 100 : 0;
  const wastePct = Math.max(0, 100 - usedPct);
  const plateLabel = title ?? `Placa #${plate.index + 1}`;

  return (
    <div>
      <div className={s['plateCutMapMeta']}>
        <strong>{plateLabel}</strong>
        <span>
          {pieces.length} {pieces.length === 1 ? 'pieza' : 'piezas'} ·{' '}
          {usedPct.toFixed(1)}% aprovechado / {wastePct.toFixed(1)}% desperdicio
        </span>
      </div>
      <svg
        viewBox={`0 0 ${widthPx} ${heightPx}`}
        width="100%"
        role="img"
        aria-label={`${plateLabel} — ${pieces.length} piezas, ${usedPct.toFixed(1)}% aprovechado`}
        className={s['plateCutMapSvg']}
        style={{ maxWidth: 520, borderRadius: 6, background: SCRAP_FILL, display: 'block' }}
      >
        {/* Fondo = desperdicio */}
        <rect x={0} y={0} width={widthPx} height={heightPx} fill={SCRAP_FILL} />

        {pieces.map((p, i) => {
          // Código correlativo corto: #1..#N dentro de ESTA placa.
          const code = i + 1;
          // rect nominal (descontando el kerf por lado)
          const rectX = p.x * SCALE + kerfPx;
          const rectY = p.y * SCALE + kerfPx;
          const rectW = p.w * SCALE - kerfPx * 2;
          const rectH = p.h * SCALE - kerfPx * 2;
          const color = p.pieceId % 2 === 0 ? COLOR_RED : COLOR_BLUE;
          // Fuente dinámica según el tamaño real del bloque: bloques chicos
          // reciben letra proporcional (con piso para que siga legible).
          const minSide = Math.min(rectW, rectH);
          const fontSize = Math.max(4, Math.min(14, minSide * 0.2));
          // El código cabe siempre; las medidas solo si hay espacio para 2 líneas.
          const showDims = rectH > fontSize * 2.6 && rectW > 44;

          return (
            <g key={`${p.pieceId}-${p.pieceIndex}-${i}`}>
              <rect
                x={rectX}
                y={rectY}
                width={rectW}
                height={rectH}
                fill={color}
                fillOpacity={0.9}
                stroke="#1e293b"
                strokeWidth={1.5}
              />
              <text
                x={rectX + rectW / 2}
                y={rectY + rectH / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                fontSize={fontSize}
                fontWeight="bold"
                className={s['plateCutMapId']}
              >
                <tspan x={rectX + rectW / 2} dy={showDims ? -fontSize * 0.45 : 0}>
                  #{code}
                  {p.split ? ` · ${p.split.tramo}/${p.split.total}` : ''}
                </tspan>
                {showDims && (
                  <tspan
                    x={rectX + rectW / 2}
                    dy={fontSize * 1.25}
                    fontSize={fontSize * 0.92}
                    fontWeight="normal"
                  >
                    {fmt(p.largo)}×{fmt(p.ancho)}
                    {p.rotated ? ' ↻' : ''}
                  </tspan>
                )}
              </text>
            </g>
          );
        })}
      </svg>

      {pieces.length > 0 && (
        <div className={s['plateCutMapLegend']}>
          <h3 className={s['plateCutMapLegendTitle']}>Tabla de Despiece / Leyenda de Cortes</h3>
          <div className="table-container">
            <table className={`table ${s['plateCutMapLegendTable']}`}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Largo × Ancho (m)</th>
                  <th>Rotado</th>
                </tr>
              </thead>
              <tbody>
                {pieces.map((p, i) => (
                  <LegendRow key={`${p.pieceId}-${p.pieceIndex}-${i}`} code={i + 1} p={p} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendRow({ code, p }: { code: number; p: PlacedPiece }) {
  const baseName = p.nombre || `Pieza ${p.origen ?? code}`;
  const name = p.split
    ? `${baseName} (Tramo ${p.split.tramo}/${p.split.total} - ${fmt(p.largo)}×${fmt(p.ancho)})`
    : baseName;
  return (
    <tr>
      <td className={s['plateCutMapLegendCode']}>#{code}</td>
      <td>{name}</td>
      <td>
        {fmt(p.largo)} × {fmt(p.ancho)} m
      </td>
      <td>{p.rotated ? 'Sí (↻)' : '—'}</td>
    </tr>
  );
}

export type { PlacedPiece };