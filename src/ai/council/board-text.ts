// ============================================================
// 盤面テキスト化ユーティリティ
// LLMへの入力プロンプト生成用の純粋関数群
// ============================================================

import type { GameState, Move, BoardMove, DropMove } from '../../types/index.js'
import { PlayerSide, PieceType } from '../../types/index.js'

// 駒種 → 漢字表記マップ
const PIECE_NAME: Record<PieceType, string> = {
  [PieceType.PAWN]:            '歩',
  [PieceType.LANCE]:           '香',
  [PieceType.KNIGHT]:          '桂',
  [PieceType.SILVER]:          '銀',
  [PieceType.GOLD]:            '金',
  [PieceType.BISHOP]:          '角',
  [PieceType.ROOK]:            '飛',
  [PieceType.KING]:            '玉',
  [PieceType.PROMOTED_PAWN]:   'と',
  [PieceType.PROMOTED_LANCE]:  '杏',
  [PieceType.PROMOTED_KNIGHT]: '圭',
  [PieceType.PROMOTED_SILVER]: '全',
  [PieceType.PROMOTED_BISHOP]: '馬',
  [PieceType.PROMOTED_ROOK]:   '龍',
}

// 列番号（0=9筋, 8=1筋）→ 将棋表記
const COL_LABEL = ['９', '８', '７', '６', '５', '４', '３', '２', '１']
// 行番号（0=一段目, 8=九段目）→ 将棋表記
const ROW_LABEL = ['一', '二', '三', '四', '五', '六', '七', '八', '九']

/**
 * 9×9盤面をASCIIテキストに変換する
 * 後手駒は「v歩」、先手駒は「 歩」で表示
 */
export function boardToText(state: GameState): string {
  const header = COL_LABEL.join('') + '\n'

  const rows = state.board.map((row, rowIdx) => {
    const cells = row.map(piece => {
      if (!piece) return ' ・'
      const name = PIECE_NAME[piece.type]
      return piece.owner === PlayerSide.GOTE ? `v${name}` : ` ${name}`
    })
    return cells.join('') + ' ' + ROW_LABEL[rowIdx]
  })

  return header + rows.join('\n')
}

/**
 * 持ち駒をテキストに変換する
 */
export function handToText(state: GameState, side: PlayerSide): string {
  const hand = state.hands[side]
  const pieces: string[] = []

  for (const [type, count] of hand.entries()) {
    if (count > 0) {
      const name = PIECE_NAME[type]
      pieces.push(count === 1 ? name : `${name}×${count}`)
    }
  }

  return pieces.length > 0 ? pieces.join('、') : 'なし'
}

/**
 * Moveオブジェクトを棋譜表記に変換する（例: 「7六歩」「4五銀打」「5五角成」）
 */
export function moveToText(move: Move): string {
  if (move.kind === 'DROP') {
    const drop = move as DropMove
    const col = COL_LABEL[drop.to.col] ?? '?'
    const row = ROW_LABEL[drop.to.row] ?? '?'
    const name = PIECE_NAME[drop.pieceType]
    return `${col}${row}${name}打`
  }

  const board = move as BoardMove
  const toCol = COL_LABEL[board.to.col] ?? '?'
  const toRow = ROW_LABEL[board.to.row] ?? '?'
  const fromCol = COL_LABEL[board.from.col] ?? '?'
  const fromRow = ROW_LABEL[board.from.row] ?? '?'
  const promote = board.promote ? '成' : ''
  return `${toCol}${toRow}(${fromCol}${fromRow})${promote}`
}

/**
 * LLMプロンプト用の完全なコンテキスト文字列を生成する
 * 盤面 + 持ち駒 + 直前の手 を結合
 */
export function gameStateToPromptContext(state: GameState, side: PlayerSide): string {
  const boardText = boardToText(state)
  const senteName = side === PlayerSide.SENTE ? '（あなた＝AI）' : ''
  const goteName  = side === PlayerSide.GOTE  ? '（あなた＝AI）' : ''

  const senteHand = handToText(state, PlayerSide.SENTE)
  const goteHand  = handToText(state, PlayerSide.GOTE)

  // 直前の手
  const lastEntry = state.moveHistory[state.moveHistory.length - 1]
  const lastMoveText = lastEntry
    ? `${lastEntry.player === PlayerSide.SENTE ? '先手' : '後手'}: ${moveToText(lastEntry.move)}`
    : 'なし（初手）'

  return [
    '【盤面】',
    boardText,
    '',
    `【持ち駒】先手${senteName}: ${senteHand}`,
    `         後手${goteName}: ${goteHand}`,
    '',
    `【直前の手】${lastMoveText}`,
    `【手番】${side === PlayerSide.SENTE ? '先手' : '後手'}（AI）`,
  ].join('\n')
}
