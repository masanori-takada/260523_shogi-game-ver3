// ============================================================
// 猛将（攻め担当サブエージェント）
// 相手玉への詰みと駒得を最優先に評価する攻撃的Minimax
// ============================================================

import type { GameState, Move } from '../../types/index.js'
import { PlayerSide, GameStatus, Difficulty } from '../../types/index.js'
import { GameEngine } from '../../core/game.js'
import { evaluate } from '../evaluator.js'
import { findBestMove } from '../minimax.js'
import { AgentRole, type SubAgentProposal } from './types.js'
import { generateLLMReasoning } from './llm-reasoning.js'
import { gameStateToPromptContext, moveToText } from './board-text.js'

const engine = new GameEngine()

/**
 * 攻撃的評価スコアを算出する
 * 既存の evaluate() に攻撃バイアスを加えたもの
 */
function evaluateAttack(state: GameState, side: PlayerSide): number {
  const opponent = side === PlayerSide.SENTE ? PlayerSide.GOTE : PlayerSide.SENTE
  let score = evaluate(state, side)

  // 相手玉への距離ボーナス（近いほど攻撃的に有利）
  const opponentKingPos = findKingPosition(state, opponent)
  if (opponentKingPos) {
    // 盤の中心（4,4）から相手玉が離れているほど攻め込みやすい
    const centerDist = Math.abs(opponentKingPos.row - 4) + Math.abs(opponentKingPos.col - 4)
    score += centerDist * 5
  }

  return score
}

/**
 * 玉の位置を探す
 */
function findKingPosition(state: GameState, side: PlayerSide): { row: number; col: number } | null {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = state.board[row]![col]
      if (piece && piece.owner === side && (piece.type === 'KING')) {
        return { row, col }
      }
    }
  }
  return null
}

/**
 * 詰み探索：N手以内に詰みがあるか確認する
 * 簡易実装：depth=3 での詰み探索
 */
function searchMate(state: GameState, side: PlayerSide, maxDepth: number): number | undefined {
  if (maxDepth <= 0) return undefined

  const moves = engine.getLegalMoves(state)
  for (const move of moves) {
    try {
      const nextState = engine.applyMove(state, move)
      if (nextState.status === GameStatus.CHECKMATE) {
        return 1
      }
      // 相手の合法手が0なら詰み（CHECKMATE は上で確認済みのため再チェック不要）
      const opponentMoves = engine.getLegalMoves(nextState)
      if (opponentMoves.length === 0) {
        return 1
      }
    } catch {
      // 非合法手はスキップ
    }
  }

  return undefined
}

/**
 * 猛将（攻め担当）が候補手を提案する
 * @param state  現在の局面
 * @param side   AIの手番
 * @param depth  探索深度
 */
export function attackerPropose(
  state: GameState,
  side: PlayerSide,
  depth: number,
): SubAgentProposal {
  // 詰み探索（3手以内）
  const mateIn = searchMate(state, side, 3)

  // 攻撃的Minimaxで最善手を探索
  // 既存のfindBestMoveを活用（ADVANCED=深さ4はコストがかかるので調整）
  const difficulty = depth >= 4 ? Difficulty.ADVANCED : Difficulty.BEGINNER
  let bestMove: Move

  try {
    bestMove = findBestMove(state, side, difficulty)
  } catch {
    // フォールバック：合法手の最初の手
    const moves = engine.getLegalMoves(state)
    if (moves.length === 0) throw new Error('合法手がありません')
    bestMove = moves[0]!
  }

  // 攻撃的評価スコアを算出
  let score = 0
  try {
    const nextState = engine.applyMove(state, bestMove)
    score = evaluateAttack(nextState, side)
  } catch {
    score = evaluateAttack(state, side)
  }

  const reasoning = mateIn !== undefined
    ? `詰み${mateIn}手を発見！攻め切れます`
    : `駒得・攻撃重視で評価スコア${score > 0 ? '+' : ''}${score}`

  return {
    move: bestMove,
    score,
    role: AgentRole.ATTACKER,
    reasoning,
    // exactOptionalPropertyTypes: undefined は代入不可のため条件付きスプレッド
    ...(mateIn !== undefined ? { mateIn } : {}),
  }
}

/**
 * 猛将ハイブリッド版: Minimaxで手を選択し、Geminiでreasoningを生成する
 * Gemini失敗時はテンプレートreasoningにフォールバック
 */
export async function attackerProposeHybrid(
  state: GameState,
  side: PlayerSide,
  depth: number,
  apiKey: string,
): Promise<SubAgentProposal> {
  const base = attackerPropose(state, side, depth)

  try {
    const boardText = gameStateToPromptContext(state, side)
    const proposedMoveText = moveToText(base.move)
    const reasoning = await generateLLMReasoning({
      persona: 'attacker',
      boardText,
      proposedMoveText,
      score: base.score,
      ...(base.mateIn !== undefined ? { mateIn: base.mateIn } : {}),
    }, apiKey)
    return { ...base, reasoning }
  } catch {
    // Gemini失敗時はテンプレートreasoningのままフォールバック
    return base
  }
}
