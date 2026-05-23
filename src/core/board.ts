import {
  type Board,
  type Piece,
  type Square,
  PieceType,
  PlayerSide,
} from '../types/index.js'

// ------------------------------------------------------------
// 盤面操作ユーティリティ
// ------------------------------------------------------------

/** 空の盤面を生成する */
export function createEmptyBoard(): Board {
  return Array.from({ length: 9 }, () => Array(9).fill(null) as (Piece | null)[])
}

/** 初期配置の盤面を生成する */
export function createInitialBoard(): Board {
  const board = createEmptyBoard()

  // 後手（GOTE）の駒配置
  // row 0: 香桂銀金玉金銀桂香
  const goteBackRank: PieceType[] = [
    PieceType.LANCE,
    PieceType.KNIGHT,
    PieceType.SILVER,
    PieceType.GOLD,
    PieceType.KING,
    PieceType.GOLD,
    PieceType.SILVER,
    PieceType.KNIGHT,
    PieceType.LANCE,
  ]
  for (let col = 0; col < 9; col++) {
    board[0]![col] = { type: goteBackRank[col]!, owner: PlayerSide.GOTE }
  }
  // row 1: 後手 飛角
  board[1]![1] = { type: PieceType.ROOK,   owner: PlayerSide.GOTE }
  board[1]![7] = { type: PieceType.BISHOP, owner: PlayerSide.GOTE }
  // row 2: 後手 歩
  for (let col = 0; col < 9; col++) {
    board[2]![col] = { type: PieceType.PAWN, owner: PlayerSide.GOTE }
  }

  // 先手（SENTE）の駒配置
  // row 8: 香桂銀金玉金銀桂香
  const senteBackRank: PieceType[] = [
    PieceType.LANCE,
    PieceType.KNIGHT,
    PieceType.SILVER,
    PieceType.GOLD,
    PieceType.KING,
    PieceType.GOLD,
    PieceType.SILVER,
    PieceType.KNIGHT,
    PieceType.LANCE,
  ]
  for (let col = 0; col < 9; col++) {
    board[8]![col] = { type: senteBackRank[col]!, owner: PlayerSide.SENTE }
  }
  // row 7: 先手 角飛
  board[7]![1] = { type: PieceType.BISHOP, owner: PlayerSide.SENTE }
  board[7]![7] = { type: PieceType.ROOK,   owner: PlayerSide.SENTE }
  // row 6: 先手 歩
  for (let col = 0; col < 9; col++) {
    board[6]![col] = { type: PieceType.PAWN, owner: PlayerSide.SENTE }
  }

  return board
}

/** 盤面をディープコピーする */
export function copyBoard(board: Board): Board {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)))
}

/** 指定マスの駒を取得する */
export function getPiece(board: Board, sq: Square): Piece | null {
  return board[sq.row]?.[sq.col] ?? null
}

/** 指定マスに駒をセットする（イミュータブル操作: コピーを返す） */
export function setPiece(board: Board, sq: Square, piece: Piece | null): Board {
  const next = copyBoard(board)
  next[sq.row]![sq.col] = piece
  return next
}

/** マス座標が盤面内かどうか */
export function isOnBoard(sq: Square): boolean {
  return sq.row >= 0 && sq.row <= 8 && sq.col >= 0 && sq.col <= 8
}

/** 2つのマス座標が等しいか */
export function squareEquals(a: Square, b: Square): boolean {
  return a.row === b.row && a.col === b.col
}

/** マス座標をユニークキー文字列に変換する（千日手検知・Map等に使用） */
export function squareToKey(sq: Square): string {
  return `${sq.row},${sq.col}`
}

/** 盤面の局面ハッシュ文字列を生成する（千日手検知用） */
export function boardToHash(board: Board): string {
  return board
    .flat()
    .map(p => (p ? `${p.owner[0]}${p.type[0]}` : '_'))
    .join('')
}
