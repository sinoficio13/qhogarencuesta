import { describe, it, expect } from 'vitest'
import { guardTypeChange, reorderPositions } from '@/lib/validation/crud'

describe('guardTypeChange', () => {
  it('returns ok when question has no answers', () => {
    const result = guardTypeChange({ hasAnswers: false })
    expect(result.ok).toBe(true)
  })

  it('returns error when question has answers', () => {
    const result = guardTypeChange({ hasAnswers: true })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/answered/i)
  })
})

describe('reorderPositions', () => {
  it('returns [10,20,30] for three ids', () => {
    const positions = reorderPositions(['id1', 'id2', 'id3'])
    expect(positions).toEqual([
      { id: 'id1', position: 10 },
      { id: 'id2', position: 20 },
      { id: 'id3', position: 30 },
    ])
  })

  it('returns [10] for single id', () => {
    const positions = reorderPositions(['only-id'])
    expect(positions).toEqual([{ id: 'only-id', position: 10 }])
  })

  it('returns empty array for empty input', () => {
    const positions = reorderPositions([])
    expect(positions).toEqual([])
  })

  it('assigns multiples of 10 in order', () => {
    const ids = ['a', 'b', 'c', 'd', 'e']
    const positions = reorderPositions(ids)
    expect(positions.map((p) => p.position)).toEqual([10, 20, 30, 40, 50])
  })
})
