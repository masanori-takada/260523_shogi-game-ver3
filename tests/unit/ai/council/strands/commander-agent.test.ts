import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GameEngine } from '../../../../../src/core/game.js'
import { PlayerSide, Difficulty } from '../../../../../src/types/index.js'
import { CommanderRule, AgentRole } from '../../../../../src/ai/council/types.js'

const mockAttacker = {
  move: { kind: 'BOARD' as const, from: { row: 6, col: 4 }, to: { row: 5, col: 4 }, promote: false },
  score: 300,
  role: AgentRole.ATTACKER,
  reasoning: '攻め',
}
const mockDefender = {
  move: { kind: 'BOARD' as const, from: { row: 6, col: 3 }, to: { row: 5, col: 3 }, promote: false },
  score: 150,
  role: AgentRole.DEFENDER,
  reasoning: '守り',
}
const mockStrategist = {
  dangerLevel: 'SAFE' as const,
  positionalScore: 50,
  proverbViolations: [],
  summary: '形勢良好',
}

vi.mock('../../../../../src/ai/council/strands/sub-agents.js', () => ({
  getLegalMovesForState: vi.fn(() => [mockAttacker.move, mockDefender.move]),
  invokeAttackerAgent: vi.fn(async () => mockAttacker),
  invokeDefenderAgent: vi.fn(async () => mockDefender),
  invokeStrategistAgent: vi.fn(async () => mockStrategist),
}))

const mockGeminiFetchJson = vi.fn()
vi.mock('../../../../../src/ai/council/strands/gemini-fetch.js', () => ({
  geminiFetchJson: (...args: unknown[]) => mockGeminiFetchJson(...args),
}))

import { strandsCommanderDeliberate } from '../../../../../src/ai/council/strands/commander-agent.js'

const engine = new GameEngine()

function makeState() {
  return engine.startGame({
    mode: 'HUMAN_VS_COMPUTER' as any,
    sentePlayer: { side: PlayerSide.SENTE, type: 'COMPUTER' as any, name: 'AI', difficulty: Difficulty.AGENT_AI },
    gotePlayer: { side: PlayerSide.GOTE, type: 'HUMAN' as any, name: '後手' },
  })
}

describe('strandsCommanderDeliberate', () => {
  beforeEach(() => {
    mockGeminiFetchJson.mockReset()
  })

  it('総大将 JSON を CouncilDecision 形状にマッピングする', async () => {
    mockGeminiFetchJson.mockResolvedValue({
      selectedAgent: 'attacker',
      appliedRule: 'RULE_3',
      explanation: '猛将の手を採用',
    })

    const decision = await strandsCommanderDeliberate(makeState(), PlayerSide.SENTE, 'test-key')

    expect(decision.attackerProposal).toEqual(mockAttacker)
    expect(decision.defenderProposal).toEqual(mockDefender)
    expect(decision.strategistAssessment).toEqual(mockStrategist)
    expect(decision.commanderRule).toBe(CommanderRule.RULE_3_WEIGHTED)
    expect(decision.finalMove).toEqual(mockAttacker.move)
    expect(decision.ruleExplanation).toBe('猛将の手を採用')
  })

  it('Gemini fetch 失敗は throw', async () => {
    mockGeminiFetchJson.mockRejectedValue(new Error('Gemini API 403'))

    await expect(
      strandsCommanderDeliberate(makeState(), PlayerSide.SENTE, 'test-key'),
    ).rejects.toThrow(/403/)
  })
})
