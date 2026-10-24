import React from 'react';
import type { Material } from '@/types/material';
import type { MaterialInForm } from '@/types/budget';
import type { MaterialCategory } from '@/api/resources/materials';
import { parseNumber } from '@/utils/formatters';
import MaterialCard from '@/components/materials/MaterialCard/MaterialCard';

/**
 * Render a material as a MaterialCard. Each piece's principal material may
 * carry EXTRA measurement rows ("tramos") — the anchor (`idx 0`) plus its
 * `mainMaterialRows` — so the operator can quote several differently-sized
 * panes of the same material in one card. Alternatives stay singular
 * (one row, no "+"). The per-row "Alternativa" checkbox is hidden
 * everywhere: alternatives are added via the unified dropdown and removed
 * with the ✕.
 */
export default function SingularMaterialCard({
  rows,
  readOnly,
  materials,
  categories,
  usdRate,
  onUpdateField,
  onUpdateGroup,
  onRemoveRow,
  onAddRow,
  onRemove,
  onSwap,
  canAddRow = false,
}: {
  rows: MaterialInForm[];
  readOnly: boolean;
  materials: Material[];
  categories: MaterialCategory[];
  usdRate: number;
  /** Field edit for ONE row (idx within `rows`). Map it to the anchor or a
   *  tramo, or in the alternatives case to `updatePieceAlternative`. */
  onUpdateField: (idx: number, field: string, value: unknown) => void;
  /** Apply `field` to EVERY row of the card (shared price input). */
  onUpdateGroup: (field: string, value: unknown) => void;
  /** Remove ONE row (per-row ✕, only shown when rows.length > 1). */
  onRemoveRow: (idx: number) => void;
  /** Add another measurement row of the same material. */
  onAddRow: (mat: MaterialInForm) => void;
  /** Remove the whole card. */
  onRemove: () => void;
  onSwap: (mat: Material) => void;
  canAddRow?: boolean;
}) {
  return (
    <MaterialCard
      rows={rows.map((mat, idx) => ({ mat, idx }))}
      readOnly={readOnly}
      materials={materials}
      categorias={categories}
      usdRate={usdRate}
      hideAddRow={!canAddRow}
      hideAlternativeCheckbox
      updateMaterial={(idx, field, value) => onUpdateField(idx, field, value)}
      updateMaterialGroup={(_idxs, field, value) => onUpdateGroup(field, value)}
      removeMaterial={(idx) => onRemoveRow(idx)}
      removeGroup={() => onRemove()}
      addRow={(mat) => onAddRow(mat)}
      onChangeMaterial={onSwap}
      num={(v) => parseNumber(v as string) ?? 0}
    />
  );
}
