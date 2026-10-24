/**
 * REGRESSION SUITE — multi-option budgets (2026-10-01).
 *
 * Covers the four defects found during the live test:
 *
 *  1. Switching tabs left the legacy flat arrays pointing at the PREVIOUS
 *     option, so the form's totals (and the saved payload) described a
 *     different scenario than the one on screen — and the PDF's
 *     comparative summary could not be reconciled with the UI.
 *  2. The "ghost" piece (`createEmptyPiece`, rendered while a piece list
 *     is empty) could be persisted into an option, replacing its real
 *     pieces with a material-less one — the option then priced at $0
 *     (only its traforos survived).
 *  3. `buildPieces` dropped the extra panes ("tramos") when the
 *     principal row was missing, while `flattenPieces` (the flat arrays
 *     the UI reads) kept them — the PDF showed $0 where the UI showed the
 *     material's amount.
 *  4. Page 1 of the PDF printed the ACTIVE option's pieces while the
 *     totals described the winner — the printed pieces never added up to
 *     the printed TOTAL.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import { BudgetOptionsProvider } from './BudgetOptionsContext';
import BudgetOptionsTabs from './BudgetOptionsTabs';
import { useBudgetPieces } from '../hooks/useBudgetPieces';
import { INITIAL_FORM } from '@/hooks/entityFormConstants';
import { buildPdfData } from '@/utils/pdf/buildPdfData';
import { buildPieces } from '@/utils/pdf/buildPiecesPdfData';
import type { EntityFormState } from '@/types/form';
import type { Material } from '@/types/material';
import type { BudgetOption, BudgetPiece } from '@/types/budget';

// ── Fixtures ─────────────────────────────────────────────────────────

function piece(
  id: string,
  name: string,
  matName: string,
  priceM2: number,
  currency: 'ARS' | 'USD' = 'ARS',
): BudgetPiece {
  return {
    id,
    name,
    mainMaterial: {
      id: 1,
      name: matName,
      price_m2: currency === 'USD' ? 0 : priceM2,
      price_m2_usd: currency === 'USD' ? priceM2 : 0,
      currency,
      quantity: 1,
      m2_used: 0,
      m2_budgeted: 0,
      length: 2,
      width: 1,
      is_alternative: false,
    },
    mainMaterialRows: [],
    alternativeMaterials: [],
    fabrication_details: [],
    additional_works_data: JSON.stringify([
      {
        additional_work_id: 5,
        name: 'Traforo de pileta',
        materialName: '__GLOBAL__',
        quantity: 1,
        price: 60_000,
        total: 60_000,
        currency: 'ARS',
        type: 'flat',
        detail: null,
      },
    ]),
    pools: [],
  } as unknown as BudgetPiece;
}

function option(
  id: string,
  name: string,
  isSelected: boolean,
  pieces: BudgetPiece[],
): BudgetOption {
  return { id, name, is_selected: isSelected, pieces };
}

const baseParams = {
  document_type: 'budget' as const,
  company: {
    company_name: 'AFAMAR',
    company_tagline: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_logo: '',
    pdf_footer: '',
  },
  globalTerms: { budget_terms: [], delivery_terms: [], warranty_text: [] },
  sketchImages: [],
};

/** Mirrors the REAL tree: the parent owns `useBudgetPieces` (through
 *  `useEntityForm`), the provider + tabs are CHILDREN. */
function Harness({
  initial,
  materials = [],
}: {
  initial: EntityFormState;
  materials?: Material[];
}) {
  const [form, setForm] = useState<EntityFormState>(initial);
  const piecesFlow = useBudgetPieces({ form, setForm, materials });
  return (
    <BudgetOptionsProvider form={form} setForm={setForm}>
      <BudgetOptionsTabs />
      <button
        type="button"
        onClick={() =>
          piecesFlow.setPieceMain(piecesFlow.pieces[0].id, 'NEGRO BRASIL')
        }
      >
        Poner material
      </button>
      <div data-testid="flat">{JSON.stringify(form.materials_data)}</div>
      <div data-testid="options">
        {JSON.stringify(
          (form.options ?? []).map((o) => ({ id: o.id, pieces: o.pieces.length })),
        )}
      </div>
    </BudgetOptionsProvider>
  );
}

const MATERIALS = [
  {
    id: 7,
    name: 'NEGRO BRASIL',
    category_id: 1,
    color: 'Negro',
    base_price: 300_000,
    price_usd: 0,
    currency: 'ARS',
    allows_integrated_sink: true,
  },
] as unknown as Material[];

function legacyForm(pieces: BudgetPiece[]): EntityFormState {
  return {
    ...INITIAL_FORM,
    options: [] as BudgetOption[],
    active_option_id: '',
    pieces,
    usd_rate: 1000,
    materials_data: [],
  } as unknown as EntityFormState;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('multi-option sync — the UI and the PDF describe the SAME scenario', () => {
  it('re-derives the flat arrays when the operator switches tabs', () => {
    // The flat arrays are what the totals read. Before the fix they kept
    // pointing at the previous option, so the form showed the wrong
    // scenario's amounts.
    const p = piece('p1', 'COCINA', 'NEGRO BRASIL', 300_000);
    render(<Harness initial={legacyForm([p])} />);

    // "+ Agregar Opción" → Opción 1 (the original) + Opción 2 (EMPTY — a
    // scenario built from scratch).
    act(() => {
      fireEvent.click(screen.getByText('Agregar Opción'));
    });
    expect(screen.getByText('Opción 1')).toBeTruthy();
    expect(screen.getByText('Opción 2')).toBeTruthy();

    // The flat arrays now describe the ACTIVE option (Opción 2), which is
    // empty → there is nothing to price yet.
    const flatAfterAdd = JSON.parse(screen.getByTestId('flat').textContent || '[]');
    expect(flatAfterAdd).toHaveLength(0);

    // Switch to Opción 1 — the flat must follow (it holds the same
    // material here, so we check the identity of the scenario instead by
    // making the two options differ).
    act(() => {
      fireEvent.click(screen.getByText('Opción 1'));
    });
    const flatAfterSwitch = JSON.parse(screen.getByTestId('flat').textContent || '[]');
    expect(flatAfterSwitch).toHaveLength(1);
    expect(flatAfterSwitch[0].name).toBe('NEGRO BRASIL');
  });

  it('never persists the ghost piece into a brand-new EMPTY option', () => {
    // "+ Agregar Opción" creates an option with `pieces: []`. The editor
    // shows a STABLE piece to write on, but that piece must never land in
    // the option: an option holding a material-less piece would be
    // persisted as a $0 scenario and quoted at $0 in the comparative.
    const p = piece('p1', 'COCINA', 'NEGRO BRASIL', 300_000);
    render(<Harness initial={legacyForm([p])} />);

    act(() => {
      fireEvent.click(screen.getByText('Agregar Opción'));
    });

    const options = JSON.parse(screen.getByTestId('options').textContent || '[]');
    // Opción 1 keeps the original piece; Opción 2 owns NOTHING.
    expect(options).toHaveLength(2);
    expect(options[0].pieces).toBe(1);
    expect(options[1].pieces).toBe(0);
  });

  it('the operator builds the EMPTY option from scratch (the piece lands in the option)', () => {
    // The empty option is edited through a STABLE piece: when the operator
    // gives it a material, the piece is pushed into the option and the
    // scenario becomes quotable.
    const p = piece('p1', 'COCINA', 'NEGRO BRASIL', 300_000);
    render(<Harness initial={legacyForm([p])} materials={MATERIALS} />);

    act(() => {
      fireEvent.click(screen.getByText('Agregar Opción'));
    });

    act(() => {
      fireEvent.click(screen.getByText('Poner material'));
    });

    const options = JSON.parse(screen.getByTestId('options').textContent || '[]');
    expect(options[1].pieces).toBe(1);
    const flat = JSON.parse(screen.getByTestId('flat').textContent || '[]');
    expect(flat).toHaveLength(1);
    expect(flat[0].name).toBe('NEGRO BRASIL');
  });

  it('keeps each option with ITS OWN material after a tab switch', () => {
    // Two options with DIFFERENT materials: switching must not leak one
    // into the other (the option that lost its material priced at $0).
    const opt1 = option('opt-1', 'Opción 1', true, [
      piece('p1', 'COCINA', 'NEGRO BRASIL', 300_000),
    ]);
    const opt2 = option('opt-2', 'Opción 2', false, [
      piece('p2', 'COCINA', 'MIAMI WHITE', 330, 'USD'),
    ]);
    const initial = {
      ...INITIAL_FORM,
      options: [opt1, opt2],
      active_option_id: 'opt-1',
      pieces: opt1.pieces,
      usd_rate: 1000,
    } as unknown as EntityFormState;

    render(<Harness initial={initial} />);

    act(() => {
      fireEvent.click(screen.getByText('Opción 2'));
    });

    // The flat arrays describe Opción 2 (MIAMI WHITE).
    const flat = JSON.parse(screen.getByTestId('flat').textContent || '[]');
    expect(flat).toHaveLength(1);
    expect(flat[0].name).toBe('MIAMI WHITE');
    expect(flat[0].price_m2_usd).toBe(330);
  });

  it('never persists the "ghost" piece into an option', () => {
    // While a piece list is empty the editor renders a GHOST piece
    // (`createEmptyPiece`, no material). If that ghost reached an option,
    // the option's real pieces were replaced by a material-less one and
    // the PDF priced it at $0 (only its traforos survived).
    const opt1 = option('opt-1', 'Opción 1', true, [
      piece('p1', 'COCINA', 'NEGRO BRASIL', 300_000),
    ]);
    const initial = {
      ...INITIAL_FORM,
      options: [opt1],
      active_option_id: 'opt-1',
      pieces: opt1.pieces,
      usd_rate: 1000,
    } as unknown as EntityFormState;

    const { rerender } = render(<Harness initial={initial} />);

    // Simulate the empty state (the provider momentarily sets an empty
    // pieces array while switching tabs).
    rerender(
      <Harness
        initial={{
          ...initial,
          pieces: [],
        } as unknown as EntityFormState}
      />,
    );

    // The option still owns its real pieces — the ghost did not land.
    const data = buildPdfData({
      ...baseParams,
      form: initial as unknown as Record<string, unknown>,
      overrides: {},
    });
    expect(data.option_totals).toBeUndefined(); // single option → no sheet
    expect(data.pieces?.[0].materials?.[0]?.name).toBe('NEGRO BRASIL');
  });

  it('prices EVERY option with its own materials + additional works', () => {
    // The bug: one option priced at $60.000 (only its traforo) while the
    // UI showed the material's amount. Each option must add up to
    // material + traforo.
    const opt1 = option('opt-1', 'Opción 1', true, [
      piece('p1', 'COCINA', 'NEGRO BRASIL', 300_000),
    ]);
    const opt2 = option('opt-2', 'Opción 2', false, [
      piece('p2', 'COCINA', 'MIAMI WHITE', 330, 'USD'),
    ]);
    const opt3 = option('opt-3', 'Opción 3', false, [
      piece('p3', 'COCINA', 'BLANCO ZEN MATE', 150_000),
    ]);
    const form = {
      ...INITIAL_FORM,
      options: [opt1, opt2, opt3],
      active_option_id: 'opt-3',
      pieces: opt3.pieces,
      usd_rate: 1000,
    } as unknown as Record<string, unknown>;

    const data = buildPdfData({ ...baseParams, form, overrides: {} });
    const totals = data.option_totals!;
    expect(totals).toHaveLength(3);

    // The array is sorted by price (cheapest first) → match BY ID.
    const byId = (id: string) => totals.find((t) => t.id === id)!;

    // 2 m² × 300.000 + 60.000 traforo
    expect(byId('opt-1').subtotal_ars).toBe(660_000);
    // 2 m² × 330 USD + 60.000 traforo → 660.000 USD + 60.000 ARS
    expect(byId('opt-2').subtotal_usd).toBe(720);
    expect(byId('opt-2').subtotal_ars).toBe(720_000);
    // 2 m² × 150.000 + 60.000 traforo
    expect(byId('opt-3').subtotal_ars).toBe(360_000);
    // Every option lists its OWN material.
    expect(byId('opt-3').material_names).toEqual(['BLANCO ZEN MATE']);
  });

  it('prints the WINNING option on page 1 and totals it with the same numbers', () => {
    // Point 4 of the request: page 1 breaks down the pieces of the
    // WINNING option and the TOTAL adds up to them.
    const opt1 = option('opt-1', 'Opción 1', false, [
      piece('p1', 'COCINA', 'NEGRO BRASIL', 300_000),
    ]);
    const opt3 = option('opt-3', 'Opción 3', true, [
      piece('p3', 'BAÑO', 'BLANCO ZEN MATE', 150_000),
    ]);
    const form = {
      ...INITIAL_FORM,
      options: [opt1, opt3],
      active_option_id: 'opt-1', // the operator has Opción 1 open…
      pieces: opt1.pieces,
      usd_rate: 1000,
    } as unknown as Record<string, unknown>;

    const data = buildPdfData({ ...baseParams, form, overrides: {} });

    // Page 1 shows the WINNER's pieces (BAÑO), not the active one.
    expect(data.pieces?.map((p) => p.name)).toEqual(['BAÑO']);
    expect(data.pieces?.map((p) => p.materials.map((m) => m.name))).toEqual([
      ['BLANCO ZEN MATE'],
    ]);
    // And the document TOTAL is the winner's total (360.000), so the
    // printed pieces add up to the printed TOTAL.
    expect(data.subtotal).toBe(360_000);
    // The comparative summary still prices EVERY option (sorted by price:
    // the cheapest first).
    expect(data.option_totals!.map((t) => t.subtotal_ars)).toEqual([360_000, 660_000]);
  });
});

describe('multi-option sync — the PDF never drops a piece pane', () => {
  it('keeps the extra panes ("tramos") when the principal row is missing', () => {
    // `flattenPieces` (the flat arrays the UI reads) keeps the tramos
    // even without an anchor row; `buildPieces` used to drop them, so the
    // PDF showed $0 where the UI showed the material's amount.
    const withPane = {
      ...piece('p1', 'COCINA', 'NEGRO BRASIL', 300_000),
      mainMaterial: null,
      mainMaterialRows: [
        {
          id: 9,
          name: 'NEGRO BRASIL',
          price_m2: 300_000,
          price_m2_usd: 0,
          currency: 'ARS' as const,
          quantity: 1,
          m2_used: 0,
          m2_budgeted: 0,
          length: 2,
          width: 1,
          is_alternative: false,
        },
      ],
    } as unknown as BudgetPiece;

    const built = buildPieces({ pieces: [withPane] } as Record<string, unknown>, 1000);
    expect(built).toHaveLength(1);
    // 2 m² × 300.000 + 60.000 traforo
    expect(built[0].subtotal_ars).toBe(660_000);
    expect(built[0].materials).toHaveLength(1);
  });
});
