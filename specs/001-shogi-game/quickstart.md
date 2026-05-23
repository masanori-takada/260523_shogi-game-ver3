# Quickstart: 将棋ゲーム

**Branch**: `001-shogi-game` | **Date**: 2026-05-23

## 前提条件

- Node.js 20 以上
- npm 9 以上（または pnpm / yarn）

## セットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動（ホットリロード付き）
npm run dev
# → http://localhost:5173 でブラウザが開く
```

## テストの実行

```bash
# 全テスト実行
npm run test

# ウォッチモード（開発中）
npm run test:watch

# カバレッジ付き
npm run test:coverage
```

## ビルド

```bash
# プロダクションビルド
npm run build
# → dist/ に静的ファイルが生成される

# ビルド結果のプレビュー
npm run preview
```

## プロジェクト構成

```text
shogi/
├── index.html              # エントリーHTML
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.ts             # アプリケーションエントリーポイント
│   ├── types/
│   │   └── index.ts        # 全型定義（PieceType, Move, GameState 等）
│   ├── core/               # ゲームエンジン（副作用なし・純粋関数）
│   │   ├── board.ts        # 盤面操作ユーティリティ
│   │   ├── piece.ts        # 駒の動き定義
│   │   ├── move-generator.ts # 合法手生成
│   │   ├── rules.ts        # ルール検証（禁じ手・成り・千日手）
│   │   ├── game.ts         # GameEngine 実装
│   │   └── game-record.ts  # 棋譜フォーマット
│   ├── ai/                 # AIエンジン
│   │   ├── engine.ts       # AIEngine 実装
│   │   ├── minimax.ts      # Minimax + αβ枝刈り
│   │   └── evaluator.ts    # 局面評価関数
│   └── ui/                 # UIレイヤー
│       ├── app.ts          # アプリケーション初期化
│       ├── board-view.ts   # 盤面描画
│       ├── piece-view.ts   # 駒描画
│       ├── hand-view.ts    # 持ち駒エリア描画
│       └── controller.ts  # UIController 実装
└── tests/
    ├── unit/
    │   ├── core/
    │   │   ├── move-generator.test.ts
    │   │   ├── rules.test.ts
    │   │   └── game.test.ts
    │   └── ai/
    │       └── evaluator.test.ts
    └── integration/
        ├── game-flow.test.ts  # 対局フロー統合テスト
        └── ai-game.test.ts   # AI対戦統合テスト
```

## 実装上の注意事項

### ゲームエンジンは副作用フリーに保つ

`src/core/` の関数はすべて純粋関数として実装すること。
`applyMove()` は既存の `GameState` を変更せず、新しいオブジェクトを返す。

```typescript
// 良い例
const newState = gameEngine.applyMove(currentState, move)

// 悪い例（直接変更しない）
currentState.board[row][col] = piece  // NG
```

### AI は Web Worker で動かすことを推奨

AI の深い探索（上級: 深さ4以上）はメインスレッドをブロックする可能性がある。
`getBestMoveAsync()` は Web Worker を使って非同期実行することを検討すること。

### テストを先に書く（TDD）

`tests/unit/core/move-generator.test.ts` から始める:

```typescript
describe('getLegalMoves', () => {
  it('初期局面で先手の歩は1マス前に移動できる', () => {
    const state = gameEngine.startGame(config)
    const moves = gameEngine.getLegalMoves(state, { row: 6, col: 4 })  // 5七の歩
    expect(moves).toContainEqual({
      kind: 'BOARD',
      from: { row: 6, col: 4 },
      to: { row: 5, col: 4 },
      promote: false,
    })
  })
})
```

## 動作確認チェックリスト

実装完了後、以下を手動で確認すること:

- [ ] ブラウザで `http://localhost:5173` を開き、盤面が正しく表示される
- [ ] 「人間対人間」モードで対局を開始し、先手が初手を指せる
- [ ] 合法手がハイライト表示される
- [ ] 相手の駒を取ると持ち駒エリアに表示される
- [ ] 相手陣に入ると成り/不成の選択が表示される
- [ ] 持ち駒を選択すると打てるマスがハイライトされる
- [ ] 二歩を打とうとするとハイライトされない
- [ ] 「AI対戦」モードで対局を開始し、AIが自動で応手する
- [ ] 詰みの局面で対局終了画面が表示される
- [ ] 投了ボタンから対局を終了できる
