/** State + helpers for the "Adicionales" picker on the budget / WO form.

The form holds the selection as a JSON-encoded `additional_works_data`
string in the wire payload (same column on the budget/WO row that
`fabrication_details` lives next to). The catalogue is fetched once
on mount from `/additional-works`; each selected row keeps the snapshot
fields the budget needs to render and to survive catalogue edits:

    [{
      "additional_work_id": 1,
      "name": "Pulido de bordes",
      "detail": "Pulido fino en ...",
      "price": 15000.0,
      "currency": "ARS",
      "quantity": 2,
      "total": 30000.0
    }]

The `total` is computed at selection time and frozen into the JSON so
historical budgets don't drift when the operator edits the
catalogue.
*/
import { useCallback, useEffect, useState } from 'react';

import { getAdditionalWorks } from '../api/resources/additionalWorks';
import type { AdditionalWork } from '../types/additionalWork';
import { POOL_MATERIAL_GLOBAL } from '../types/budget';

export interface AdditionalWorkSelection {
  /** Null when the snapshot predates the catalogue (rare — only when
   *  the operator deleted the catalogue row and left the budget alone).
   *  In that case the name field still has the historical value. */
  additional_work_id: number | null;
  name: string;
  detail: string | null;
  price: number;
  currency: 'ARS' | 'USD';
  quantity: number;
  total: number;
  /** Optional link to the material/alternative this adicional belongs to:
   *  - `POOL_MATERIAL_GLOBAL` ('__GLOBAL__') → global / extras section
   *    (common to all options, adds to every subtotal).
   *  - any other string → matches a material name. */
  materialName?: string;
}

export function parseAdditionalWorksData(json: string | null | undefined): AdditionalWorkSelection[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed.filter((row): row is AdditionalWorkSelection => {
        return (
          row != null &&
          typeof row === 'object' &&
          typeof row.name === 'string' &&
          typeof row.price === 'number' &&
          typeof row.quantity === 'number' &&
          (row.currency === 'ARS' || row.currency === 'USD')
        );
      });
    }
  } catch {
    // Treat malformed JSON as empty — the form will just show no
    // adicionales on load and the user can re-add them.
  }
  return [];
}

export function serializeAdditionalWorksData(items: AdditionalWorkSelection[]): string {
  return JSON.stringify(items);
}

/** Fetch the catalogue (active rows only). Used by the picker. */
export function useAdditionalWorksCatalogue() {
  const [items, setItems] = useState<AdditionalWork[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAdditionalWorks();
        if (!cancelled) setItems(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { items, loading };
}

/** Hook that owns the selection + a small set of mutators the picker UI
 *  needs. State lives in the parent (BudgetForm / WorkOrderForm); the
 *  hook just bundles the parsing and the mutators so the JSX stays
 *  declarative. */
export function useAdditionalWorkSelection(initialJson: string | null | undefined) {
  const [selections, setSelections] = useState<AdditionalWorkSelection[]>(() =>
    parseAdditionalWorksData(initialJson)
  );

  const add = useCallback((item: AdditionalWork, quantity: number) => {
    if (quantity <= 0) return;
    setSelections((prev) => {
      // Replace if the same adicional is already selected (so the picker
      // doesn't show duplicates and the user can update the quantity in
      // place).
      const filtered = prev.filter((s) => s.additional_work_id !== item.id);
      const total = Math.round((item.price * quantity) * 100) / 100;
      return [
        ...filtered,
        {
          additional_work_id: item.id,
          name: item.name,
          detail: item.detail,
          price: item.price,
          currency: item.currency,
          quantity,
          total,
          materialName: POOL_MATERIAL_GLOBAL,
        },
      ];
    });
  }, []);

  const remove = useCallback((additionalWorkId: number | null) => {
    setSelections((prev) => prev.filter((s) => s.additional_work_id !== additionalWorkId));
  }, []);

  const updateQuantity = useCallback((additionalWorkId: number | null, quantity: number) => {
    if (quantity <= 0) return;
    setSelections((prev) =>
      prev.map((s) => {
        if (s.additional_work_id !== additionalWorkId) return s;
        const total = Math.round((s.price * quantity) * 100) / 100;
        return { ...s, quantity, total };
      })
    );
  }, []);

  const updateField = useCallback((idx: number, field: string, value: unknown) => {
    setSelections((prev) => {
      const next = [...prev];
      const row = { ...next[idx] };
      if (field === 'price') {
        row.price = Number(value) || 0;
        row.total = Math.round((row.price * row.quantity) * 100) / 100;
      } else if (field === 'quantity') {
        row.quantity = Number(value) || 1;
        row.total = Math.round((row.price * row.quantity) * 100) / 100;
      } else if (field === 'materialName') {
        row.materialName = String(value ?? POOL_MATERIAL_GLOBAL);
      }
      next[idx] = row;
      return next;
    });
  }, []);

  const totalArs = selections
    .filter((s) => s.currency === 'ARS')
    .reduce((sum, s) => sum + s.total, 0);
  const totalUsd = selections
    .filter((s) => s.currency === 'USD')
    .reduce((sum, s) => sum + s.total, 0);

  return { selections, add, remove, updateQuantity, updateField, totalArs, totalUsd };
}
