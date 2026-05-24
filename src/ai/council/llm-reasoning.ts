// ============================================================
// LLM reasoning 生成ユーティリティ（Gemini版）
// 各サブエージェントの reasoning / summary を Gemini で生成する
// ⚠️ WARNING: APIキーはブラウザ側に露出します。個人利用プロジェクト専用。
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai'
import type { DangerLevel } from './types.js'

/** 全呼び出しで共通使用するモデル */
const GEMINI_MODEL = 'gemini-2.0-flash-lite'

/** reasoning生成のタイムアウト（ms） */
const REASONING_TIMEOUT_MS = 2500

export type AgentPersona = 'attacker' | 'defender' | 'strategist'

export interface LLMReasoningContext {
  persona: AgentPersona
  boardText: string        // gameStateToPromptContext()の出力
  proposedMoveText: string // moveToText()の出力
  score: number
  mateIn?: number
  dangerLevel?: DangerLevel
  proverbViolations?: string[]
}

// ペルソナ別のシステムプロンプト
const SYSTEM_PROMPTS: Record<AgentPersona, string> = {
  attacker: 'あなたは将棋AIの「猛将」です。攻撃担当として、相手玉への詰みと駒得を最優先します。提案手の攻撃的な意図を60字以内の日本語で簡潔に説明してください。余計な前置きは不要です。',
  defender: 'あなたは将棋AIの「智将」です。守り担当として、自玉の安全を最優先します。提案手の守備的な意図を60字以内の日本語で簡潔に説明してください。余計な前置きは不要です。',
  strategist: 'あなたは将棋AIの「審判」です。局面全体を客観的に評価します。現在の形勢を80字以内の日本語で簡潔に説明してください。余計な前置きは不要です。',
}

function buildUserPrompt(ctx: LLMReasoningContext): string {
  const lines: string[] = [ctx.boardText, '']

  if (ctx.persona === 'attacker') {
    lines.push(`【提案手】${ctx.proposedMoveText}`)
    lines.push(`【攻撃スコア】${ctx.score > 0 ? '+' : ''}${ctx.score}`)
    if (ctx.mateIn !== undefined) {
      lines.push(`【詰み】${ctx.mateIn}手詰み発見！`)
    }
    lines.push('')
    lines.push('この手の攻撃的な意図を60字以内で説明してください。')
  } else if (ctx.persona === 'defender') {
    lines.push(`【提案手】${ctx.proposedMoveText}`)
    lines.push(`【防御スコア】${ctx.score > 0 ? '+' : ''}${ctx.score}`)
    lines.push(`【危険度】${ctx.dangerLevel ?? 'SAFE'}`)
    lines.push('')
    lines.push('この手の守備的な意図を60字以内で説明してください。')
  } else {
    lines.push(`【形勢スコア】${ctx.score > 0 ? '+' : ''}${ctx.score}（正=先手有利、負=後手有利）`)
    lines.push(`【危険度】${ctx.dangerLevel ?? 'SAFE'}`)
    if (ctx.proverbViolations && ctx.proverbViolations.length > 0) {
      lines.push(`【格言違反】${ctx.proverbViolations.join('、')}`)
    } else {
      lines.push('【格言違反】なし')
    }
    lines.push('')
    lines.push('現在の局面の形勢を80字以内で評価してください。')
  }

  return lines.join('\n')
}

/**
 * Geminiを使ってサブエージェントのreasoningを生成する
 * 失敗時はthrowする → 呼び出し元でフォールバック
 */
export async function generateLLMReasoning(
  ctx: LLMReasoningContext,
  apiKey: string,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: SYSTEM_PROMPTS[ctx.persona],
    generationConfig: {
      maxOutputTokens: ctx.persona === 'strategist' ? 200 : 150,
      temperature: 0.7,
    },
  })

  const userPrompt = buildUserPrompt(ctx)

  // タイムアウト付きで実行
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('LLM reasoning timeout')), REASONING_TIMEOUT_MS)
  )

  const result = await Promise.race([
    model.generateContent(userPrompt),
    timeoutPromise,
  ])

  const text = result.response.text().trim()
  if (!text) throw new Error('Empty LLM response')
  return text
}
