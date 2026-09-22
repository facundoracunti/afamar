/**
 * Cash-movement cell formatters used by `CashDailyPage`'s income /
 * expense tables. Extracted into pure functions so we can unit-test
 * the OT ↔ movement mapping without rendering the whole page.
 *
 * The cash module historically embedded `remaining_balance` and
 * `folder_status` (= the OT status) at the moment the movement was
 * created. Movements older than the new "current OT" view don't have
 * those fields populated, so we resolve them by:
 *
 *   1. Asking the live work-order cache (`workOrdersById`) for the OT.
 *   2. Falling back to the snapshot fields baked into the movement.
 *   3. Falling back to the movement's own `order_total - amount` if
 *      we know the order_total.
 *
 * The renderers ALWAYS format as currency / status badge (never `'—'`)
 * when the movement has an `order_id` — the only legitimate case for
 * a dash is a movement with NO associated order (e.g. a manual
 * expense / generic income).
 */
import type { CashMovement } from '../types/cash';
import type { WorkOrderListItem } from '../types/workOrder';

export type WorkOrdersById = Map<number, WorkOrderListItem>;

/** Resolve the SALDO RESTANTE for a cash movement.
 *
 *  Priority:
 *    1. The OT's CURRENT `balance_due` from `workOrdersById` (the OT
 *       state the user expects to see, not the snapshot at payment
 *       time).
 *    2. The movement's stored `remaining_balance` (legacy snapshot
 *       value if the OT was deleted / not in the cache).
 *    3. `order_total - amount` heuristic if both are positive and we
 *       have an `order_id` (covers the edge case where the OT row
 *       exists but the cached list doesn't include it).
 *    4. `null` — only when the movement has no `order_id`.
 *
 *  Returns `null` (not `0`!) when we genuinely don't know — callers
 *  decide whether to render `$ 0,00` (the safe display) or `'-'`
 *  (when there's no order at all).
 */
export function resolveBalanceDue(
  movement: CashMovement,
  workOrdersById: WorkOrdersById,
): number | null {
  const orderId = movement.order_id;
  if (orderId == null) return null;

  const orderIdNum: number = orderId;
  const live = workOrdersById.get(orderIdNum);
  if (live) {
    // The OT is in the live cache — show the CURRENT outstanding
    // balance. Falls back to 0 (fully paid) rather than null so the
    // cell always renders a numeric currency value.
    return Number(live.balance_due) || 0;
  }

  const snap = movement.remaining_balance;
  if (snap !== null && snap !== undefined) return Number(snap) || 0;

  if (movement.order_total != null && movement.order_total > 0) {
    return Math.max(0, Number(movement.order_total) - Number(movement.amount || 0));
  }

  // Last resort: the OT exists in the DB but we don't have its
  // current data. Return 0 so the operator doesn't see a dash for a
  // valid OT — the real value will refresh on next reload.
  return 0;
}

/** Resolve the ESTADO (OT status) for a cash movement.
 *
 *  Priority:
 *    1. The OT's CURRENT `status` from `workOrdersById`.
 *    2. The movement's stored `folder_status` (legacy snapshot).
 *    3. `null` when no order is associated.
 */
export function resolveStatus(
  movement: CashMovement,
  workOrdersById: WorkOrdersById,
): string | null {
  const orderId = movement.order_id;
  if (orderId == null) return null;

  const orderIdNum: number = orderId;
  const live = workOrdersById.get(orderIdNum);
  if (live?.status) return live.status;

  const snap = movement.folder_status;
  if (snap) return snap;

  return null;
}

/** Default fallback status when we know there's an OT but have no
 *  status data (rare — happens for very old movements where the
 *  `status` column was added later). The default `MEASUREMENT`
 *  matches the WorkOrder model's `default="MEASUREMENT"`. */
export const FALLBACK_OT_STATUS = 'MEASUREMENT';
