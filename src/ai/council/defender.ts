// ============================================================
// 智将（守り担当サブエージェント）
// 自玉の安全度と詰めろ解除を最優先に評価する防御的Minimax
// ============================================================

import type { GameState, Move } from '../../types/index.js'
import { PlayerSide, PieceType, Difficulty } from '../../types/index.js'
import { GameEngine } from '../../core/game.js'
import { evaluate } from '../evaluator.js'
import { findBestMove } from '../minimax.js'
import { isInCheck } from '../../core/rules.js'
import { AgentRole, type SubAgentProposal } from './types.js'
import { generateLLMReasoning } from './llm-reasoning.js'
import { gameStateToPromptContext, moveToText } from './board-text.js'

const engine = new GameEngine()

/**
 * 自玉周辺の金銀枚数をカウントする
 * 玉から2マス以内の金将・銀将を数える
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
 * 玉の位置を探す
 */
function findKingPosition(state: GameState, side: PlayerSide): { row: number; col: number } | null {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = state.board[row]![col]
      if (piece && piece.owner === side && piece.type === 'KING') {
        return { row, col }
      }
    }
  }
  return null
}

/**
 * 防御的評価スコアを算出する
 * 既存の evaluate() に防御バイアスを加えたもの
 */
function evaluateDefense(state: GameState, side: PlayerSide): number {
  let score = evaluate(state, side) * 0.5 // 材料差は半減

  // 自玉周辺の金銀枚数ボーナス（守りの金銀を2倍重視）
  const guardCount = countKingGuards(state, side)
  score += guardCount * 60

  // 王手がかかっていたらペナルティ
  if (isInCheck(state.board, side)) {
    score -= 300
  }

  return score
}

/**
 * 智将（守り担当）が候補手を提案する
 * @param state  現在の局面
 * @param side   AIの手番
 * @param depth  探索深度
 */
export function defenderPropose(
  state: GameState,
  side: PlayerSide,
  depth: number,
): SubAgentProposal {
  const difficulty = depth >= 4 ? Difficulty.ADVANCED : Difficulty.BEGINNER

  // 守りを重視した手を選ぶ
  // 基本はfindBestMoveを活用しつつ、自玉の安全度で最終選択
  let bestMove: Move
  let bestScore = -Infinity

  try {
    const moves = engine.getLegalMoves(state)
    if (moves.length === 0) throw new Error('合法手がありません')

    // 各合法手を評価して防御的スコアが最高の手を選ぶ
    const sampleMoves = moves.slice(0, Math.min(moves.length, 20)) // 最大20手評価

    for (const move of sampleMoves) {
      try {
        const nextState = engine.applyMove(state, move)
        const score = evaluateDefense(nextState, side)
        if (score > bestScore) {
          bestScore = score
          bestMove = move
        }
      } catch {
        // 非合法手はスキップ
      }
    }

    if (!bestMove!) {
      bestMove = findBestMove(state, side, difficulty)
    }
  } catch {
    const moves = engine.getLegalMoves(state)
    if (moves.length === 0) throw new Error('合法手がありません')
    bestMove = moves[0]!
    bestScore = evaluateDefense(state, side)
  }

  const guardCount = countKingGuards(state, side)
  const reasoning = guardCount <= 1
    ? `⚠️ 玉周辺の金銀が${guardCount}枚のみ！守りを固めます`
    : `守り重視で評価スコア${bestScore > 0 ? '+' : ''}${bestScore}`

  return {
    move: bestMove!,
    score: bestScore,
    role: AgentRole.DEFENDER,
    reasoning,
  }
}

/**
 * 智将ハイブリッド版: Minimaxで手を選択し、Geminiでreasoningを生成する
 * Gemini失敗時はテンプレートreasoningにフォールバック
 */
export async function defenderProposeHybrid(
  state: GameState,
  side: PlayerSide,
  depth: number,
  apiKey: string,
): Promise<SubAgentProposal> {
  const base = defenderPropose(state, side, depth)

  try {
    const boardText = gameStateToPromptContext(state, side)
    const proposedMoveText = moveToText(base.move)
    // dangerLevel は呼び出し元では不明なので省略（defenderPropose内部で判定済み）
    const reasoning = await generateLLMReasoning({
      persona: 'defender',
      boardText,
      proposedMoveText,
      score: base.score,
    }, apiKey)
    return { ...base, reasoning }
  } catch {
    return base
  }
}
