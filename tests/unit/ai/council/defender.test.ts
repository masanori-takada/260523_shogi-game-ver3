import { describe, it, expect } from 'vitest'
import { defenderPropose } from '../../../../src/ai/council/defender.js'
import { GameEngine } from '../../../../src/core/game.js'
import { PlayerSide, Difficulty } from '../../../../src/types/index.js'
import { AgentRole } from '../../../../src/ai/council/types.js'

const engine = new GameEngine()

describe('defenderPropose（智将）', () => {
  it('初期局面で SubAgentProposal を返す', () => {
    const config = {
      mode: 'HUMAN_VS_COMPUTER' as any,
      sentePlayer: { side: PlayerSide.SENTE, type: 'COMPUTER' as any, name: 'AI', difficulty: Difficulty.AGENT_AI },
      gotePlayer:  { side: PlayerSide.GOTE,  type: 'HUMAN' as any,    name: '後手' },
    }
    const state = engine.startGame(config)
    const proposal = defenderPropose(state, PlayerSide.SENTE, 2)

    expect(proposal).toBeDefined()
    expect(proposal.move).toBeDefined()
    expect(proposal.role).toBe(AgentRole.DEFENDER)
    expect(typeof proposal.score).toBe('number')
    expect(typeof proposal.reasoning).toBe('string')
  })

  it('合法手のある局面では有効な手を返す', () => {
    const config = {
      mode: 'HUMAN_VS_COMPUTER' as any,
      sentePlayer: { side: PlayerSide.SENTE, type: 'COMPUTER' as any, name: 'AI', difficulty: Difficulty.AGENT_AI },
      gotePlayer:  { side: PlayerSide.GOTE,  type: 'HUMAN' as any,    name: '後手' },
    }
    const state = engine.startGame(config)
    const proposal = defenderPropose(state, PlayerSide.SENTE, 2)
    const legalMoves = engine.getLegalMoves(state)

    const isLegal = legalMoves.some(m => JSON.stringify(m) === JSON.stringify(proposal.move))
    expect(isLegal).toBe(true)
  })
})
