// ============================================================
// LLM サブエージェント（猛将・智将・審判）— Gemini fetch 直叩き
// ============================================================

import type { GameState, Move } from '../../../types/index.js'
import type { PlayerSide } from '../../../types/index.js'
import { GameEngine } from '../../../core/game.js'
import { gameStateToPromptContext } from '../board-text.js'
import { AgentRole, type SubAgentProposal, type StrategistAssessment } from '../types.js'
import { geminiFetchJson } from './gemini-fetch.js'
import { formatLegalMoves } from './legal-moves-text.js'
import { resolveSubAgentMove } from './move-from-llm.js'
import {
  subAgentOutputSchema,
  strategistOutputSchema,
  type SubAgentOutput,
  type StrategistOutput,
} from './schemas.js'

const ATTACKER_SYSTEM = `あなたは将棋AI「猛将（攻め担当）」です。
攻撃・駒得・詰みを最優先に、合法手リストから最善手を1つ選んでください。
JSON形式: { moveIndex, score, reasoning, mateIn? }`
const DEFENDER_SYSTEM = `あなたは将棋AI「智将（守り担当）」です。
自玉の安全・守りの厚みを最優先に、合法手リストから最善手を1つ選んでください。
JSON形式: { moveIndex, score, reasoning }`
const STRATEGIST_SYSTEM = `あなたは将棋AI「審判（形勢判断）」です。
盤面の形勢・自玉の危険度を評価してください。dangerLevel: SAFE/CAUTION/DANGER
JSON形式: { dangerLevel, positionalScore, proverbViolations, summary }`

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

function buildSubPrompt(context: string, legalText: string): string {
  return `${context}\n\n${legalText}\n\n合法手リストから最善手を1つ選んでください。`
}

/** 猛将 LLM 実行 */
export async function invokeAttackerAgent(
  apiKey: string,
  state: GameState,
  side: PlayerSide,
  legalMoves: Move[],
): Promise<SubAgentProposal> {
  const context = gameStateToPromptContext(state, side)
  const legalText = formatLegalMoves(legalMoves)
  const output = await geminiFetchJson(
    apiKey,
    ATTACKER_SYSTEM,
    buildSubPrompt(context, legalText),
    subAgentOutputSchema,
  )
  return toSubAgentProposal(output, legalMoves, AgentRole.ATTACKER)
}

/** 智将 LLM 実行 */
export async function invokeDefenderAgent(
  apiKey: string,
  state: GameState,
  side: PlayerSide,
  legalMoves: Move[],
): Promise<SubAgentProposal> {
  const context = gameStateToPromptContext(state, side)
  const legalText = formatLegalMoves(legalMoves)
  const output = await geminiFetchJson(
    apiKey,
    DEFENDER_SYSTEM,
    buildSubPrompt(context, legalText),
    subAgentOutputSchema,
  )
  return toSubAgentProposal(output, legalMoves, AgentRole.DEFENDER)
}

/** 審判 LLM 実行 */
export async function invokeStrategistAgent(
  apiKey: string,
  state: GameState,
  side: PlayerSide,
  legalMoves: Move[],
): Promise<StrategistAssessment> {
  const context = gameStateToPromptContext(state, side)
  const legalText = formatLegalMoves(legalMoves)
  const output = await geminiFetchJson(
    apiKey,
    STRATEGIST_SYSTEM,
    `${context}\n\n${legalText}\n\n盤面の形勢と危険度を評価してください。`,
    strategistOutputSchema,
  )
  return toStrategistAssessment(output)
}

/** 局面の合法手を取得 */
export function getLegalMovesForState(state: GameState): Move[] {
  const engine = new GameEngine()
  return engine.getLegalMoves(state)
}
