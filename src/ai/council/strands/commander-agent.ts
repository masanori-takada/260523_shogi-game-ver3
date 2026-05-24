// ============================================================
// Strands 総大将オーケストレーター
// Phase1: 3サブエージェント並列 LLM → Phase2: 総大将 LLM 裁定
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
  getLegalMovesForState,
  invokeAttackerAgent,
  invokeDefenderAgent,
  invokeStrategistAgent,
} from './sub-agents.js'
import { commanderOutputSchema, type CommanderOutput } from './schemas.js'

/** CouncilEngine の全体タイムアウト（3秒）より少し短く */
export const STRANDS_TIMEOUT_MS = 2_800

const COMMANDER_SYSTEM = `あなたは将棋AIの「総大将」です。
三軍師の提案テキストを読み、以下のルールで最終手を決定してください。

【意思決定ルール（優先順位順）】
RULE-1（最優先）: 審判のdangerLevelがDANGER → 智将(defender)の手を採用
RULE-2（第二優先）: 猛将のmateInが3以下 → 猛将(attacker)の手を採用
RULE-3（通常）: 形勢スコアと各スコアを比較して判断

最終回答は structured output で selectedAgent, appliedRule, explanation を返してください。`

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms),
    ),
  ])
}

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
  const mateInfo = attacker.mateIn !== undefined ? ` mateIn=${attacker.mateIn}` : ''
  return [
    '【三軍師の意見】',
    `猛将: ${moveToText(attacker.move)} score=${attacker.score}${mateInfo} / ${attacker.reasoning}`,
    `智将: ${moveToText(defender.move)} score=${defender.score} / ${defender.reasoning}`,
    `審判: ${strategist.dangerLevel} score=${strategist.positionalScore} / ${strategist.summary}`,
  ].join('\n')
}

async function runDeliberation(
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

  const [attacker, defender, strategist] = await Promise.all([
    invokeAttackerAgent(apiKey, state, side, legalMoves),
    invokeDefenderAgent(apiKey, state, side, legalMoves),
    invokeStrategistAgent(apiKey, state, side, legalMoves),
  ])

  const commanderAgent = new Agent({
    name: 'commander',
    description: '総大将が三軍師の意見を統合して最終手を決定する',
    model: createGoogleModel(apiKey),
    systemPrompt: COMMANDER_SYSTEM,
    structuredOutputSchema: commanderOutputSchema,
    printer: false,
  })

  const proposalText = formatProposalsForCommander(attacker, defender, strategist)
  const result = await commanderAgent.invoke(
    `${context}\n\n${proposalText}\n\n上記の三軍師意見に基づき最終手を決定してください。`,
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
}

/**
 * Strands 合議実行（最大4 LLM 呼び出し: 三軍師並列 + 総大将1回、2.8秒上限）
 */
export function strandsCommanderDeliberate(
  state: GameState,
  side: PlayerSide,
  apiKey: string,
): Promise<Omit<CouncilDecision, 'isFallback'>> {
  return withTimeout(
    runDeliberation(state, side, apiKey),
    STRANDS_TIMEOUT_MS,
    'Strands',
  )
}
