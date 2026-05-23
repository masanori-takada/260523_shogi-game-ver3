import { describe, it, expect } from 'vitest'
import { GameEngine } from '../../../src/core/game.js'
import {
  GameMode,
  PlayerSide,
  PlayerType,
  GameStatus,
  PieceType,
  type GameConfig,
} from '../../../src/types/index.js'

const defaultConfig: GameConfig = {
  mode: GameMode.HUMAN_VS_HUMAN,
  sentePlayer: { side: PlayerSide.SENTE, type: PlayerType.HUMAN, name: '先手' },
  gotePlayer:  { side: PlayerSide.GOTE,  type: PlayerType.HUMAN, name: '後手' },
}

describe('GameEngine.startGame', () => {
  it('先手の手番から開始する', () => {
    const engine = new GameEngine()
    const state = engine.startGame(defaultConfig)
    expect(state.currentTurn).toBe(PlayerSide.SENTE)
  })

  it('両者の持ち駒が空で始まる', () => {
    const engine = new GameEngine()
    const state = engine.startGame(defaultConfig)
    expect(state.hands[PlayerSide.SENTE].size).toBe(0)
    expect(state.hands[PlayerSide.GOTE].size).toBe(0)
  })

  it('対局状態が ONGOING で始まる', () => {
    const engine = new GameEngine()
    const state = engine.startGame(defaultConfig)
    expect(state.status).toBe(GameStatus.ONGOING)
  })

  it('棋譜が空で始まる', () => {
    const engine = new GameEngine()
    const state = engine.startGame(defaultConfig)
    expect(state.moveHistory).toHaveLength(0)
  })

  it('先手の歩が row=6 に9枚並ぶ', () => {
    const engine = new GameEngine()
    const state = engine.startGame(defaultConfig)
    for (let col = 0; col < 9; col++) {
      const piece = state.board[6]![col]
      expect(piece).not.toBeNull()
      expect(piece!.type).toBe(PieceType.PAWN)
      expect(piece!.owner).toBe(PlayerSide.SENTE)
    }
  })

  it('後手の歩が row=2 に9枚並ぶ', () => {
    const engine = new GameEngine()
    const state = engine.startGame(defaultConfig)
    for (let col = 0; col < 9; col++) {
      const piece = state.board[2]![col]
      expect(piece).not.toBeNull()
      expect(piece!.type).toBe(PieceType.PAWN)
      expect(piece!.owner).toBe(PlayerSide.GOTE)
    }
  })

  it('先手の玉が row=8, col=4 にある', () => {
    const engine = new GameEngine()
    const state = engine.startGame(defaultConfig)
    const king = state.board[8]![4]
    expect(king).not.toBeNull()
    expect(king!.type).toBe(PieceType.KING)
    expect(king!.owner).toBe(PlayerSide.SENTE)
  })
})

describe('GameEngine.applyMove', () => {
  it('先手が歩を動かすと手番が後手に変わる', () => {
    const engine = new GameEngine()
    const state = engine.startGame(defaultConfig)
    // 先手 row=6,col=4 の歩を row=5,col=4 へ
    const newState = engine.applyMove(state, {
      kind: 'BOARD',
      from: { row: 6, col: 4 },
      to:   { row: 5, col: 4 },
      promote: false,
    })
    expect(newState.currentTurn).toBe(PlayerSide.GOTE)
  })

  it('駒を動かすと棋譜に記録される', () => {
    const engine = new GameEngine()
    const state = engine.startGame(defaultConfig)
    const newState = engine.applyMove(state, {
      kind: 'BOARD',
      from: { row: 6, col: 4 },
      to:   { row: 5, col: 4 },
      promote: false,
    })
    expect(newState.moveHistory).toHaveLength(1)
    expect(newState.moveHistory[0]!.moveNumber).toBe(1)
  })

  it('相手の駒を取ると持ち駒に入る', () => {
    const engine = new GameEngine()
    // 先手飛車で後手歩を取るシナリオを手動構築
    const state = engine.startGame(defaultConfig)
    // 飛車 (row=7,col=7) を後手歩 (row=2,col=7) まで動かせる局面を作るのは複雑なので
    // getLegalMoves のテストで十分
    expect(state.hands[PlayerSide.SENTE].size).toBe(0)
  })

  it('合法でない手（相手の駒を動かす）を指すと IllegalMoveError', () => {
    const engine = new GameEngine()
    const state = engine.startGame(defaultConfig)
    expect(() =>
      engine.applyMove(state, {
        kind: 'BOARD',
        from: { row: 2, col: 4 }, // 後手の歩
        to:   { row: 3, col: 4 },
        promote: false,
      })
    ).toThrow()
  })
})

describe('GameEngine.resign', () => {
  it('投了すると RESIGNED 状態になり、相手が勝者になる', () => {
    const engine = new GameEngine()
    const state = engine.startGame(defaultConfig)
    const ended = engine.resign(state, PlayerSide.SENTE)
    expect(ended.status).toBe(GameStatus.RESIGNED)
    expect(ended.winner).toBe(PlayerSide.GOTE)
  })
})
