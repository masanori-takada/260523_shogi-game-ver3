// ============================================================
// CouncilPanel — 三軍師の審議パネルUI
// ============================================================

import type { CouncilDecision } from '../ai/council/types.js'
import { MODE_DISPLAY } from '../ai/council/types.js'

// ------------------------------------------------------------
// スコアラベル変換ヘルパー
// ------------------------------------------------------------

interface ScoreLabel {
  label: string
  cssClass: string
}

/** 猛将・智将のスコアをわかりやすいラベルに変換 */
function scoreToLabel(score: number): ScoreLabel {
  if (score > 500)  return { label: '大優勢', cssClass: 'score-strong' }
  if (score > 200)  return { label: '優勢',   cssClass: 'score-up'    }
  if (score > 50)   return { label: 'やや有利', cssClass: 'score-up'  }
  if (score > -50)  return { label: '互角',    cssClass: 'score-even'  }
  if (score > -200) return { label: 'やや不利', cssClass: 'score-down' }
  if (score > -500) return { label: '不利',    cssClass: 'score-down'  }
  return                   { label: '大劣勢',  cssClass: 'score-weak'  }
}

/** 審判の形勢スコアをわかりやすいラベルに変換 */
function posScoreToLabel(score: number): ScoreLabel {
  if (score > 500)  return { label: '大優勢', cssClass: 'score-strong' }
  if (score > 200)  return { label: '優勢',   cssClass: 'score-up'    }
  if (score > 50)   return { label: 'やや有利', cssClass: 'score-up'  }
  if (score > -50)  return { label: '互角',    cssClass: 'score-even'  }
  if (score > -200) return { label: 'やや不利', cssClass: 'score-down' }
  if (score > -500) return { label: '不利',    cssClass: 'score-down'  }
  return                   { label: '大劣勢',  cssClass: 'score-weak'  }
}

// ------------------------------------------------------------
// CouncilPanel クラス
// ------------------------------------------------------------

export class CouncilPanel {
  private container: HTMLElement

  constructor(container: HTMLElement) {
    this.container = container
    this._buildInitialDOM()
  }

  /** 初期DOM構築 */
  private _buildInitialDOM(): void {
    this.container.innerHTML = `
      <div class="council-panel">
        <h3 class="council-title">👑 三軍師の審議</h3>

        <div class="council-agent attacker" id="council-attacker">
          <div class="agent-header">
            <span class="agent-icon">🗡️</span>
            <span class="agent-name">猛将（攻め）</span>
          </div>
          <div class="agent-body">
            <span class="agent-status">待機中...</span>
          </div>
        </div>

        <div class="council-agent defender" id="council-defender">
          <div class="agent-header">
            <span class="agent-icon">🛡️</span>
            <span class="agent-name">智将（守り）</span>
          </div>
          <div class="agent-body">
            <span class="agent-status">待機中...</span>
          </div>
        </div>

        <div class="council-agent strategist" id="council-strategist">
          <div class="agent-header">
            <span class="agent-icon">⚖️</span>
            <span class="agent-name">審判（形勢）</span>
          </div>
          <div class="agent-body">
            <span class="agent-status">待機中...</span>
          </div>
        </div>

        <div class="council-commander" id="council-commander">
          <div class="agent-header">
            <span class="agent-icon">👑</span>
            <span class="agent-name">総大将の裁定</span>
          </div>
          <div class="agent-body">
            <span class="agent-status">待機中...</span>
          </div>
        </div>
      </div>
    `
  }

  /** 審議中状態を表示 */
  showThinking(phase?: 'subs' | 'commander'): void {
    const thinking = phase === 'commander' ? '👑 裁定中...' : '🤔 思考中...'
    this._updateAgent('council-attacker',  `<span class="agent-thinking">${thinking}</span>`)
    this._updateAgent('council-defender',  `<span class="agent-thinking">${thinking}</span>`)
    this._updateAgent('council-strategist',`<span class="agent-thinking">${thinking}</span>`)
    this._updateAgent('council-commander', `<span class="agent-thinking">${phase === 'commander' ? '👑 裁定中...' : '審議中...'}</span>`)
  }

  /** Phase1 完了後: 三軍師結果を表示し総大将のみ思考中 */
  showPartial(
    partial: Pick<CouncilDecision, 'attackerProposal' | 'defenderProposal' | 'strategistAssessment'>,
  ): void {
    const attackerEval = scoreToLabel(partial.attackerProposal.score)
    const mateText = partial.attackerProposal.mateIn !== undefined
      ? `<span class="agent-mate">🎯 詰み${partial.attackerProposal.mateIn}手！</span>`
      : ''
    this._updateAgent('council-attacker', `
      <span class="agent-eval ${attackerEval.cssClass}">${attackerEval.label}</span>
      ${mateText}
    `)

    const defenderEval = scoreToLabel(partial.defenderProposal.score)
    this._updateAgent('council-defender', `
      <span class="agent-eval ${defenderEval.cssClass}">${defenderEval.label}</span>
    `)

    const posEval = posScoreToLabel(partial.strategistAssessment.positionalScore)
    const dangerClass = {
      SAFE:    'danger-safe',
      CAUTION: 'danger-caution',
      DANGER:  'danger-high',
    }[partial.strategistAssessment.dangerLevel]
    this._updateAgent('council-strategist', `
      <span class="danger-level ${dangerClass}">${partial.strategistAssessment.dangerLevel}</span>
      <span class="agent-eval ${posEval.cssClass}">${posEval.label}</span>
    `)

    this._updateAgent('council-commander', `<span class="agent-thinking">👑 裁定中...</span>`)
  }

  /** 審議結果を表示（バッジ・ラベルのみ。手や評価文は表示しない） */
  showDecision(decision: CouncilDecision): void {
    // 猛将: 形勢ラベル（詰みがあればその表示も追加）
    const attackerEval = scoreToLabel(decision.attackerProposal.score)
    const mateText = decision.attackerProposal.mateIn !== undefined
      ? `<span class="agent-mate">🎯 詰み${decision.attackerProposal.mateIn}手！</span>`
      : ''
    this._updateAgent('council-attacker', `
      <span class="agent-eval ${attackerEval.cssClass}">${attackerEval.label}</span>
      ${mateText}
    `)

    // 智将: 形勢ラベル
    const defenderEval = scoreToLabel(decision.defenderProposal.score)
    this._updateAgent('council-defender', `
      <span class="agent-eval ${defenderEval.cssClass}">${defenderEval.label}</span>
    `)

    // 審判: 危険度バッジ + 形勢ラベル
    const posEval = posScoreToLabel(decision.strategistAssessment.positionalScore)
    const dangerClass = {
      SAFE:    'danger-safe',
      CAUTION: 'danger-caution',
      DANGER:  'danger-high',
    }[decision.strategistAssessment.dangerLevel]
    this._updateAgent('council-strategist', `
      <span class="danger-level ${dangerClass}">${decision.strategistAssessment.dangerLevel}</span>
      <span class="agent-eval ${posEval.cssClass}">${posEval.label}</span>
    `)

    // 総大将: モードバッジのみ
    const modeInfo = MODE_DISPLAY[decision.aiMode]
    const fallbackMark = decision.isFallback ? ' ⚡' : ''
    this._updateAgent('council-commander', `
      <span class="mode-badge-large ${modeInfo.cssClass}">${modeInfo.label}${fallbackMark}</span>
    `)
  }

  /** パネルをリセット */
  reset(): void {
    this._buildInitialDOM()
  }

  /** エージェント要素のbody部分を更新 */
  private _updateAgent(id: string, bodyHtml: string): void {
    const el = this.container.querySelector(`#${id} .agent-body`)
    if (el) el.innerHTML = bodyHtml
  }
}
