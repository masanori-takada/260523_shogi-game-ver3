# Contract: ゲームエンジン API

**Branch**: `001-shogi-game` | **Type**: TypeScript Interface Contract | **Date**: 2026-05-23

このドキュメントは、ゲームエンジン（コアロジック）と UI レイヤーの間のインターフェース仕様を定義します。
UI はこのコントラクトを通じてのみゲームエンジンと通信します。

---

## GameEngine インターフェース

```typescript
interface GameEngine {
  /**
   * 新しい対局を開始する
   * @param config 対局設定（モード・プレイヤー情報）
   * @returns 初期 GameState
   */
  startGame(config: GameConfig): GameState

  /**
   * 指定した手が合法かどうかを確認する
   * @param state 現在の GameState
   * @param move 検証する手
   * @returns 合法なら true
   */
  isLegalMove(state: GameState, move: Move): boolean

  /**
   * 現在の局面で合法な手をすべて返す
   * @param state 現在の GameState
   * @param square 選択した盤上の駒のマス（省略時は全合法手）
   * @returns 合法手のリスト
   */
  getLegalMoves(state: GameState, square?: Square): Move[]

  /**
   * 手を指して新しい GameState を返す（イミュータブル）
   * @param state 現在の GameState
   * @param move 実行する手
   * @returns 新しい GameState
   * @throws IllegalMoveError 合法でない手が渡された場合
   */
  applyMove(state: GameState, move: Move): GameState

  /**
   * 現在の局面で王手がかかっているか
   * @param state 現在の GameState
   * @param side チェックするプレイヤー
   * @returns 王手なら true
   */
  isInCheck(state: GameState, side: PlayerSide): boolean

  /**
   * 現在の局面が詰みか
   * @param state 現在の GameState
   * @param side チェックするプレイヤー
   * @returns 詰みなら true
   */
  isCheckmate(state: GameState, side: PlayerSide): boolean

  /**
   * 投了処理を行い対局終了状態の GameState を返す
   * @param state 現在の GameState
   * @param resigningSide 投了するプレイヤー
   * @returns 対局終了状態の GameState
   */
  resign(state: GameState, resigningSide: PlayerSide): GameState

  /**
   * 棋譜をテキスト形式（KIF風）で出力する
   * @param state 対局終了後の GameState
   * @returns 棋譜テキスト
   */
  exportRecord(state: GameState): string
}
```

---

## AIEngine インターフェース

```typescript
interface AIEngine {
  /**
   * 現在の局面から最善手を計算する
   * @param state 現在の GameState
   * @param side AIが操作するプレイヤー
   * @param difficulty 難易度
   * @returns 最善手
   */
  getBestMove(state: GameState, side: PlayerSide, difficulty: Difficulty): Move

  /**
   * 非同期で最善手を計算する（UI スレッドをブロックしない）
   * @param state 現在の GameState
   * @param side AIが操作するプレイヤー
   * @param difficulty 難易度
   * @returns Promise<Move>
   */
  getBestMoveAsync(state: GameState, side: PlayerSide, difficulty: Difficulty): Promise<Move>
}
```

---

## UIController インターフェース

UI から見たゲームコントローラーのインターフェース。

```typescript
interface UIController {
  /**
   * 駒をクリック/タップしたときの処理
   * - 自分の駒: 選択状態にし、合法手をハイライト
   * - 移動先のハイライト上: 移動を実行
   * - 持ち駒エリア: 持ち駒を選択
   */
  onSquareClick(square: Square): void
  onHandPieceClick(pieceType: PieceType): void

  /**
   * 成り選択ダイアログへの応答
   */
  onPromotionChoice(promote: boolean): void

  /**
   * 投了確認への応答
   */
  onResignConfirm(): void

  /**
   * 現在の UI 状態
   */
  readonly uiState: UIState
}

interface UIState {
  gameState: GameState
  selectedSquare: Square | null      // 選択中の盤上マス
  selectedHandPiece: PieceType | null // 選択中の持ち駒
  highlightedSquares: Square[]        // 合法手ハイライト
  isThinking: boolean                 // AI思考中フラグ
  pendingPromotion: {                 // 成り選択待ちの手（ある場合）
    move: BoardMove
  } | null
}
```

---

## エラー定義

```typescript
class IllegalMoveError extends Error {
  constructor(
    public readonly move: Move,
    public readonly reason: IllegalMoveReason
  ) {
    super(`Illegal move: ${reason}`)
  }
}

enum IllegalMoveReason {
  OUT_OF_BOARD        = 'OUT_OF_BOARD',        // 盤外への移動
  WRONG_TURN          = 'WRONG_TURN',          // 手番でない
  NO_PIECE_AT_FROM    = 'NO_PIECE_AT_FROM',    // 移動元に駒なし
  NOT_OWN_PIECE       = 'NOT_OWN_PIECE',       // 自分の駒でない
  PIECE_CANNOT_MOVE   = 'PIECE_CANNOT_MOVE',   // 駒の動き規則に違反
  LEAVES_KING_IN_CHECK = 'LEAVES_KING_IN_CHECK', // 自殺手
  NIFU                = 'NIFU',                // 二歩
  UCHI_FU_ZUME        = 'UCHI_FU_ZUME',        // 打ち歩詰め
  NO_RETREAT          = 'NO_RETREAT',          // 行き所のない駒
  GAME_ALREADY_OVER   = 'GAME_ALREADY_OVER',   // 対局終了後
}
```

---

## コントラクトテスト要件

実装時に以下の契約テスト (`tests/contract/`) を作成すること:

| テストID | 内容 |
|---------|------|
| CT-001 | `startGame()` が正しい初期盤面を返す |
| CT-002 | `getLegalMoves()` が初期局面の先手歩の合法手を正しく返す |
| CT-003 | `applyMove()` で合法手を適用すると手番が交代する |
| CT-004 | `applyMove()` で禁じ手（二歩）を渡すと `IllegalMoveError` が発生する |
| CT-005 | `isCheckmate()` が詰みの局面で true を返す |
| CT-006 | `resign()` が RESIGNED 状態の GameState を返す |
| CT-007 | `AIEngine.getBestMoveAsync()` が返す手が合法手である |
