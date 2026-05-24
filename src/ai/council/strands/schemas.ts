// ============================================================
// Strands 合議制 — Zod スキーマ定義
// ============================================================

import { z } from 'zod'

/** 猛将・智将の LLM 出力 */
export const subAgentOutputSchema = z.object({
  moveIndex: z.number().int().min(0).describe('合法手リストの0始まりインデックス'),
  score: z.number().describe('評価スコア（正=自分有利）'),
  reasoning: z.string().describe('50字以内の日本語理由'),
  mateIn: z.number().int().positive().optional().describe('詰み手数（見つかれば）'),
})

export type SubAgentOutput = z.infer<typeof subAgentOutputSchema>

/** 審判の LLM 出力 */
export const strategistOutputSchema = z.object({
  dangerLevel: z.enum(['SAFE', 'CAUTION', 'DANGER']),
  positionalScore: z.number(),
  proverbViolations: z.array(z.object({
    proverb: z.string(),
    severity: z.enum(['MINOR', 'MAJOR']),
  })),
  summary: z.string().describe('50字以内の形勢サマリー'),
})

export type StrategistOutput = z.infer<typeof strategistOutputSchema>

/** 総大将の LLM 出力 */
export const commanderOutputSchema = z.object({
  selectedAgent: z.enum(['attacker', 'defender']),
  appliedRule: z.enum(['RULE_1', 'RULE_2', 'RULE_3']),
  explanation: z.string().describe('50字以内の採用理由'),
})

export type CommanderOutput = z.infer<typeof commanderOutputSchema>
