// PURE — no DB, no framework imports

// ── Type-change guard ──────────────────────────────────────────────────────────

export interface GuardTypeChangeInput {
  hasAnswers: boolean
}

export interface GuardOk {
  ok: true
}

export interface GuardError {
  ok: false
  error: string
}

export type GuardResult = GuardOk | GuardError

/**
 * Prevent changing the type of a question that already has answers.
 * The `hasAnswers` flag must be pre-computed by the caller (e.g. SELECT 1
 * FROM answers WHERE question_id = $1 LIMIT 1) — this function is pure.
 */
export function guardTypeChange(input: GuardTypeChangeInput): GuardResult {
  if (input.hasAnswers) {
    return {
      ok: false,
      error: 'Cannot change type: this question already has answered responses.',
    }
  }
  return { ok: true }
}

// ── Position reorder ───────────────────────────────────────────────────────────

export interface PositionEntry {
  id: string
  position: number
}

/**
 * Given an ordered list of ids, returns {id, position} pairs with positions
 * 10, 20, 30, … (gap-based, multiples of 10).
 * The caller is responsible for persisting these in a single transaction.
 */
export function reorderPositions(orderedIds: string[]): PositionEntry[] {
  return orderedIds.map((id, index) => ({
    id,
    position: (index + 1) * 10,
  }))
}

/**
 * Compute the next position for a new item at the end of a sibling list.
 * Returns max(existingPositions) + 10, or 10 if the list is empty.
 */
export function nextPosition(existingPositions: number[]): number {
  if (existingPositions.length === 0) return 10
  return Math.max(...existingPositions) + 10
}
