import { describe, it, expect } from 'vitest'
import { moveFromIndex, resolveSubAgentMove } from '../../../../../src/ai/council/strands/move-from-llm.js'
import type { Move } from '../../../../../src/types/index.js'

const moveA: Move = { kind: 'BOARD', from: { row: 6, col: 4 }, to: { row: 5, col: 4 }, promote: false }
const moveB: Move = { kind: 'BOARD', from: { row: 6, col: 3 }, to: { row: 5, col: 3 }, promote: false }
const legalMoves = [moveA, moveB]

describe('moveFromIndex', () => {
  it('合法インデックスから Move を返す', () => {
    expect(moveFromIndex(legalMoves, 0)).toEqual(moveA)
    expect(moveFromIndex(legalMoves, 1)).toEqual(moveB)
  })

  it('範囲外インデックスは throw', () => {
    expect(() => moveFromIndex(legalMoves, -1)).toThrow(/Invalid moveIndex/)
    expect(() => moveFromIndex(legalMoves, 2)).toThrow(/Invalid moveIndex/)
  })
})

describe('resolveSubAgentMove', () => {
  it('moveIndex から合法手を解決する', () => {
    const move = resolveSubAgentMove(
      { moveIndex: 1, score: 100, reasoning: '守り' },
      legalMoves,
    )
    expect(move).toEqual(moveB)
  })

  it('非整数 moveIndex は throw', () => {
    expect(() =>
      resolveSubAgentMove({ moveIndex: 0.5, score: 0, reasoning: 'x' }, legalMoves),
    ).toThrow(/integer/)
  })

  it('非法手インデックスは throw', () => {
    expect(() =>
      resolveSubAgentMove({ moveIndex: 99, score: 0, reasoning: 'x' }, legalMoves),
    ).toThrow(/Invalid moveIndex/)
  })
})
