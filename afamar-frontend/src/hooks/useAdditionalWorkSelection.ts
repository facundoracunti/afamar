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
    },
    {
      "additional_work_id": 5,
      "type": "frente",
      "name": "Frente / Regrueso",
      "linear_meters": 2.93,
      "assigned_material_id": 42,
      "price": 49.34,
      "total": 144.57,
      "currency": "USD",
      "formula_values": { "material_price_m2_at_selection": 330.0,
                          "multiplier": 1.15,
                          "computed_at": "..." }
    }]

The total is recomputed client-side at edit time and frozen into the
JSON so historical budgets don't drift when the operator edits the
catalogue or the assigned material.
*/
export { useEffect, useMemo, useState, useCallback } from 'react';
export type { AdditionalWork } from '../types/additionalWork';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { getAdditionalWorks } from '../api/resources/additionalWorks';
import type { AdditionalWork } from '../types/additionalWork';
import { POOL_MATERIAL_GLOBAL } from '../types/budget';
import { applyAdditionalWorkField } from '../utils/additionalWorkCalc';
import {
  AdditionalWorkSelection as ParseAdditionalWorkSelection,
  parseAdditionalWorksData,
  serializeAdditionalWorksData,
} from '../utils/additionalWorkParse';

// Re-export so existing callers that import from the hook keep working.
export {
  parseAdditionalWorksData,
  serializeAdditionalWorksData,
} from '../utils/additionalWorkParse';
export type { AdditionalWorkSelection } from '../utils/additionalWorkParse';

interface AddArgs {
  catalogueItem: AdditionalWork;
  quantity?: number;
  initialAssignedMaterialId?: number | null;
  initialLinearMeters?: number;
}

/** Hook that owns the selection + a small set of mutators the picker UI
 *  needs. State lives in the parent (BudgetForm / WorkOrderForm); the
 *  hook just bundles the parsing and the mutators so the JSX stays
 *  declarative. */
export function useAdditionalWorkSelection(initialJson: string | null | undefined) {
  const [selections, setSelections] = useState<ParseAdditionalWorkSelection[]>(() =>
    parseAdditionalWorksData(initialJson),
  );

  // Re-sync local state from the parent's `value` whenever it changes
  // *from outside* the hook's own mutations. Without this, sibling
  // pickers (e.g. the per-material "Asignar Frente / Regrueso" dropdown
  // in AdditionalWorkSection) write through `onChange` directly and the
  // local `selections` array stays stale — so newly added rows never
  // render even though the parent has them.
  //
  // Idempotent: the `JSON.stringify` short-circuit avoids re-rendering
  // when our own `useEffect([selections])` writes the same JSON back
  // through the parent.
  useEffect(() => {
    const next = parseAdditionalWorksData(initialJson);
    setSelections((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
      return next;
    });
  }, [initialJson]);

  const add = useCallback((args: AddArgs) => {
    const { catalogueItem, quantity = 1, initialAssignedMaterialId = null, initialLinearMeters = 0 } = args;
    setSelections((prev) => {
      // Flat items: dedupe by `additional_work_id` so a catalogue item
      // appears at most once (you don't want 3 "Pulido" rows).
      // Frente items: append WITHOUT deduping — the operator needs one
      // row per material (e.g. one per principal + one per alternativa)
      // and the catalogue id is the same for all of them. Removing by
      // index (`removeAt`) is the safe way to drop a specific row.
      const base = catalogueItem.type === 'frente'
        ? prev
        : prev.filter((s) => s.additional_work_id !== catalogueItem.id);
      if (catalogueItem.type === 'frente') {
        const linear_meters = Math.max(0, Number(initialLinearMeters) || 0);
        const newRow: ParseAdditionalWorkSelection = {
          additional_work_id: catalogueItem.id,
          name: catalogueItem.name,
          detail: catalogueItem.detail,
          price: 0,
          currency: catalogueItem.currency,
          quantity: 1,
          total: 0,
          materialName: POOL_MATERIAL_GLOBAL,
          type: 'frente',
          linear_meters,
          assigned_material_id: initialAssignedMaterialId,
          formula_values: null,
        };
        return [...base, newRow];
      }
      const total = Math.round((catalogueItem.price * quantity) * 100) / 100;
      return [
        ...base,
        {
          additional_work_id: catalogueItem.id,
          name: catalogueItem.name,
          detail: catalogueItem.detail,
          price: catalogueItem.price,
          currency: catalogueItem.currency,
          quantity,
          total,
          materialName: POOL_MATERIAL_GLOBAL,
          type: 'flat',
        },
      ];
    });
  }, []);

  const remove = useCallback((additionalWorkId: number | null) => {
    if (additionalWorkId == null) return;
    setSelections((prev) => {
      // Only drop the FIRST matching row. Used for flat items where the
      // catalogue id is unique within `selections`; for frentes the
      // parent should call `removeAt(idx)` so the user can pick which
      // row to drop without nuking the rest of the same catalogue id.
      const idx = prev.findIndex((s) => s.additional_work_id === additionalWorkId);
      if (idx < 0) return prev;
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });
  }, []);

  /** Remove the row at `idx` regardless of catalogue id. Use this from
   *  the X button on the additional-work card so deleting a frente
   *  tied to one material doesn't accidentally drop the frentes tied
   *  to other materials (which all share the same catalogue id). */
  const removeAt = useCallback((idx: number) => {
    setSelections((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateQuantity = useCallback((additionalWorkId: number | null, quantity: number) => {
    if (quantity <= 0) return;
    setSelections((prev) =>
      prev.map((s) => {
        if (s.additional_work_id !== additionalWorkId) return s;
        const total = Math.round((s.price * quantity) * 100) / 100;
        return { ...s, quantity, total };
      }),
    );
  }, []);

  const updateField = useCallback(
    (
      idx: number,
      field: string,
      value: unknown,
      options?: {
        catalogueItem?: AdditionalWork | null;
        materialOptions?: import('../utils/frentePricing').FrenteMaterialOption[];
      },
    ) => {
      setSelections((prev) => {
        const next = [...prev];
        next[idx] = applyAdditionalWorkField(next[idx], field, value, options);
        return next;
      });
    },
    [],
  );

  const totalArs = useMemo(
    () =>
      selections
        .filter((s) => s.currency === 'ARS')
        .reduce((sum, s) => sum + s.total, 0),
    [selections],
  );
  const totalUsd = useMemo(
    () =>
      selections
        .filter((s) => s.currency === 'USD')
        .reduce((sum, s) => sum + s.total, 0),
    [selections],
  );

  return {
    selections,
    add,
    remove,
    removeAt,
    updateQuantity,
    updateField,
    totalArs,
    totalUsd,
  };
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
        if (!cancelled) setItems(data as AdditionalWork[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loading };
}



