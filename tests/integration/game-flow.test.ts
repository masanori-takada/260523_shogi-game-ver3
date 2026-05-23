import { describe, it, expect } from 'vitest'
import { GameEngine } from '../../src/core/game.js'
import {
  GameMode,
  PlayerSide,
  PlayerType,
  GameStatus,
  PieceType,
  type GameConfig,
} from '../../src/types/index.js'

const config: GameConfig = {
  mode: GameMode.HUMAN_VS_HUMAN,
  sentePlayer: { side: PlayerSide.SENTE, type: PlayerType.HUMAN, name: '先手' },
  gotePlayer:  { side: PlayerSide.GOTE,  type: PlayerType.HUMAN, name: '後手' },
}

describe('対局フロー 統合テスト', () => {
  it('対局開始 → 先手初手 → 後手応手 が正常に進行する', () => {
    const engine = new GameEngine()
    let state = engine.startGame(config)

    expect(state.currentTurn).toBe(PlayerSide.SENTE)
    expect(state.status).toBe(GameStatus.ONGOING)

    // 先手: 7七歩→7六歩 (row=6,col=2 → row=5,col=2)
    state = engine.applyMove(state, {
      kind: 'BOARD',
      from: { row: 6, col: 2 },
      to:   { row: 5, col: 2 },
      promote: false,
    })
    expect(state.currentTurn).toBe(PlayerSide.GOTE)
    expect(state.board[5]![2]).not.toBeNull()
    expect(state.board[6]![2]).toBeNull()

    // 後手: 3三歩→3四歩 (row=2,col=6 → row=3,col=6)
    state = engine.applyMove(state, {
      kind: 'BOARD',
      from: { row: 2, col: 6 },
      to:   { row: 3, col: 6 },
      promote: false,
    })
    expect(state.currentTurn).toBe(PlayerSide.SENTE)
    expect(state.moveHistory).toHaveLength(2)
    expect(state.status).toBe(GameStatus.ONGOING)
  })

  it('投了すると対局が終了する', () => {
    const engine = new GameEngine()
    const state = engine.startGame(config)
    const ended = engine.resign(state, PlayerSide.SENTE)
    expect(ended.status).toBe(GameStatus.RESIGNED)
    expect(ended.winner).toBe(PlayerSide.GOTE)
  })

  it('isLegalMove が合法手で true を返す', () => {
    const engine = new GameEngine()
    const state = engine.startGame(config)
    expect(engine.isLegalMove(state, {
      kind: 'BOARD',
      from: { row: 6, col: 4 },
      to:   { row: 5, col: 4 },
      promote: false,
    })).toBe(true)
  })

  it('isLegalMove が不正な手で false を返す', () => {
    const engine = new GameEngine()
    const state = engine.startGame(config)
    expect(engine.isLegalMove(state, {
      kind: 'BOARD',
      from: { row: 6, col: 4 },
      to:   { row: 4, col: 4 }, // 歩は2マス動けない
      promote: false,
    })).toBe(false)
  })
})
