import React, { useMemo } from 'react';
import type { Material } from '@/types/material';
import type { EntityFormState } from '@/types';
import type { BudgetPiece, MaterialInForm } from '@/types/budget';
import type { MaterialCategory } from '@/api/resources/materials';
import type { Pool } from '@/types/poolStock';
import { parseNumber } from '@/utils/formatters';
import { M2_CONCEPTS } from '@/hooks/entityFormHelpers';
import MaterialPickerControls from '@/components/materials/MaterialPickerControls/MaterialPickerControls';
import FabricationSection from '@/components/budget/FabricationSection/FabricationSection';
import AdditionalWorkSection from '@/components/budget/AdditionalWorkSection/AdditionalWorkSection';
import SingularMaterialCard from './PiecesSection.SingularMaterialCard';
import PiecePools from './PiecesSection.PiecePools';
import styles from './PiecesSection.module.css';
import type { PieceHandlers } from './PiecesSection.types';

const s = styles as unknown as Record<string, string>;

/**
 * One piece (mesada) of the pieces editor: its header (name, m², delete),
 * its principal material card + one card per alternative material, its
 * zócalo/frente rows, its additional works and its piletas.
 */
export default function PieceCard({
  piece,
  index,
  form,
  readOnly,
  materials,
  pools,
  categories,
  handlers,
  showMeasurementComparison,
  canRemove,
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
  canRemove?: boolean;
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
  // pick becomes the principal material.
  //
  // 2026-10-01 (punto 2 del pedido): the "+ AGREGAR ALTERNATIVA DE MATERIAL"
  // entry point was REMOVED from the piece cards. The business model now
  // expresses variants at the OPCIONES level (the tabs above each option
  // owns its own pieces / materials / piletas), so a per-piece material
  // alternative was a second, conceptually duplicated way of quoting the
  // same thing — and the operator mixed both up (they added an
  // "alternative" inside a piece and expected it to show up as a
  // separate option in the comparative summary, which it never did).
  //
  // The picker therefore only shows up while the piece has NO principal
  // material yet ("+ AGREGAR MATERIAL PRINCIPAL"). Alternatives can still
  // be created by the pileta-override flow ("PILETAS ALTERNATIVAS POR
  // VARIANTE"), which is a different feature (per-variant sink).
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
          disabled={readOnly || canRemove === false}
          title={canRemove === false ? 'Debe quedar al menos una pieza' : undefined}
          aria-label="Eliminar pieza"
        >
          ✕
        </button>
      </div>

      {!readOnly && !piece.mainMaterial && (
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

      {piece.mainMaterial && (
        <p className={s['piece-card__variant-hint']}>
          Para cotizar una variante (por ejemplo, cambiar el material de la
          alzada) usá <strong>«Agregar Opción»</strong> en la barra de
          opciones: cada opción tiene sus propias piezas y materiales.
        </p>
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
