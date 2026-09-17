/**
 * "Bacha integrada" validation helpers.
 *
 * Some materials can't carry an integrated sink cutout — either because
 * they're too porous (granites like DALLAS) or because the operator pinned
 * `allows_integrated_sink = false` on the material. The additional-work
 * catalogue carries a flat row named "Bacha Integrada"; these helpers let
 * the form picker block/hide that option for incompatible materials.
 *
 * Detection is name-based because the catalogue has no structured
 * `integrated_sink` flag — the seeded name is "Bacha Integrada" and there
 * is no stable id worth hardcoding (operators can add/remove catalogue
 * rows).
 */

import type { MaterialInForm } from '../types/budget';
import { POOL_MATERIAL_GLOBAL } from '../types/budget';

const INTEGRATED_SINK_RE = /bacha.*integrada|integrated.*sink/i;

/** Whether an additional-work catalogue name is the integrated-sink work. */
export function isIntegratedSinkWork(name: string | null | undefined): boolean {
  return !!name && INTEGRATED_SINK_RE.test(name);
}

/**
 * Whether the material identified by `materialName` allows an integrated
 * sink. `materialName` may carry the `__ALT__:` alternative prefix (e.g.
 * `__ALT__:NEGRO BRASIL`), which is stripped before the lookup.
 *
 * Returns `true` when the material can't be resolved (global assignment,
 * legacy rows without the flag, or a name that's no longer in the form):
 * the backend remains the source of truth and an optimistic default avoids
 * hiding a valid option on incomplete data.
 */
export function materialAllowsIntegratedSink(
  materialName: string | null | undefined,
  formMaterials: MaterialInForm[],
): boolean {
  if (!materialName || materialName === POOL_MATERIAL_GLOBAL) return true;
  const bare = materialName.startsWith('__ALT__:')
    ? materialName.slice('__ALT__:'.length)
    : materialName;
  const match = (formMaterials || []).find((m) => m && m.name === bare);
  if (!match) return true;
  return match.allows_integrated_sink !== false;
}
