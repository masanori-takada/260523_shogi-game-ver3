// ============================================================
// 合法手リストのテキスト化
// ============================================================

import type { Move } from '../../../types/index.js'
import { moveToText } from '../board-text.js'

/** 合法手を番号付きリストに変換 */
export function formatLegalMoves(moves: Move[]): string {
  if (moves.length === 0) {
    return '【合法手】なし'
  }

  const lines = moves.map((move, index) => `[${index}] ${moveToText(move)}`)
  return ['【合法手リスト】（moveIndex は [] 内の番号）', ...lines].join('\n')
}
