// ============================================================
// 審判（形勢判断サブエージェント）
// 将棋格言チェックと形勢スコアで局面を評価する
// ============================================================

import type { GameState } from '../../types/index.js'
import { PlayerSide, PieceType } from '../../types/index.js'
import { evaluate } from '../evaluator.js'
import { isInCheck } from '../../core/rules.js'
import {
  type StrategistAssessment,
  type DangerLevel,
  type ProverbViolation,
} from './types.js'
import { generateLLMReasoning } from './llm-reasoning.js'
import { gameStateToPromptContext } from './board-text.js'

/**
 * 玉の位置を探す
 */
function findKingPosition(state: GameState, side: PlayerSide): { row: number; col: number } | null {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = state.board[row]![col]
      if (piece && piece.owner === side && piece.type === PieceType.KING) {
        return { row, col }
      }
    }
  }
  return null
}

/**
 * 自玉周辺の金銀枚数をカウントする（半径2マス以内）
 */
function countKingGuards(state: GameState, side: PlayerSide): number {
  const kingPos = findKingPosition(state, side)
  if (!kingPos) return 0

  let count = 0
  for (let row = Math.max(0, kingPos.row - 2); row <= Math.min(8, kingPos.row + 2); row++) {
    for (let col = Math.max(0, kingPos.col - 2); col <= Math.min(8, kingPos.col + 2); col++) {
      const piece = state.board[row]![col]
      if (piece && piece.owner === side) {
        if (piece.type === PieceType.GOLD || piece.type === PieceType.SILVER) {
          count++
        }
      }
    }
  }
  return count
}

/**
 * 自玉周辺の金枚数をカウントする
 */
function countKingGold(state: GameState, side: PlayerSide): number {
  const kingPos = findKingPosition(state, side)
  if (!kingPos) return 0

  let count = 0
  for (let row = Math.max(0, kingPos.row - 2); row <= Math.min(8, kingPos.row + 2); row++) {
    for (let col = Math.max(0, kingPos.col - 2); col <= Math.min(8, kingPos.col + 2); col++) {
      const piece = state.board[row]![col]
      if (piece && piece.owner === side && piece.type === PieceType.GOLD) {
        count++
      }
    }
  }
  return count
}

/**
 * 相手の成り駒・と金が自陣に侵入しているか確認
 */
function hasEnemyPromotedInBase(state: GameState, side: PlayerSide): boolean {
  const promotedTypes = [
    PieceType.PROMOTED_PAWN,
    PieceType.PROMOTED_LANCE,
    PieceType.PROMOTED_KNIGHT,
    PieceType.PROMOTED_SILVER,
    PieceType.PROMOTED_BISHOP,
    PieceType.PROMOTED_ROOK,
  ]
  const opponent = side === PlayerSide.SENTE ? PlayerSide.GOTE : PlayerSide.SENTE

  // 自陣2段目以内（先手なら row>=7、後手なら row<=1）
  const baseRows = side === PlayerSide.SENTE ? [7, 8] : [0, 1]

  for (const row of baseRows) {
    for (let col = 0; col < 9; col++) {
      const piece = state.board[row]![col]
      if (piece && piece.owner === opponent && promotedTypes.includes(piece.type)) {
        return true
      }
    }
  }
  return false
}

/**
 * 将棋格言チェック
 * 5つの格言に基づいて違反を検出する
 */
function checkProverbs(state: GameState, side: PlayerSide): ProverbViolation[] {
  const violations: ProverbViolation[] = []
  const guardCount = countKingGuards(state, side)
  const goldCount = countKingGold(state, side)

  // 格言1: 玉の守りは金銀3枚
  if (guardCount <= 1) {
    violations.push({ proverb: '玉の守りは金銀3枚（現在: ' + guardCount + '枚）', severity: 'MAJOR' })
  } else if (guardCount === 2) {
    violations.push({ proverb: '玉の守りは金銀3枚（現在: 2枚）', severity: 'MINOR' })
  }

  // 格言2: 守りの要は金
  if (goldCount === 0) {
    violations.push({ proverb: '守りの要は金（玉周辺に金がない）', severity: 'MAJOR' })
  }

  // 格言3: 拠点の放置（相手の成り駒が自陣に侵入）
  if (hasEnemyPromotedInBase(state, side)) {
    violations.push({ proverb: '拠点を放置するな（相手の成り駒が自陣に侵入）', severity: 'MINOR' })
  }

  // 格言4: 王手がかかっていたら危険
  if (isInCheck(state.board, side)) {
    violations.push({ proverb: '王手を放置するな', severity: 'MAJOR' })
  }

  return violations
}

/**
 * DangerLevel を判定する
 */
function assessDangerLevel(
  guardCount: number,
  violations: ProverbViolation[],
  state: GameState,
  side: PlayerSide,
): DangerLevel {
  const majorViolations = violations.filter(v => v.severity === 'MAJOR').length

  // DANGER: 玉周辺金銀1枚以下 OR 重大格言違反2件以上 OR 王手
  if (guardCount <= 1 || majorViolations >= 2 || isInCheck(state.board, side)) {
    return 'DANGER'
  }

  // CAUTION: 玉周辺金銀2枚 OR 格言違反あり
  if (guardCount === 2 || violations.length > 0) {
    return 'CAUTION'
  }

  return 'SAFE'
}

/**
 * 審判（形勢判断）が局面を評価する
 * @param state  現在の局面
 * @param side   評価する側（AIの手番）
 */
export function strategistAssess(state: GameState, side: PlayerSide): StrategistAssessment {
  const positionalScore = evaluate(state, side)
  const guardCount = countKingGuards(state, side)
  const proverbViolations = checkProverbs(state, side)
  const dangerLevel = assessDangerLevel(guardCount, proverbViolations, state, side)

  // サマリーテキスト生成
  let summary = ''
  if (dangerLevel === 'DANGER') {
    summary = `⚠️ 危険！玉周辺金銀${guardCount}枚・重大違反${proverbViolations.filter(v => v.severity === 'MAJOR').length}件`
  } else if (dangerLevel === 'CAUTION') {
    summary = `⚡ 注意。玉周辺金銀${guardCount}枚${positionalScore > 0 ? '・形勢有利' : '・形勢不利'}`
  } else {
    const advantage = positionalScore > 200 ? '有利' : positionalScore < -200 ? '不利' : '互角'
    summary = `✅ 安全。形勢${advantage}（スコア${positionalScore > 0 ? '+' : ''}${positionalScore}）`
  }

  return {
    dangerLevel,
    positionalScore,
    proverbViolations,
    summary,
  }
}

/**
 * 審判ハイブリッド版: 格言チェックは既存のまま、summaryのみGeminiで生成する
 * Gemini失敗時はテンプレートsummaryにフォールバック
 */
export async function strategistAssessHybrid(
  state: GameState,
  side: PlayerSide,
  apiKey: string,
): Promise<StrategistAssessment> {
  const base = strategistAssess(state, side)

  try {
    const boardText = gameStateToPromptContext(state, side)
    const summary = await generateLLMReasoning({
      persona: 'strategist',
      boardText,
      proposedMoveText: '',
      score: base.positionalScore,
      dangerLevel: base.dangerLevel,
      proverbViolations: base.proverbViolations.map(v => v.proverb),
    }, apiKey)
    return { ...base, summary }
  } catch {
    return base
  }
}
