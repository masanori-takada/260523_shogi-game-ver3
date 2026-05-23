import {
  type GameState,
  PlayerSide,
} from '../types/index.js'
import { pieceValue } from '../core/piece.js'

// ------------------------------------------------------------
// 局面評価関数
// ------------------------------------------------------------

/**
 * 現在の局面を side 視点で評価する
 * 正の値 = side が有利、負の値 = 相手が有利
 */
export function evaluate(state: GameState, side: PlayerSide): number {
  const opponent = side === PlayerSide.SENTE ? PlayerSide.GOTE : PlayerSide.SENTE
  let score = 0

  // 盤上の駒の価値を合計
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = state.board[row]![col]
      if (!piece) continue
      const val = pieceValue(piece.type)
      if (piece.owner === side) {
        score += val
      } else {
        score -= val
      }
    }
  }

  // 持ち駒の価値（盤面より若干低く評価）
  for (const [type, count] of state.hands[side]) {
    score += pieceValue(type) * count * 0.8
  }
  for (const [type, count] of state.hands[opponent]) {
    score -= pieceValue(type) * count * 0.8
  }

  return score
}
