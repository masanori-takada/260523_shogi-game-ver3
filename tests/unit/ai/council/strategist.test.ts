import { describe, it, expect } from 'vitest'
import { strategistAssess } from '../../../../src/ai/council/strategist.js'
import { GameEngine } from '../../../../src/core/game.js'
import { PlayerSide, Difficulty } from '../../../../src/types/index.js'

const engine = new GameEngine()

describe('strategistAssess（審判）', () => {
  it('初期局面で StrategistAssessment を返す', () => {
    const config = {
      mode: 'HUMAN_VS_COMPUTER' as any,
      sentePlayer: { side: PlayerSide.SENTE, type: 'COMPUTER' as any, name: 'AI', difficulty: Difficulty.AGENT_AI },
      gotePlayer:  { side: PlayerSide.GOTE,  type: 'HUMAN' as any,    name: '後手' },
    }
    const state = engine.startGame(config)
    const assessment = strategistAssess(state, PlayerSide.SENTE)

    expect(assessment).toBeDefined()
    expect(['SAFE', 'CAUTION', 'DANGER']).toContain(assessment.dangerLevel)
    expect(typeof assessment.positionalScore).toBe('number')
    expect(Array.isArray(assessment.proverbViolations)).toBe(true)
    expect(typeof assessment.summary).toBe('string')
  })

  it('初期局面は SAFE（金銀3枚以上）を返す', () => {
    const config = {
      mode: 'HUMAN_VS_COMPUTER' as any,
      sentePlayer: { side: PlayerSide.SENTE, type: 'COMPUTER' as any, name: 'AI', difficulty: Difficulty.AGENT_AI },
      gotePlayer:  { side: PlayerSide.GOTE,  type: 'HUMAN' as any,    name: '後手' },
    }
    const state = engine.startGame(config)
    const assessment = strategistAssess(state, PlayerSide.SENTE)

    // 初期局面：玉周辺に金将2枚・銀将2枚 → SAFE
    expect(assessment.dangerLevel).toBe('SAFE')
  })

  it('格言違反リストは配列で返される', () => {
    const config = {
      mode: 'HUMAN_VS_COMPUTER' as any,
      sentePlayer: { side: PlayerSide.SENTE, type: 'COMPUTER' as any, name: 'AI', difficulty: Difficulty.AGENT_AI },
      gotePlayer:  { side: PlayerSide.GOTE,  type: 'HUMAN' as any,    name: '後手' },
    }
    const state = engine.startGame(config)
    const assessment = strategistAssess(state, PlayerSide.SENTE)

    expect(Array.isArray(assessment.proverbViolations)).toBe(true)
    assessment.proverbViolations.forEach(v => {
      expect(typeof v.proverb).toBe('string')
      expect(['MINOR', 'MAJOR']).toContain(v.severity)
    })
  })
})
