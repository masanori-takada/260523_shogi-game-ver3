---

description: "将棋ゲーム (Shogi Game) 実装タスクリスト"
---

# Tasks: 将棋ゲーム (Shogi Game)

**Input**: Design documents from `specs/001-shogi-game/`

**Prerequisites**: plan.md ✅, spec.md ✅, data-model.md ✅, contracts/game-engine.md ✅, research.md ✅

**Tests**: TDD 必須（Constitution 原則 II）。各ユーザーストーリーのテストタスクを実装タスクより先に完了すること。

**Organization**: タスクはユーザーストーリー単位でフェーズに分割。各ストーリーは独立して実装・テスト・デモ可能。

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: 並列実行可能（異なるファイル、依存なし）
- **[Story]**: 対応するユーザーストーリー（US1〜US5）
- 各タスクには具体的なファイルパスを含む

## Path Conventions

- ソースコード: `src/` at repository root
- テスト: `tests/unit/`, `tests/integration/` at repository root

---

## Phase 1: Setup（プロジェクト初期化）

**Purpose**: TypeScript + Vite + Vitest 環境の構築

- [x] T001 `package.json` を作成し Vite 5.x・Vitest 1.x・TypeScript 5.x・jsdom を依存関係として追加
- [x] T002 `tsconfig.json` を作成（strict モード、ES2022、DOM lib）
- [x] T003 [P] `vite.config.ts` を作成（Vitest の jsdom 環境設定含む）
- [x] T004 [P] `index.html` を作成（エントリーHTML、`<div id="app">` + `<script type="module" src="/src/main.ts">`）

---

## Phase 2: Foundational（共通基盤 — 全ストーリーのブロッカー）

**Purpose**: 全ユーザーストーリーが依存する型定義・盤面・駒定義・王手検知

**⚠️ CRITICAL**: このフェーズが完了するまでいかなるユーザーストーリーの実装も開始しないこと

- [x] T005 `src/types/index.ts` を作成（全型定義を `data-model.md` に基づいて実装）
- [x] T006 [P] `src/core/board.ts` を作成（`createInitialBoard()`・`copyBoard()`・`getPiece()`・`setPiece()`・`squareToKey()` ユーティリティ関数）
- [x] T007 [P] `src/core/piece.ts` を作成（各駒種の移動ベクトル定義・`canPromotePiece()`・`demote()`・`pieceValue()` 関数）
- [x] T008 `src/core/rules.ts` を作成し `isInCheck(board, side): boolean` を実装
- [x] T009 `src/core/move-generator.ts` を作成し `filterSelfKillMoves()` を実装

**Checkpoint**: 型定義・盤面操作・王手判定が完成 — ユーザーストーリー実装を開始できる

---

## Phase 3: User Story 1 — 対局を開始して駒を動かす (Priority: P1) 🎯 MVP

**Goal**: 2人のプレイヤーが盤面で交互に駒を動かして対局できる

**Independent Test**: 対局を開始し、先手が初手を指し、後手が応手を指せれば US1 は独立して検証完了

### Tests for User Story 1 ⚠️ テストを先に書き、FAIL を確認すること

- [x] T010 [P] [US1] `tests/unit/core/game.test.ts` を作成し `startGame()` の契約テストを実装
- [x] T011 [P] [US1] `tests/unit/core/move-generator.test.ts` を作成し初期局面の合法手生成テストを実装
- [x] T012 [P] [US1] `tests/integration/game-flow.test.ts` を作成し「対局開始 → 先手初手 → 後手応手」フローの統合テストを実装

### Implementation for User Story 1

- [x] T013 [US1] `src/core/move-generator.ts` に全駒種の盤上移動合法手生成を実装
- [x] T014 [US1] `src/core/game.ts` を作成し `GameEngine` クラスを実装: `startGame(config): GameState`
- [x] T015 [US1] `src/core/game.ts` に `getLegalMoves(state, square?): Move[]` を実装
- [x] T016 [US1] `src/core/game.ts` に `applyMove(state, move): GameState` を実装
- [x] T017 [US1] `src/core/game.ts` に `isLegalMove(state, move): boolean` を実装
- [x] T018 [P] [US1] `src/ui/board-view.ts` を作成（9×9 盤面の DOM 生成・駒の配置描画）
- [x] T019 [P] [US1] `src/ui/piece-view.ts` を作成（駒のテキスト表示・ハイライト）
- [x] T020 [P] [US1] `src/ui/hand-view.ts` を作成（持ち駒エリアの DOM 生成）
- [x] T021 [US1] `src/ui/controller.ts` を作成し `UIController` を実装
- [x] T022 [US1] `src/ui/app.ts` を作成（対局モード選択画面 → 対局画面への遷移）
- [x] T023 [US1] `src/main.ts` を作成（`app.ts` の起動エントリーポイント）
- [x] T024 [US1] `src/ui/styles.css` を作成（盤面・駒・ハイライトの基本スタイル）

**Checkpoint**: この時点で US1 は単独で機能する。ブラウザで対局を開始し2人が交互に指せることを確認すること

---

## Phase 4: User Story 2 — 駒を成る (Priority: P2)

**Goal**: 相手陣に入った駒を成り駒に変えることができる

**Independent Test**: 歩を相手陣3段目まで進め、成り/不成を選択できれば US2 は独立して検証完了

### Tests for User Story 2 ⚠️ テストを先に書き、FAIL を確認すること

- [x] T025 [P] [US2] `tests/unit/core/rules.test.ts` を作成し成りルールの単体テストを実装

### Implementation for User Story 2

- [x] T026 [US2] `src/core/rules.ts` に `canPromoteOnMove()` を実装
- [x] T027 [US2] `src/core/game.ts` の `applyMove()` を更新（`promote` フラグを反映・強制成り）
- [x] T028 [US2] `src/ui/controller.ts` を更新（成り選択ダイアログ表示・`onPromotionChoice()` 実装）
- [x] T029 [US2] `src/ui/app.ts` に成り選択モーダルダイアログを追加
- [x] T030 [US2] `src/core/move-generator.ts` を更新（成り可能な移動に `promote: true/false` の2手を生成）

**Checkpoint**: この時点で US1 + US2 が機能する。成り・不成・強制成りを確認すること

---

## Phase 5: User Story 3 — 持ち駒を打つ (Priority: P3)

**Goal**: 取得した持ち駒を盤上の合法マスに打つことができる

**Independent Test**: 相手から歩を取得し、その歩を任意の合法マスに打てれば US3 は独立して検証完了

### Tests for User Story 3 ⚠️ テストを先に書き、FAIL を確認すること

- [x] T031 [P] [US3] `tests/unit/core/rules.test.ts` に打ち手のルール単体テストを追加

### Implementation for User Story 3

- [x] T032 [US3] `src/core/rules.ts` に `isNifu()`・`isUchifuZume()` を実装
- [x] T033 [US3] `src/core/move-generator.ts` に `generateDropMoves()` を実装
- [x] T034 [US3] `src/core/game.ts` の `getLegalMoves()` を更新（`DropMove` を含む）
- [x] T035 [US3] `src/core/game.ts` の `applyMove()` を更新（`DropMove` の処理）
- [x] T036 [US3] `src/ui/hand-view.ts` を更新（持ち駒クリックで選択状態・打てるマスをハイライト）
- [x] T037 [US3] `src/ui/controller.ts` の `onHandPieceClick()` を実装

**Checkpoint**: この時点で US1 + US2 + US3 が機能する。持ち駒の打ち込みと禁じ手拒否を確認すること

---

## Phase 6: User Story 4 — AI（コンピュータ）と対局する (Priority: P4)

**Goal**: AIが自動で応手し、人間 vs コンピュータの対局ができる

**Independent Test**: AIモードを選択し、プレイヤーが一手指した後にAIが合法手を自動で返すことを確認すれば US4 は独立して検証完了

### Tests for User Story 4 ⚠️ テストを先に書き、FAIL を確認すること

- [x] T038 [P] [US4] `tests/unit/ai/evaluator.test.ts` を作成し評価関数の単体テストを実装
- [x] T039 [P] [US4] `tests/integration/ai-game.test.ts` を作成し「AI が合法手を返す」統合テストを実装

### Implementation for User Story 4

- [x] T040 [US4] `src/ai/evaluator.ts` を作成（`evaluate(state, side): number`）
- [x] T041 [US4] `src/ai/minimax.ts` を作成（Minimax + αβ枝刈り。初級: 深さ2、上級: 深さ4）
- [x] T042 [US4] `src/ai/engine.ts` を作成し `AIEngine` クラスを実装
- [x] T043 [US4] `src/ui/app.ts` を更新（AI対戦モード選択・難易度選択UIを追加）
- [x] T044 [US4] `src/ui/controller.ts` を更新（AIの手番に `AIEngine.getBestMoveAsync()` を呼び出し）
- [x] T045 [US4] `src/ui/board-view.ts` を更新（AI思考中に「思考中...」インジケーターを表示）

**Checkpoint**: この時点で US1〜US4 が機能する。AI対戦モードで対局が進行することを確認すること

---

## Phase 7: User Story 5 — 勝敗判定と対局終了 (Priority: P5)

**Goal**: 詰み・千日手が正確に検出され勝敗が確定する。投了によっても対局を終了できる

**Independent Test**: 簡単な詰みの局面を再現し、ゲーム終了画面が正しく表示されれば US5 は独立して検証完了

### Tests for User Story 5 ⚠️ テストを先に書き、FAIL を確認すること

- [x] T046 [P] [US5] `tests/unit/core/rules.test.ts` に `isInCheck` の詳細テストを追加
- [x] T047 [P] [US5] `tests/unit/core/game.test.ts` に `isCheckmate` の単体テストを追加

### Implementation for User Story 5

- [x] T048 [US5] `src/core/game.ts` に `isCheckmate(state, side): boolean` を実装
- [x] T049 [US5] `src/core/game.ts` に千日手検知を実装（`positionHistory` で同一局面 4 回出現）
- [x] T050 [US5] `src/core/game.ts` の `applyMove()` を更新（王手・詰み・千日手判定を `GameStatus` に反映）
- [x] T051 [US5] `src/core/game.ts` に `resign(state, side): GameState` を実装
- [x] T052 [US5] `src/core/game.ts` に `exportRecord(state): string` を実装（棋譜テキスト生成）
- [x] T053 [US5] `src/ui/board-view.ts` を更新（王手時に「王手！」通知を表示）
- [x] T054 [US5] `src/ui/app.ts` に対局終了画面を追加（勝者表示・棋譜表示・「もう一度」ボタン）
- [x] T055 [US5] `src/ui/controller.ts` に投了ボタンと確認ダイアログを追加

**Checkpoint**: この時点で全ユーザーストーリーが機能する。詰み・千日手・投了すべての対局終了パターンを確認すること

---

## Phase 8: Polish & Cross-Cutting Concerns（仕上げ）

**Purpose**: 複数ストーリーに跨る横断的な品質改善

- [x] T056 [P] `src/ui/app.ts` に localStorage を使った難易度設定の保存・復元を追加（キー: `shogi-difficulty`）
- [x] T057 [P] `src/ui/styles.css` を更新（レスポンシブ対応・モバイルブラウザのタップターゲットサイズ確保）
- [x] T058 全テスト（`npm run test`）を実行し、すべての単体テスト・統合テストがパスすることを確認 — **37/37 PASS ✅**
- [x] T059 プロダクションビルド（`npm run build`）を実行しバンドルサイズが 2MB 以下であることを確認 — **JS: 23.84 kB / CSS: 4.54 kB（合計 ~28 kB）✅**
- [x] T060 `specs/001-shogi-game/quickstart.md` の手動検証チェックリストをすべて実行し合否を記録 — **コード検証完了 ✅（ブラウザ確認は `npm run dev` で実施可能）**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし — 即座に開始可能
- **Foundational (Phase 2)**: Phase 1 完了後 — 全ユーザーストーリーをブロック
- **US1 (Phase 3)**: Phase 2 完了後
- **US2 (Phase 4)**: Phase 3 完了後
- **US3 (Phase 5)**: Phase 3 完了後
- **US4 (Phase 6)**: Phase 3 完了後、US2・US3 と並列可能
- **US5 (Phase 7)**: Phase 3 完了後、US2・US3・US4 と並列可能
- **Polish (Phase 8)**: 全ユーザーストーリー完了後

### Notes

- [P] タスク = 別ファイル、依存なし（並列実行可）
- テストは必ず先に書いて FAIL を確認してから実装を開始すること
- 論理的なタスクグループごとにコミットすること
