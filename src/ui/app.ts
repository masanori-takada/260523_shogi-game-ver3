import {
  type UIState,
  type GameConfig,
  GameMode,
  PlayerSide,
  PlayerType,
  GameStatus,
  Difficulty,
  PieceType,
} from '../types/index.js'
import { UIController } from './controller.js'
import { BoardView } from './board-view.js'
import { HandView } from './hand-view.js'
import { CouncilPanel } from './council-panel.js'
import { PIECE_DISPLAY } from './piece-view.js'
import { type CouncilSession, MODE_DISPLAY } from '../ai/council/types.js'

// ------------------------------------------------------------
// メインアプリケーション
// ------------------------------------------------------------

export function initApp(root: HTMLElement): void {
  root.innerHTML = ''
  root.className = 'app'

  showModeSelectScreen(root)
}

// ------------------------------------------------------------
// 対局モード選択画面
// ------------------------------------------------------------

function showModeSelectScreen(root: HTMLElement): void {
  root.innerHTML = `
    <div class="mode-select">
      <h1 class="app-title">将棋</h1>
      <div class="mode-buttons">
        <button class="mode-btn" id="btn-hvh">人間対人間</button>
        <button class="mode-btn" id="btn-hvc">人間対AI</button>
      </div>
    </div>
  `

  root.querySelector('#btn-hvh')!.addEventListener('click', () => {
    const config: GameConfig = {
      mode: GameMode.HUMAN_VS_HUMAN,
      sentePlayer: { side: PlayerSide.SENTE, type: PlayerType.HUMAN, name: '先手' },
      gotePlayer:  { side: PlayerSide.GOTE,  type: PlayerType.HUMAN, name: '後手' },
    }
    showGameScreen(root, config)
  })

  root.querySelector('#btn-hvc')!.addEventListener('click', () => {
    showDifficultySelectScreen(root)
  })
}

// ------------------------------------------------------------
// 難易度選択画面（AI対戦用）
// ------------------------------------------------------------

function showDifficultySelectScreen(root: HTMLElement): void {
  root.innerHTML = `
    <div class="difficulty-select">
      <h2>難易度を選択</h2>
      <div class="difficulty-buttons">
        <button class="difficulty-btn" id="btn-beginner">初級</button>
        <button class="difficulty-btn" id="btn-advanced">上級</button>
        <button class="difficulty-btn difficulty-btn--agent" id="btn-agent-ai">
          🤖 エージェントAI
        </button>
      </div>
      <button class="back-btn" id="btn-back">戻る</button>
    </div>
  `

  const startAI = (difficulty: Difficulty) => {
    localStorage.setItem('shogi-difficulty', difficulty)

    const config: GameConfig = {
      mode: GameMode.HUMAN_VS_COMPUTER,
      sentePlayer: { side: PlayerSide.SENTE, type: PlayerType.HUMAN, name: '先手' },
      gotePlayer:  {
        side: PlayerSide.GOTE,
        type: PlayerType.COMPUTER,
        name: difficulty === Difficulty.AGENT_AI ? '三軍師AI' : 'CPU',
        difficulty,
      },
    }
    showGameScreen(root, config)
  }

  root.querySelector('#btn-beginner')!.addEventListener('click', () => startAI(Difficulty.BEGINNER))
  root.querySelector('#btn-advanced')!.addEventListener('click', () => startAI(Difficulty.ADVANCED))
  root.querySelector('#btn-agent-ai')!.addEventListener('click', () => startAI(Difficulty.AGENT_AI))
  root.querySelector('#btn-back')!.addEventListener('click', () => showModeSelectScreen(root))
}

// ------------------------------------------------------------
// 対局画面
// ------------------------------------------------------------

function showGameScreen(root: HTMLElement, config: GameConfig): void {
  const isAgentAI = config.gotePlayer.difficulty === Difficulty.AGENT_AI
    || config.sentePlayer.difficulty === Difficulty.AGENT_AI

  root.innerHTML = `
    <div class="game-screen${isAgentAI ? ' game-screen--agent' : ''}">
      <div class="game-header">
        <span class="turn-indicator" id="turn-indicator"></span>
        ${isAgentAI ? '<span class="ai-mode-badge" id="ai-mode-badge">⚖️ 形勢判断モード</span>' : ''}
        <button class="resign-btn" id="btn-resign">投了</button>
      </div>
      <div class="game-layout">
        <div class="hand-container" id="hand-gote"></div>
        <div class="board-container" id="board-container"></div>
        <div class="hand-container" id="hand-sente"></div>
        ${isAgentAI ? '<div class="council-panel-container" id="council-panel-container"></div>' : ''}
      </div>
    </div>
  `

  const boardContainer = root.querySelector('#board-container') as HTMLElement
  const handSenteContainer = root.querySelector('#hand-sente') as HTMLElement
  const handGoteContainer  = root.querySelector('#hand-gote')  as HTMLElement
  const turnIndicator = root.querySelector('#turn-indicator') as HTMLElement

  const boardView = new BoardView(boardContainer)
  const handSenteView = new HandView(handSenteContainer, PlayerSide.SENTE)
  const handGoteView  = new HandView(handGoteContainer,  PlayerSide.GOTE)

  // エージェントAIモード用: 三軍師パネルとモードバッジ
  let councilPanel: CouncilPanel | null = null
  const modeBadgeEl = root.querySelector('#ai-mode-badge') as HTMLElement | null
  if (isAgentAI) {
    const panelContainer = root.querySelector('#council-panel-container') as HTMLElement
    councilPanel = new CouncilPanel(panelContainer)
  }

  let promotionDialog: HTMLElement | null = null

  const controller = new UIController((uiState: UIState) => {
    const gs = uiState.gameState

    // 盤面更新（直前の指し手をハイライト）
    const lastMove = gs.moveHistory.length > 0
      ? gs.moveHistory[gs.moveHistory.length - 1]!.move
      : undefined
    boardView.update(
      gs.board,
      uiState.selectedSquare,
      uiState.highlightedSquares,
      gs.status === GameStatus.CHECK,
      lastMove,
    )
    boardView.setThinking(uiState.isThinking)

    // 持ち駒更新
    handSenteView.update(gs.hands[PlayerSide.SENTE], uiState.selectedHandPiece)
    handGoteView.update(gs.hands[PlayerSide.GOTE],   uiState.selectedHandPiece)

    // 手番インジケーター
    if (gs.status === GameStatus.ONGOING || gs.status === GameStatus.CHECK) {
      const side = gs.currentTurn === PlayerSide.SENTE ? '先手' : '後手'
      const check = gs.status === GameStatus.CHECK ? '（王手！）' : ''
      turnIndicator.textContent = `${side}の番${check}`
      if (uiState.isThinking) {
        turnIndicator.textContent += ' 思考中...'
      }
    }

    // 三軍師パネルとモードバッジを更新（エージェントAIモードのみ）
    if (councilPanel && isAgentAI) {
      const session = uiState.councilSession as CouncilSession | undefined
      if (session?.isThinking) {
        councilPanel.showThinking()
        if (modeBadgeEl) {
          modeBadgeEl.textContent = '⏳ 審議中...'
          modeBadgeEl.className = 'ai-mode-badge mode-thinking'
        }
      } else if (session?.currentDecision) {
        councilPanel.showDecision(session.currentDecision)
        if (modeBadgeEl) {
          const modeInfo = MODE_DISPLAY[session.currentDecision.aiMode]
          modeBadgeEl.textContent = modeInfo.label
          modeBadgeEl.className = `ai-mode-badge ${modeInfo.cssClass}`
        }
      }
    }

    // 成り選択ダイアログ
    if (uiState.pendingPromotion && !promotionDialog) {
      promotionDialog = createPromotionDialog(
        (promote) => {
          promotionDialog?.remove()
          promotionDialog = null
          controller.onPromotionChoice(promote)
        }
      )
      root.appendChild(promotionDialog)
    }

    // 対局終了画面
    if (
      gs.status === GameStatus.CHECKMATE ||
      gs.status === GameStatus.RESIGNED ||
      gs.status === GameStatus.DRAW
    ) {
      showGameOverScreen(root, gs, config, () => showModeSelectScreen(root))
    }
  })

  // イベント登録
  boardView.onSquareClick(sq => controller.onSquareClick(sq))
  handSenteView.onPieceClick(type => controller.onHandPieceClick(type))
  handGoteView.onPieceClick(type  => controller.onHandPieceClick(type))

  root.querySelector('#btn-resign')!.addEventListener('click', () => {
    if (confirm('本当に投了しますか？')) {
      controller.onResignConfirm()
    }
  })

  // 対局開始
  controller.startGame(config)
}

// ------------------------------------------------------------
// 成り選択ダイアログ
// ------------------------------------------------------------

function createPromotionDialog(onChoice: (promote: boolean) => void): HTMLElement {
  const overlay = document.createElement('div')
  overlay.className = 'dialog-overlay'
  overlay.innerHTML = `
    <div class="dialog promotion-dialog">
      <h3>成りますか？</h3>
      <div class="dialog-buttons">
        <button id="btn-promote">成る</button>
        <button id="btn-no-promote">不成</button>
      </div>
    </div>
  `
  overlay.querySelector('#btn-promote')!.addEventListener('click', () => onChoice(true))
  overlay.querySelector('#btn-no-promote')!.addEventListener('click', () => onChoice(false))
  return overlay
}

// ------------------------------------------------------------
// 対局終了画面
// ------------------------------------------------------------

function showGameOverScreen(
  root: HTMLElement,
  gs: import('../types/index.js').GameState,
  config: GameConfig,
  onBack: () => void,
): void {
  // 既に表示中なら重複しない
  if (root.querySelector('.game-over-overlay')) return

  let message = ''
  if (gs.status === GameStatus.CHECKMATE || gs.status === GameStatus.RESIGNED) {
    const winner = gs.winner === PlayerSide.SENTE ? '先手' : '後手'
    const reason = gs.status === GameStatus.CHECKMATE ? '（詰み）' : '（投了）'
    message = `${winner}の勝ち${reason}`
  } else {
    message = '引き分け（千日手）'
  }

  const overlay = document.createElement('div')
  overlay.className = 'dialog-overlay game-over-overlay'
  overlay.innerHTML = `
    <div class="dialog game-over-dialog">
      <h2 class="game-over-title">対局終了</h2>
      <p class="game-over-message">${message}</p>
      <p class="game-over-moves">総手数: ${gs.moveHistory.length}手</p>
      <button id="btn-play-again">もう一度</button>
    </div>
  `
  overlay.querySelector('#btn-play-again')!.addEventListener('click', onBack)
  root.appendChild(overlay)
}
