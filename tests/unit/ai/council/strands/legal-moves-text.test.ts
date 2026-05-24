import { describe, it, expect } from 'vitest'
import { formatLegalMoves } from '../../../../../src/ai/council/strands/legal-moves-text.js'
import { PieceType } from '../../../../../src/types/index.js'
import type { Move } from '../../../../../src/types/index.js'

describe('formatLegalMoves', () => {
  it('合法手がない場合', () => {
    expect(formatLegalMoves([])).toBe('【合法手】なし')
  })

  it('番号付きリストを生成する', () => {
    const moves: Move[] = [
      { kind: 'BOARD', from: { row: 6, col: 4 }, to: { row: 5, col: 4 }, promote: false },
      { kind: 'DROP', pieceType: PieceType.PAWN, to: { row: 5, col: 5 } },
    ]
    const text = formatLegalMoves(moves)
    expect(text).toContain('【合法手リスト】')
    expect(text).toContain('[0]')
    expect(text).toContain('[1]')
    expect(text.split('\n').length).toBe(3)
  })
})
