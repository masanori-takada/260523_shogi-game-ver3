import { describe, it, expect } from 'vitest'
import { CouncilEngine } from '../../src/ai/council/council-engine.js'
import { GameEngine } from '../../src/core/game.js'
import { PlayerSide, Difficulty, GameMode, PlayerType } from '../../src/types/index.js'

const engine = new GameEngine()

describe('CouncilEngine 統合テスト', () => {
  it('deliberate() が CouncilDecision を返す（フォールバック経由）', async () => {
    const config = {
      mode: GameMode.HUMAN_VS_COMPUTER,
      sentePlayer: { side: PlayerSide.SENTE, type: PlayerType.COMPUTER, name: 'AI', difficulty: Difficulty.AGENT_AI },
      gotePlayer:  { side: PlayerSide.GOTE,  type: PlayerType.HUMAN,    name: '後手' },
    }
    const state = engine.startGame(config)
    const councilEngine = new CouncilEngine()

    // APIキー未指定 → フォールバックで動作
    const decision = await councilEngine.deliberate(state, PlayerSide.SENTE)

    expect(decision).toBeDefined()
    expect(decision.finalMove).toBeDefined()
    expect(decision.attackerProposal).toBeDefined()
    expect(decision.defenderProposal).toBeDefined()
    expect(decision.strategistAssessment).toBeDefined()
    expect(['RULE_1', 'RULE_2', 'RULE_3']).toContain(decision.commanderRule)
    expect(['ATTACK', 'DEFENSE', 'BALANCE']).toContain(decision.aiMode)
    expect(typeof decision.ruleExplanation).toBe('string')
    expect(typeof decision.isFallback).toBe('boolean')
  }, 15000)

  it('deliberate() の finalMove は合法手である', async () => {
    const config = {
      mode: GameMode.HUMAN_VS_COMPUTER,
      sentePlayer: { side: PlayerSide.SENTE, type: PlayerType.COMPUTER, name: 'AI', difficulty: Difficulty.AGENT_AI },
      gotePlayer:  { side: PlayerSide.GOTE,  type: PlayerType.HUMAN,    name: '後手' },
    }
    const state = engine.startGame(config)
    const councilEngine = new CouncilEngine()

    const decision = await councilEngine.deliberate(state, PlayerSide.SENTE)
    const legalMoves = engine.getLegalMoves(state)

    const isLegal = legalMoves.some(m => JSON.stringify(m) === JSON.stringify(decision.finalMove))
    expect(isLegal).toBe(true)
  }, 15000)
})
