// ============================================================
// 将棋ゲーム 型定義
// ============================================================

// ------------------------------------------------------------
// 駒の種類
// ------------------------------------------------------------
export enum PieceType {
  // 通常駒
  PAWN    = 'PAWN',    // 歩兵
  LANCE   = 'LANCE',   // 香車
  KNIGHT  = 'KNIGHT',  // 桂馬
  SILVER  = 'SILVER',  // 銀将
  GOLD    = 'GOLD',    // 金将
  BISHOP  = 'BISHOP',  // 角行
  ROOK    = 'ROOK',    // 飛車
  KING    = 'KING',    // 玉将
  // 成り駒
  PROMOTED_PAWN    = 'PROMOTED_PAWN',    // と金
  PROMOTED_LANCE   = 'PROMOTED_LANCE',   // 成香
  PROMOTED_KNIGHT  = 'PROMOTED_KNIGHT',  // 成桂
  PROMOTED_SILVER  = 'PROMOTED_SILVER',  // 成銀
  PROMOTED_BISHOP  = 'PROMOTED_BISHOP',  // 龍馬（馬）
  PROMOTED_ROOK    = 'PROMOTED_ROOK',    // 龍王（龍）
}

// ------------------------------------------------------------
// プレイヤー
// ------------------------------------------------------------
export enum PlayerSide {
  SENTE = 'SENTE', // 先手（画面下）
  GOTE  = 'GOTE',  // 後手（画面上）
}

export enum PlayerType {
  HUMAN    = 'HUMAN',
  COMPUTER = 'COMPUTER',
}

export enum Difficulty {
  BEGINNER = 'BEGINNER', // 初級: 探索深度2
  ADVANCED = 'ADVANCED', // 上級: 探索深度4
}

export interface Player {
  side: PlayerSide
  type: PlayerType
  name: string
  difficulty?: Difficulty
}

// ------------------------------------------------------------
// 盤面座標
// ------------------------------------------------------------
export interface Square {
  row: number // 0-8（0=後手最奥 / 8=先手最奥）
  col: number // 0-8（0=9筋 / 8=1筋）
}

// ------------------------------------------------------------
// 駒
// ------------------------------------------------------------
export interface Piece {
  type: PieceType
  owner: PlayerSide
}

// ------------------------------------------------------------
// 盤面（9×9）
// ------------------------------------------------------------
export type Board = (Piece | null)[][]

// ------------------------------------------------------------
// 持ち駒（成る前の形で管理）
// ------------------------------------------------------------
export type Hand = Map<PieceType, number>

// ------------------------------------------------------------
// 手
// ------------------------------------------------------------
export interface BoardMove {
  kind: 'BOARD'
  from: Square
  to: Square
  promote: boolean
}

export interface DropMove {
  kind: 'DROP'
  pieceType: PieceType // 打つ駒（成る前）
  to: Square
}

export type Move = BoardMove | DropMove

// ------------------------------------------------------------
// 棋譜エントリ
// ------------------------------------------------------------
export interface GameRecordEntry {
  moveNumber: number
  move: Move
  player: PlayerSide
  capturedPiece?: PieceType
  timestamp: number
}

// ------------------------------------------------------------
// 対局状態
// ------------------------------------------------------------
export enum GameStatus {
  ONGOING   = 'ONGOING',
  CHECK     = 'CHECK',
  CHECKMATE = 'CHECKMATE',
  DRAW      = 'DRAW',
  RESIGNED  = 'RESIGNED',
}

export interface GameState {
  board: Board
  hands: {
    [PlayerSide.SENTE]: Hand
    [PlayerSide.GOTE]: Hand
  }
  currentTurn: PlayerSide
  status: GameStatus
  winner?: PlayerSide
  moveHistory: GameRecordEntry[]
  positionHistory: string[] // 千日手検知用（局面ハッシュ）
}

// ------------------------------------------------------------
// 対局設定
// ------------------------------------------------------------
export enum GameMode {
  HUMAN_VS_HUMAN    = 'HUMAN_VS_HUMAN',
  HUMAN_VS_COMPUTER = 'HUMAN_VS_COMPUTER',
}

export interface GameConfig {
  mode: GameMode
  sentePlayer: Player
  gotePlayer: Player
}

// ------------------------------------------------------------
// UI状態
// ------------------------------------------------------------
export interface UIState {
  gameState: GameState
  selectedSquare: Square | null
  selectedHandPiece: PieceType | null
  highlightedSquares: Square[]
  isThinking: boolean
  pendingPromotion: { move: BoardMove } | null
}

// ------------------------------------------------------------
// エラー
// ------------------------------------------------------------
export enum IllegalMoveReason {
  OUT_OF_BOARD          = 'OUT_OF_BOARD',
  WRONG_TURN            = 'WRONG_TURN',
  NO_PIECE_AT_FROM      = 'NO_PIECE_AT_FROM',
  NOT_OWN_PIECE         = 'NOT_OWN_PIECE',
  PIECE_CANNOT_MOVE     = 'PIECE_CANNOT_MOVE',
  LEAVES_KING_IN_CHECK  = 'LEAVES_KING_IN_CHECK',
  NIFU                  = 'NIFU',
  UCHI_FU_ZUME          = 'UCHI_FU_ZUME',
  NO_RETREAT            = 'NO_RETREAT',
  GAME_ALREADY_OVER     = 'GAME_ALREADY_OVER',
}

export class IllegalMoveError extends Error {
  constructor(
    public readonly move: Move,
    public readonly reason: IllegalMoveReason,
  ) {
    super(`Illegal move: ${reason}`)
    this.name = 'IllegalMoveError'
  }
}
