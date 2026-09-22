import React, { useMemo, useState } from 'react';
import type { Material } from '@/types/material';
import type { EntityFormState, PoolInForm } from '@/types';
import type {
  BudgetPiece,
  MaterialInForm,
} from '@/types/budget';
import type { MaterialCategory } from '@/api/resources/materials';
import type { Pool } from '@/types/poolStock';
import { useList } from '@/api/hooks';
import { getMaterialCategories } from '@/api/resources/materials';
import { parseNumber } from '@/utils/formatters';
import { M2_CONCEPTS } from '@/hooks/entityFormHelpers';
import type { UseBudgetPiecesReturn } from '@features/budgets/hooks/useBudgetPieces';
import MaterialCard from '@/components/materials/MaterialCard/MaterialCard';
import MaterialPickerControls from '@/components/materials/MaterialPickerControls/MaterialPickerControls';
import FabricationSection from '@/components/budget/FabricationSection/FabricationSection';
import AdditionalWorkSection from '@/components/budget/AdditionalWorkSection/AdditionalWorkSection';
import PoolCard from '@/components/materials/PoolCard/PoolCard';
import styles from './PiecesSection.module.css';

const s = styles as unknown as Record<string, string>;

type PieceHandlers = Omit<UseBudgetPiecesReturn, 'pieces'>;

interface PiecesSectionProps {
  form: EntityFormState;
  readOnly: boolean;
  materials: Material[];
  /** Pool catalog (from /pool-stock). */
  pools: Pool[];
  pieces: BudgetPiece[];
  handlers: PieceHandlers;
  /**
   * OT-specific: shows the inline COMPARATIVA DE MEDICIÓN (M² Real vs
   * Presupuestado) inside each piece's fabrication section when the work
   * order is in MEASUREMENT. Budgets never pass this.
   */
  showMeasurementComparison?: boolean;
}

/**
 * Render a material as a MaterialCard. Each piece's principal material may
 * carry EXTRA measurement rows ("tramos") — the anchor (`idx 0`) plus its
 * `mainMaterialRows` — so the operator can quote several differently-sized
 * panes of the same material in one card. Alternatives stay singular
 * (one row, no "+"). The per-row "Alternativa" checkbox is hidden
 * everywhere: alternatives are added via the unified dropdown and removed
 * with the ✕.
 */
function SingularMaterialCard({
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

/** Inline pool picker scoped to a single piece. Mirrors the global
 *  PoolSection but reads/writes `piece.pools` via the piece pool handlers
 *  so each mesada carries its own pileta(s). */
function PiecePools({
  piece,
  pools,
  readOnly,
  handlers,
}: {
  piece: BudgetPiece;
  pools: Pool[];
  readOnly: boolean;
  handlers: PieceHandlers;
}) {
  const pieceMaterials = useMemo(
    () =>
      [
        piece.mainMaterial,
        ...(piece.mainMaterialRows || []),
        ...(piece.alternativeMaterials || []),
      ].filter(Boolean) as MaterialInForm[],
    [piece.mainMaterial, piece.mainMaterialRows, piece.alternativeMaterials],
  );

  const handleAdd = (poolId: string) => {
    const pool = pools.find((p) => Number(p.id) === Number(poolId));
    if (!pool) return;
    handlers.setPiecePoolFields(piece.id, piece.pools.length, {
      pool_id: pool.id,
      brand: pool.brand || '',
      model: pool.model || '',
      price: Number(pool.price) || 0,
      currency: (pool.currency || 'ARS') as 'ARS' | 'USD',
      quantity: 1,
      material: '',
      image: (pool as { photo?: string }).photo || (pool as { image?: string }).image || null,
    });
  };

  // Filter the pool catalogue by pool type (SIMPLE / DOBLE) so the
  // operator can narrow the picker before adding a pileta to the piece.
  // The types are derived from the pools themselves (backend attaches
  // `pool_type_id` + `pool_type_name` to each row), so no extra fetch is
  // needed. Mirrors the legacy PoolSection's type filter behaviour.
  const [poolTypeFilter, setPoolTypeFilter] = useState<number | 'all'>('all');

  const poolTypes = useMemo(() => {
    const byType = new Map<number, string>();
    for (const p of pools) {
      const id = Number(p.pool_type_id);
      if (id > 0) byType.set(id, p.pool_type_name || `Tipo ${id}`);
    }
    return [...byType.entries()].sort(([a], [b]) => a - b);
  }, [pools]);

  const filteredPools = useMemo(() => {
    const base =
      poolTypeFilter === 'all'
        ? pools
        : pools.filter((p) => Number(p.pool_type_id) === poolTypeFilter);
    // Stable ordering (brand, then model) so the picker reads predictably
    // regardless of stock insertion order.
    return [...base].sort((a, b) => {
      const ab = `${a.brand ?? ''}`.toLowerCase();
      const bb = `${b.brand ?? ''}`.toLowerCase();
      if (ab < bb) return -1;
      if (ab > bb) return 1;
      return `${a.model ?? ''}`.toLowerCase().localeCompare(`${b.model ?? ''}`.toLowerCase());
    });
  }, [pools, poolTypeFilter]);

  return (
    <div className={s['piece-pools']}>
      <div className={s['piece-pools__header']}>
        <h4 className={s['piece-pools__title']}>PILETAS DE ESTA PIEZA</h4>
        {!readOnly && (
          <div className={s['piece-pools__filters']}>
            <select
              className={`input ${s['piece-pools__type-filter']}`}
              value={poolTypeFilter}
              onChange={(e) =>
                setPoolTypeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              disabled={readOnly}
              aria-label="Filtrar piletas por tipo"
            >
              <option value="all">Todas</option>
              {poolTypes.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
            <select
              className={`input ${s['piece-pools__add']}`}
              value=""
              onChange={(e) => {
                if (e.target.value) handleAdd(e.target.value);
                e.target.value = '';
              }}
              disabled={readOnly}
            >
              <option value="">+ AGREGAR PILETA</option>
              {filteredPools.map((p) => (
                <option key={p.id as number} value={p.id as number}>
                  {p.brand as string} - {p.model as string}
                  {p.pool_type_name ? ` (${p.pool_type_name})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {(piece.pools || []).map((pt, idx) => (
        <PoolCard
          key={`${piece.id}-pool-${idx}`}
          pt={pt}
          idx={idx}
          formMaterials={pieceMaterials}
          readOnly={readOnly}
          updatePileta={(i, field, value) => handlers.updatePiecePool(piece.id, i, field, value)}
          setPoolFields={(i, fields) => handlers.setPiecePoolFields(piece.id, i, fields)}
          removePileta={(i) => handlers.removePiecePool(piece.id, i)}
          num={(v) => parseNumber(v as string) ?? 0}
        />
      ))}
    </div>
  );
}

function PieceCard({
  piece,
  index,
  form,
  readOnly,
  materials,
  pools,
  categories,
  handlers,
  showMeasurementComparison,
}: {
  piece: BudgetPiece;
  index: number;
  form: EntityFormState;
  readOnly: boolean;
  materials: Material[];
  pools: Pool[];
  categories: MaterialCategory[];
  handlers: PieceHandlers;
  showMeasurementComparison?: boolean;
}) {
  const usdRate = Number(form.usd_rate) || 0;
  // Reactivo: la lista de materiales de la pieza (ancla + tramos del
  // principal + TODAS las alternativas activas) se recalcula
  // automáticamente cuando el operador agrega/quita/modifica cualquier
  // fila, porque las deps incluyen las 3 fuentes de verdad del modelo
  // de piezas. Cualquier fila eliminada por `removePieceAlternativeRow`
  // / `removePieceAlternative` desaparece de este array en el siguiente
  // render → la "COMPARATIVA DE MEDICIÓN" (que consume este array vía
  // `materialsData` prop) deja de mostrarla automáticamente.
  const pieceMaterials = useMemo<MaterialInForm[]>(() => {
    const rows: MaterialInForm[] = [];
    if (piece.mainMaterial) rows.push(piece.mainMaterial);
    if (Array.isArray(piece.mainMaterialRows)) {
      rows.push(...piece.mainMaterialRows);
    }
    if (Array.isArray(piece.alternativeMaterials)) {
      rows.push(...piece.alternativeMaterials);
    }
    return rows.filter(Boolean);
  }, [piece.mainMaterial, piece.mainMaterialRows, piece.alternativeMaterials]);
  const totalM2 = pieceMaterials.reduce(
    (acc, m) => acc + Number(m.length || 0) * Number(m.width || 0) * Number(m.quantity || 1),
    0,
  );

  // Agrupar las filas alternativas por material para que CADA material
  // alternativo renderice como UNA SOLA tarjeta con N panes dentro
  // (en vez de N tarjetas apiladas, una por fila). La clave de grupo
  // es el `id` del catálogo cuando existe, si no el `name` (fallback
  // para filas legacy con `id: null`). Las tarjetas son independientes:
  // el operador edita cada material por separado.
  const alternativeGroups = useMemo(() => {
    const map = new Map<
      string,
      { key: string; name: string; rows: MaterialInForm[] }
    >();
    for (const alt of piece.alternativeMaterials || []) {
      const k = String(alt.id ?? alt.name);
      const existing = map.get(k);
      if (existing) {
        existing.rows.push(alt);
      } else {
        map.set(k, { key: k, name: alt.name, rows: [alt] });
      }
    }
    return Array.from(map.values());
  }, [piece.alternativeMaterials]);

  // Unified material picker: if the piece has no main material yet, the
  // pick becomes the principal material; otherwise it's appended to the
  // piece's `alternativeMaterials` array. This is the ONLY way to add
  // alternatives in pieces v3 — the per-row checkbox was removed.
  const handlePickMaterial = (name: string) => {
    if (!piece.mainMaterial) {
      handlers.setPieceMain(piece.id, name);
    } else {
      handlers.addPieceAlternative(piece.id, name);
    }
  };

  const pickerPlaceholder = piece.mainMaterial
    ? '+ AGREGAR ALTERNATIVA DE MATERIAL'
    : '+ AGREGAR MATERIAL PRINCIPAL';

  return (
    <div className={s['piece-card']} data-testid={`piece-card-${piece.id}`}>
      <div className={s['piece-card__header']}>
        <span className={s['piece-card__index']}>PIEZA {index + 1}</span>
        <input
          className={`input ${s['piece-card__name']}`}
          value={piece.name}
          onChange={(e) => handlers.renamePiece(piece.id, e.target.value)}
          disabled={readOnly}
          aria-label="Nombre de la pieza"
          placeholder="Ej. Mesada cocina / Isla"
        />
        <span className={s['piece-card__m2']}>{totalM2.toFixed(2)} m²</span>
        <button
          type="button"
          className={s['piece-card__remove']}
          onClick={() => handlers.removePiece(piece.id)}
          disabled={readOnly}
          aria-label="Eliminar pieza"
        >
          ✕
        </button>
      </div>

      {!readOnly && (
        <div className={s['pieces__material-controls']}>
          <MaterialPickerControls
            materials={materials}
            categorias={categories}
            readOnly={readOnly}
            onPick={(mat) => handlePickMaterial(mat.name)}
            placeholder={pickerPlaceholder}
          />
        </div>
      )}

      <div className={s['pieces__materials-grid']}>
        {piece.mainMaterial && (
          <SingularMaterialCard
            rows={pieceMaterials.filter((m) => !m.is_alternative)}
            readOnly={readOnly}
            materials={materials}
            categories={categories}
            usdRate={usdRate}
            canAddRow
            onUpdateField={(idx, field, value) =>
              idx === 0
                ? handlers.updatePieceMain(piece.id, field, value)
                : handlers.updatePieceMainRow(piece.id, idx, field, value)
            }
            onUpdateGroup={(field, value) =>
              handlers.updatePieceMainGroup(piece.id, field, value)
            }
            onRemoveRow={(idx) => handlers.removePieceMainRow(piece.id, idx)}
            onAddRow={(mat) => handlers.addPieceMainRow(piece.id, mat)}
            onRemove={() => handlers.removePieceMain(piece.id)}
            onSwap={(mat) => handlers.swapPieceMain(piece.id, mat)}
          />
        )}
        {alternativeGroups.map((group) => (
          <SingularMaterialCard
            key={`${piece.id}-alt-${group.key}`}
            rows={group.rows}
            readOnly={readOnly}
            materials={materials}
            categories={categories}
            usdRate={usdRate}
            onUpdateField={(rowIdx, field, value) =>
              handlers.updatePieceAlternative(piece.id, group.key, rowIdx, field, value)
            }
            onUpdateGroup={(field, value) =>
              handlers.updatePieceAlternativeGroup(piece.id, group.key, field, value)
            }
            onRemoveRow={(rowIdx) =>
              handlers.removePieceAlternativeRow(piece.id, group.key, rowIdx)
            }
            canAddRow
            onAddRow={(mat) =>
              handlers.addPieceAlternativeRow(piece.id, group.key, mat)
            }
            onRemove={() => handlers.removePieceAlternative(piece.id, group.key)}
            onSwap={(mat) => handlers.swapPieceAlternative(piece.id, group.key, mat)}
          />
        ))}
        {!piece.mainMaterial && piece.alternativeMaterials.length === 0 && (
          <div className={s['pieces__empty']}>
            Sin materiales. Usá &quot;+ AGREGAR MATERIAL PRINCIPAL&quot;.
          </div>
        )}
      </div>

      <FabricationSection
        detalles={piece.fabrication_details}
        readOnly={readOnly}
        formMaterials={pieceMaterials}
        M2_CONCEPTS={M2_CONCEPTS}
        num={parseNumber as (v: unknown) => number}
        handleDetailChange={(idx, field, value) =>
          handlers.updatePieceFabrication(piece.id, idx, field, value)
        }
        addDetalle={() => handlers.addPieceFabrication(piece.id)}
        removeDetalle={(idx) => handlers.removePieceFabrication(piece.id, idx)}
        showMeasurementComparison={showMeasurementComparison}
        materialsData={showMeasurementComparison ? pieceMaterials : undefined}
      />

      <AdditionalWorkSection
        value={piece.additional_works_data}
        onChange={(json) => handlers.setPieceAdditionalWorks(piece.id, json)}
        readOnly={readOnly}
        formMaterials={pieceMaterials}
      />

      <PiecePools piece={piece} pools={pools} readOnly={readOnly} handlers={handlers} />
    </div>
  );
}

/**
 * Multi-piece ("piezas / mesadas") editor — pieces v3.
 *
 * Pieces-only mode is the ONLY mode in the application: this component is
 * the budget editor. There is no toggle, no "enable pieces" button, and
 * no legacy flat fallback — `form.pieces` is guaranteed to have at least
 * one piece (the form initialiser + the API serializer both enforce
 * this). Each piece owns:
 *
 *   - exactly one main material (or none until the operator picks one),
 *   - a list of alternative materials (added via the unified dropdown
 *     below the main card — there is NO per-row "Alternativa" checkbox
 *     anymore),
 *   - its own zócalo/frente rows,
 *   - its own additional works,
 *   - its own piletas (piletas no longer live as a document-global
 *     section at the bottom of the form).
 *
 * Dimensions, zócalos, frentes, traforos and piletas are defined ONCE on
 * the piece and inherited verbatim by every alternative when the PDF
 * renders the "Hoja de alternativas".
 */
export default function PiecesSection({
  form,
  readOnly,
  materials,
  pools,
  pieces,
  handlers,
  showMeasurementComparison,
}: PiecesSectionProps) {
  const { items: categories } = useList<MaterialCategory>(
    ['material-categories', 'all'],
    async () => {
      const res = await getMaterialCategories();
      return (res.data as MaterialCategory[]) || [];
    },
  );

  return (
    <div className={`card ${s['pieces']}`}>
      <div className={s['pieces__header']}>
        <h3 className="section-title">PIEZAS / MESADAS</h3>
      </div>

      <div className={s['pieces__grid']}>
        {pieces.map((piece, index) => (
          <PieceCard
            key={piece.id}
            piece={piece}
            index={index}
            form={form}
            readOnly={readOnly}
            materials={materials}
            pools={pools}
            categories={categories}
            handlers={handlers}
            showMeasurementComparison={showMeasurementComparison}
          />
        ))}
      </div>
      <button
        type="button"
        className={s['pieces__add']}
        onClick={handlers.addPiece}
        disabled={readOnly}
      >
        + AGREGAR PIEZA
      </button>
    </div>
  );
}

// Re-export for type-checking convenience.
export type { PoolInForm };
