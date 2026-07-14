import { describe, expect, it } from 'vitest';
import { buildMaterialGroupOptions } from './materialGroups';
import type { MaterialInForm } from '../types/budget';

const mkMaterial = (overrides: Partial<MaterialInForm> = {}): MaterialInForm => ({
  id: 1,
  name: 'Negro Brasil',
  price_m2: 200000,
  price_m2_usd: 330,
  currency: 'USD',
  quantity: 1,
  m2_used: 1,
  m2_budgeted: 1,
  length: 200,
  width: 50,
  is_alternative: false,
  ...overrides,
});

describe('buildMaterialGroupOptions — dedupe by id ?? name', () => {
  it('collapses 3 panes of the same material into a single option', () => {
    // Three realistic marble panes (length and width in metres, per the
    // MaterialCard's "Largo (mts)" input label).
    const panes = [
      mkMaterial({ id: 42, name: 'Negro Brasil', length: 2.0, width: 1.0, quantity: 1 }),
      mkMaterial({ id: 42, name: 'Negro Brasil', length: 1.5, width: 1.0, quantity: 1 }),
      mkMaterial({ id: 42, name: 'Negro Brasil', length: 1.0, width: 0.5, quantity: 1 }),
    ];
    const out = buildMaterialGroupOptions(panes);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Negro Brasil');
    expect(out[0].count).toBe(3);
    // 2 + 1.5 + 0.5 = 4.0 m² combined footprint.
    expect(out[0].totalM2).toBeCloseTo(4.0, 2);
    expect(out[0].label).toContain('3 planchas');
  });

  it('renders ONE option per pane when the operator changes material between rows', () => {
    const panes = [
      mkMaterial({ id: 1, name: 'Negro Brasil', length: 200, width: 50 }),
      mkMaterial({ id: 2, name: 'Marmol Carrara', length: 150, width: 60 }),
      mkMaterial({ id: 3, name: 'Blanco Calacatta', length: 100, width: 40 }),
    ];
    const out = buildMaterialGroupOptions(panes);
    expect(out).toHaveLength(3);
  });

  it('mixes principal + alternativa groups and tags the alternative', () => {
    const panes = [
      mkMaterial({ id: 1, name: 'Negro Brasil', is_alternative: false }),
      mkMaterial({ id: 2, name: 'Marmol Carrara', is_alternative: true }),
    ];
    const out = buildMaterialGroupOptions(panes);
    expect(out.find((g) => g.name === 'Negro Brasil')?.isAlternative).toBe(false);
    expect(out.find((g) => g.name === 'Marmol Carrara')?.isAlternative).toBe(true);
  });

  it('falls back to name for legacy rows without an id', () => {
    const panes = [
      mkMaterial({ id: null as unknown as number, name: 'Negro Brasil' }),
      mkMaterial({ id: null as unknown as number, name: 'Negro Brasil' }),
      // An unrelated legacy row with a different name — should NOT
      // collapse with the ones above even though they share `id === null`.
      mkMaterial({ id: null as unknown as number, name: 'Marmol Carrara' }),
    ];
    const out = buildMaterialGroupOptions(panes);
    expect(out).toHaveLength(2);
    expect(out.find((g) => g.name === 'Negro Brasil')?.count).toBe(2);
    expect(out.find((g) => g.name === 'Marmol Carrara')?.count).toBe(1);
  });

  it('omits rows with empty/missing names', () => {
    const out = buildMaterialGroupOptions([
      mkMaterial({ name: '' }),
      mkMaterial({ name: 'Negro Brasil' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Negro Brasil');
  });
});
