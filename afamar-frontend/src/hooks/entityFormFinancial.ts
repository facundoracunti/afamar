/**
 * FinancialBase serialization helpers for the entity form.
 */

import type { EntityFormState } from '../types';
import type { FinancialBase } from '../types/shared';

export function buildFinancialPayload(form: EntityFormState): FinancialBase {
  return {
    currency: form.currency || 'ARS',
    usd_rate: Number(form.usd_rate) || 1000,
    subtotal: Number(form.subtotal),
    transport: Number(form.transport),
    total: Number(form.total),
    subtotal_usd: Number(form.subtotal_usd) || 0,
    transport_usd: Number(form.transport_usd) || 0,
    total_usd: Number(form.total_usd) || 0,
    deposit_received: Number(form.deposit_received),
    deposit_currency: form.deposit_currency || 'ARS',
    deposit_usd: Number(form.deposit_usd) || 0,
    balance_due: Number(form.balance_due),
    balance_due_usd: Number(form.balance_due_usd) || 0,
    payment_method: form.payment_method || null,
    installments: Number(form.installments) || 1,
    discount_percentage: Number(form.discount_percentage) || 0,
    discount_fixed_amount: Number(form.discount_fixed_amount) || 0,
  };
}

export function mapFinancialToForm(d: Record<string, unknown>): FinancialBase {
  return {
    currency: (d.currency as string) || 'ARS',
    usd_rate: (d.usd_rate as number) ?? 1000,
    subtotal: (d.subtotal as number) || 0,
    transport: (d.transport as number) || 0,
    total: (d.total as number) || 0,
    subtotal_usd: (d.subtotal_usd as number) || 0,
    transport_usd: (d.transport_usd as number) || 0,
    total_usd: (d.total_usd as number) || 0,
    deposit_received: (d.deposit_received as number) || 0,
    deposit_currency: (d.deposit_currency as string) || 'ARS',
    deposit_usd: (d.deposit_usd as number) || 0,
    balance_due: (d.balance_due as number) || 0,
    balance_due_usd: (d.balance_due_usd as number) || 0,
    payment_method: (d.payment_method as string) || '',
    installments: (d.installments as number) || 1,
    discount_percentage: (d.discount_percentage as number) ?? 0,
    discount_fixed_amount: (d.discount_fixed_amount as number) ?? 0,
  };
}
