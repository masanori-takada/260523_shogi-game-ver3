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
  showThinking(): void {
    const thinking = '🤔 思考中...'
    this._updateAgent('council-attacker',  `<span class="agent-thinking">${thinking}</span>`)
    this._updateAgent('council-defender',  `<span class="agent-thinking">${thinking}</span>`)
    this._updateAgent('council-strategist',`<span class="agent-thinking">${thinking}</span>`)
    this._updateAgent('council-commander', `<span class="agent-thinking">審議中...</span>`)
  }

  /** 審議結果を表示 */
  showDecision(decision: CouncilDecision): void {
    // 猛将の結果
    const attackerEval = scoreToLabel(decision.attackerProposal.score)
    const mateText = decision.attackerProposal.mateIn !== undefined
      ? `<span class="agent-mate">🎯 詰み${decision.attackerProposal.mateIn}手！</span>`
      : ''
    this._updateAgent('council-attacker', `
      <span class="agent-move">${this._formatMove(decision.attackerProposal.move)}</span>
      <span class="agent-eval ${attackerEval.cssClass}">${attackerEval.label}</span>
      ${mateText}
      <span class="agent-reasoning">${decision.attackerProposal.reasoning}</span>
    `)

    // 智将の結果
    const defenderEval = scoreToLabel(decision.defenderProposal.score)
    this._updateAgent('council-defender', `
      <span class="agent-move">${this._formatMove(decision.defenderProposal.move)}</span>
      <span class="agent-eval ${defenderEval.cssClass}">${defenderEval.label}</span>
      <span class="agent-reasoning">${decision.defenderProposal.reasoning}</span>
    `)

    // 審判の結果
    const posEval = posScoreToLabel(decision.strategistAssessment.positionalScore)
    const dangerClass = {
      SAFE:    'danger-safe',
      CAUTION: 'danger-caution',
      DANGER:  'danger-high',
    }[decision.strategistAssessment.dangerLevel]
    const proverbText = decision.strategistAssessment.proverbViolations.length > 0
      ? `<span class="proverb-violation">⚠️ ${decision.strategistAssessment.proverbViolations[0]!.proverb}</span>`
      : `<span class="proverb-ok">✅ 格言違反なし</span>`
    this._updateAgent('council-strategist', `
      <span class="danger-level ${dangerClass}">${decision.strategistAssessment.dangerLevel}</span>
      <span class="agent-eval ${posEval.cssClass}">${posEval.label}</span>
      ${proverbText}
      <span class="agent-reasoning">${decision.strategistAssessment.summary}</span>
    `)

    // 総大将の裁定
    const modeInfo = MODE_DISPLAY[decision.aiMode]
    const fallbackText = decision.isFallback
      ? `<span class="fallback-notice">⚡ フォールバック中</span>`
      : ''
    this._updateAgent('council-commander', `
      <span class="mode-badge-large ${modeInfo.cssClass}">${modeInfo.label}</span>
      <span class="rule-applied">${decision.commanderRule}: ${this._ruleLabel(decision.commanderRule)}</span>
      <span class="final-move">${this._formatMove(decision.finalMove)}</span>
      <span class="rule-explanation">${decision.ruleExplanation}</span>
      ${fallbackText}
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

  /** 手を簡易テキスト表示 */
  private _formatMove(move: import('../types/index.js').Move): string {
    if (move.kind === 'DROP') {
      return `${move.pieceType}打（${9 - move.to.col}${move.to.row + 1}）`
    }
    const promoteStr = move.promote ? '成' : ''
    return `${9 - move.from.col}${move.from.row + 1}→${9 - move.to.col}${move.to.row + 1}${promoteStr}`
  }

  /** ルール名の日本語ラベル */
  private _ruleLabel(rule: string): string {
    const labels: Record<string, string> = {
      RULE_1: '危険回避',
      RULE_2: '詰み優先',
      RULE_3: '重み付け統合',
    }
    return labels[rule] ?? rule
  }
}
