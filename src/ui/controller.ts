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
import { findBestMove } from '../ai/minimax.js'
import { CouncilEngine } from '../ai/council/council-engine.js'
import { type CouncilSession } from '../ai/council/types.js'
import { type UIState } from '../types/index.js'
import { squareEquals } from '../core/board.js'

// ------------------------------------------------------------
// UIController — ユーザー操作とゲームエンジンを繋ぐ
// ------------------------------------------------------------

export type UIUpdateCallback = (state: UIState) => void

export class UIController {
  private engine: GameEngine
  private aiEngine: AIEngine
  private councilEngine: CouncilEngine
  private gameState!: GameState
  private config!: GameConfig
  private uiStateInternal: UIState = createEmptyUIState()
  private onUpdate: UIUpdateCallback

  constructor(onUpdate: UIUpdateCallback) {
    this.engine = new GameEngine()
    this.aiEngine = new AIEngine()
    this.councilEngine = new CouncilEngine()
    this.onUpdate = onUpdate
  }

  /** 対局を開始する */
  startGame(config: GameConfig): void {
    this.config = config
    this.gameState = this.engine.startGame(config)

    // エージェントAIモードの場合は councilSession を初期化
    const isAgentAI = config.sentePlayer.difficulty === Difficulty.AGENT_AI
      || config.gotePlayer.difficulty === Difficulty.AGENT_AI

    const initialCouncilSession: CouncilSession | undefined = isAgentAI
      ? { isThinking: false, decisionHistory: [] }
      : undefined

    this.uiStateInternal = {
      gameState: this.gameState,
      selectedSquare: null,
      selectedHandPiece: null,
      highlightedSquares: [],
      isThinking: false,
      pendingPromotion: null,
      councilSession: initialCouncilSession,
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

  /** 指し手を適用する。非合法手などで適用に失敗した場合は false を返す */
  private executeMove(move: Move): boolean {
    try {
      this.gameState = this.engine.applyMove(this.gameState, move)
    } catch {
      this.clearSelection()
      return false
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
    return true
  }

  /**
   * 合議エンジンが非合法手を返した／想定外に失敗した場合の保険。
   * Minimax で必ず合法手を 1 手指し、AI 手番でのフリーズを防ぐ。
   */
  private playFallbackMove(state: GameState): void {
    try {
      const move = findBestMove(state, state.currentTurn, Difficulty.ADVANCED)
      this.executeMove(move)
    } catch {
      // 合法手が存在しない（既に詰みなど）場合は何もしない
    }
  }

  private async maybeAIMove(): Promise<void> {
    const gs = this.gameState
    if (gs.status !== GameStatus.ONGOING && gs.status !== GameStatus.CHECK) return

    const currentPlayer = gs.currentTurn === PlayerSide.SENTE
      ? this.config.sentePlayer
      : this.config.gotePlayer
    if (currentPlayer.type !== PlayerType.COMPUTER) return

    const difficulty = currentPlayer.difficulty ?? Difficulty.BEGINNER

    // エージェントAIモードは合議制エンジンを使用
    if (difficulty === Difficulty.AGENT_AI) {
      await this.maybeCouncilMove()
      return
    }

    // 初級/上級は従来のMinimaxエンジン（変更なし）
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

  /** エージェントAIモード専用: 合議制エンジンで応手する */
  private async maybeCouncilMove(): Promise<void> {
    const gs = this.gameState

    // councilSession の isThinking をオン
    const prevSession = this.uiStateInternal.councilSession as CouncilSession | undefined
    const thinkingSession: CouncilSession = {
      isThinking: true,
      // exactOptionalPropertyTypes: undefined は代入不可のため条件付きスプレッド
      ...(prevSession?.currentDecision !== undefined ? { currentDecision: prevSession.currentDecision } : {}),
      decisionHistory: prevSession?.decisionHistory ?? [],
    }
    this.uiStateInternal = {
      ...this.uiStateInternal,
      isThinking: true,
      councilSession: thinkingSession,
    }
    this.notifyUpdate()

    try {
      const decision = await this.councilEngine.deliberate(gs, gs.currentTurn, (update) => {
        if (update.phase === 'subs') {
          this.uiStateInternal = {
            ...this.uiStateInternal,
            councilSession: {
              ...thinkingSession,
              isThinking: true,
              thinkingPhase: 'subs',
            },
          }
        } else if (update.phase === 'commander') {
          this.uiStateInternal = {
            ...this.uiStateInternal,
            councilSession: {
              ...thinkingSession,
              isThinking: true,
              thinkingPhase: 'commander',
              partialDecision: update.partial,
            },
          }
        }
        this.notifyUpdate()
      })

      // councilSession を更新してUIに通知
      const updatedSession: CouncilSession = {
        isThinking: false,
        currentDecision: decision,
        decisionHistory: [...(prevSession?.decisionHistory ?? []), decision],
      }
      this.uiStateInternal = {
        ...this.uiStateInternal,
        councilSession: updatedSession,
      }
      this.notifyUpdate()

      // 総大将が（局面ズレ等で）非合法手を返した場合は Minimax で指し直す
      if (!this.executeMove(decision.finalMove)) {
        this.playFallbackMove(gs)
      }
    } catch {
      // 合議が想定外に失敗しても AI が必ず一手指すようフォールバック
      this.playFallbackMove(this.gameState)
    } finally {
      const session = this.uiStateInternal.councilSession as CouncilSession | undefined
      if (session) {
        this.uiStateInternal = {
          ...this.uiStateInternal,
          isThinking: false,
          councilSession: { ...session, isThinking: false },
        }
        this.notifyUpdate()
      }
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
