// ============================================================
// 総大将（意思決定エージェント）
// Strands Agent + 3ツール（猛将・智将・審判）による合議制
// ============================================================

import type { GameState } from '../../types/index.js'
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
 *
 * @param attacker    猛将の提案
 * @param defender    智将の提案
 * @param strategist  審判の評価
 * @param _state      局面（将来の拡張用）
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
    // 自分有利：攻め寄り（猛将7:智将3）
    selectedMove = attacker.score >= defender.score * 0.5 ? attacker.move : defender.move
    weightDescription = '形勢有利のため攻め寄り（猛将優先）'
  } else if (score < -200) {
    // 相手有利：守り寄り（猛将3:智将7）
    selectedMove = defender.move
    weightDescription = '形勢不利のため守り寄り（智将優先）'
  } else {
    // 均衡：均等（猛将5:智将5）→ スコアが高い方
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
// Strands Agent 統合（APIキーが利用可能な場合）
// ------------------------------------------------------------

/** Strands Agent を使った高度な意思決定（APIキー必要） */
export async function commanderDecideWithStrands(
  attacker: SubAgentProposal,
  defender: SubAgentProposal,
  strategist: StrategistAssessment,
  state: GameState,
  side: PlayerSide,
  apiKey: string,
): Promise<Omit<CouncilDecision, 'attackerProposal' | 'defenderProposal' | 'strategistAssessment' | 'isFallback'>> {

  try {
    // 動的インポート（ブラウザバンドル最適化のため）
    const { Agent } = await import('@strands-agents/sdk')
    const { tool } = await import('@strands-agents/sdk')
    const { z } = await import('zod')

    // 猛将ツール（既に計算済みの提案を返す）
    const attackerTool = tool({
      name: 'get_attacker_proposal',
      description: '猛将（攻め担当）の候補手を取得する。相手玉への詰みと駒得を最優先で評価済み。',
      inputSchema: z.object({}),
      callback: () => JSON.stringify({
        move: attacker.move,
        score: attacker.score,
        reasoning: attacker.reasoning,
        mateIn: attacker.mateIn,
      }),
    })

    // 智将ツール（既に計算済みの提案を返す）
    const defenderTool = tool({
      name: 'get_defender_proposal',
      description: '智将（守り担当）の候補手を取得する。自玉の安全度と詰めろ解除を最優先で評価済み。',
      inputSchema: z.object({}),
      callback: () => JSON.stringify({
        move: defender.move,
        score: defender.score,
        reasoning: defender.reasoning,
      }),
    })

    // 審判ツール（既に計算済みの評価を返す）
    const strategistTool = tool({
      name: 'get_strategist_assessment',
      description: '審判（形勢判断）の評価を取得する。危険度（SAFE/CAUTION/DANGER）と格言違反を評価済み。',
      inputSchema: z.object({}),
      callback: () => JSON.stringify({
        dangerLevel: strategist.dangerLevel,
        positionalScore: strategist.positionalScore,
        proverbViolations: strategist.proverbViolations,
        summary: strategist.summary,
      }),
    })

    const COMMANDER_SYSTEM_PROMPT = `あなたは将棋の「総大将」です。
3つのツール（猛将・智将・審判）を呼び出して部下の意見を聞き、以下のルールで最終手を決定してください。

## 意思決定ルール（優先順位順）

RULE-1【危険度優先】:
  審判（get_strategist_assessment）が "DANGER" を報告した場合
  → 必ず智将（get_defender_proposal）の手を採用する

RULE-2【詰み優先】:
  猛将（get_attacker_proposal）が mateIn: 3 以下を報告した場合
  → RULE-1より優先して猛将の手を採用する
  （ただし審判がDANGERの場合はRULE-1を優先）

RULE-3【重み付け統合】:
  上記以外 → 形勢スコアに基づいて判断する
  - 有利（+200以上）：猛将の手
  - 不利（-200以下）：智将の手
  - 互角：スコアが高い方の手

## 出力
必ず以下のJSON形式のみで答えてください（他のテキスト不要）：
{"selectedRole":"ATTACKER"または"DEFENDER","appliedRule":"RULE_1"または"RULE_2"または"RULE_3","explanation":"30文字以内の日本語説明"}`

    const agent = new Agent({
      model: {
        modelId: 'claude-haiku-4-5-20251001',
        apiKey,
      } as any,
      systemPrompt: COMMANDER_SYSTEM_PROMPT,
      tools: [attackerTool, defenderTool, strategistTool],
    })

    const result = await agent.invoke('三軍師に諮問し、意思決定ルールに従って最善手を決定せよ。')
    // Message 型を文字列に変換（Strands SDK は Message オブジェクトを返す場合がある）
    const rawMsg = (result as any).lastMessage ?? ''
    const lastMsg: string = typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg)

    // JSONパース
    const jsonMatch = lastMsg.match(/\{[^}]+\}/)
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
    console.warn('[CouncilEngine] Strands Agent 失敗、ルールベースにフォールバック:', err)
  }

  // フォールバック: ルールベース判定
  return applyCommanderRules(attacker, defender, strategist, state)
}
