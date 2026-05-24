// ============================================================
// 総大将（意思決定エージェント）
// Gemini API で三軍師の意見を統合し最善手を決定する
// ============================================================

import type { GameState, Move } from '../../types/index.js'
import { PlayerSide } from '../../types/index.js'
import {
  CommanderRule,
  RULE_TO_MODE,
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

  // RULE-3: 通常局面 → 形勢スコアで重み付け
  const score = strategist.positionalScore
  let selectedMove = attacker.move
  let weightDescription = ''

  if (score > 200) {
    selectedMove = attacker.score >= defender.score * 0.5 ? attacker.move : defender.move
    weightDescription = '形勢有利のため攻め寄り（猛将優先）'
  } else if (score < -200) {
    selectedMove = defender.move
    weightDescription = '形勢不利のため守り寄り（智将優先）'
  } else {
    selectedMove = attacker.score >= defender.score ? attacker.move : defender.move
    weightDescription = '形勢互角のため均等判断'
  }

  return {
    commanderRule: CommanderRule.RULE_3_WEIGHTED,
    aiMode: RULE_TO_MODE[CommanderRule.RULE_3_WEIGHTED],
    finalMove: selectedMove,
    ruleExplanation: `⚖️ ${weightDescription}`,
  }
}

// ------------------------------------------------------------
// 手の表記ヘルパー
// ------------------------------------------------------------

function formatMoveText(move: Move): string {
  if (move.kind === 'DROP') {
    return `${move.pieceType}打（${9 - move.to.col}${move.to.row + 1}）`
  }
  const promoteStr = move.promote ? '成' : ''
  return `${9 - move.from.col}${move.from.row + 1}→${9 - move.to.col}${move.to.row + 1}${promoteStr}`
}

// ------------------------------------------------------------
// Gemini API 統合
// ------------------------------------------------------------

/**
 * Gemini API を使った高度な意思決定
 * @param attacker   猛将の提案
 * @param defender   智将の提案
 * @param strategist 審判の評価
 * @param state      局面
 * @param _side      手番（将来の拡張用）
 * @param apiKey     Gemini APIキー
 */
export async function commanderDecideWithGemini(
  attacker: SubAgentProposal,
  defender: SubAgentProposal,
  strategist: StrategistAssessment,
  state: GameState,
  _side: PlayerSide,
  apiKey: string,
): Promise<Omit<CouncilDecision, 'attackerProposal' | 'defenderProposal' | 'strategistAssessment' | 'isFallback'>> {

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const mateText = attacker.mateIn !== undefined ? `\n- 詰み: ${attacker.mateIn}手` : ''

    const prompt = `あなたは将棋の「総大将」です。三軍師の意見を踏まえ、意思決定ルールに従って最善手を選んでください。

## 三軍師の意見

**猛将（攻め）の提案:**
- 手: ${formatMoveText(attacker.move)}
- スコア: ${attacker.score}
- 評価: ${attacker.reasoning}${mateText}

**智将（守り）の提案:**
- 手: ${formatMoveText(defender.move)}
- スコア: ${defender.score}
- 評価: ${defender.reasoning}

**審判（形勢）の評価:**
- 危険度: ${strategist.dangerLevel}
- 形勢スコア: ${strategist.positionalScore}
- ${strategist.summary}

## 意思決定ルール（優先順位順）

RULE-1【危険度優先】: 審判が "DANGER" → 必ず智将の手を採用
RULE-2【詰み優先】: 猛将の mateIn が3以下 → 猛将の手を採用（DANGERの場合はRULE-1優先）
RULE-3【重み付け統合】: 上記以外 → 形勢スコアで判断（+200以上→猛将、-200以下→智将、互角→スコア高い方）

## 出力形式
必ず以下のJSON形式のみで返してください（他のテキスト不要）：
{"selectedRole":"ATTACKER","appliedRule":"RULE_3","explanation":"形勢互角のため均等判断"}`

    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // JSONを抽出してパース
    const jsonMatch = text.match(/\{[^}]+\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        selectedRole: 'ATTACKER' | 'DEFENDER'
        appliedRule: 'RULE_1' | 'RULE_2' | 'RULE_3'
        explanation: string
      }
      const rule = parsed.appliedRule === 'RULE_1'
        ? CommanderRule.RULE_1_DANGER_DEFENSE
        : parsed.appliedRule === 'RULE_2'
          ? CommanderRule.RULE_2_CHECKMATE_FIRST
          : CommanderRule.RULE_3_WEIGHTED

      return {
        commanderRule: rule,
        aiMode: RULE_TO_MODE[rule],
        finalMove: parsed.selectedRole === 'ATTACKER' ? attacker.move : defender.move,
        ruleExplanation: parsed.explanation,
      }
    }
  } catch (err) {
    console.warn('[CouncilEngine] Gemini API 失敗、ルールベースにフォールバック:', err)
  }

  // フォールバック: ルールベース判定
  return applyCommanderRules(attacker, defender, strategist, state)
}
