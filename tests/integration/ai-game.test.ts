import { describe, it, expect } from 'vitest'
import { GameEngine } from '../../src/core/game.js'
import { AIEngine } from '../../src/ai/engine.js'
import {
  GameMode, PlayerSide, PlayerType, Difficulty, GameStatus,
  type GameConfig,
} from '../../src/types/index.js'

const config: GameConfig = {
  mode: GameMode.HUMAN_VS_COMPUTER,
  sentePlayer: { side: PlayerSide.SENTE, type: PlayerType.HUMAN, name: '先手' },
  gotePlayer:  {
    side: PlayerSide.GOTE,
    type: PlayerType.COMPUTER,
    name: 'CPU',
    difficulty: Difficulty.BEGINNER,
  },
}

describe('AI対戦 統合テスト', () => {
  it('AIが合法手を返す（初期局面・後手・初級）', async () => {
    const engine = new GameEngine()
    const aiEngine = new AIEngine()

    let state = engine.startGame(config)
    // 先手が初手を指す
    state = engine.applyMove(state, {
      kind: 'BOARD',
      from: { row: 6, col: 4 },
      to:   { row: 5, col: 4 },
      promote: false,
    })
    expect(state.currentTurn).toBe(PlayerSide.GOTE)

    // AIが応手を返す
    const aiMove = await aiEngine.getBestMoveAsync(state, PlayerSide.GOTE, Difficulty.BEGINNER)
    expect(aiMove).toBeDefined()

    // AIの手が合法かどうか確認
    expect(engine.isLegalMove(state, aiMove)).toBe(true)
  }, 10000) // AI探索に最大10秒

  it('AIの手を指すと対局が継続する', async () => {
    const engine = new GameEngine()
    const aiEngine = new AIEngine()

    let state = engine.startGame(config)
    state = engine.applyMove(state, {
      kind: 'BOARD',
      from: { row: 6, col: 4 },
      to:   { row: 5, col: 4 },
      promote: false,
    })

    const aiMove = await aiEngine.getBestMoveAsync(state, PlayerSide.GOTE, Difficulty.BEGINNER)
    state = engine.applyMove(state, aiMove)

    expect(state.currentTurn).toBe(PlayerSide.SENTE)
    expect(state.status === GameStatus.ONGOING || state.status === GameStatus.CHECK).toBe(true)
  }, 10000)
})
