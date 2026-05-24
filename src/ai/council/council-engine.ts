// ============================================================
// CouncilEngine — 三軍師合議制AIエンジン（外部インターフェース）
// UIControllerから呼び出される合議制AIの窓口
// ============================================================

import type { GameState } from '../../types/index.js'
import { PlayerSide, Difficulty } from '../../types/index.js'
import { findBestMove } from '../minimax.js'
import { attackerPropose } from './attacker.js'
import { defenderPropose } from './defender.js'
import { strategistAssess } from './strategist.js'
import { applyCommanderRules, commanderDecideWithGemini } from './commander.js'
import { CommanderRule, RULE_TO_MODE, type CouncilDecision, type CouncilSession } from './types.js'

/** タイムアウト時間（ミリ秒） */
const TIMEOUT_MS = 10_000

/** 探索深度（エージェントAIモード用） */
const AGENT_SEARCH_DEPTH = 3

export class CouncilEngine {
  private session: CouncilSession = {
    isThinking: false,
    decisionHistory: [],
  }

  get currentSession(): CouncilSession {
    return { ...this.session }
  }

  /**
   * 合議制で最善手を決定する
   * @param state   現在の局面
   * @param side    AIの手番
   * @param apiKey  Anthropic APIキー（省略可。省略時はルールベースで動作）
   */
  async deliberate(
    state: GameState,
    side: PlayerSide,
    apiKey?: string,
  ): Promise<CouncilDecision> {
    this.session.isThinking = true

    try {
      // タイムアウト付きで審議を実行
      const decision = await Promise.race([
        this._runCouncil(state, side, apiKey),
        this._timeout(),
      ]) as CouncilDecision

      this.session.currentDecision = decision
      this.session.decisionHistory.push(decision)
      return decision

    } catch (err) {
      console.warn('[CouncilEngine] タイムアウトまたはエラー。Minimaxにフォールバック:', err)
      return this._fallbackDecision(state, side)
    } finally {
      this.session.isThinking = false
    }
  }

  /** 審議実行（内部） */
  private async _runCouncil(
    state: GameState,
    side: PlayerSide,
    apiKey?: string,
  ): Promise<CouncilDecision> {
    // 3サブエージェントを並列実行
    const [attacker, defender, strategist] = await Promise.all([
      Promise.resolve(attackerPropose(state, side, AGENT_SEARCH_DEPTH)),
      Promise.resolve(defenderPropose(state, side, AGENT_SEARCH_DEPTH)),
      Promise.resolve(strategistAssess(state, side)),
    ])

    // 総大将の意思決定
    let commanderResult: Omit<CouncilDecision, 'attackerProposal' | 'defenderProposal' | 'strategistAssessment' | 'isFallback'>

    if (apiKey) {
      // Gemini API 経由（LLMが意思決定）
      commanderResult = await commanderDecideWithGemini(attacker, defender, strategist, state, side, apiKey)
    } else {
      // ルールベース（フォールバック）
      commanderResult = applyCommanderRules(attacker, defender, strategist, state)
    }

    return {
      attackerProposal: attacker,
      defenderProposal: defender,
      strategistAssessment: strategist,
      ...commanderResult,
      isFallback: false,
    }
  }

  /** タイムアウトPromise */
  private _timeout(): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('CouncilEngine timeout')), TIMEOUT_MS)
    )
  }

  /** フォールバック：既存Minimaxエンジン（上級相当）で応手 */
  private _fallbackDecision(state: GameState, side: PlayerSide): CouncilDecision {
    const move = findBestMove(state, side, Difficulty.ADVANCED)

    // フォールバック時も一応3サブエージェントのデータを揃える
    const attacker = attackerPropose(state, side, 2)
    const defender = defenderPropose(state, side, 2)
    const strategist = strategistAssess(state, side)

    const fallbackDecision: CouncilDecision = {
      attackerProposal: attacker,
      defenderProposal: defender,
      strategistAssessment: strategist,
      commanderRule: CommanderRule.RULE_3_WEIGHTED,
      aiMode: RULE_TO_MODE[CommanderRule.RULE_3_WEIGHTED],
      finalMove: move,
      ruleExplanation: '⚡ フォールバック中（Minimaxで応手）',
      isFallback: true,
    }

    this.session.currentDecision = fallbackDecision
    this.session.decisionHistory.push(fallbackDecision)
    return fallbackDecision
  }
}
