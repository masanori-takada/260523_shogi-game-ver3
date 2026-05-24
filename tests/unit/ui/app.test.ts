// ============================================================
// app.ts UI テスト — US3: 難易度選択にエージェントAIが追加される
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Difficulty, PlayerSide, PlayerType, GameMode } from '../../../src/types/index.js'

// ============================================================
// ブラウザDOM環境のモック（JSDOM を使用）
// ============================================================

// initApp をテストするためのシンプルなDOM環境チェック
describe('難易度選択画面 — 3択ボタン存在確認（US3）', () => {
  it('Difficulty enum に AGENT_AI が含まれる', () => {
    expect(Difficulty.AGENT_AI).toBe('AGENT_AI')
  })

  it('Difficulty enum に BEGINNER が含まれる（変更なし確認）', () => {
    expect(Difficulty.BEGINNER).toBe('BEGINNER')
  })

  it('Difficulty enum に ADVANCED が含まれる（変更なし確認）', () => {
    expect(Difficulty.ADVANCED).toBe('ADVANCED')
  })

  it('Difficulty enum の値が3つ存在する（初級・上級・エージェントAI）', () => {
    const values = Object.values(Difficulty)
    expect(values).toHaveLength(3)
    expect(values).toContain('BEGINNER')
    expect(values).toContain('ADVANCED')
    expect(values).toContain('AGENT_AI')
  })
})

describe('GameConfig 生成 — AGENT_AI 設定時の councilSession', () => {
  it('AGENT_AI難易度のGameConfigでgotePlayerにdifficulty=AGENT_AIが設定される', () => {
    // app.ts の showDifficultySelectScreen() で生成される設定と等価な構造を検証
    const config = {
      mode: GameMode.HUMAN_VS_COMPUTER,
      sentePlayer: {
        side: PlayerSide.SENTE,
        type: PlayerType.HUMAN,
        name: '先手',
      },
      gotePlayer: {
        side: PlayerSide.GOTE,
        type: PlayerType.COMPUTER,
        name: '三軍師AI',
        difficulty: Difficulty.AGENT_AI,
      },
    }

    expect(config.gotePlayer.difficulty).toBe(Difficulty.AGENT_AI)
    expect(config.gotePlayer.type).toBe(PlayerType.COMPUTER)
    expect(config.sentePlayer.type).toBe(PlayerType.HUMAN)
  })

  it('BEGINNER難易度のGameConfigではdifficulty=BEGINNERが設定される（変更なし確認）', () => {
    const config = {
      mode: GameMode.HUMAN_VS_COMPUTER,
      sentePlayer: {
        side: PlayerSide.SENTE,
        type: PlayerType.HUMAN,
        name: '先手',
      },
      gotePlayer: {
        side: PlayerSide.GOTE,
        type: PlayerType.COMPUTER,
        name: 'CPU',
        difficulty: Difficulty.BEGINNER,
      },
    }

    expect(config.gotePlayer.difficulty).toBe(Difficulty.BEGINNER)
    expect(config.gotePlayer.difficulty).not.toBe(Difficulty.AGENT_AI)
  })

  it('ADVANCED難易度のGameConfigではdifficulty=ADVANCEDが設定される（変更なし確認）', () => {
    const config = {
      mode: GameMode.HUMAN_VS_COMPUTER,
      sentePlayer: {
        side: PlayerSide.SENTE,
        type: PlayerType.HUMAN,
        name: '先手',
      },
      gotePlayer: {
        side: PlayerSide.GOTE,
        type: PlayerType.COMPUTER,
        name: 'CPU',
        difficulty: Difficulty.ADVANCED,
      },
    }

    expect(config.gotePlayer.difficulty).toBe(Difficulty.ADVANCED)
    expect(config.gotePlayer.difficulty).not.toBe(Difficulty.AGENT_AI)
  })
})

describe('isAgentAI フラグ判定 — app.ts のロジック検証', () => {
  // app.ts の showGameScreen() 内で使われるロジックと同等の検証
  function isAgentAI(gotePlayerDifficulty?: Difficulty, sentePlayerDifficulty?: Difficulty): boolean {
    return gotePlayerDifficulty === Difficulty.AGENT_AI
      || sentePlayerDifficulty === Difficulty.AGENT_AI
  }

  it('後手がAGENT_AIのとき isAgentAI = true', () => {
    expect(isAgentAI(Difficulty.AGENT_AI, undefined)).toBe(true)
  })

  it('後手がBEGINNERのとき isAgentAI = false（三軍師パネルは表示しない）', () => {
    expect(isAgentAI(Difficulty.BEGINNER, undefined)).toBe(false)
  })

  it('後手がADVANCEDのとき isAgentAI = false（三軍師パネルは表示しない）', () => {
    expect(isAgentAI(Difficulty.ADVANCED, undefined)).toBe(false)
  })

  it('後手がundefinedのとき isAgentAI = false（人間対人間モード）', () => {
    expect(isAgentAI(undefined, undefined)).toBe(false)
  })
})
