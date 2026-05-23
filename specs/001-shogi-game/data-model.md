# Data Model: 将棋ゲーム

**Branch**: `001-shogi-game` | **Phase**: 1 | **Date**: 2026-05-23

## エンティティ一覧

---

### PieceType (駒の種類)

```typescript
enum PieceType {
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
```

**バリデーション**:
- 金（GOLD）・玉（KING）は成れない
- 成り駒はさらに成れない（既に成り状態）
- 持ち駒として打つ場合は必ず成る前の形

---

### Player (プレイヤー)

```typescript
enum PlayerSide {
  SENTE = 'SENTE',  // 先手（画面下・通常）
  GOTE  = 'GOTE',   // 後手（画面上・反転）
}

enum PlayerType {
  HUMAN    = 'HUMAN',
  COMPUTER = 'COMPUTER',
}

interface Player {
  side: PlayerSide
  type: PlayerType
  name: string           // 表示名（例: "先手", "後手", "CPU"）
  difficulty?: Difficulty // type が COMPUTER の場合のみ
}
```

---

### Difficulty (AI難易度)

```typescript
enum Difficulty {
  BEGINNER = 'BEGINNER',  // 初級: 探索深度2
  ADVANCED = 'ADVANCED',  // 上級: 探索深度4
}
```

---

### Square (マス目座標)

```typescript
interface Square {
  row: number  // 0-8（0が後手陣の最奥、8が先手陣の最奥）
  col: number  // 0-8（0が9筋側、8が1筋側）
}
```

**変換ルール**:
- 表示用「9三」= { row: 2, col: 0 }
- 表示用「5五」= { row: 4, col: 4 }

---

### Piece (駒)

```typescript
interface Piece {
  type: PieceType
  owner: PlayerSide
}
```

**不変条件**:
- 盤上の駒は上記の通り
- 持ち駒（hand）に入る際は成りが解除される（PROMOTED_PAWN → PAWN）
- 打ち駒は必ず成る前の形

---

### Board (盤面)

```typescript
type Board = (Piece | null)[][]
// Board[row][col] で各マスの状態にアクセス
// null = 空きマス
```

**初期配置** (先手視点):
```
後手陣 (row 0-2):
  row 0: 香桂銀金玉金銀桂香（col 0-8）
  row 1: _飛___________角_
  row 2: 歩歩歩歩歩歩歩歩歩

先手陣 (row 6-8):
  row 6: 歩歩歩歩歩歩歩歩歩
  row 7: _角___________飛_
  row 8: 香桂銀金玉金銀桂香
```

---

### Hand (持ち駒)

```typescript
type Hand = Map<PieceType, number>
// PieceType → 枚数（成り前の形で管理）
// 例: { PAWN: 3, ROOK: 1 }
```

**バリデーション**:
- 枚数は 0 以上
- 存在しない駒種は Map に含まない（0は除外）

---

### Move (手)

```typescript
// 盤上の駒を動かす手
interface BoardMove {
  kind: 'BOARD'
  from: Square
  to: Square
  promote: boolean   // 成りを選択したか
}

// 持ち駒を打つ手
interface DropMove {
  kind: 'DROP'
  pieceType: PieceType  // 打つ駒の種類（成る前）
  to: Square
}

type Move = BoardMove | DropMove
```

---

### GameRecord (棋譜エントリ)

```typescript
interface GameRecordEntry {
  moveNumber: number   // 手数（1から開始）
  move: Move
  player: PlayerSide
  capturedPiece?: PieceType  // 取った駒（あれば成る前の形）
  timestamp: number          // Unix timestamp (ms)
}
```

---

### GameStatus (対局状態)

```typescript
enum GameStatus {
  ONGOING   = 'ONGOING',    // 対局中
  CHECK     = 'CHECK',      // 王手
  CHECKMATE = 'CHECKMATE',  // 詰み（対局終了）
  DRAW      = 'DRAW',       // 引き分け（千日手）
  RESIGNED  = 'RESIGNED',   // 投了（対局終了）
}
```

---

### GameState (対局全体の状態)

```typescript
interface GameState {
  board: Board
  hands: {
    [PlayerSide.SENTE]: Hand
    [PlayerSide.GOTE]: Hand
  }
  currentTurn: PlayerSide
  status: GameStatus
  winner?: PlayerSide        // CHECKMATE または RESIGNED の場合に設定
  moveHistory: GameRecordEntry[]
  positionHistory: string[]  // 千日手検知用（局面ハッシュのリスト）
}
```

**不変条件**:
- `status` が CHECKMATE または RESIGNED の場合、`winner` が必ず設定されている
- `status` が DRAW の場合、`winner` は undefined
- `positionHistory` の長さは `moveHistory` の長さ + 1（初期局面を含む）

---

### GameMode (対局モード)

```typescript
enum GameMode {
  HUMAN_VS_HUMAN    = 'HUMAN_VS_HUMAN',
  HUMAN_VS_COMPUTER = 'HUMAN_VS_COMPUTER',
}

interface GameConfig {
  mode: GameMode
  sentePlayer: Player
  gotePlayer: Player
}
```

---

## 状態遷移図

```
[対局設定] ─── startGame() ───→ [ONGOING]
                                     │
                          ┌──────────┼──────────┐
                          │          │          │
                      makeMove()  makeMove()  resign()
                          │          │          │
                       [ONGOING]  [CHECK]   [RESIGNED]
                                     │
                                  makeMove()
                                     │
                        ┌────────────┴────────────┐
                        │                         │
                   [CHECKMATE]               [ONGOING]
                                                  │
                              （千日手検知）
                                                  │
                                              [DRAW]
```

---

## エンティティ関係図

```
GameConfig
  ├── sentePlayer: Player
  └── gotePlayer: Player

GameState
  ├── board: Board (9×9 grid of Piece|null)
  ├── hands
  │   ├── SENTE: Hand (Map<PieceType, number>)
  │   └── GOTE: Hand (Map<PieceType, number>)
  ├── currentTurn: PlayerSide
  ├── status: GameStatus
  ├── winner?: PlayerSide
  ├── moveHistory: GameRecordEntry[]
  └── positionHistory: string[]

Move (union)
  ├── BoardMove { kind, from: Square, to: Square, promote }
  └── DropMove  { kind, pieceType, to: Square }
```
