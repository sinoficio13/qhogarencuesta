import { describe, it, expect } from 'vitest'
import { computeNextPosition, rebalancePositions } from '@/lib/position'

describe('computeNextPosition', () => {
  it('returns 10 for empty sibling list', () => {
    expect(computeNextPosition([])).toBe(10)
  })

  it('returns max + 10 for a single existing position', () => {
    expect(computeNextPosition([10])).toBe(20)
  })

  it('returns max + 10 for multiple positions', () => {
    expect(computeNextPosition([10, 20, 30])).toBe(40)
  })

  it('handles non-sequential existing positions', () => {
    expect(computeNextPosition([10, 30, 50])).toBe(60)
  })

  it('handles a single gap-broken position (e.g. after manual edits)', () => {
    expect(computeNextPosition([100])).toBe(110)
  })
})

describe('rebalancePositions', () => {
  it('returns [] for empty list', () => {
    expect(rebalancePositions([])).toEqual([])
  })

  it('returns [{id,position:10}] for single item', () => {
    expect(rebalancePositions(['a'])).toEqual([{ id: 'a', position: 10 }])
  })

  it('rebalances 3 items to [10,20,30]', () => {
    expect(rebalancePositions(['a', 'b', 'c'])).toEqual([
      { id: 'a', position: 10 },
      { id: 'b', position: 20 },
      { id: 'c', position: 30 },
    ])
  })

  it('rebalances after an item is moved (reorder)', () => {
    // Imagine original order [a=10,b=20,c=30], user moves c before a
    // Caller submits new order: ['c','a','b']
    expect(rebalancePositions(['c', 'a', 'b'])).toEqual([
      { id: 'c', position: 10 },
      { id: 'a', position: 20 },
      { id: 'b', position: 30 },
    ])
  })

  it('rebalances 5 items to [10,20,30,40,50]', () => {
    const ids = ['q1', 'q2', 'q3', 'q4', 'q5']
    const result = rebalancePositions(ids)
    expect(result.map((r) => r.position)).toEqual([10, 20, 30, 40, 50])
  })
})
