/**
 * Entity form ↔ API serialization — PUBLIC BARREL.
 *
 * The thin facade that ``useEntityForm`` consumes. The implementations
 * live in focused submodules:
 *
 *   * ``entityFormSerialization.helpers.ts`` — JSON / date coercions and the
 *                                              legacy-alternative flag
 *   * ``entityFormSerialization.pieces.ts``  — pieces (mesadas) hydration
 *                                              + legacy → pieces v3 migration
 *   * ``entityFormSerialization.options.ts`` — multi-option scenarios
 *   * ``entityFormSerialization.payload.ts`` — ``buildPayload``
 *   * ``entityFormSerialization.form.ts``     — ``mapApiToForm``
 *   * ``entityForm/sketch.ts``                — sketch page ↔ wire format
 *                                              (`[{pagina_id, name, material?,
 *                                              dibujo}]` ↔
 *                                              `[{type, data, order}]` legacy)
 *   * ``entityForm/piecesHydration.ts``       — bake the budgeted-measurement
 *                                              snapshot onto each piece so
 *                                              the COMPARATIVA DE MEDICIÓN
 *                                              survives any round-trip.
 *
 * Public API unchanged (``buildPayload``, ``mapApiToForm``,
 * ``hydratePiecesSnapshots``, ``todayLocalISO``) so the existing tests +
 * callers keep working.
 */

export { todayLocalISO } from '../utils/formatters';
export {
  serializeSketchPages,
  unflattenSketchElements,
  type SketchWireElement,
  type SketchWirePage,
} from './entityForm/sketch';
export {
  hydratePiecesSnapshots,
  hydrateSnapshotKeys,
  SNAPSHOT_MATERIAL_KEYS,
  SNAPSHOT_FABRICATION_KEYS,
  SNAPSHOT_ADDITIONAL_KEYS,
} from './entityForm/piecesHydration';
export { buildPayload } from './entityFormSerialization.payload';
export { mapApiToForm } from './entityFormSerialization.form';

// Re-export the piece types so older callers that imported them via
// `entityFormSerialization` still type-check (the canonical definitions
// live in `types/budget.ts`).
export type { BudgetPiece, FabricationDetail, MaterialInForm, PoolInForm } from '../types/budget';
