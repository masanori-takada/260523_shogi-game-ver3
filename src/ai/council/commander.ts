// ============================================================
// 総大将（意思決定エージェント）
// 三軍師の意見をルールベースで統合し最善手を決定する
// ============================================================

import type { GameState } from '../../types/index.js'
import {
  CommanderRule,
  RULE_TO_MODE,
  type AIMode,
  type SubAgentProposal,
  type StrategistAssessment,
  type CouncilDecision,
} from './types.js'

// ------------------------------------------------------------
// ルール適用ロジック（純粋関数 — テスト可能）
// ------------------------------------------------------------

/**
 * 総大将の意思決定ルールを適用して CouncilDecision を返す
 * 優先順位: RULE-1（DANGER）> RULE-2（詰み）> RULE-3（通常）
 */
export function applyCommanderRules(
  attacker: SubAgentProposal,
  defender: SubAgentProposal,
  strategist: StrategistAssessment,
  _state: GameState,
): Omit<CouncilDecision, 'attackerProposal' | 'defenderProposal' | 'strategistAssessment' | 'isFallback'> {

  // RULE-1: 審判がDANGER → 智将手を強制採用（最優先）
  if (strategist.dangerLevel === 'DANGER') {
    return {
      commanderRule: CommanderRule.RULE_1_DANGER_DEFENSE,
      aiMode: RULE_TO_MODE[CommanderRule.RULE_1_DANGER_DEFENSE],
      finalMove: defender.move,
      ruleExplanation: `⚠️ 危険度高：智将の守り手を採用（${strategist.proverbViolations[0]?.proverb ?? '自玉危険'}）`,
    }
  }

  // RULE-2: 猛将が3手詰み以内を発見 → 猛将手を最優先
  if (attacker.mateIn !== undefined && attacker.mateIn <= 3) {
    return {
      commanderRule: CommanderRule.RULE_2_CHECKMATE_FIRST,
      aiMode: RULE_TO_MODE[CommanderRule.RULE_2_CHECKMATE_FIRST],
      finalMove: attacker.move,
      ruleExplanation: `✅ 詰み${attacker.mateIn}手発見！猛将の攻め手を最優先`,
    }
  }

  // RULE-3: 通常局面 → 形勢スコアで重み付け（採用した手でaiModeを動的決定）
  const score = strategist.positionalScore
  let selectedMove = attacker.move
  let aiMode: AIMode = 'BALANCE'
  let weightDescription = ''

  if (score > 200) {
    // 有利局面：猛将スコアが一定以上なら攻め、でなければ智将
    if (attacker.score >= defender.score * 0.5) {
      selectedMove = attacker.move
      aiMode = 'ATTACK'
      weightDescription = '形勢有利・猛将手を採用'
    } else {
      selectedMove = defender.move
      aiMode = 'DEFENSE'
      weightDescription = '形勢有利・智将手を採用'
    }
  } else if (score < -200) {
    // 不利局面：必ず智将
    selectedMove = defender.move
    aiMode = 'DEFENSE'
    weightDescription = '形勢不利・智将手を採用'
  } else {
    // 互角：スコアが高い方を採用
    if (attacker.score > defender.score) {
      selectedMove = attacker.move
      aiMode = 'ATTACK'
      weightDescription = '形勢互角・猛将スコア優位'
    } else if (defender.score > attacker.score) {
      selectedMove = defender.move
      aiMode = 'DEFENSE'
      weightDescription = '形勢互角・智将スコア優位'
    } else {
      selectedMove = attacker.move
      aiMode = 'BALANCE'
      weightDescription = '形勢互角・スコア同点'
    }
  }

  const icon = aiMode === 'ATTACK' ? '🗡️' : aiMode === 'DEFENSE' ? '🛡️' : '⚖️'

  return {
    commanderRule: CommanderRule.RULE_3_WEIGHTED,
    aiMode,
    finalMove: selectedMove,
    ruleExplanation: `${icon} ${weightDescription}`,
  }
}
