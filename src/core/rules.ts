import {
  type Board,
  type Hand,
  type GameState,
  type Square,
  type DropMove,
  PieceType,
  PlayerSide,
} from '../types/index.js'
import { getPiece, isOnBoard, copyBoard, setPiece as setBoardPiece } from './board.js'
import { getPieceMoveConfig, demote } from './piece.js'

// ------------------------------------------------------------
// 王手判定
// ------------------------------------------------------------

/**
 * 指定した side の玉が攻撃されているか（王手か）
 */
export function isInCheck(board: Board, side: PlayerSide): boolean {
  // 玉の位置を探す
  const kingSquare = findKing(board, side)
  if (!kingSquare) return false // 玉がない（テスト用）

  const opponent = side === PlayerSide.SENTE ? PlayerSide.GOTE : PlayerSide.SENTE

  // 相手の全駒から玉を攻撃できるか確認
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row]![col]
      if (!piece || piece.owner !== opponent) continue

      const config = getPieceMoveConfig(piece.type, opponent)
      const from: Square = { row, col }

      // ステップ移動
      for (const [dr, dc] of config.stepDirs) {
        const to: Square = { row: row + dr, col: col + dc }
        if (isOnBoard(to) &&
            to.row === kingSquare.row &&
            to.col === kingSquare.col) {
          return true
        }
      }

      // スライド移動
      for (const [dr, dc] of config.slideDirs) {
        let r = row + dr
        let c = col + dc
        while (r >= 0 && r <= 8 && c >= 0 && c <= 8) {
          if (r === kingSquare.row && c === kingSquare.col) return true
          if (board[r]![c] !== null) break // 駒がいれば遮断
          r += dr
          c += dc
        }
      }

      // 桂馬の跳び
      for (const [dr, dc] of config.knightMoves) {
        const to: Square = { row: row + dr, col: col + dc }
        if (isOnBoard(to) &&
            to.row === kingSquare.row &&
            to.col === kingSquare.col) {
          return true
        }
      }
    }
  }

  return false
}

/** 玉の位置を返す */
export function findKing(board: Board, side: PlayerSide): Square | null {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row]![col]
      if (piece && piece.type === PieceType.KING && piece.owner === side) {
        return { row, col }
      }
    }
  }
  return null
}

// ------------------------------------------------------------
// 自殺手フィルタ
// ------------------------------------------------------------

/**
 * 仮に手を適用した後、自玉が王手になるか
 */
export function wouldLeaveKingInCheck(
  board: Board,
  side: PlayerSide,
  from: Square,
  to: Square,
): boolean {
  // 移動後の仮盤面を作成
  const piece = getPiece(board, from)
  if (!piece) return false

  const tempBoard = copyBoard(board)
  tempBoard[to.row]![to.col] = piece
  tempBoard[from.row]![from.col] = null

  return isInCheck(tempBoard, side)
}

/**
 * 持ち駒を打った後、自玉が王手になるか（通常はないが念のため）
 */
export function dropWouldLeaveKingInCheck(
  board: Board,
  side: PlayerSide,
  pieceType: PieceType,
  to: Square,
): boolean {
  const tempBoard = copyBoard(board)
  tempBoard[to.row]![to.col] = { type: pieceType, owner: side }
  return isInCheck(tempBoard, side)
}

// ------------------------------------------------------------
// 二歩チェック
// ------------------------------------------------------------

/**
 * 指定の筋に既に side の歩（未成）があるか
 */
export function isNifu(board: Board, side: PlayerSide, col: number): boolean {
  for (let row = 0; row < 9; row++) {
    const piece = board[row]![col]
    if (piece && piece.owner === side && piece.type === PieceType.PAWN) {
      return true
    }
  }
  return false
}

// ------------------------------------------------------------
// 打ち歩詰めチェック
// ------------------------------------------------------------

/**
 * 歩を打って詰みになるか（打ち歩詰め）
 */
export function isUchifuZume(
  board: Board,
  hands: { [PlayerSide.SENTE]: Hand; [PlayerSide.GOTE]: Hand },
  side: PlayerSide,
  to: Square,
): boolean {
  const opponent = side === PlayerSide.SENTE ? PlayerSide.GOTE : PlayerSide.SENTE

  // 仮に歩を打つ
  const tempBoard = copyBoard(board)
  tempBoard[to.row]![to.col] = { type: PieceType.PAWN, owner: side }

  // 打った後、相手が王手になっているか
  if (!isInCheck(tempBoard, opponent)) return false

  // 相手の全合法手を確認（すべてが王手を解消できないなら詰み = 打ち歩詰め）
  return !hasAnyLegalMove(tempBoard, hands, opponent)
}

/**
 * 指定 side に1手でも合法手があるか
 */
function hasAnyLegalMove(
  board: Board,
  hands: { [PlayerSide.SENTE]: Hand; [PlayerSide.GOTE]: Hand },
  side: PlayerSide,
): boolean {
  // 盤上の駒を動かす手
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row]![col]
      if (!piece || piece.owner !== side) continue

      const config = getPieceMoveConfig(piece.type, side)
      const from: Square = { row, col }

      for (const [dr, dc] of config.stepDirs) {
        const to: Square = { row: row + dr, col: col + dc }
        if (!isOnBoard(to)) continue
        const target = getPiece(board, to)
        if (target && target.owner === side) continue
        if (!wouldLeaveKingInCheck(board, side, from, to)) return true
      }

      for (const [dr, dc] of config.slideDirs) {
        let r = row + dr; let c = col + dc
        while (r >= 0 && r <= 8 && c >= 0 && c <= 8) {
          const to: Square = { row: r, col: c }
          const target = getPiece(board, to)
          if (target && target.owner === side) break
          if (!wouldLeaveKingInCheck(board, side, from, to)) return true
          if (target) break
          r += dr; c += dc
        }
      }

      for (const [dr, dc] of config.knightMoves) {
        const to: Square = { row: row + dr, col: col + dc }
        if (!isOnBoard(to)) continue
        const target = getPiece(board, to)
        if (target && target.owner === side) continue
        if (!wouldLeaveKingInCheck(board, side, from, to)) return true
      }
    }
  }

  // 持ち駒を打つ手
  const hand = hands[side]
  for (const [type, count] of hand) {
    if (count <= 0) continue
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row]![col] !== null) continue
        const to: Square = { row, col }
        if (!dropWouldLeaveKingInCheck(board, side, type, to)) return true
      }
    }
  }

  return false
}

// ------------------------------------------------------------
// 成りルール
// ------------------------------------------------------------

/**
 * 指定の from→to で成りが可能か
 */
export function canPromoteOnMove(
  side: PlayerSide,
  from: Square,
  to: Square,
): boolean {
  if (side === PlayerSide.SENTE) {
    return from.row <= 2 || to.row <= 2
  } else {
    return from.row >= 6 || to.row >= 6
  }
}
