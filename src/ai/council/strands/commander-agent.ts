// ============================================================
// Strands 総大将オーケストレーター（agents-as-tools）
// 3サブエージェントを並列 LLM 実行後、総大将 Agent が最終裁定
// ⚠️ APIキーはブラウザに露出します（個人利用専用）
// ============================================================

import { Agent } from '@strands-agents/sdk'
import type { GameState, Move } from '../../../types/index.js'
import type { PlayerSide } from '../../../types/index.js'
import { gameStateToPromptContext, moveToText } from '../board-text.js'
import {
  CommanderRule,
  RULE_TO_MODE,
  type CouncilDecision,
  type SubAgentProposal,
  type StrategistAssessment,
} from '../types.js'
import { createGoogleModel } from './gemini-model.js'
import { formatLegalMoves } from './legal-moves-text.js'
import {
  createAttackerAgent,
  createDefenderAgent,
  createStrategistAgent,
  getLegalMovesForState,
  invokeAttackerAgent,
  invokeDefenderAgent,
  invokeStrategistAgent,
} from './sub-agents.js'
import { commanderOutputSchema, type CommanderOutput } from './schemas.js'

const COMMANDER_SYSTEM = `あなたは将棋AIの「総大将」です。
3つのツール（get_attacker_proposal, get_defender_proposal, get_strategist_assessment）を必ずすべて呼び出してから、以下のルールで最終手を決定してください。

【意思決定ルール（優先順位順）】
RULE-1（最優先）: 審判のdangerLevelがDANGER → 智将(defender)の手を採用
RULE-2（第二優先）: 猛将のmateInが3以下 → 猛将(attacker)の手を採用
RULE-3（通常）: 形勢スコアと各スコアを比較して判断

最終回答は structured output で selectedAgent, appliedRule, explanation を返してください。`

const STRANDS_TIMEOUT_MS = 4_500

/** CommanderOutput → CouncilDecision の一部 */
function mapCommanderOutput(
  output: CommanderOutput,
  attacker: SubAgentProposal,
  defender: SubAgentProposal,
  strategist: StrategistAssessment,
): Omit<CouncilDecision, 'attackerProposal' | 'defenderProposal' | 'strategistAssessment' | 'isFallback'> {
  const ruleMap: Record<string, CommanderRule> = {
    RULE_1: CommanderRule.RULE_1_DANGER_DEFENSE,
    RULE_2: CommanderRule.RULE_2_CHECKMATE_FIRST,
    RULE_3: CommanderRule.RULE_3_WEIGHTED,
  }

  let selectedAgent = output.selectedAgent
  let commanderRule = ruleMap[output.appliedRule] ?? CommanderRule.RULE_3_WEIGHTED

  if (strategist.dangerLevel === 'DANGER' && selectedAgent === 'attacker') {
    selectedAgent = 'defender'
    commanderRule = CommanderRule.RULE_1_DANGER_DEFENSE
  }

  const finalMove: Move = selectedAgent === 'attacker' ? attacker.move : defender.move
  const aiMode = RULE_TO_MODE[commanderRule]

  return {
    commanderRule,
    aiMode,
    finalMove,
    ruleExplanation: output.explanation,
  }
}

/** 三軍師提案を総大将プロンプト用テキストに変換 */
function formatProposalsForCommander(
  attacker: SubAgentProposal,
  defender: SubAgentProposal,
  strategist: StrategistAssessment,
): string {
  return [
    '【三軍師の意見（参考）】',
    `猛将: ${moveToText(attacker.move)} score=${attacker.score} ${attacker.reasoning}`,
    `智将: ${moveToText(defender.move)} score=${defender.score} ${defender.reasoning}`,
    `審判: ${strategist.dangerLevel} score=${strategist.positionalScore} ${strategist.summary}`,
  ].join('\n')
}

/**
 * Strands agents-as-tools による合議実行
 * Phase1: 3サブエージェント並列 LLM
 * Phase2: 総大将 Agent（3サブを tools として登録 + structured output）
 */
export async function strandsCommanderDeliberate(
  state: GameState,
  side: PlayerSide,
  apiKey: string,
): Promise<Omit<CouncilDecision, 'isFallback'>> {
  const legalMoves = getLegalMovesForState(state)
  if (legalMoves.length === 0) {
    throw new Error('No legal moves available')
  }

  const context = gameStateToPromptContext(state, side)
  const legalText = formatLegalMoves(legalMoves)

  const abortController = new AbortController()
  const timer = setTimeout(() => abortController.abort(), STRANDS_TIMEOUT_MS)

  try {
    const [attacker, defender, strategist] = await Promise.all([
      invokeAttackerAgent(apiKey, state, side, legalMoves),
      invokeDefenderAgent(apiKey, state, side, legalMoves),
      invokeStrategistAgent(apiKey, state, side, legalMoves),
    ])

    const attackerAgent = createAttackerAgent(apiKey, context, legalText)
    const defenderAgent = createDefenderAgent(apiKey, context, legalText)
    const strategistAgent = createStrategistAgent(apiKey, context, legalText)

    const commanderAgent = new Agent({
      name: 'commander',
      description: '総大将が三軍師の意見を統合して最終手を決定する',
      model: createGoogleModel(apiKey),
      systemPrompt: COMMANDER_SYSTEM,
      tools: [attackerAgent, defenderAgent, strategistAgent],
      structuredOutputSchema: commanderOutputSchema,
      printer: false,
      toolExecutor: 'sequential',
    })

    const proposalText = formatProposalsForCommander(attacker, defender, strategist)
    const result = await commanderAgent.invoke(
      `三軍師に諮問し、3つのツールをすべて呼び出した上で最終手を決定してください。\n\n${proposalText}`,
      { cancelSignal: abortController.signal },
    )

    const output = result.structuredOutput as CommanderOutput | undefined
    if (!output) {
      throw new Error('Commander agent: no structured output')
    }

    const commanderPart = mapCommanderOutput(output, attacker, defender, strategist)

    return {
      attackerProposal: attacker,
      defenderProposal: defender,
      strategistAssessment: strategist,
      ...commanderPart,
    }
  } finally {
    clearTimeout(timer)
  }
}
