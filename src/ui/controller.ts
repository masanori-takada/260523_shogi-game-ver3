import {
  type GameState,
  type GameConfig,
  type Square,
  type BoardMove,
  type Move,
  PieceType,
  PlayerSide,
  PlayerType,
  GameStatus,
  Difficulty,
} from '../types/index.js'
import { GameEngine } from '../core/game.js'
import { AIEngine } from '../ai/engine.js'
import { type UIState } from '../types/index.js'
import { squareEquals } from '../core/board.js'

// ------------------------------------------------------------
// UIController — ユーザー操作とゲームエンジンを繋ぐ
// ------------------------------------------------------------

export type UIUpdateCallback = (state: UIState) => void

export class UIController {
  private engine: GameEngine
  private aiEngine: AIEngine
  private gameState!: GameState
  private config!: GameConfig
  private uiStateInternal: UIState = createEmptyUIState()
  private onUpdate: UIUpdateCallback

  constructor(onUpdate: UIUpdateCallback) {
    this.engine = new GameEngine()
    this.aiEngine = new AIEngine()
    this.onUpdate = onUpdate
  }

  /** 対局を開始する */
  startGame(config: GameConfig): void {
    this.config = config
    this.gameState = this.engine.startGame(config)
    this.uiStateInternal = {
      gameState: this.gameState,
      selectedSquare: null,
      selectedHandPiece: null,
      highlightedSquares: [],
      isThinking: false,
      pendingPromotion: null,
    }
    this.notifyUpdate()

    // AIが先手の場合（通常はないが対応）
    this.maybeAIMove()
  }

  /** 盤上のマスをクリックした */
  onSquareClick(sq: Square): void {
    if (this.uiStateInternal.pendingPromotion) return
    if (this.uiStateInternal.isThinking) return

    const gs = this.gameState
    if (gs.status !== GameStatus.ONGOING && gs.status !== GameStatus.CHECK) return

    // 現在のプレイヤーがHUMANでなければ無視
    const currentPlayer = gs.currentTurn === PlayerSide.SENTE
      ? this.config.sentePlayer
      : this.config.gotePlayer
    if (currentPlayer.type !== PlayerType.HUMAN) return

    const { selectedSquare, selectedHandPiece, highlightedSquares } = this.uiStateInternal

    // 持ち駒選択中に盤マスをクリック → 打ち手
    if (selectedHandPiece !== null) {
      const target = highlightedSquares.find(s => squareEquals(s, sq))
      if (target) {
        const move: Move = { kind: 'DROP', pieceType: selectedHandPiece, to: sq }
        this.executeMove(move)
      } else {
        this.clearSelection()
      }
      return
    }

    // 既に駒を選択している場合
    if (selectedSquare !== null) {
      if (squareEquals(selectedSquare, sq)) {
        // 同じマスをクリック → キャンセル
        this.clearSelection()
        return
      }

      // 合法手のマスをクリック → 移動
      const legalToSquare = highlightedSquares.find(s => squareEquals(s, sq))
      if (legalToSquare) {
        // promote:true / promote:false の両方が合法かどうか確認
        const legalMoves = this.engine.getLegalMoves(gs, selectedSquare)
        const boardMoves = legalMoves.filter(
          m => m.kind === 'BOARD' &&
               (m as BoardMove).to.row === sq.row &&
               (m as BoardMove).to.col === sq.col
        ) as BoardMove[]

        const hasPromote    = boardMoves.some(m => m.promote)
        const hasNotPromote = boardMoves.some(m => !m.promote)

        if (hasPromote && hasNotPromote) {
          // 成り選択ダイアログを表示
          this.uiStateInternal = {
            ...this.uiStateInternal,
            pendingPromotion: {
              move: boardMoves.find(m => m.promote)!,
            },
          }
          this.notifyUpdate()
        } else {
          const move = boardMoves[0]!
          this.executeMove(move)
        }
        return
      }

      // 別の自駒をクリック → 選択変更
      const piece = gs.board[sq.row]?.[sq.col]
      if (piece && piece.owner === gs.currentTurn) {
        this.selectSquare(sq)
        return
      }

      this.clearSelection()
      return
    }

    // 駒の新規選択
    const piece = gs.board[sq.row]?.[sq.col]
    if (piece && piece.owner === gs.currentTurn) {
      this.selectSquare(sq)
    }
  }

  /** 持ち駒をクリックした */
  onHandPieceClick(type: PieceType): void {
    if (this.uiStateInternal.isThinking) return

    const gs = this.gameState
    if (gs.status !== GameStatus.ONGOING && gs.status !== GameStatus.CHECK) return

    const currentPlayer = gs.currentTurn === PlayerSide.SENTE
      ? this.config.sentePlayer
      : this.config.gotePlayer
    if (currentPlayer.type !== PlayerType.HUMAN) return

    const hand = gs.hands[gs.currentTurn]
    if (!hand.has(type) || (hand.get(type) ?? 0) <= 0) return

    // 打てるマスを取得
    const legalMoves = this.engine.getLegalMoves(gs)
    const dropTargets = legalMoves
      .filter(m => m.kind === 'DROP' && m.pieceType === type)
      .map(m => m.to)

    if (dropTargets.length === 0) return

    this.uiStateInternal = {
      ...this.uiStateInternal,
      selectedSquare: null,
      selectedHandPiece: type,
      highlightedSquares: dropTargets,
    }
    this.notifyUpdate()
  }

  /** 成り選択ダイアログへの応答 */
  onPromotionChoice(promote: boolean): void {
    const pending = this.uiStateInternal.pendingPromotion
    if (!pending) return

    const move: BoardMove = { ...pending.move, promote }
    this.uiStateInternal = { ...this.uiStateInternal, pendingPromotion: null }
    this.executeMove(move)
  }

  /** 投了確認 */
  onResignConfirm(): void {
    if (this.uiStateInternal.isThinking) return
    const side = this.gameState.currentTurn
    this.gameState = this.engine.resign(this.gameState, side)
    this.uiStateInternal = {
      ...this.uiStateInternal,
      gameState: this.gameState,
      selectedSquare: null,
      selectedHandPiece: null,
      highlightedSquares: [],
    }
    this.notifyUpdate()
  }

  get uiState(): UIState {
    return this.uiStateInternal
  }

  // ------------------------------------------------------------
  // プライベートメソッド
  // ------------------------------------------------------------

  private selectSquare(sq: Square): void {
    const gs = this.gameState
    const legalMoves = this.engine.getLegalMoves(gs, sq)
    const targets = legalMoves.map(m => m.kind === 'BOARD' ? (m as BoardMove).to : m.to)

    this.uiStateInternal = {
      ...this.uiStateInternal,
      selectedSquare: sq,
      selectedHandPiece: null,
      highlightedSquares: targets,
    }
    this.notifyUpdate()
  }

  private clearSelection(): void {
    this.uiStateInternal = {
      ...this.uiStateInternal,
      selectedSquare: null,
      selectedHandPiece: null,
      highlightedSquares: [],
    }
    this.notifyUpdate()
  }

  private executeMove(move: Move): void {
    try {
      this.gameState = this.engine.applyMove(this.gameState, move)
    } catch {
      this.clearSelection()
      return
    }

    this.uiStateInternal = {
      ...this.uiStateInternal,
      gameState: this.gameState,
      selectedSquare: null,
      selectedHandPiece: null,
      highlightedSquares: [],
    }
    this.notifyUpdate()

    // AIの手番かチェック
    this.maybeAIMove()
  }

  private async maybeAIMove(): Promise<void> {
    const gs = this.gameState
    if (gs.status !== GameStatus.ONGOING && gs.status !== GameStatus.CHECK) return

    const currentPlayer = gs.currentTurn === PlayerSide.SENTE
      ? this.config.sentePlayer
      : this.config.gotePlayer
    if (currentPlayer.type !== PlayerType.COMPUTER) return

    const difficulty = currentPlayer.difficulty ?? Difficulty.BEGINNER

    this.uiStateInternal = { ...this.uiStateInternal, isThinking: true }
    this.notifyUpdate()

    try {
      const aiMove = await this.aiEngine.getBestMoveAsync(gs, gs.currentTurn, difficulty)
      this.executeMove(aiMove)
    } finally {
      this.uiStateInternal = { ...this.uiStateInternal, isThinking: false }
      this.notifyUpdate()
    }
  }

  private notifyUpdate(): void {
    this.onUpdate(this.uiStateInternal)
  }
}

function createEmptyUIState(): UIState {
  return {
    gameState: null as unknown as GameState,
    selectedSquare: null,
    selectedHandPiece: null,
    highlightedSquares: [],
    isThinking: false,
    pendingPromotion: null,
  }
}
