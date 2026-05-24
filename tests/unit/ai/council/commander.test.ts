import { describe, it, expect } from 'vitest'
import { applyCommanderRules } from '../../../../src/ai/council/commander.js'
import {
  CommanderRule,
  AIMode,
  RULE_TO_MODE,
  type SubAgentProposal,
  type StrategistAssessment,
  AgentRole,
} from '../../../../src/ai/council/types.js'
import { GameEngine } from '../../../../src/core/game.js'
import { PlayerSide, Difficulty } from '../../../../src/types/index.js'

const engine = new GameEngine()

function makeConfig() {
  return {
    mode: 'HUMAN_VS_COMPUTER' as any,
    sentePlayer: { side: PlayerSide.SENTE, type: 'COMPUTER' as any, name: 'AI', difficulty: Difficulty.AGENT_AI },
    gotePlayer:  { side: PlayerSide.GOTE,  type: 'HUMAN' as any,    name: '後手' },
  }
}

function makeDummyMove() {
  return { kind: 'BOARD' as const, from: { row: 6, col: 4 }, to: { row: 5, col: 4 }, promote: false }
}

describe('applyCommanderRules（総大将の意思決定ルール）', () => {
  describe('RULE-1: 審判がDANGERのとき智将の手を採用', () => {
    it('dangerLevel=DANGER → 智将の提案を採用し RULE_1 を返す', () => {
      const state = engine.startGame(makeConfig())
      const attackerMove = makeDummyMove()
      const defenderMove = { kind: 'BOARD' as const, from: { row: 6, col: 3 }, to: { row: 5, col: 3 }, promote: false }

      const attacker: SubAgentProposal = { move: attackerMove, score: 500, role: AgentRole.ATTACKER, reasoning: '攻め' }
      const defender: SubAgentProposal = { move: defenderMove, score: 100, role: AgentRole.DEFENDER, reasoning: '守り' }
      const strategist: StrategistAssessment = {
        dangerLevel: 'DANGER',
        positionalScore: -200,
        proverbViolations: [{ proverb: '玉の守りは金銀3枚', severity: 'MAJOR' }],
        summary: '危険',
      }

      const result = applyCommanderRules(attacker, defender, strategist, state)

      expect(result.commanderRule).toBe(CommanderRule.RULE_1_DANGER_DEFENSE)
      expect(result.aiMode).toBe('DEFENSE')
      expect(JSON.stringify(result.finalMove)).toBe(JSON.stringify(defenderMove))
    })
  })

  describe('RULE-2: 猛将が3手詰みを発見したとき猛将の手を採用', () => {
    it('mateIn=3 → 猛将の提案を採用し RULE_2 を返す', () => {
      const state = engine.startGame(makeConfig())
      const attackerMove = makeDummyMove()
      const defenderMove = { kind: 'BOARD' as const, from: { row: 6, col: 3 }, to: { row: 5, col: 3 }, promote: false }

      const attacker: SubAgentProposal = { move: attackerMove, score: 100000, role: AgentRole.ATTACKER, reasoning: '詰み3手', mateIn: 3 }
      const defender: SubAgentProposal = { move: defenderMove, score: 200, role: AgentRole.DEFENDER, reasoning: '守り' }
      const strategist: StrategistAssessment = {
        dangerLevel: 'SAFE',
        positionalScore: 100,
        proverbViolations: [],
        summary: '安全',
      }

      const result = applyCommanderRules(attacker, defender, strategist, state)

      expect(result.commanderRule).toBe(CommanderRule.RULE_2_CHECKMATE_FIRST)
      expect(result.aiMode).toBe('ATTACK')
      expect(JSON.stringify(result.finalMove)).toBe(JSON.stringify(attackerMove))
    })

    it('RULE-1（DANGER）はRULE-2（詰み）より優先される', () => {
      const state = engine.startGame(makeConfig())
      const attackerMove = makeDummyMove()
      const defenderMove = { kind: 'BOARD' as const, from: { row: 6, col: 3 }, to: { row: 5, col: 3 }, promote: false }

      const attacker: SubAgentProposal = { move: attackerMove, score: 100000, role: AgentRole.ATTACKER, reasoning: '詰み3手', mateIn: 3 }
      const defender: SubAgentProposal = { move: defenderMove, score: 100, role: AgentRole.DEFENDER, reasoning: '守り' }
      const strategist: StrategistAssessment = {
        dangerLevel: 'DANGER', // DANGER かつ 詰み3手 → RULE-1優先
        positionalScore: -500,
        proverbViolations: [{ proverb: '玉の守りは金銀3枚', severity: 'MAJOR' }],
        summary: '危険',
      }

      const result = applyCommanderRules(attacker, defender, strategist, state)

      expect(result.commanderRule).toBe(CommanderRule.RULE_1_DANGER_DEFENSE)
      expect(result.aiMode).toBe('DEFENSE')
    })
  })

  describe('RULE-3: 通常局面は重み付け統合', () => {
    it('互角局面・猛将スコア優位 → RULE_3/ATTACK を返す', () => {
      const state = engine.startGame(makeConfig())
      const attackerMove = makeDummyMove()
      const defenderMove = { kind: 'BOARD' as const, from: { row: 6, col: 3 }, to: { row: 5, col: 3 }, promote: false }

      const attacker: SubAgentProposal = { move: attackerMove, score: 300, role: AgentRole.ATTACKER, reasoning: '攻め' }
      const defender: SubAgentProposal = { move: defenderMove, score: 200, role: AgentRole.DEFENDER, reasoning: '守り' }
      const strategist: StrategistAssessment = {
        dangerLevel: 'SAFE',
        positionalScore: 50,
        proverbViolations: [],
        summary: '互角',
      }

      const result = applyCommanderRules(attacker, defender, strategist, state)

      expect(result.commanderRule).toBe(CommanderRule.RULE_3_WEIGHTED)
      expect(result.aiMode).toBe('ATTACK') // 猛将(300) > 智将(200) → ATTACK
    })

    it('互角局面・スコア同点 → RULE_3/BALANCE を返す', () => {
      const state = engine.startGame(makeConfig())
      const attackerMove = makeDummyMove()
      const defenderMove = { kind: 'BOARD' as const, from: { row: 6, col: 3 }, to: { row: 5, col: 3 }, promote: false }

      const attacker: SubAgentProposal = { move: attackerMove, score: 200, role: AgentRole.ATTACKER, reasoning: '攻め' }
      const defender: SubAgentProposal = { move: defenderMove, score: 200, role: AgentRole.DEFENDER, reasoning: '守り' }
      const strategist: StrategistAssessment = {
        dangerLevel: 'SAFE',
        positionalScore: 0,
        proverbViolations: [],
        summary: '互角',
      }

      const result = applyCommanderRules(attacker, defender, strategist, state)

      expect(result.commanderRule).toBe(CommanderRule.RULE_3_WEIGHTED)
      expect(result.aiMode).toBe('BALANCE') // 同点のときのみ BALANCE
    })

    it('互角局面・智将スコア優位 → RULE_3/DEFENSE を返す', () => {
      const state = engine.startGame(makeConfig())
      const attackerMove = makeDummyMove()
      const defenderMove = { kind: 'BOARD' as const, from: { row: 6, col: 3 }, to: { row: 5, col: 3 }, promote: false }

      const attacker: SubAgentProposal = { move: attackerMove, score: 100, role: AgentRole.ATTACKER, reasoning: '攻め' }
      const defender: SubAgentProposal = { move: defenderMove, score: 300, role: AgentRole.DEFENDER, reasoning: '守り' }
      const strategist: StrategistAssessment = {
        dangerLevel: 'SAFE',
        positionalScore: 50,
        proverbViolations: [],
        summary: '互角',
      }

      const result = applyCommanderRules(attacker, defender, strategist, state)

      expect(result.commanderRule).toBe(CommanderRule.RULE_3_WEIGHTED)
      expect(result.aiMode).toBe('DEFENSE') // 智将(300) > 猛将(100) → DEFENSE
    })
  })

  describe('RULE_TO_MODE マッピング', () => {
    it('各ルールが正しいAIModeに対応する', () => {
      expect(RULE_TO_MODE[CommanderRule.RULE_1_DANGER_DEFENSE]).toBe('DEFENSE' as AIMode)
      expect(RULE_TO_MODE[CommanderRule.RULE_2_CHECKMATE_FIRST]).toBe('ATTACK' as AIMode)
      expect(RULE_TO_MODE[CommanderRule.RULE_3_WEIGHTED]).toBe('BALANCE' as AIMode)
    })
  })

  describe('ruleExplanation テキスト検証', () => {
    it('RULE-1 適用時：ruleExplanation が「⚠️ 危険度高」から始まり DEFENSE モード', () => {
      const state = engine.startGame(makeConfig())
      const attacker: SubAgentProposal = { move: makeDummyMove(), score: 500, role: AgentRole.ATTACKER, reasoning: '攻め' }
      const defenderMove = { kind: 'BOARD' as const, from: { row: 6, col: 3 }, to: { row: 5, col: 3 }, promote: false }
      const defender: SubAgentProposal = { move: defenderMove, score: 100, role: AgentRole.DEFENDER, reasoning: '守り' }
      const strategist: StrategistAssessment = {
        dangerLevel: 'DANGER',
        positionalScore: -200,
        proverbViolations: [{ proverb: '玉の守りは金銀3枚', severity: 'MAJOR' }],
        summary: '危険',
      }

      const result = applyCommanderRules(attacker, defender, strategist, state)

      expect(result.aiMode).toBe('DEFENSE' as AIMode)
      expect(result.ruleExplanation).toMatch(/⚠️/)
      expect(result.ruleExplanation).toMatch(/危険度高/)
      expect(result.commanderRule).toBe(CommanderRule.RULE_1_DANGER_DEFENSE)
    })

    it('RULE-2 適用時：ruleExplanation が詰み手数を含み ATTACK モード', () => {
      const state = engine.startGame(makeConfig())
      const attacker: SubAgentProposal = { move: makeDummyMove(), score: 100000, role: AgentRole.ATTACKER, reasoning: '詰み', mateIn: 2 }
      const defenderMove = { kind: 'BOARD' as const, from: { row: 6, col: 3 }, to: { row: 5, col: 3 }, promote: false }
      const defender: SubAgentProposal = { move: defenderMove, score: 200, role: AgentRole.DEFENDER, reasoning: '守り' }
      const strategist: StrategistAssessment = {
        dangerLevel: 'SAFE',
        positionalScore: 100,
        proverbViolations: [],
        summary: '安全',
      }

      const result = applyCommanderRules(attacker, defender, strategist, state)

      expect(result.aiMode).toBe('ATTACK' as AIMode)
      expect(result.ruleExplanation).toMatch(/✅/)
      expect(result.ruleExplanation).toMatch(/詰み2手/)
      expect(result.commanderRule).toBe(CommanderRule.RULE_2_CHECKMATE_FIRST)
    })

    it('RULE-3 適用時（スコア同点）：ruleExplanation が「⚖️」から始まり BALANCE モード', () => {
      const state = engine.startGame(makeConfig())
      const attacker: SubAgentProposal = { move: makeDummyMove(), score: 200, role: AgentRole.ATTACKER, reasoning: '攻め' }
      const defenderMove = { kind: 'BOARD' as const, from: { row: 6, col: 3 }, to: { row: 5, col: 3 }, promote: false }
      const defender: SubAgentProposal = { move: defenderMove, score: 200, role: AgentRole.DEFENDER, reasoning: '守り' }
      const strategist: StrategistAssessment = {
        dangerLevel: 'SAFE',
        positionalScore: 0, // 均衡 かつ スコア同点
        proverbViolations: [],
        summary: '互角',
      }

      const result = applyCommanderRules(attacker, defender, strategist, state)

      expect(result.aiMode).toBe('BALANCE' as AIMode)
      expect(result.ruleExplanation).toMatch(/⚖️/)
      expect(result.commanderRule).toBe(CommanderRule.RULE_3_WEIGHTED)
    })

    it('RULE-3 適用時（形勢有利・猛将優位）：ATTACK モードで有利テキストを含む', () => {
      const state = engine.startGame(makeConfig())
      const attacker: SubAgentProposal = { move: makeDummyMove(), score: 600, role: AgentRole.ATTACKER, reasoning: '攻め有利' }
      const defenderMove = { kind: 'BOARD' as const, from: { row: 6, col: 3 }, to: { row: 5, col: 3 }, promote: false }
      const defender: SubAgentProposal = { move: defenderMove, score: 100, role: AgentRole.DEFENDER, reasoning: '守り' }
      const strategist: StrategistAssessment = {
        dangerLevel: 'SAFE',
        positionalScore: 500, // 形勢大幅有利
        proverbViolations: [],
        summary: '有利',
      }

      const result = applyCommanderRules(attacker, defender, strategist, state)

      expect(result.aiMode).toBe('ATTACK' as AIMode) // 有利かつ猛将スコア優位 → ATTACK
      expect(result.ruleExplanation).toMatch(/有利/)
    })
  })
})
