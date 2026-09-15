/**
 * Render tests for `MeasurementPhotoGrid`.
 *
 * Verifies:
 *  - renders thumbnails for each photo
 *  - clicking a thumbnail opens the lightbox with the full-size image
 *  - closing the lightbox removes it
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MeasurementPhotoGrid } from './MeasurementPhotoGrid';

const FOTO_1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const FOTO_2 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function renderGrid(fotos: string[] = [FOTO_1, FOTO_2]) {
  return render(
    <MeasurementPhotoGrid fotos={fotos} onAddFotos={vi.fn()} onRemoveFoto={vi.fn()} />,
  );
}

describe('MeasurementPhotoGrid', () => {
  it('renders a thumbnail per photo', () => {
    renderGrid();
    expect(screen.getByAltText('Foto 1')).toBeDefined();
    expect(screen.getByAltText('Foto 2')).toBeDefined();
  });

  it('opens a lightbox with the full-size image on click and closes on "Cerrar"', () => {
    renderGrid();
    fireEvent.click(screen.getByAltText('Foto 1'));
    expect(screen.getByAltText('Foto de la medición')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByAltText('Foto de la medición')).toBeNull();
  });
});