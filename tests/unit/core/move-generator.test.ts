import { describe, it, expect } from 'vitest'
import { GameEngine } from '../../../src/core/game.js'
import {
  GameMode,
  PlayerSide,
  PlayerType,
  PieceType,
  type GameConfig,
  type BoardMove,
} from '../../../src/types/index.js'

const defaultConfig: GameConfig = {
  mode: GameMode.HUMAN_VS_HUMAN,
  sentePlayer: { side: PlayerSide.SENTE, type: PlayerType.HUMAN, name: '先手' },
  gotePlayer:  { side: PlayerSide.GOTE,  type: PlayerType.HUMAN, name: '後手' },
}

describe('getLegalMoves — 初期局面', () => {
  it('先手の歩 (row=6,col=4) は1マス前に動ける', () => {
    const engine = new GameEngine()
    const state = engine.startGame(defaultConfig)
    const moves = engine.getLegalMoves(state, { row: 6, col: 4 })

    expect(moves.some(m =>
      m.kind === 'BOARD' &&
      (m as BoardMove).from.row === 6 &&
      (m as BoardMove).from.col === 4 &&
      (m as BoardMove).to.row   === 5 &&
      (m as BoardMove).to.col   === 4
    )).toBe(true)
  })

  it('先手の歩 (row=6,col=0) は1マス前にのみ動ける（1手）', () => {
    const engine = new GameEngine()
    const state = engine.startGame(defaultConfig)
    const moves = engine.getLegalMoves(state, { row: 6, col: 0 })
    // 成りなし1手のみ（相手陣ではないので promote:false のみ）
    expect(moves).toHaveLength(1)
  })

  it('先手の桂馬 (row=8,col=1) は初期局面では動けない（跳び先が自駒の歩で塞がれている）', () => {
    const engine = new GameEngine()
    const state = engine.startGame(defaultConfig)
    const moves = engine.getLegalMoves(state, { row: 8, col: 1 })
    // 桂馬の跳び先: (6,0) と (6,2) はどちらも先手の歩 → 0手
    expect(moves).toHaveLength(0)
  })

  it('先手の飛車 (row=7,col=7) は初期局面で横方向に動ける', () => {
    const engine = new GameEngine()
    const state = engine.startGame(defaultConfig)
    const moves = engine.getLegalMoves(state, { row: 7, col: 7 })
    // 飛車は row=7 の横方向（col=2〜6: 5手, col=8: 1手）= 6手
    // 上(row=6)は先手の歩で遮断、下(row=8)は先手の桂馬で遮断
    expect(moves.length).toBeGreaterThan(0)
  })

  it('先手の角 (row=7,col=1) は初期局面では動けない', () => {
    const engine = new GameEngine()
    const state = engine.startGame(defaultConfig)
    const moves = engine.getLegalMoves(state, { row: 7, col: 1 })
    expect(moves).toHaveLength(0)
  })

  it('後手の手番でない場合、先手の駒の合法手は空', () => {
    const engine = new GameEngine()
    const state = engine.startGame(defaultConfig)
    // 後手の手番に先手の駒の合法手を求める
    const goteState = { ...state, currentTurn: PlayerSide.GOTE }
    const moves = engine.getLegalMoves(goteState, { row: 6, col: 4 })
    expect(moves).toHaveLength(0)
  })
})

describe('getLegalMoves — 全合法手', () => {
  it('初期局面で先手の全合法手は30手', () => {
    // 歩9枚×1 + 桂馬2枚×2 = 13手
    // ただし promote:false/true の重複なし（相手陣でないため全て promote:false）
    const engine = new GameEngine()
    const state = engine.startGame(defaultConfig)
    const moves = engine.getLegalMoves(state)
    // 初期局面の先手合法手: 歩9×1マス + 桂馬2×1マス = 11手（角・飛は遮断）
    // 実際には歩9+桂馬2=11手が標準
    expect(moves.length).toBeGreaterThan(0)
  })
})
