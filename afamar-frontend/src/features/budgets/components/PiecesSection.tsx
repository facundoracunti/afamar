import React from 'react';
import type { PoolInForm } from '@/types';
import type { MaterialCategory } from '@/api/resources/materials';
import { useList } from '@/api/hooks';
import { getMaterialCategories } from '@/api/resources/materials';
import PieceCard from './PiecesSection.PieceCard';
import styles from './PiecesSection.module.css';
import type { PiecesSectionProps } from './PiecesSection.types';

const s = styles as unknown as Record<string, string>;

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
 *
 * The card itself lives in `PiecesSection.PieceCard.tsx`.
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
            canRemove={pieces.length > 1}
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
