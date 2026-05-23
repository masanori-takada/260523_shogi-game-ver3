import {
  type Board,
  type Hand,
  type GameState,
  type Move,
  type BoardMove,
  type DropMove,
  type Square,
  PieceType,
  PlayerSide,
} from '../types/index.js'
import { getPiece, isOnBoard } from './board.js'
import {
  getPieceMoveConfig,
  canPromotePiece,
  hasNoRetreat,
  isEnemyTerritory,
  demote,
} from './piece.js'
import {
  wouldLeaveKingInCheck,
  dropWouldLeaveKingInCheck,
  isNifu,
  isUchifuZume,
  canPromoteOnMove,
} from './rules.js'

// ------------------------------------------------------------
// 盤上の駒の合法手生成
// ------------------------------------------------------------

/**
 * 指定したマスの駒が指せる全合法手（BoardMove）を返す
 */
export function generateBoardMovesFromSquare(
  board: Board,
  hands: { [PlayerSide.SENTE]: Hand; [PlayerSide.GOTE]: Hand },
  from: Square,
): BoardMove[] {
  const piece = getPiece(board, from)
  if (!piece) return []

  const side = piece.owner
  const pieceType = piece.type // クロージャ内でのnull narrowingを回避
  const config = getPieceMoveConfig(pieceType, side)
  const moves: BoardMove[] = []

  function addMoveIfLegal(to: Square): void {
    if (!isOnBoard(to)) return
    const target = getPiece(board, to)
    if (target && target.owner === side) return // 自駒には移動不可
    if (wouldLeaveKingInCheck(board, side, from, to)) return // 自殺手

    const canPromote = canPromotePiece(pieceType) && canPromoteOnMove(side, from, to)
    const mustPromote = canPromotePiece(pieceType) && hasNoRetreat(pieceType, side, to)

    if (mustPromote) {
      // 強制成り（不成は行き所のない駒になる）
      moves.push({ kind: 'BOARD', from, to, promote: true })
    } else if (canPromote) {
      // 成り or 不成 の2択
      moves.push({ kind: 'BOARD', from, to, promote: true })
      moves.push({ kind: 'BOARD', from, to, promote: false })
    } else {
      moves.push({ kind: 'BOARD', from, to, promote: false })
    }
  }

  // ステップ移動
  for (const [dr, dc] of config.stepDirs) {
    addMoveIfLegal({ row: from.row + dr, col: from.col + dc })
  }

  // スライド移動
  for (const [dr, dc] of config.slideDirs) {
    let r = from.row + dr
    let c = from.col + dc
    while (r >= 0 && r <= 8 && c >= 0 && c <= 8) {
      const to: Square = { row: r, col: c }
      const target = getPiece(board, to)
      const ownPiece = target && target.owner === side

      if (!ownPiece) {
        addMoveIfLegal(to)
      }
      if (target) break // 敵駒に当たったらその後は進めない
      r += dr
      c += dc
    }
  }

  // 桂馬の跳び
  for (const [dr, dc] of config.knightMoves) {
    addMoveIfLegal({ row: from.row + dr, col: from.col + dc })
  }

  return moves
}

/**
 * 指定 side の全合法 BoardMove を返す
 */
export function generateAllBoardMoves(
  board: Board,
  hands: { [PlayerSide.SENTE]: Hand; [PlayerSide.GOTE]: Hand },
  side: PlayerSide,
): BoardMove[] {
  const moves: BoardMove[] = []
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row]![col]
      if (piece && piece.owner === side) {
        moves.push(...generateBoardMovesFromSquare(board, hands, { row, col }))
      }
    }
  }
  return moves
}

// ------------------------------------------------------------
// 持ち駒の打ち手生成
// ------------------------------------------------------------

/**
 * 指定 side の全合法 DropMove を返す
 */
export function generateDropMoves(
  board: Board,
  hands: { [PlayerSide.SENTE]: Hand; [PlayerSide.GOTE]: Hand },
  side: PlayerSide,
): DropMove[] {
  const hand = hands[side]
  const moves: DropMove[] = []

  for (const [type, count] of hand) {
    if (count <= 0) continue

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row]![col] !== null) continue // 空きマスのみ
        const to: Square = { row, col }

        // 行き所のない駒チェック
        if (hasNoRetreat(type, side, to)) continue

        // 二歩チェック
        if (type === PieceType.PAWN && isNifu(board, side, col)) continue

        // 打ち歩詰めチェック
        if (type === PieceType.PAWN && isUchifuZume(board, hands, side, to)) continue

        // 打った後、自玉が王手にさらされるかチェック
        if (dropWouldLeaveKingInCheck(board, side, type, to)) continue

        moves.push({ kind: 'DROP', pieceType: type, to })
      }
    }
  }

  return moves
}

// ------------------------------------------------------------
// 自殺手フィルタ（外部向け）
// ------------------------------------------------------------

/**
 * boardMoves から自殺手を除外する
 * （generateBoardMovesFromSquare 内で既にフィルタしているが、外部からの検証用に公開）
 */
export function filterSelfKillMoves(
  board: Board,
  side: PlayerSide,
  moves: BoardMove[],
): BoardMove[] {
  return moves.filter(m => !wouldLeaveKingInCheck(board, side, m.from, m.to))
}
