// ============================================================
// 三軍師合議制AI 専用型定義
// ============================================================

import type { Move } from '../../types/index.js'

// ------------------------------------------------------------
// サブエージェントの役割
// ------------------------------------------------------------
export enum AgentRole {
  ATTACKER   = 'ATTACKER',   // 猛将（攻め担当）
  DEFENDER   = 'DEFENDER',   // 智将（守り担当）
  STRATEGIST = 'STRATEGIST', // 審判（形勢判断）
}

// ------------------------------------------------------------
// サブエージェントの提案
// ------------------------------------------------------------
export interface SubAgentProposal {
  move: Move        // 候補手
  score: number     // 評価スコア（正=自分有利、負=相手有利）
  role: AgentRole   // ATTACKER | DEFENDER
  reasoning: string // 評価の理由（パネル表示用テキスト）
  mateIn?: number   // 詰み手数（猛将のみ。見つかれば設定）
}

// ------------------------------------------------------------
// 審判の評価結果
// ------------------------------------------------------------
export type DangerLevel = 'SAFE' | 'CAUTION' | 'DANGER'

export interface ProverbViolation {
  proverb: string              // 違反した格言テキスト
  severity: 'MINOR' | 'MAJOR' // 重大度
}

export interface StrategistAssessment {
  dangerLevel: DangerLevel           // 自玉の危険度
  positionalScore: number            // 形勢スコア（正=自分有利）
  proverbViolations: ProverbViolation[] // 格言違反リスト
  summary: string                    // パネル表示用サマリーテキスト
}

// ------------------------------------------------------------
// 総大将の意思決定ルール
// ------------------------------------------------------------
export enum CommanderRule {
  RULE_1_DANGER_DEFENSE  = 'RULE_1', // 危険度HIGH → 智将手を強制採用
  RULE_2_CHECKMATE_FIRST = 'RULE_2', // 3手詰み発見 → 猛将手を最優先
  RULE_3_WEIGHTED        = 'RULE_3', // 通常 → 形勢スコアで重み付け統合
}

// ------------------------------------------------------------
// 画面表示用のAIモード
// ------------------------------------------------------------
export type AIMode = 'ATTACK' | 'DEFENSE' | 'BALANCE'

/** CommanderRule → AIMode マッピング */
export const RULE_TO_MODE: Record<CommanderRule, AIMode> = {
  [CommanderRule.RULE_1_DANGER_DEFENSE]:  'DEFENSE', // 守りモード
  [CommanderRule.RULE_2_CHECKMATE_FIRST]: 'ATTACK',  // 攻めモード
  [CommanderRule.RULE_3_WEIGHTED]:        'BALANCE', // 形勢判断モード
}

/** AIMode → 表示テキスト・CSSクラスのマッピング */
export const MODE_DISPLAY: Record<AIMode, { label: string; cssClass: string }> = {
  ATTACK:  { label: '⚔️ 攻めモード',     cssClass: 'mode-attack'  },
  DEFENSE: { label: '🛡️ 守りモード',     cssClass: 'mode-defense' },
  BALANCE: { label: '⚖️ 形勢判断モード', cssClass: 'mode-balance' },
}

// ------------------------------------------------------------
// 一手番の審議結果（合議の最終出力）
// ------------------------------------------------------------
export interface CouncilDecision {
  attackerProposal: SubAgentProposal         // 猛将の提案
  defenderProposal: SubAgentProposal         // 智将の提案
  strategistAssessment: StrategistAssessment // 審判の評価
  commanderRule: CommanderRule               // 総大将が適用したルール
  aiMode: AIMode                             // 画面表示用モード
  finalMove: Move                            // 採用された最終手
  ruleExplanation: string                    // ルール適用理由（パネル表示用）
  isFallback: boolean                        // タイムアウト時のフォールバックフラグ
}

// ------------------------------------------------------------
// 審議セッション状態
// ------------------------------------------------------------
export interface CouncilSession {
  isThinking: boolean               // 審議中フラグ
  currentDecision?: CouncilDecision // 最新の審議結果
  decisionHistory: CouncilDecision[]// 全手番の審議ログ
}
