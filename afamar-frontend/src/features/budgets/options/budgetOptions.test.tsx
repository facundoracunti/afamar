import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import type { EntityFormState } from '@/types';
import type { BudgetOption, BudgetPiece } from '@/types/budget';
import { BudgetOptionsProvider, useBudgetOptions } from './BudgetOptionsContext';
import {
  activePieces,
  clonePieces,
  isMultiOption,
  nextOptionId,
  nextOptionName,
  normalizeOption,
  parseOptions,
  parsePieces,
  pickWinningOptionId,
  resolveActiveOptionId,
  SINGLE_OPTION_ID,
} from './budgetOptions';

// ── Fixtures ─────────────────────────────────────────────────────────

function piece(id: string, name: string): BudgetPiece {
  return {
    id,
    name,
    mainMaterial: {
      id: 1,
      name: 'CALACATTA',
      price_m2: 100000,
      price_m2_usd: 0,
      currency: 'ARS',
      quantity: 1,
      m2_used: 0,
      m2_budgeted: 0,
      length: 2,
      width: 1,
      is_alternative: false,
    },
    alternativeMaterials: [],
    fabrication_details: [],
    additional_works_data: '[]',
    pools: [],
  };
}

function option(id: string, name: string, isSelected = false, ...pieces: BudgetPiece[]): BudgetOption {
  return { id, name, is_selected: isSelected, pieces };
}

function wrapperFor(initial: EntityFormState) {
  return ({ children }: { children: React.ReactNode }) => {
    const [form, setForm] = useState<EntityFormState>(initial);
    return (
      <BudgetOptionsProvider form={form} setForm={setForm}>
        {children}
      </BudgetOptionsProvider>
    );
  };
}

function setup(initial: EntityFormState) {
  return renderHook(() => useBudgetOptions(), { wrapper: wrapperFor(initial) });
}

function baseForm(extra: Partial<EntityFormState> = {}): EntityFormState {
  return {
    pieces: [piece('legacy-1', 'COCINA')],
    options: [],
    active_option_id: '',
    ...extra,
  } as unknown as EntityFormState;
}

// ── Pure helpers ──────────────────────────────────────────────────────

describe('budgetOptions — parse / normalise', () => {
  it('parses an options array and drops empty options', () => {
    const raw = JSON.stringify([
      option('opt-1', 'Opción 1', false, piece('p1', 'COCINA')),
      { id: 'opt-2', name: 'Vacía', pieces: [] },
    ]);
    const parsed = parseOptions(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('opt-1');
    expect(parsed[0].pieces[0].name).toBe('COCINA');
  });

  it('returns [] for a legacy budget (no options_data)', () => {
    expect(parseOptions(null)).toEqual([]);
    expect(parseOptions('')).toEqual([]);
    expect(parseOptions('[]')).toEqual([]);
    expect(parseOptions('not-json')).toEqual([]);
  });

  it('generates id + name when missing', () => {
    const parsed = parseOptions(JSON.stringify([{ pieces: [piece('p1', 'COCINA')] }]));
    expect(parsed[0].id).toBe('opt-1');
    expect(parsed[0].name).toBe('Opción 1');
  });

  it('normalizeOption rejects non-objects and piece-less options', () => {
    expect(normalizeOption(null, 0)).toBeNull();
    expect(normalizeOption('nope', 0)).toBeNull();
    expect(normalizeOption({ id: 'x', pieces: [] }, 0)).toBeNull();
  });

  it('parsePieces accepts string / list and degrades gracefully', () => {
    expect(parsePieces(JSON.stringify([piece('p1', 'A')]))).toHaveLength(1);
    expect(parsePieces([piece('p1', 'A')])).toHaveLength(1);
    expect(parsePieces(null)).toEqual([]);
    expect(parsePieces('bad')).toEqual([]);
  });
});

describe('budgetOptions — active option resolution', () => {
  it('resolveActiveOptionId honours the stored id, then selected, then first', () => {
    const opts = [option('opt-1', 'A', false, piece('p1', 'x')), option('opt-2', 'B', true, piece('p2', 'y'))];
    expect(resolveActiveOptionId(opts, 'opt-1')).toBe('opt-1');
    expect(resolveActiveOptionId(opts, '')).toBe('opt-2');
    expect(resolveActiveOptionId(opts, 'missing')).toBe('opt-2');
    expect(resolveActiveOptionId([], 'opt-1')).toBe('');
  });

  it('activePieces falls back to legacy pieces for a legacy budget', () => {
    const legacy = [piece('legacy-1', 'COCINA')];
    expect(activePieces([], '', legacy)).toBe(legacy);
  });

  it('isMultiOption is true only with 2+ options', () => {
    expect(isMultiOption([])).toBe(false);
    expect(isMultiOption([option('a', 'A', false, piece('p', 'x'))])).toBe(false);
    expect(
      isMultiOption([
        option('a', 'A', false, piece('p1', 'x')),
        option('b', 'B', false, piece('p2', 'y')),
      ]),
    ).toBe(true);
  });

  it('nextOptionId / nextOptionName skip taken values', () => {
    const opts = [option('opt-1', 'Opción 1', false, piece('p1', 'x'))];
    expect(nextOptionId(opts)).toBe('opt-2');
    expect(nextOptionName(opts)).toBe('Opción 2');
    expect(nextOptionName([option('opt-1', 'Opción 2', false, piece('p1', 'x'))])).toBe('Opción 3');
  });
});

describe('budgetOptions — pickWinningOptionId', () => {
  it('returns the explicit id when it exists', () => {
    const opts = [option('opt-1', 'A', false, piece('p1', 'x')), option('opt-2', 'B', false, piece('p2', 'y'))];
    expect(pickWinningOptionId(opts, 'opt-2')).toBe('opt-2');
  });

  it('falls back to the single selected option', () => {
    const opts = [option('opt-1', 'A', false, piece('p1', 'x')), option('opt-2', 'B', true, piece('p2', 'y'))];
    expect(pickWinningOptionId(opts)).toBe('opt-2');
  });

  it('refuses to guess when ambiguous (conversion guard)', () => {
    const opts = [option('opt-1', 'A', false, piece('p1', 'x')), option('opt-2', 'B', false, piece('p2', 'y'))];
    expect(pickWinningOptionId(opts)).toBeNull();
  });

  it('legacy budget resolves to SINGLE', () => {
    expect(pickWinningOptionId([])).toBe(SINGLE_OPTION_ID);
  });
});

// ── Provider behaviour ────────────────────────────────────────────────

describe('BudgetOptionsProvider — mirror + CRUD', () => {
  it('legacy budget is inert: options stay empty and pieces flow through', () => {
    const { result } = setup(baseForm());
    expect(result.current?.options).toEqual([]);
    expect(result.current?.isMultiOption).toBe(false);
    expect(result.current?.activeOptionId).toBe('');
    expect(result.current?.activePieces[0].name).toBe('COCINA');
  });

  it('addOption materialises the current config as Opción 1 and CLONES it as Opción 2', () => {
    // A new / legacy budget has no materialised option. "+ Agregar Opción"
    // must not start from scratch (the operator would have to rewrite
    // everything): the current pieces become "Opción 1" and a CLONE
    // becomes "Opción 2", ready for a single-material swap (e.g. alzada →
    // Blanco Zen Mate).
    const { result } = setup(baseForm());
    expect(result.current!.options).toHaveLength(0);

    act(() => result.current!.addOption());

    const opts = result.current!.options;
    expect(opts).toHaveLength(2);
    expect(opts[0].id).toBe('opt-1');
    expect(opts[0].name).toBe('Opción 1');
    expect(opts[0].is_selected).toBe(true);
    expect(opts[1].id).toBe('opt-2');
    expect(opts[1].name).toBe('Opción 2');
    expect(opts[1].is_selected).toBe(false);

    // The clone carries the SAME configuration but FRESH piece ids, so
    // editing the copy never mutates the original.
    expect(opts[1].pieces[0].name).toBe('COCINA');
    expect(opts[1].pieces[0].id).not.toBe(opts[0].pieces[0].id);
    // Opción 2 is the one being edited.
    expect(result.current!.activeOptionId).toBe('opt-2');
  });

  it('addOption clones the ACTIVE option when options already exist', () => {
    const optA = option('opt-1', 'Opción 1', true, piece('p1', 'COCINA'));
    const optB = option('opt-2', 'Opción 2', false, piece('p2', 'BAÑO'));
    const { result } = setup(
      baseForm({ options: [optA, optB], active_option_id: 'opt-2' }),
    );

    act(() => result.current!.addOption());

    const opts = result.current!.options;
    expect(opts).toHaveLength(3);
    const added = opts[2];
    expect(added.name).toBe('Opción 3');
    expect(added.is_selected).toBe(false);
    // Cloned from the ACTIVE option (Opt2 / BAÑO), not the first one.
    expect(added.pieces[0].name).toBe('BAÑO');
    expect(added.pieces[0].id).not.toBe('p2');
    expect(result.current!.activeOptionId).toBe(added.id);
  });

  it('duplicateOption deep-clones with fresh piece ids', () => {
    const src = option('opt-1', 'Opción 1', true, piece('p1', 'COCINA'));
    const { result } = setup(baseForm({ options: [src], active_option_id: 'opt-1' }));
    act(() => result.current!.duplicateOption('opt-1'));

    const opts = result.current!.options;
    expect(opts).toHaveLength(2);
    // The copy has a distinct piece id so editing it never mutates the original.
    expect(opts[1].pieces[0].id).not.toBe(opts[0].pieces[0].id);
    expect(opts[1].pieces[0].name).toBe('COCINA');
    // A duplicate is never the winner by default.
    expect(opts[1].is_selected).toBe(false);
    expect(result.current!.activeOptionId).toBe('opt-2');
  });

  it('removeOption drops it and promotes a survivor when the winner was removed', () => {
    const src1 = option('opt-1', 'Opción 1', true, piece('p1', 'A'));
    const src2 = option('opt-2', 'Opción 2', false, piece('p2', 'B'));
    const { result } = setup(baseForm({ options: [src1, src2], active_option_id: 'opt-1' }));
    act(() => result.current!.removeOption('opt-1'));

    expect(result.current!.options).toHaveLength(1);
    // The survivor is promoted so exactly one winner remains.
    expect(result.current!.options[0].is_selected).toBe(true);
    expect(result.current!.activeOptionId).toBe('opt-2');
  });

  it('selectOption marks exactly one winner', () => {
    const src1 = option('opt-1', 'Opción 1', true, piece('p1', 'A'));
    const src2 = option('opt-2', 'Opción 2', false, piece('p2', 'B'));
    const { result } = setup(baseForm({ options: [src1, src2], active_option_id: 'opt-1' }));
    act(() => result.current!.selectOption('opt-2'));

    const opts = result.current!.options;
    expect(opts.find((o) => o.is_selected)?.id).toBe('opt-2');
    expect(opts.filter((o) => o.is_selected)).toHaveLength(1);
  });

  it('renameOption updates the label', () => {
    const src = option('opt-1', 'Opción 1', false, piece('p1', 'A'));
    const { result } = setup(baseForm({ options: [src], active_option_id: 'opt-1' }));
    act(() => result.current!.renameOption('opt-1', 'Opción full Negro'));
    expect(result.current!.options[0].name).toBe('Opción full Negro');
  });

  it('syncActivePieces writes the edited pieces into the active option', () => {
    const src = option('opt-1', 'Opción 1', true, piece('p1', 'COCINA'));
    const { result } = setup(baseForm({ options: [src], active_option_id: 'opt-1' }));
    const edited = [piece('p1', 'COCINA EDITADA')];
    act(() => result.current!.syncActivePieces(edited));
    expect(result.current!.options[0].pieces[0].name).toBe('COCINA EDITADA');
  });

  it('setActiveOptionId switches the active option', () => {
    const src1 = option('opt-1', 'Opción 1', true, piece('p1', 'A'));
    const src2 = option('opt-2', 'Opción 2', false, piece('p2', 'B'));
    const { result } = setup(baseForm({ options: [src1, src2], active_option_id: 'opt-1' }));
    act(() => result.current!.setActiveOptionId('opt-2'));
    expect(result.current!.activeOptionId).toBe('opt-2');
  });
});

describe('clonePieces', () => {
  it('gives every cloned piece a fresh id but keeps the values', () => {
    const src = piece('p1', 'COCINA');
    src.alternativeMaterials = [
      {
        id: 2,
        name: 'NEGRO',
        price_m2: 300000,
        price_m2_usd: 0,
        currency: 'ARS',
        quantity: 1,
        m2_used: 0,
        m2_budgeted: 0,
        length: 2,
        width: 1,
        is_alternative: true,
      },
    ];
    const [copy] = clonePieces([src]);
    expect(copy.id).not.toBe('p1');
    expect(copy.name).toBe('COCINA');
    expect(copy.alternativeMaterials[0].name).toBe('NEGRO');
    // The alternative row is a COPY (the clone must never share the
    // original's object references).
    expect(copy.alternativeMaterials[0]).not.toBe(src.alternativeMaterials[0]);
  });
});