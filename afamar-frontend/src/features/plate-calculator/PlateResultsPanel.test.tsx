import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PlateResultsPanel from './PlateResultsPanel';
import type { PlateLayout, PlacedPiece } from './guillotinePacker';

function piece(pieceId: number, largo: number, ancho: number): PlacedPiece {
  return {
    pieceId,
    pieceIndex: 0,
    origen: pieceId,
    nombre: `Pieza ${pieceId}`,
    x: 0,
    y: 0,
    w: largo,
    h: ancho,
    largo,
    ancho,
    rotated: false,
    m2: largo * ancho,
  };
}

function plate(index: number, pieces: PlacedPiece[]): PlateLayout {
  return {
    index,
    plateM2: 3.0 * 1.4,
    usedM2: pieces.reduce((acc, p) => acc + p.m2, 0),
    pieces,
  };
}

describe('PlateResultsPanel — impresión de TODAS las placas', () => {
  it('renderiza la sección print-only con una hoja de corte completa por placa', () => {
    render(
      <PlateResultsPanel
        plates={[plate(0, [piece(1, 3.0, 1.4)]), plate(1, [piece(2, 1.0, 1.0)]), plate(2, [piece(3, 0.5, 0.5)])]}
        plateW={3.0}
        plateH={1.4}
        kerf={0}
        platesM2Bought={3 * 3.0 * 1.4}
        totalM2={3.0 * 1.4 + 1.0 + 0.25}
        utilizacion={72.5}
        unplaced={[]}
      />,
    );

    const printAll = screen.getByTestId('plate-results-print-all');
    expect(printAll).toBeDefined();

    // Las 3 placas figuran con su título y su Tabla de Despiece/Leyenda.
    expect(printAll.textContent).toContain('Placa #1');
    expect(printAll.textContent).toContain('Placa #2');
    expect(printAll.textContent).toContain('Placa #3');

    const legends = screen.getAllByText('Tabla de Despiece / Leyenda de Cortes');
    // 1 del canvas activo + 3 de la sección print-only = 4.
    expect(legends.length).toBe(4);

    // El canvas interactivo muestra la placa activa (#1); la sección
    // print-only complementa con las placas #2 y #3 (que el canvas no tiene).
    expect(screen.getAllByText(/Pieza 1/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Placa #1/).length).toBeGreaterThanOrEqual(2);
    expect(printAll.textContent).toContain('Pieza 2');
    expect(printAll.textContent).toContain('Pieza 3');
  });

  it('una única placa también se imprime (print-only no se rompe)', () => {
    render(
      <PlateResultsPanel
        plates={[plate(0, [piece(1, 3.0, 1.4)])]}
        plateW={3.0}
        plateH={1.4}
        kerf={0}
        platesM2Bought={3.0 * 1.4}
        totalM2={3.0 * 1.4}
        utilizacion={100}
        unplaced={[]}
      />,
    );

    const printAll = screen.getByTestId('plate-results-print-all');
    expect(printAll.textContent).toContain('Placa #1');
    expect(screen.getAllByText('Tabla de Despiece / Leyenda de Cortes').length).toBe(2);
  });
});