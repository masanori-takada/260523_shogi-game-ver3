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
import type { CouncilDecision, CouncilProgressUpdate, CouncilSession } from './types.js'

/** LLM 合議タイムアウト（モバイル回線でも完走できるよう5秒） */
export const COUNCIL_LLM_TIMEOUT_MS = 5_000

/** 探索深度（エージェントAIモード用） */
const AGENT_SEARCH_DEPTH = 3

const LLM_RETRY_COUNT = 2

/**
 * APIキーを解決（PC/スマホ同一: ビルド埋め込みキーを優先）
 * 1. Vite環境変数（VITE_GEMINI_API_KEY — Pages ビルドで全端末共通）
 * 2. localStorage（ユーザー手入力）
 * 3. コンストラクタ明示指定
 */
function resolveApiKey(explicit?: string): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) as string | undefined
  if (envKey && envKey.length > 0) return envKey
  try {
    const stored = localStorage.getItem('shogi-gemini-api-key')
    if (stored && stored.length > 0) return stored
  } catch {
    // private browsing 等
  }
  if (explicit) return explicit
  return undefined
}

export type CouncilProgressCallback = (update: CouncilProgressUpdate) => void

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

  /** APIキーが解決されているか（デバッグ用） */
  get hasApiKey(): boolean {
    return !!this.apiKey
  }

  async deliberate(
    state: GameState,
    side: PlayerSide,
    onProgress?: CouncilProgressCallback,
  ): Promise<CouncilDecision> {
    this.session.isThinking = true

    try {
      const decision = await Promise.race([
        this._runCouncil(state, side, onProgress),
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

  private async _runCouncil(
    state: GameState,
    side: PlayerSide,
    onProgress?: CouncilProgressCallback,
  ): Promise<CouncilDecision> {
    const wantedLlm = !!this.apiKey

    if (this.apiKey) {
      let lastErr: unknown
      for (let attempt = 0; attempt < LLM_RETRY_COUNT; attempt++) {
        try {
          const decision = await strandsCommanderDeliberate(
            state,
            side,
            this.apiKey,
            onProgress,
          )
          return { ...decision, isFallback: false }
        } catch (err) {
          lastErr = err
          if (attempt < LLM_RETRY_COUNT - 1) {
            console.warn('[CouncilEngine] Strands失敗、リトライします:', err)
          }
        }
      }
      console.warn('[CouncilEngine] Strands失敗、ルールベースにフォールバック:', lastErr)
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
      isFallback: wantedLlm,
    }
  }

  private _timeout(): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('CouncilEngine timeout')), COUNCIL_LLM_TIMEOUT_MS),
    )
  }

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
