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
import { applyCommanderRules } from './commander.js'
import { strandsCommanderDeliberate } from './strands/commander-agent.js'
import type { CouncilDecision, CouncilSession } from './types.js'

/** タイムアウト時間（ミリ秒）— LLM 合議は3秒以内 */
const TIMEOUT_MS = 3_000

/** 探索深度（エージェントAIモード用） */
const AGENT_SEARCH_DEPTH = 3

/**
 * APIキーを優先度順に解決する
 * 1. 明示的に渡されたキー
 * 2. Vite環境変数（VITE_GEMINI_API_KEY）
 * 3. localStorage
 * ※ APIキーは .env.local に VITE_GEMINI_API_KEY=... として設定してください
 */
function resolveApiKey(explicit?: string): string | undefined {
  if (explicit) return explicit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) as string | undefined
  if (envKey) return envKey
  try {
    return localStorage.getItem('shogi-gemini-api-key') ?? undefined
  } catch {
    return undefined
  }
}

export class CouncilEngine {
  private session: CouncilSession = {
    isThinking: false,
    decisionHistory: [],
  }
  private apiKey: string | undefined

  constructor(apiKey?: string) {
    this.apiKey = resolveApiKey(apiKey)
  }

  get currentSession(): CouncilSession {
    return { ...this.session }
  }

  /**
   * 合議制で最善手を決定する
   * @param state   現在の局面
   * @param side    AIの手番
   */
  async deliberate(
    state: GameState,
    side: PlayerSide,
  ): Promise<CouncilDecision> {
    this.session.isThinking = true

    try {
      const decision = await Promise.race([
        this._runCouncil(state, side),
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
  ): Promise<CouncilDecision> {
    const wantedLlm = !!this.apiKey

    if (this.apiKey) {
      try {
        const decision = await strandsCommanderDeliberate(state, side, this.apiKey)
        return { ...decision, isFallback: false }
      } catch (err) {
        console.warn('[CouncilEngine] Strands失敗、ルールベースにフォールバック:', err)
      }
    }

    const [attacker, defender, strategist] = await Promise.all([
      Promise.resolve(attackerPropose(state, side, AGENT_SEARCH_DEPTH)),
      Promise.resolve(defenderPropose(state, side, AGENT_SEARCH_DEPTH)),
      Promise.resolve(strategistAssess(state, side)),
    ])

    const commanderResult = applyCommanderRules(attacker, defender, strategist, state)

    return {
      attackerProposal: attacker,
      defenderProposal: defender,
      strategistAssessment: strategist,
      ...commanderResult,
      // APIキーありで LLM 失敗時は ⚡ 表示（PC/スマホで同じ判定）
      isFallback: wantedLlm,
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

    const attacker = attackerPropose(state, side, 2)
    const defender = defenderPropose(state, side, 2)
    const strategist = strategistAssess(state, side)
    const commanderResult = applyCommanderRules(attacker, defender, strategist, state)

    const fallbackDecision: CouncilDecision = {
      attackerProposal: attacker,
      defenderProposal: defender,
      strategistAssessment: strategist,
      commanderRule: commanderResult.commanderRule,
      aiMode: commanderResult.aiMode,
      finalMove: move,
      ruleExplanation: commanderResult.ruleExplanation + ' ⚡',
      isFallback: true,
    }

    this.session.currentDecision = fallbackDecision
    this.session.decisionHistory.push(fallbackDecision)
    return fallbackDecision
  }
}
