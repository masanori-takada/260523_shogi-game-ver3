// ============================================================
// Gemini FunctionCalling 総大将オーケストレーター
// 猛将・智将・審判の3つのtoolを呼び出し、RULE-1/2/3を適用して最終手を決定する
// ⚠️ WARNING: APIキーはブラウザ側に露出します。個人利用プロジェクト専用。
// ============================================================

import { GoogleGenerativeAI, type FunctionDeclaration, SchemaType } from '@google/generative-ai'
import type { GameState, Move } from '../../types/index.js'
import { CommanderRule, RULE_TO_MODE, type SubAgentProposal, type StrategistAssessment, type AIMode } from './types.js'
import { moveToText } from './board-text.js'

/** 全呼び出しで共通使用するモデル */
const GEMINI_MODEL = 'gemini-2.0-flash-lite'

/** 総大将のタイムアウト（ms） */
const COMMANDER_TIMEOUT_MS = 2500

// FunctionDeclaration 定義（Strands tool相当）
const COUNCIL_FUNCTIONS: FunctionDeclaration[] = [
  {
    name: 'get_attacker_proposal',
    description: '猛将（攻め担当）の候補手・評価スコア・reasoning・詰み手数を取得する',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_defender_proposal',
    description: '智将（守り担当）の候補手・評価スコア・reasoningを取得する',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_strategist_assessment',
    description: '審判（形勢判断）の危険度・形勢スコア・格言違反・サマリーを取得する',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [],
    },
  },
]

const COMMANDER_SYSTEM_PROMPT = `あなたは将棋AIの「総大将」です。
3つのfunction（get_attacker_proposal, get_defender_proposal, get_strategist_assessment）を必ずすべて呼び出してから、以下のルールを適用して最終手を決定してください。

【意思決定ルール（優先順位順）】
RULE-1（最優先）: 審判のdangerLevelが「DANGER」→ 智将の手を採用（自玉を守ることが最優先）
RULE-2（第二優先）: 猛将のmateInが3以下 → 猛将の手を採用（詰みは最大のチャンス）
RULE-3（通常）: 形勢スコアと各スコアを比較して判断

【最終回答形式】
必ず以下のJSON形式のみで回答してください（他のテキスト不要）：
{"selectedAgent":"attacker","appliedRule":"RULE_2","explanation":"3手詰みを発見したため猛将の手を採用"}

selectedAgent は "attacker" か "defender" のいずれか。
appliedRule は "RULE_1"、"RULE_2"、"RULE_3" のいずれか。
explanation は採用理由を日本語100字以内で。`

export interface CommanderResult {
  finalMove: Move
  ruleExplanation: string
  commanderRule: CommanderRule
  aiMode: AIMode
}

/**
 * Gemini FunctionCallingを使った総大将の意思決定
 * 失敗時はthrowする → council-engine.ts でapplyCommanderRulesにフォールバック
 */
export async function geminiCommanderDecide(
  attacker: SubAgentProposal,
  defender: SubAgentProposal,
  strategist: StrategistAssessment,
  _state: GameState,
  apiKey: string,
): Promise<CommanderResult> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: COMMANDER_SYSTEM_PROMPT,
    tools: [{ functionDeclarations: COUNCIL_FUNCTIONS }],
    generationConfig: {
      maxOutputTokens: 512,
      temperature: 0.3,
    },
  })

  // tool呼び出しループ
  const chat = model.startChat()

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('GeminiCommander timeout')), COMMANDER_TIMEOUT_MS)
  )

  // LLMとのやり取り（最大3ターン: 初回→tool呼び出し→最終回答）
  async function runChat(): Promise<CommanderResult> {
    let response = await chat.sendMessage('三軍師の意見を収集し、RULEを適用して最終手を決定してください。')

    // tool呼び出しループ（最大5回）
    for (let i = 0; i < 5; i++) {
      const candidate = response.response.candidates?.[0]
      if (!candidate) break

      const functionCalls = response.response.functionCalls()
      if (!functionCalls || functionCalls.length === 0) break

      // 各functionCallに対してtoolの結果を返す
      const toolResults = functionCalls.map(call => {
        let result: unknown
        if (call.name === 'get_attacker_proposal') {
          result = {
            move: moveToText(attacker.move),
            score: attacker.score,
            reasoning: attacker.reasoning,
            mateIn: attacker.mateIn ?? null,
          }
        } else if (call.name === 'get_defender_proposal') {
          result = {
            move: moveToText(defender.move),
            score: defender.score,
            reasoning: defender.reasoning,
          }
        } else if (call.name === 'get_strategist_assessment') {
          result = {
            dangerLevel: strategist.dangerLevel,
            positionalScore: strategist.positionalScore,
            proverbViolations: strategist.proverbViolations.map(v => v.proverb),
            summary: strategist.summary,
          }
        } else {
          result = { error: 'unknown function' }
        }
        return {
          functionResponse: {
            name: call.name,
            response: result as Record<string, unknown>,
          },
        }
      })

      response = await chat.sendMessage(toolResults)
    }

    // 最終テキストからJSONをパース
    const text = response.response.text().trim()
    return parseCommanderResponse(text, attacker, defender, strategist)
  }

  return Promise.race([runChat(), timeoutPromise])
}

/**
 * Geminiの最終テキスト回答をパースしてCommanderResultを返す
 */
function parseCommanderResponse(
  text: string,
  attacker: SubAgentProposal,
  defender: SubAgentProposal,
  strategist: StrategistAssessment,
): CommanderResult {
  // JSONブロックを抽出
  const jsonMatch = text.match(/\{[^}]+\}/)
  if (!jsonMatch) throw new Error(`Gemini commander response parse error: ${text}`)

  let parsed: { selectedAgent?: string; appliedRule?: string; explanation?: string }
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error(`Gemini commander JSON parse error: ${jsonMatch[0]}`)
  }

  const selectedAgent = parsed.selectedAgent === 'attacker' ? 'attacker' : 'defender'
  const finalMove = selectedAgent === 'attacker' ? attacker.move : defender.move

  // appliedRule をCommanderRuleにマッピング
  const ruleMap: Record<string, CommanderRule> = {
    RULE_1: CommanderRule.RULE_1_DANGER_DEFENSE,
    RULE_2: CommanderRule.RULE_2_CHECKMATE_FIRST,
    RULE_3: CommanderRule.RULE_3_WEIGHTED,
  }
  const commanderRule = ruleMap[parsed.appliedRule ?? 'RULE_3'] ?? CommanderRule.RULE_3_WEIGHTED
  const aiMode = RULE_TO_MODE[commanderRule]

  // フォールバック: dangerがあるのにattackerが選ばれた場合は安全側に補正
  if (strategist.dangerLevel === 'DANGER' && selectedAgent === 'attacker') {
    return {
      finalMove: defender.move,
      ruleExplanation: parsed.explanation ?? '危険局面のため守りを優先',
      commanderRule: CommanderRule.RULE_1_DANGER_DEFENSE,
      aiMode: 'DEFENSE',
    }
  }

  return {
    finalMove,
    ruleExplanation: parsed.explanation ?? `${selectedAgent === 'attacker' ? '猛将' : '智将'}の手を採用`,
    commanderRule,
    aiMode,
  }
}
