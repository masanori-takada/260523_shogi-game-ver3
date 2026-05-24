// ============================================================
// Strands サブエージェント（猛将・智将・審判）生成・実行
// ============================================================

import { Agent } from '@strands-agents/sdk'
import type { GameState, Move } from '../../../types/index.js'
import type { PlayerSide } from '../../../types/index.js'
import { GameEngine } from '../../../core/game.js'
import { gameStateToPromptContext } from '../board-text.js'
import { AgentRole, type SubAgentProposal, type StrategistAssessment } from '../types.js'
import { createGoogleModel } from './gemini-model.js'
import { formatLegalMoves } from './legal-moves-text.js'
import { resolveSubAgentMove } from './move-from-llm.js'
import {
  subAgentOutputSchema,
  strategistOutputSchema,
  type SubAgentOutput,
  type StrategistOutput,
} from './schemas.js'

const ATTACKER_SYSTEM = `あなたは将棋AI「猛将（攻め担当）」です。
攻撃・駒得・詰みを最優先に、合法手リストから最善手を1つ選んでください。`
const DEFENDER_SYSTEM = `あなたは将棋AI「智将（守り担当）」です。
自玉の安全・守りの厚みを最優先に、合法手リストから最善手を1つ選んでください。`
const STRATEGIST_SYSTEM = `あなたは将棋AI「審判（形勢判断）」です。
盤面の形勢・自玉の危険度を評価してください。dangerLevel: SAFE/CAUTION/DANGER`

const SUB_AGENT_INVOKE_PROMPT = '合法手リストから最善手を1つ選んでください。'
const STRATEGIST_INVOKE_PROMPT = '盤面の形勢と危険度を評価してください。'

/** 猛将 Strands Agent を生成 */
export function createAttackerAgent(apiKey: string, context: string, legalText: string): Agent {
  return new Agent({
    name: 'get_attacker_proposal',
    description: '猛将（攻め担当）が候補手・評価・理由を提案する',
    model: createGoogleModel(apiKey),
    systemPrompt: `${ATTACKER_SYSTEM}\n\n${context}\n\n${legalText}`,
    structuredOutputSchema: subAgentOutputSchema,
    printer: false,
  })
}

/** 智将 Strands Agent を生成 */
export function createDefenderAgent(apiKey: string, context: string, legalText: string): Agent {
  return new Agent({
    name: 'get_defender_proposal',
    description: '智将（守り担当）が候補手・評価・理由を提案する',
    model: createGoogleModel(apiKey),
    systemPrompt: `${DEFENDER_SYSTEM}\n\n${context}\n\n${legalText}`,
    structuredOutputSchema: subAgentOutputSchema,
    printer: false,
  })
}

/** 審判 Strands Agent を生成 */
export function createStrategistAgent(apiKey: string, context: string, legalText: string): Agent {
  return new Agent({
    name: 'get_strategist_assessment',
    description: '審判（形勢判断）が危険度・形勢・格言違反を評価する',
    model: createGoogleModel(apiKey),
    systemPrompt: `${STRATEGIST_SYSTEM}\n\n${context}\n\n${legalText}`,
    structuredOutputSchema: strategistOutputSchema,
    printer: false,
  })
}

function toSubAgentProposal(
  output: SubAgentOutput,
  legalMoves: Move[],
  role: AgentRole,
): SubAgentProposal {
  const move = resolveSubAgentMove(output, legalMoves)
  return {
    move,
    score: output.score,
    role,
    reasoning: output.reasoning,
    ...(output.mateIn !== undefined ? { mateIn: output.mateIn } : {}),
  }
}

function toStrategistAssessment(output: StrategistOutput): StrategistAssessment {
  return {
    dangerLevel: output.dangerLevel,
    positionalScore: output.positionalScore,
    proverbViolations: output.proverbViolations,
    summary: output.summary,
  }
}

/** 猛将 Agent を LLM 実行 */
export async function invokeAttackerAgent(
  apiKey: string,
  state: GameState,
  side: PlayerSide,
  legalMoves: Move[],
): Promise<SubAgentProposal> {
  const context = gameStateToPromptContext(state, side)
  const legalText = formatLegalMoves(legalMoves)
  const agent = createAttackerAgent(apiKey, context, legalText)
  const result = await agent.invoke(SUB_AGENT_INVOKE_PROMPT)
  const output = result.structuredOutput as SubAgentOutput | undefined
  if (!output) throw new Error('Attacker agent: no structured output')
  return toSubAgentProposal(output, legalMoves, AgentRole.ATTACKER)
}

/** 智将 Agent を LLM 実行 */
export async function invokeDefenderAgent(
  apiKey: string,
  state: GameState,
  side: PlayerSide,
  legalMoves: Move[],
): Promise<SubAgentProposal> {
  const context = gameStateToPromptContext(state, side)
  const legalText = formatLegalMoves(legalMoves)
  const agent = createDefenderAgent(apiKey, context, legalText)
  const result = await agent.invoke(SUB_AGENT_INVOKE_PROMPT)
  const output = result.structuredOutput as SubAgentOutput | undefined
  if (!output) throw new Error('Defender agent: no structured output')
  return toSubAgentProposal(output, legalMoves, AgentRole.DEFENDER)
}

/** 審判 Agent を LLM 実行 */
export async function invokeStrategistAgent(
  apiKey: string,
  state: GameState,
  side: PlayerSide,
  legalMoves: Move[],
): Promise<StrategistAssessment> {
  const context = gameStateToPromptContext(state, side)
  const legalText = formatLegalMoves(legalMoves)
  const agent = createStrategistAgent(apiKey, context, legalText)
  const result = await agent.invoke(STRATEGIST_INVOKE_PROMPT)
  const output = result.structuredOutput as StrategistOutput | undefined
  if (!output) throw new Error('Strategist agent: no structured output')
  return toStrategistAssessment(output)
}

/** 局面の合法手を取得 */
export function getLegalMovesForState(state: GameState): Move[] {
  const engine = new GameEngine()
  return engine.getLegalMoves(state)
}
