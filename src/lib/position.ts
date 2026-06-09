/**
 * Gap-based position helpers (multiples of 10).
 * PURE — no DB, no framework imports.
 *
 * Strategy decision (from design §2): gap-based integer positions are used
 * for questions, options, and scale rows. New items append at max+10.
 * Reorders rewrite the full sibling list at 10,20,30,… in a single
 * transaction — deterministic, idempotent, and cheap at Phase-1 cardinality.
 */

export interface PositionEntry {
  id: string
  position: number
}

/**
 * Compute the next position for a new item at the end of a sibling list.
 * Returns max(existingPositions) + 10, or 10 if the list is empty.
 */
export function computeNextPosition(existingPositions: number[]): number {
  if (existingPositions.length === 0) return 10
  return Math.max(...existingPositions) + 10
}

/**
 * Rebalance a sibling list to positions 10, 20, 30, …
 * The caller provides the desired order (orderedIds) after a reorder operation.
 * Returns {id, position} pairs ready for bulk UPDATE in a single transaction.
 */
export function rebalancePositions(orderedIds: string[]): PositionEntry[] {
  return orderedIds.map((id, index) => ({
    id,
    position: (index + 1) * 10,
  }))
}
