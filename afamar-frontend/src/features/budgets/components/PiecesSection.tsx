import React, { useMemo } from 'react';
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
}

/**
 * Render a single material as a singular MaterialCard. Pieces v3 uses
 * the singular model (one main OR one alternative row per card) and
 * hides the per-row "Alternativa" checkbox — alternatives are added via
 * the unified dropdown at the piece header and removed with the ✕.
 */
function SingularMaterialCard({
  mat,
  readOnly,
  materials,
  categories,
  usdRate,
  onUpdateField,
  onSwap,
  onRemove,
}: {
  mat: MaterialInForm;
  readOnly: boolean;
  materials: Material[];
  categories: MaterialCategory[];
  usdRate: number;
  onUpdateField: (field: string, value: unknown) => void;
  onSwap: (mat: Material) => void;
  onRemove: () => void;
}) {
  return (
    <MaterialCard
      rows={[{ mat, idx: 0 }]}
      readOnly={readOnly}
      materials={materials}
      categorias={categories}
      usdRate={usdRate}
      hideAddRow
      hideAlternativeCheckbox
      updateMaterial={(_idx, field, value) => onUpdateField(field, value)}
      updateMaterialGroup={(_idxs, field, value) => onUpdateField(field, value)}
      removeMaterial={() => {
        /* not used (removeGroup handles it) */
      }}
      removeGroup={() => onRemove()}
      addRow={() => {
        /* not used (hideAddRow) */
      }}
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
      [piece.mainMaterial, ...(piece.alternativeMaterials || [])].filter(
        Boolean,
      ) as MaterialInForm[],
    [piece.mainMaterial, piece.alternativeMaterials],
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

  return (
    <div className={s['piece-pools']}>
      <div className={s['piece-pools__header']}>
        <h4 className={s['piece-pools__title']}>PILETAS DE ESTA PIEZA</h4>
        {!readOnly && (
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
            {pools.map((p) => (
              <option key={p.id as number} value={p.id as number}>
                {p.brand as string} - {p.model as string}
              </option>
            ))}
          </select>
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
}: {
  piece: BudgetPiece;
  index: number;
  form: EntityFormState;
  readOnly: boolean;
  materials: Material[];
  pools: Pool[];
  categories: MaterialCategory[];
  handlers: PieceHandlers;
}) {
  const usdRate = Number(form.usd_rate) || 0;
  const pieceMaterials = [piece.mainMaterial, ...(piece.alternativeMaterials)].filter(
    Boolean,
  ) as MaterialInForm[];
  const totalM2 = pieceMaterials.reduce(
    (acc, m) => acc + Number(m.length || 0) * Number(m.width || 0) * Number(m.quantity || 1),
    0,
  );

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
            mat={piece.mainMaterial}
            readOnly={readOnly}
            materials={materials}
            categories={categories}
            usdRate={usdRate}
            onUpdateField={(field, value) => handlers.updatePieceMain(piece.id, field, value)}
            onSwap={(mat) => handlers.swapPieceMain(piece.id, mat)}
            onRemove={() => handlers.removePieceMain(piece.id)}
          />
        )}
        {piece.alternativeMaterials.map((alt, idx) => (
          <SingularMaterialCard
            key={`${piece.id}-alt-${idx}`}
            mat={alt}
            readOnly={readOnly}
            materials={materials}
            categories={categories}
            usdRate={usdRate}
            onUpdateField={(field, value) => handlers.updatePieceAlternative(piece.id, idx, field, value)}
            onSwap={(mat) => handlers.swapPieceAlternative(piece.id, idx, mat)}
            onRemove={() => handlers.removePieceAlternative(piece.id, idx)}
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
