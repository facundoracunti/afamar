import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { EntityFormState } from '@/types';
import type { BudgetOption, BudgetPiece } from '@/types/budget';
import { INITIAL_FORM } from '@/hooks/entityFormConstants';
import { BudgetOptionsProvider } from './BudgetOptionsContext';
import BudgetOptionsTabs from './BudgetOptionsTabs';

// ── Fixtures ─────────────────────────────────────────────────────────

function piece(name: string): BudgetPiece {
  return {
    id: `p-${name}`,
    name,
    mainMaterial: {
      id: 1, name: 'CALACATTA', price_m2: 100000, price_m2_usd: 0,
      currency: 'ARS', quantity: 1, m2_used: 0, m2_budgeted: 0,
      length: 2, width: 1, is_alternative: false,
    },
    alternativeMaterials: [],
    fabrication_details: [],
    additional_works_data: '[]',
    pools: [],
  };
}

function option(id: string, name: string, selected: boolean, ...pieces: BudgetPiece[]): BudgetOption {
  return { id, name, is_selected: selected, pieces };
}

function baseForm(extra: Partial<EntityFormState> = {}): EntityFormState {
  return {
    ...INITIAL_FORM,
    pieces: [piece('COCINA')],
    options: [],
    active_option_id: '',
    ...extra,
  } as unknown as EntityFormState;
}

function renderTabs(initial: EntityFormState) {
  const Wrapper = ({ children }: { children: ReactNode }) => {
    const [form, setForm] = useState<EntityFormState>(initial);
    return (
      <BudgetOptionsProvider form={form} setForm={setForm}>
        {children}
      </BudgetOptionsProvider>
    );
  };
  return render(<Wrapper><BudgetOptionsTabs /></Wrapper>);
}

// ── Tests ────────────────────────────────────────────────────────────

describe('BudgetOptionsTabs — always visible', () => {
  it('renders the bar + add button for a NEW budget (no options yet)', () => {
    // Regression: the bar used to self-hide when `options` was empty, so
    // a new budget had NO way to create a second option.
    renderTabs(baseForm());
    expect(screen.getByText('Agregar Opción')).toBeTruthy();
    // The single implicit option is shown so the bar is never empty.
    expect(screen.getByText('Opción 1')).toBeTruthy();
  });

  it('renders the bar for a budget with exactly ONE stored option', () => {
    renderTabs(baseForm({
      options: [option('opt-1', 'Opción 1', true, piece('COCINA'))],
      active_option_id: 'opt-1',
    }));
    expect(screen.getByText('Opción 1')).toBeTruthy();
    expect(screen.getByText('Agregar Opción')).toBeTruthy();
  });

  it('renders every option tab when there are 2+', () => {
    renderTabs(baseForm({
      options: [
        option('opt-1', 'Opción 1', true, piece('COCINA')),
        option('opt-2', 'Opción 2', false, piece('BAÑO')),
      ],
      active_option_id: 'opt-1',
    }));
    expect(screen.getByText('Opción 1')).toBeTruthy();
    expect(screen.getByText('Opción 2')).toBeTruthy();
    expect(screen.getByText('Agregar Opción')).toBeTruthy();
  });

  it('clicking "Agregar Opción" on a new budget creates Opción 1 + Opción 2', () => {
    // The operator must be able to reach the feature from a fresh budget:
    // pressing the button clones the current config into a second option.
    renderTabs(baseForm());
    expect(screen.queryByText('Opción 2')).toBeNull();

    fireEvent.click(screen.getByText('Agregar Opción'));

    expect(screen.getByText('Opción 1')).toBeTruthy();
    expect(screen.getByText('Opción 2')).toBeTruthy();
  });

  it('hides the remove button while only one option is stored', () => {
    renderTabs(baseForm({
      options: [option('opt-1', 'Opción 1', true, piece('COCINA'))],
      active_option_id: 'opt-1',
    }));
    // Nothing to remove yet — only the duplicate action is offered.
    expect(screen.queryByTitle(/^Quitar/)).toBeNull();
    expect(screen.getByTitle(/Duplicar/)).toBeTruthy();
  });

  it('shows the remove button once a second option exists', () => {
    renderTabs(baseForm({
      options: [
        option('opt-1', 'Opción 1', true, piece('COCINA')),
        option('opt-2', 'Opción 2', false, piece('BAÑO')),
      ],
      active_option_id: 'opt-1',
    }));
    expect(screen.getAllByTitle(/^Quitar/)).toHaveLength(2);
  });
});