// ============================================================
// LLM 出力 → Move 変換・検証
// ============================================================

import type { Move } from '../../../types/index.js'
import type { SubAgentOutput } from './schemas.js'

/** moveIndex から合法手を取得（範囲外は throw） */
export function moveFromIndex(legalMoves: Move[], moveIndex: number): Move {
  const move = legalMoves[moveIndex]
  if (!move) {
    throw new Error(`Invalid moveIndex ${moveIndex} (legal moves: ${legalMoves.length})`)
  }
  return move
}

/** SubAgentOutput を検証して Move を返す */
export function resolveSubAgentMove(output: SubAgentOutput, legalMoves: Move[]): Move {
  if (!Number.isInteger(output.moveIndex)) {
    throw new Error(`moveIndex must be integer: ${output.moveIndex}`)
  }
  return moveFromIndex(legalMoves, output.moveIndex)
}
