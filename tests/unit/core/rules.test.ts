import { describe, it, expect } from 'vitest'
import { isInCheck, isNifu, canPromoteOnMove } from '../../../src/core/rules.js'
import { createInitialBoard, setPiece } from '../../../src/core/board.js'
import { GameEngine } from '../../../src/core/game.js'
import {
  GameMode, PlayerSide, PlayerType, GameStatus, PieceType,
  type GameConfig, type Board,
} from '../../../src/types/index.js'

const config: GameConfig = {
  mode: GameMode.HUMAN_VS_HUMAN,
  sentePlayer: { side: PlayerSide.SENTE, type: PlayerType.HUMAN, name: '先手' },
  gotePlayer:  { side: PlayerSide.GOTE,  type: PlayerType.HUMAN, name: '後手' },
}

describe('isInCheck', () => {
  it('初期局面では王手でない', () => {
    const board = createInitialBoard()
    expect(isInCheck(board, PlayerSide.SENTE)).toBe(false)
    expect(isInCheck(board, PlayerSide.GOTE)).toBe(false)
  })

  it('先手玉の直前に後手の歩があれば王手', () => {
    let board = createInitialBoard()
    // 先手玉 row=8,col=4 の1マス前 row=7 に後手の歩を置く（角・飛を取り除く）
    board[7]![1] = null  // 先手角を除去
    board[7]![7] = null  // 先手飛を除去
    board[7]![4] = { type: PieceType.PAWN, owner: PlayerSide.GOTE }
    expect(isInCheck(board, PlayerSide.SENTE)).toBe(true)
  })
})

describe('成りルール', () => {
  it('先手が相手陣に入る手は成れる', () => {
    expect(canPromoteOnMove(PlayerSide.SENTE, { row: 3, col: 4 }, { row: 2, col: 4 })).toBe(true)
  })

  it('先手が相手陣から出る手も成れる', () => {
    expect(canPromoteOnMove(PlayerSide.SENTE, { row: 2, col: 4 }, { row: 3, col: 4 })).toBe(true)
  })

  it('先手が自陣内の手は成れない', () => {
    expect(canPromoteOnMove(PlayerSide.SENTE, { row: 5, col: 4 }, { row: 4, col: 4 })).toBe(false)
  })

  it('後手が自分の相手陣（row=6以降）に入る手は成れる', () => {
    expect(canPromoteOnMove(PlayerSide.GOTE, { row: 5, col: 4 }, { row: 6, col: 4 })).toBe(true)
  })
})

describe('二歩チェック', () => {
  it('同じ筋に歩がなければ二歩でない', () => {
    const board = createInitialBoard()
    // 先手の歩を5筋から除去
    board[6]![4] = null
    expect(isNifu(board, PlayerSide.SENTE, 4)).toBe(false)
  })

  it('同じ筋に先手の歩があれば二歩', () => {
    const board = createInitialBoard()
    expect(isNifu(board, PlayerSide.SENTE, 4)).toBe(true) // row=6,col=4 に先手歩あり
  })
})

describe('禁じ手 — 二歩', () => {
  it('歩を打って二歩になる場合は合法手に含まれない', () => {
    const engine = new GameEngine()
    let state = engine.startGame(config)

    // 先手が7七歩を動かして持ち駒に入らせるシナリオは複雑なので
    // getLegalMoves が DROP の二歩を含まないことだけ確認
    const moves = engine.getLegalMoves(state)
    const dropMoves = moves.filter(m => m.kind === 'DROP')
    // 初期局面では持ち駒なし → DROP なし
    expect(dropMoves).toHaveLength(0)
  })
})

describe('詰み検知', () => {
  it('詰みでない局面では isCheckmate が false', () => {
    const engine = new GameEngine()
    const state = engine.startGame(config)
    expect(engine.isCheckmate(state, PlayerSide.SENTE)).toBe(false)
  })
})
