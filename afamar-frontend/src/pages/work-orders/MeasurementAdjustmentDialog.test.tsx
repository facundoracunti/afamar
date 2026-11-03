import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MeasurementAdjustmentDialog from './MeasurementAdjustmentDialog';

const proposal = {
  measurement_fingerprint: 'fingerprint',
  original_total: 27384900,
  original_total_usd: 17840,
  gross_difference_ars: 18544028.1,
  positive_difference_ars: 18544028.1,
  negative_difference_ars: 0,
  difference_ars: -44,
  difference_usd: -0.04,
  discount_difference_ars: 0,
  commercial_discount_ars: 0,
  catalogue_adjustment_ars: 0,
  commercial_adjustment_delta_ars: 0,
  reconciliation_error_ars: 0,
  discount_percentage: 0,
  discount_fixed_amount: 0,
  new_total: 27384856,
  new_total_usd: 17839.96,
  payments_ars: 0,
  payments_usd: 0,
  new_balance_due: 27384856,
  new_balance_due_usd: 17839.96,
  usd_rate: 1535,
};

describe('MeasurementAdjustmentDialog', () => {
  it('renders the commercial amounts and keeps confirmation available when reconciled', () => {
    render(
      <MeasurementAdjustmentDialog
        proposal={proposal}
        open
        saving={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('Diferencia económica por medición')).toBeTruthy();
    const details = screen.getByText('Ver detalle de diferencias').closest('details');
    expect(details).toBeTruthy();
    expect(details?.hasAttribute('open')).toBe(false);
    expect(screen.getByRole('dialog').textContent).toContain('18.544.028,10');
    expect(screen.getByRole('button', { name: 'Confirmar diferencias' })).not.toHaveProperty('disabled', true);
  });

  it('reveals the auditable breakdown when expanded', () => {
    render(
      <MeasurementAdjustmentDialog
        proposal={{
          ...proposal,
          comparison: [{
            name: 'Frente Ingletetado 45°',
            measure_budgeted_str: '1,50 ml',
            measure_real_str: '1,60 ml',
            measure_delta_str: '+0,10 ml',
            subtotal_ars_str: '+$ 10.602,00',
            subtotal_usd_str: '+USD 6,84',
          }],
        }}
        open
        saving={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    screen.getByText('Ver detalle de diferencias').click();
    expect(screen.getByText('Frente Ingletetado 45°')).toBeTruthy();
    expect(screen.getByText('Diferencias positivas')).toBeTruthy();
  });

  it('shows the blocking reason and disables confirmation when historical data is missing', () => {
    render(
      <MeasurementAdjustmentDialog
        proposal={{
          ...proposal,
          approval_blocked: true,
          blocking_reasons: ['Mesada NEGRO BRASIL: m² presupuestados'],
        }}
        open
        saving={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain('Mesada NEGRO BRASIL: m² presupuestados');
    expect(screen.getByRole('button', { name: 'Confirmar diferencias' })).toHaveProperty('disabled', true);
  });
});
