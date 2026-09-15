import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MaterialCard from './MaterialCard';
import type { MaterialInForm } from '../../../types/budget';
import type { MaterialCategory } from '../../../api/resources/materials';

const row = (overrides: Partial<MaterialInForm> = {}): MaterialInForm => ({
  id: 1,
  name: 'GRIS MARA',
  category: 'Granitos',
  color: undefined,
  price_m2: 180000,
  price_m2_usd: 0,
  currency: 'ARS',
  quantity: 1,
  m2_used: 0,
  m2_budgeted: 0,
  length: 0,
  width: 0,
  is_alternative: false,
  ...overrides,
});

const num = (v: unknown): number => Number(v) || 0;

function renderCard({
  rows = [row()],
  readOnly = false,
  usdRate = 0,
  updateMaterialGroup = vi.fn(),
}: {
  rows?: MaterialInForm[];
  readOnly?: boolean;
  usdRate?: number;
  updateMaterialGroup?: ReturnType<typeof vi.fn>;
} = {}) {
  const props = {
    rows: rows.map((mat, i) => ({ mat, idx: i })),
    readOnly,
    materials: [],
    categorias: [] as MaterialCategory[],
    updateMaterial: vi.fn(),
    updateMaterialGroup,
    removeMaterial: vi.fn(),
    removeGroup: vi.fn(),
    addRow: vi.fn(),
    onChangeMaterial: vi.fn(),
    num,
    usdRate,
  };
  const view = render(<MaterialCard {...props} />);
  return { view, props };
}

describe('MaterialCard — inline price editing', () => {
  it('renders an editable price input in edit mode (ARS) and writes price_m2 for every row', () => {
    const updateMaterialGroup = vi.fn();
    renderCard({ updateMaterialGroup });

    const input = screen.getByLabelText('Precio por m² ARS') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('180000');

    fireEvent.change(input, { target: { value: '240000' } });
    expect(updateMaterialGroup).toHaveBeenCalledWith([0], 'price_m2', 240000);
  });

  it('writes price_m2_usd when the material is in USD', () => {
    const updateMaterialGroup = vi.fn();
    renderCard({
      rows: [row({ currency: 'USD', price_m2: 0, price_m2_usd: 750 })],
      updateMaterialGroup,
    });

    const input = screen.getByLabelText('Precio por m² USD') as HTMLInputElement;
    expect(input.value).toBe('750');

    fireEvent.change(input, { target: { value: '820' } });
    expect(updateMaterialGroup).toHaveBeenCalledWith([0], 'price_m2_usd', 820);
  });

  it('applies the price to every row of the card group', () => {
    const updateMaterialGroup = vi.fn();
    renderCard({
      rows: [
        row({ name: 'GRIS MARA', price_m2: 180000 }),
        row({ name: 'GRIS MARA', price_m2: 180000 }),
      ],
      updateMaterialGroup,
    });

    const input = screen.getByLabelText('Precio por m² ARS') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '300000' } });
    expect(updateMaterialGroup).toHaveBeenCalledWith([0, 1], 'price_m2', 300000);
  });

  it('shows a read-only price span in readOnly mode (no input)', () => {
    renderCard({ readOnly: true });
    expect(screen.queryByLabelText('Precio por m² ARS')).toBeNull();
    expect(screen.getByText('$ 180.000,00')).toBeDefined();
  });
});