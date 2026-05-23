import { PieceType } from '../types/index.js'

// ------------------------------------------------------------
// 駒の表示文字列
// ------------------------------------------------------------

export const PIECE_DISPLAY: Record<PieceType, string> = {
  [PieceType.PAWN]:             '歩',
  [PieceType.LANCE]:            '香',
  [PieceType.KNIGHT]:           '桂',
  [PieceType.SILVER]:           '銀',
  [PieceType.GOLD]:             '金',
  [PieceType.BISHOP]:           '角',
  [PieceType.ROOK]:             '飛',
  [PieceType.KING]:             '玉',
  [PieceType.PROMOTED_PAWN]:    'と',
  [PieceType.PROMOTED_LANCE]:   '杏',
  [PieceType.PROMOTED_KNIGHT]:  '圭',
  [PieceType.PROMOTED_SILVER]:  '全',
  [PieceType.PROMOTED_BISHOP]:  '馬',
  [PieceType.PROMOTED_ROOK]:    '龍',
}

export const PIECE_DISPLAY_PROMOTED: Partial<Record<PieceType, string>> = {
  [PieceType.PROMOTED_PAWN]:    'と金',
  [PieceType.PROMOTED_LANCE]:   '成香',
  [PieceType.PROMOTED_KNIGHT]:  '成桂',
  [PieceType.PROMOTED_SILVER]:  '成銀',
  [PieceType.PROMOTED_BISHOP]:  '龍馬',
  [PieceType.PROMOTED_ROOK]:    '龍王',
}
