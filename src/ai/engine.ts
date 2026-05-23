import {
  type GameState,
  type Move,
  PlayerSide,
  Difficulty,
} from '../types/index.js'
import { findBestMove } from './minimax.js'

// ------------------------------------------------------------
// AIEngine 実装
// ------------------------------------------------------------

export class AIEngine {
  /**
   * 同期で最善手を計算する（テスト用）
   */
  getBestMove(state: GameState, side: PlayerSide, difficulty: Difficulty): Move {
    return findBestMove(state, side, difficulty)
  }

  /**
   * 非同期で最善手を計算する（UIスレッドをブロックしない）
   */
  getBestMoveAsync(
    state: GameState,
    side: PlayerSide,
    difficulty: Difficulty,
  ): Promise<Move> {
    return new Promise((resolve, reject) => {
      // setTimeout で UIスレッドに制御を返してから計算する
      setTimeout(() => {
        try {
          const move = findBestMove(state, side, difficulty)
          resolve(move)
        } catch (err) {
          reject(err)
        }
      }, 0)
    })
  }
}
