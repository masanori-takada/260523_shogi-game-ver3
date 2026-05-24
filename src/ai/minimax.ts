import {
  type GameState,
  type Move,
  PlayerSide,
  GameStatus,
  Difficulty,
} from '../types/index.js'
import { GameEngine } from '../core/game.js'
import { evaluate } from './evaluator.js'

// ------------------------------------------------------------
// Minimax + αβ枝刈り
// ------------------------------------------------------------

const DEPTH_BY_DIFFICULTY: Record<Difficulty, number> = {
  [Difficulty.BEGINNER]:  2,
  [Difficulty.ADVANCED]:  4,
  [Difficulty.AGENT_AI]:  4, // エージェントAIはサブエージェント経由で呼ばれるが念のため設定
}

const engine = new GameEngine()

/**
 * Minimax + αβ枝刈りで最善手を探索する
 */
export function findBestMove(
  state: GameState,
  side: PlayerSide,
  difficulty: Difficulty,
): Move {
  const depth = DEPTH_BY_DIFFICULTY[difficulty]
  const moves = engine.getLegalMoves(state)

  if (moves.length === 0) {
    throw new Error('No legal moves available')
  }

  let bestMove = moves[0]!
  let bestScore = -Infinity

  for (const move of moves) {
    try {
      const nextState = engine.applyMove(state, move)
      const score = alphaBeta(nextState, depth - 1, -Infinity, Infinity, false, side)
      if (score > bestScore) {
        bestScore = score
        bestMove = move
      }
    } catch {
      // 合法手でなければスキップ
    }
  }

  return bestMove
}

function alphaBeta(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  side: PlayerSide,
): number {
  // 終端条件
  if (
    state.status === GameStatus.CHECKMATE ||
    state.status === GameStatus.RESIGNED
  ) {
    // 詰まされた側が負け
    const loser = state.status === GameStatus.CHECKMATE ? state.currentTurn : state.winner === side ? side : (side === PlayerSide.SENTE ? PlayerSide.GOTE : PlayerSide.SENTE)
    return loser === side ? -100000 : 100000
  }

  if (state.status === GameStatus.DRAW) return 0

  if (depth === 0) {
    return evaluate(state, side)
  }

  const moves = engine.getLegalMoves(state)
  if (moves.length === 0) return evaluate(state, side)

  if (isMaximizing) {
    let maxScore = -Infinity
    for (const move of moves) {
      try {
        const nextState = engine.applyMove(state, move)
        const score = alphaBeta(nextState, depth - 1, alpha, beta, false, side)
        maxScore = Math.max(maxScore, score)
        alpha = Math.max(alpha, score)
        if (beta <= alpha) break // βカット
      } catch {
        continue
      }
    }
    return maxScore
  } else {
    let minScore = Infinity
    for (const move of moves) {
      try {
        const nextState = engine.applyMove(state, move)
        const score = alphaBeta(nextState, depth - 1, alpha, beta, true, side)
        minScore = Math.min(minScore, score)
        beta = Math.min(beta, score)
        if (beta <= alpha) break // αカット
      } catch {
        continue
      }
    }
    return minScore
  }
}
