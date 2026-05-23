import {
  type Board,
  type Hand,
  type GameState,
  type GameConfig,
  type Move,
  type BoardMove,
  type DropMove,
  type Square,
  type GameRecordEntry,
  PieceType,
  PlayerSide,
  GameStatus,
  IllegalMoveError,
  IllegalMoveReason,
} from '../types/index.js'
import { createInitialBoard, copyBoard, getPiece, boardToHash } from './board.js'
import { promote, demote, canPromotePiece, isEnemyTerritory } from './piece.js'
import {
  generateAllBoardMoves,
  generateBoardMovesFromSquare,
  generateDropMoves,
} from './move-generator.js'
import { isInCheck, isUchifuZume, isNifu } from './rules.js'

// ------------------------------------------------------------
// GameEngine 実装
// ------------------------------------------------------------

export class GameEngine {

  /** 新しい対局を開始する */
  startGame(config: GameConfig): GameState {
    const board = createInitialBoard()
    const initialHash = boardToHash(board)

    return {
      board,
      hands: {
        [PlayerSide.SENTE]: new Map(),
        [PlayerSide.GOTE]:  new Map(),
      },
      currentTurn: PlayerSide.SENTE,
      status: GameStatus.ONGOING,
      moveHistory: [],
      positionHistory: [initialHash],
    }
  }

  /** 指定した手が合法かどうかを確認する */
  isLegalMove(state: GameState, move: Move): boolean {
    const legalMoves = this.getLegalMoves(state)
    return legalMoves.some(m => movesEqual(m, move))
  }

  /** 現在の局面の合法手を返す */
  getLegalMoves(state: GameState, square?: Square): Move[] {
    if (state.status !== GameStatus.ONGOING && state.status !== GameStatus.CHECK) {
      return []
    }

    const side = state.currentTurn
    const { board, hands } = state

    if (square) {
      // 特定マス or 持ち駒の選択
      const piece = getPiece(board, square)
      if (!piece || piece.owner !== side) return []
      return generateBoardMovesFromSquare(board, hands, square)
    }

    // 全合法手
    const boardMoves = generateAllBoardMoves(board, hands, side)
    const dropMoves  = generateDropMoves(board, hands, side)
    return [...boardMoves, ...dropMoves]
  }

  /** 手を指して新しい GameState を返す（イミュータブル） */
  applyMove(state: GameState, move: Move): GameState {
    if (state.status !== GameStatus.ONGOING && state.status !== GameStatus.CHECK) {
      throw new IllegalMoveError(move, IllegalMoveReason.GAME_ALREADY_OVER)
    }

    if (!this.isLegalMove(state, move)) {
      // 詳細なエラー理由を特定
      const reason = detectIllegalReason(state, move)
      throw new IllegalMoveError(move, reason)
    }

    const side = state.currentTurn
    const opponent = side === PlayerSide.SENTE ? PlayerSide.GOTE : PlayerSide.SENTE

    let newBoard = copyBoard(state.board)
    const newHands: { [PlayerSide.SENTE]: Hand; [PlayerSide.GOTE]: Hand } = {
      [PlayerSide.SENTE]: new Map(state.hands[PlayerSide.SENTE]),
      [PlayerSide.GOTE]:  new Map(state.hands[PlayerSide.GOTE]),
    }

    let capturedPiece: PieceType | undefined

    if (move.kind === 'BOARD') {
      const piece = getPiece(newBoard, move.from)!
      const target = getPiece(newBoard, move.to)

      // 取った駒を持ち駒に追加（成りを解除して）
      if (target) {
        capturedPiece = target.type
        const demoted = demote(target.type)
        const currentCount = newHands[side].get(demoted) ?? 0
        newHands[side].set(demoted, currentCount + 1)
      }

      // 駒を移動
      const movedPieceType = move.promote ? promote(piece.type) : piece.type
      newBoard[move.to.row]![move.to.col] = { type: movedPieceType, owner: side }
      newBoard[move.from.row]![move.from.col] = null

    } else {
      // 打ち手
      newBoard[move.to.row]![move.to.col] = { type: move.pieceType, owner: side }

      const hand = newHands[side]
      const count = hand.get(move.pieceType) ?? 0
      if (count <= 1) {
        hand.delete(move.pieceType)
      } else {
        hand.set(move.pieceType, count - 1)
      }
    }

    // 棋譜エントリ作成
    const entry: GameRecordEntry = {
      moveNumber: state.moveHistory.length + 1,
      move,
      player: side,
      ...(capturedPiece !== undefined ? { capturedPiece } : {}),
      timestamp: Date.now(),
    }

    // 手番交代
    const nextTurn = opponent

    // 局面ハッシュ記録
    const newHash = `${boardToHash(newBoard)}_${nextTurn}_${handToString(newHands[PlayerSide.SENTE])}_${handToString(newHands[PlayerSide.GOTE])}`
    const newPositionHistory = [...state.positionHistory, newHash]

    // ゲーム状態更新
    let newStatus = GameStatus.ONGOING
    let winner: PlayerSide | undefined

    // 千日手判定
    const occurrences = newPositionHistory.filter(h => h === newHash).length
    if (occurrences >= 4) {
      newStatus = GameStatus.DRAW
    } else {
      // 王手・詰み判定
      if (isInCheck(newBoard, nextTurn)) {
        // 相手に合法手があるか確認
        const opponentMoves = [
          ...generateAllBoardMoves(newBoard, newHands, nextTurn),
          ...generateDropMoves(newBoard, newHands, nextTurn),
        ]
        if (opponentMoves.length === 0) {
          newStatus = GameStatus.CHECKMATE
          winner = side
        } else {
          newStatus = GameStatus.CHECK
        }
      }
    }

    return {
      board: newBoard,
      hands: newHands,
      currentTurn: nextTurn,
      status: newStatus,
      ...(winner !== undefined ? { winner } : {}),
      moveHistory: [...state.moveHistory, entry],
      positionHistory: newPositionHistory,
    }
  }

  /** 王手がかかっているか */
  isInCheck(state: GameState, side: PlayerSide): boolean {
    return isInCheck(state.board, side)
  }

  /** 詰みかどうか */
  isCheckmate(state: GameState, side: PlayerSide): boolean {
    if (!isInCheck(state.board, side)) return false
    const boardMoves = generateAllBoardMoves(state.board, state.hands, side)
    const dropMoves  = generateDropMoves(state.board, state.hands, side)
    return boardMoves.length === 0 && dropMoves.length === 0
  }

  /** 投了 */
  resign(state: GameState, resigningSide: PlayerSide): GameState {
    const winner = resigningSide === PlayerSide.SENTE ? PlayerSide.GOTE : PlayerSide.SENTE
    return {
      ...state,
      status: GameStatus.RESIGNED,
      winner,
    }
  }

  /** 棋譜をテキスト形式で出力する */
  exportRecord(state: GameState): string {
    const lines: string[] = ['# 棋譜', '']
    for (const entry of state.moveHistory) {
      const side = entry.player === PlayerSide.SENTE ? '先手' : '後手'
      const move = formatMove(entry.move)
      const captured = entry.capturedPiece ? ` (${entry.capturedPiece}取)` : ''
      lines.push(`${entry.moveNumber}手目 ${side}: ${move}${captured}`)
    }
    if (state.winner) {
      lines.push('')
      lines.push(`勝者: ${state.winner === PlayerSide.SENTE ? '先手' : '後手'}`)
    } else if (state.status === GameStatus.DRAW) {
      lines.push('')
      lines.push('引き分け（千日手）')
    }
    return lines.join('\n')
  }
}

// ------------------------------------------------------------
// ヘルパー関数
// ------------------------------------------------------------

function movesEqual(a: Move, b: Move): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'BOARD' && b.kind === 'BOARD') {
    return (
      a.from.row === b.from.row &&
      a.from.col === b.from.col &&
      a.to.row   === b.to.row   &&
      a.to.col   === b.to.col   &&
      a.promote  === b.promote
    )
  }
  if (a.kind === 'DROP' && b.kind === 'DROP') {
    return (
      a.pieceType === b.pieceType &&
      a.to.row    === b.to.row    &&
      a.to.col    === b.to.col
    )
  }
  return false
}

function handToString(hand: Hand): string {
  const entries: string[] = []
  for (const [type, count] of [...hand.entries()].sort()) {
    entries.push(`${type}:${count}`)
  }
  return entries.join(',')
}

function detectIllegalReason(state: GameState, move: Move): IllegalMoveReason {
  const side = state.currentTurn

  if (move.kind === 'BOARD') {
    const piece = getPiece(state.board, move.from)
    if (!piece) return IllegalMoveReason.NO_PIECE_AT_FROM
    if (piece.owner !== side) return IllegalMoveReason.NOT_OWN_PIECE
    return IllegalMoveReason.PIECE_CANNOT_MOVE
  } else {
    const hand = state.hands[side]
    const count = hand.get(move.pieceType) ?? 0
    if (count <= 0) return IllegalMoveReason.NO_PIECE_AT_FROM
    if (move.pieceType === PieceType.PAWN && isNifu(state.board, side, move.to.col)) {
      return IllegalMoveReason.NIFU
    }
    return IllegalMoveReason.PIECE_CANNOT_MOVE
  }
}

function formatMove(move: Move): string {
  if (move.kind === 'BOARD') {
    const fromCol = 9 - move.from.col
    const fromRow = move.from.row + 1
    const toCol   = 9 - move.to.col
    const toRow   = move.to.row + 1
    const prom = move.promote ? '成' : ''
    return `${fromCol}${fromRow} → ${toCol}${toRow}${prom}`
  } else {
    const toCol = 9 - move.to.col
    const toRow = move.to.row + 1
    return `${move.pieceType}打 ${toCol}${toRow}`
  }
}
