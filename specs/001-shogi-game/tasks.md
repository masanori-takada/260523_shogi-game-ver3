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

- [ ] T001 `package.json` を作成し Vite 5.x・Vitest 1.x・TypeScript 5.x・jsdom を依存関係として追加（`npm init` + `npm install`）
- [ ] T002 `tsconfig.json` を作成（strict モード、ES2022、DOM lib）
- [ ] T003 [P] `vite.config.ts` を作成（Vitest の jsdom 環境設定含む）
- [ ] T004 [P] `index.html` を作成（エントリーHTML、`<div id="app">` + `<script type="module" src="/src/main.ts">`）

---

## Phase 2: Foundational（共通基盤 — 全ストーリーのブロッカー）

**Purpose**: 全ユーザーストーリーが依存する型定義・盤面・駒定義・王手検知

**⚠️ CRITICAL**: このフェーズが完了するまでいかなるユーザーストーリーの実装も開始しないこと

- [ ] T005 `src/types/index.ts` を作成（`PieceType`・`PlayerSide`・`PlayerType`・`Difficulty`・`Square`・`Piece`・`Board`・`Hand`・`Move`・`BoardMove`・`DropMove`・`GameStatus`・`GameState`・`GameConfig`・`GameMode`・`GameRecordEntry`・`UIState` の全型定義を `data-model.md` に基づいて実装）
- [ ] T006 [P] `src/core/board.ts` を作成（`createInitialBoard(): Board`・`copyBoard(): Board`・`getPiece(): Piece|null`・`setPiece()`・`squareToKey()` ユーティリティ関数）
- [ ] T007 [P] `src/core/piece.ts` を作成（各駒種の移動ベクトル定義・`canPromote()`・`demote()`・`pieceValue()` 関数）
- [ ] T008 `src/core/rules.ts` を作成し `isInCheck(board, hands, side): boolean` を実装（王の位置を求め、相手の全駒が攻撃できるかを判定）
- [ ] T009 `src/core/move-generator.ts` を作成し `filterSelfKillMoves()` を実装（候補手のうち自殺手となるものを除外するフィルタ）

**Checkpoint**: 型定義・盤面操作・王手判定が完成 — ユーザーストーリー実装を開始できる

---

## Phase 3: User Story 1 — 対局を開始して駒を動かす (Priority: P1) 🎯 MVP

**Goal**: 2人のプレイヤーが盤面で交互に駒を動かして対局できる（成り・持ち駒なし）

**Independent Test**: 対局を開始し、先手が初手を指し、後手が応手を指せれば US1 は独立して検証完了

### Tests for User Story 1 ⚠️ テストを先に書き、FAIL を確認すること

- [ ] T010 [P] [US1] `tests/unit/core/game.test.ts` を作成し `startGame()` の契約テストを実装（初期盤面の駒配置・先手手番・持ち駒空を検証）
- [ ] T011 [P] [US1] `tests/unit/core/move-generator.test.ts` を作成し初期局面の合法手生成テストを実装（先手歩の1マス前移動・桂馬の跳び・飛車の縦横など主要駒を検証）
- [ ] T012 [P] [US1] `tests/integration/game-flow.test.ts` を作成し「対局開始 → 先手初手 → 後手応手」フローの統合テストを実装

### Implementation for User Story 1

- [ ] T013 [US1] `src/core/move-generator.ts` に全駒種の盤上移動合法手生成を実装（歩・香・桂・銀・金・角・飛・玉の移動ベクトルと移動可能マスの列挙）
- [ ] T014 [US1] `src/core/game.ts` を作成し `GameEngine` クラスを実装: `startGame(config): GameState`（初期局面生成・プレイヤー設定）
- [ ] T015 [US1] `src/core/game.ts` に `getLegalMoves(state, square?): Move[]` を実装（盤上移動のみ、T009 の自殺手フィルタ適用）
- [ ] T016 [US1] `src/core/game.ts` に `applyMove(state, move): GameState` を実装（駒移動・手番交代・駒取り時の持ち駒追加・`IllegalMoveError` スロー）
- [ ] T017 [US1] `src/core/game.ts` に `isLegalMove(state, move): boolean` を実装（`getLegalMoves` の結果から判定）
- [ ] T018 [P] [US1] `src/ui/board-view.ts` を作成（9×9 盤面の DOM 生成・駒の配置描画・マスのクリックイベント発火）
- [ ] T019 [P] [US1] `src/ui/piece-view.ts` を作成（駒のテキスト/記号表示・先手後手の向き反転・選択ハイライト・合法手ハイライト描画）
- [ ] T020 [P] [US1] `src/ui/hand-view.ts` を作成（持ち駒エリアの DOM 生成・駒種と枚数の表示）
- [ ] T021 [US1] `src/ui/controller.ts` を作成し `UIController` を実装（マス選択 → ハイライト → 移動実行 → 手番交代の一連のフロー）
- [ ] T022 [US1] `src/ui/app.ts` を作成（対局モード選択画面 → 対局画面への遷移・`GameEngine` と `UIController` の初期化）
- [ ] T023 [US1] `src/main.ts` を作成（`app.ts` の起動エントリーポイント）
- [ ] T024 [US1] `src/ui/styles.css` を作成（盤面・駒・ハイライトの基本スタイル）

**Checkpoint**: この時点で US1 は単独で機能する。ブラウザで対局を開始し2人が交互に指せることを確認すること

---

## Phase 4: User Story 2 — 駒を成る (Priority: P2)

**Goal**: 相手陣に入った駒を成り駒に変えることができる

**Independent Test**: 歩を相手陣3段目まで進め、成り/不成を選択できれば US2 は独立して検証完了

### Tests for User Story 2 ⚠️ テストを先に書き、FAIL を確認すること

- [ ] T025 [P] [US2] `tests/unit/core/rules.test.ts` を作成し成りルールの単体テストを実装（成れるマスの判定・強制成り・金・玉は成れないことを検証）

### Implementation for User Story 2

- [ ] T026 [US2] `src/core/rules.ts` に `canPromote(piece, from, to): boolean`・`mustPromote(piece, to): boolean` を実装（相手陣への出入り判定・行き所のない駒の強制成り）
- [ ] T027 [US2] `src/core/game.ts` の `applyMove()` を更新（成り可能な移動に `promote` フラグを反映・強制成りの場合は自動成り）
- [ ] T028 [US2] `src/ui/controller.ts` を更新（成り可能な移動後に成り選択ダイアログを表示・`onPromotionChoice()` を実装）
- [ ] T029 [US2] `src/ui/app.ts` に成り選択モーダルダイアログを追加（「成る」「不成」ボタン）
- [ ] T030 [US2] `src/core/move-generator.ts` を更新（成り可能な移動には `promote: true` と `promote: false` の2手を生成）

**Checkpoint**: この時点で US1 + US2 が機能する。成り・不成・強制成りを確認すること

---

## Phase 5: User Story 3 — 持ち駒を打つ (Priority: P3)

**Goal**: 取得した持ち駒を盤上の合法マスに打つことができる

**Independent Test**: 相手から歩を取得し、その歩を任意の合法マスに打てれば US3 は独立して検証完了

### Tests for User Story 3 ⚠️ テストを先に書き、FAIL を確認すること

- [ ] T031 [P] [US3] `tests/unit/core/rules.test.ts` に打ち手のルール単体テストを追加（二歩禁止・打ち歩詰め禁止・行き所のない位置への打ち禁止を検証）

### Implementation for User Story 3

- [ ] T032 [US3] `src/core/rules.ts` に `isNifu(board, side, col): boolean`・`isUchifuZume(state, dropMove): boolean` を実装
- [ ] T033 [US3] `src/core/move-generator.ts` に `generateDropMoves(state): DropMove[]` を実装（持ち駒の打ち込み先の合法マスを列挙、禁じ手フィルタ適用）
- [ ] T034 [US3] `src/core/game.ts` の `getLegalMoves()` を更新（`DropMove` を含む全合法手を返す）
- [ ] T035 [US3] `src/core/game.ts` の `applyMove()` を更新（`DropMove` の処理: 持ち駒から減算・盤上に配置）
- [ ] T036 [US3] `src/ui/hand-view.ts` を更新（持ち駒クリックで選択状態にし、打てるマスをハイライト表示）
- [ ] T037 [US3] `src/ui/controller.ts` の `onHandPieceClick()` を実装（持ち駒選択 → `getLegalMoves` でドロップ合法手取得 → ハイライト → `applyMove` で打ち込み）

**Checkpoint**: この時点で US1 + US2 + US3 が機能する。持ち駒の打ち込みと禁じ手拒否を確認すること

---

## Phase 6: User Story 4 — AI（コンピュータ）と対局する (Priority: P4)

**Goal**: AIが自動で応手し、人間 vs コンピュータの対局ができる

**Independent Test**: AIモードを選択し、プレイヤーが一手指した後にAIが合法手を自動で返すことを確認すれば US4 は独立して検証完了

### Tests for User Story 4 ⚠️ テストを先に書き、FAIL を確認すること

- [ ] T038 [P] [US4] `tests/unit/ai/evaluator.test.ts` を作成し評価関数の単体テストを実装（初期局面でスコアが0・駒を取ると自側に有利なスコアになることを検証）
- [ ] T039 [P] [US4] `tests/integration/ai-game.test.ts` を作成し「AI が合法手を返す」統合テストを実装

### Implementation for User Story 4

- [ ] T040 [US4] `src/ai/evaluator.ts` を作成（`evaluate(state, side): number` — 駒の価値合計 + 位置ボーナスによる局面評価関数）
- [ ] T041 [US4] `src/ai/minimax.ts` を作成（Minimax + αβ枝刈りアルゴリズムを実装。初級: 深さ2、上級: 深さ4）
- [ ] T042 [US4] `src/ai/engine.ts` を作成し `AIEngine` クラスを実装: `getBestMoveAsync(state, side, difficulty): Promise<Move>` （Web Worker または `setTimeout` による非同期処理）
- [ ] T043 [US4] `src/ui/app.ts` を更新（AI対戦モード選択時に難易度選択UIを追加・`GameConfig` にAIプレイヤー設定）
- [ ] T044 [US4] `src/ui/controller.ts` を更新（`GameConfig` に基づき現在の手番がAIなら `AIEngine.getBestMoveAsync()` を呼び出して自動着手）
- [ ] T045 [US4] `src/ui/board-view.ts` を更新（AI思考中に「思考中...」インジケーターを表示）

**Checkpoint**: この時点で US1〜US4 が機能する。AI対戦モードで対局が進行することを確認すること

---

## Phase 7: User Story 5 — 勝敗判定と対局終了 (Priority: P5)

**Goal**: 詰み・千日手が正確に検出され勝敗が確定する。投了によっても対局を終了できる

**Independent Test**: 簡単な詰みの局面を再現し、ゲーム終了画面が正しく表示されれば US5 は独立して検証完了

### Tests for User Story 5 ⚠️ テストを先に書き、FAIL を確認すること

- [ ] T046 [P] [US5] `tests/unit/core/rules.test.ts` に `isInCheck` の詳細テストを追加（複数の攻撃パターンを検証）
- [ ] T047 [P] [US5] `tests/unit/core/game.test.ts` に `isCheckmate` の単体テストを追加（詰みの局面・王手だが逃げられる局面・詰みでない局面を検証）

### Implementation for User Story 5

- [ ] T048 [US5] `src/core/game.ts` に `isCheckmate(state, side): boolean` を実装（王手 かつ 合法手ゼロ の場合に true）
- [ ] T049 [US5] `src/core/game.ts` に千日手検知を実装（`positionHistory` で同一局面 4 回出現を検知し `DRAW` 状態に遷移）
- [ ] T050 [US5] `src/core/game.ts` の `applyMove()` を更新（手を適用後に `isInCheck`・`isCheckmate`・千日手判定を実行し `GameStatus` を更新）
- [ ] T051 [US5] `src/core/game.ts` に `resign(state, side): GameState` を実装（`RESIGNED` 状態・勝者設定）
- [ ] T052 [US5] `src/core/game-record.ts` を作成し `exportRecord(state): string` を実装（棋譜テキスト生成）
- [ ] T053 [US5] `src/ui/board-view.ts` を更新（王手時に「王手！」通知を表示）
- [ ] T054 [US5] `src/ui/app.ts` に対局終了画面を追加（勝者表示・棋譜表示・「もう一度」ボタン）
- [ ] T055 [US5] `src/ui/controller.ts` に投了ボタンと確認ダイアログを追加（`onResignConfirm()` 実装）

**Checkpoint**: この時点で全ユーザーストーリーが機能する。詰み・千日手・投了すべての対局終了パターンを確認すること

---

## Phase 8: Polish & Cross-Cutting Concerns（仕上げ）

**Purpose**: 複数ストーリーに跨る横断的な品質改善

- [ ] T056 [P] `src/ui/app.ts` に localStorage を使った難易度設定の保存・復元を追加（キー: `shogi-difficulty`）
- [ ] T057 [P] `src/ui/styles.css` を更新（レスポンシブ対応・モバイルブラウザでの基本操作に対応したタップターゲットサイズ確保）
- [ ] T058 全テスト（`npm run test`）を実行し、すべての単体テスト・統合テストがパスすることを確認
- [ ] T059 プロダクションビルド（`npm run build`）を実行しバンドルサイズが 2MB 以下であることを確認
- [ ] T060 `specs/001-shogi-game/quickstart.md` の手動検証チェックリストをすべて実行し合否を記録

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし — 即座に開始可能
- **Foundational (Phase 2)**: Phase 1 完了後 — 全ユーザーストーリーをブロック
- **US1 (Phase 3)**: Phase 2 完了後
- **US2 (Phase 4)**: Phase 3 完了後（成りは基本的な移動の上に成立する）
- **US3 (Phase 5)**: Phase 3 完了後（持ち駒は駒取りの仕組みが必要）
- **US4 (Phase 6)**: Phase 3 完了後（AIは合法手生成に依存）、US2・US3 と並列可能
- **US5 (Phase 7)**: Phase 3 完了後（詰み判定は王手判定に依存）、US2・US3・US4 と並列可能
- **Polish (Phase 8)**: 全ユーザーストーリー完了後

### User Story Dependencies

- **US1 (P1)**: Phase 2 完了後に開始可能 — 他のストーリーに依存なし
- **US2 (P2)**: US1 完了後（成りは基本移動の拡張）
- **US3 (P3)**: US1 完了後（持ち駒は駒取りロジックの拡張）
- **US4 (P4)**: US1 完了後（AIは合法手生成を使用）— US2/US3 と並列可能
- **US5 (P5)**: US1 完了後（詰みは合法手生成に依存）— US2/US3/US4 と並列可能

### Within Each User Story

1. テストタスクを先に実装し、FAIL を確認する
2. 実装タスクを完了してテストが PASS することを確認する
3. ストーリー完了を確認してから次のストーリーへ進む

### Parallel Opportunities

- Phase 2 の [P] タスク（T006, T007）は並列実行可能
- Phase 3 の UI タスク（T018, T019, T020）と核となるゲームエンジンタスクは並列実行可能
- US4 と US5 は US1 完了後に並列実行可能（異なるファイルを操作するため）

---

## Parallel Example: User Story 1

```
# Phase 2 並列実行（T005 完了後）:
Task: T006 - src/core/board.ts の実装
Task: T007 - src/core/piece.ts の実装

# Phase 3 テスト並列実行（T005-T009 完了後）:
Task: T010 - tests/unit/core/game.test.ts
Task: T011 - tests/unit/core/move-generator.test.ts
Task: T012 - tests/integration/game-flow.test.ts

# Phase 3 UI実装並列実行（T013-T017 完了後）:
Task: T018 - src/ui/board-view.ts
Task: T019 - src/ui/piece-view.ts
Task: T020 - src/ui/hand-view.ts
```

---

## Implementation Strategy

### MVP First（User Story 1 のみ）

1. Phase 1 完了: プロジェクト構成
2. Phase 2 完了: 共通基盤（**CRITICAL** — 後続すべてをブロック）
3. Phase 3 完了: US1「対局を開始して駒を動かす」
4. **STOP & VALIDATE**: ブラウザで2人対局が動作することを確認
5. デモ可能 — ここで一度レビューを受けられる

### Incremental Delivery

1. Setup + Foundational → 基盤完成
2. US1 追加 → 基本対局 MVP！ → デモ
3. US2 追加 → 成り → デモ
4. US3 追加 → 持ち駒 → デモ
5. US4 追加 → AI対戦 → デモ
6. US5 追加 → 勝敗判定 → 完成デモ

---

## Notes

- [P] タスク = 別ファイル、依存なし（並列実行可）
- [Story] ラベルはトレーサビリティのためにユーザーストーリーとタスクを紐付ける
- 各ストーリーは独立して完成・テスト可能であること
- テストは必ず先に書いて FAIL を確認してから実装を開始すること
- 論理的なタスクグループごとにコミットすること
- 各 Checkpoint でストーリーを単独で検証してから次の優先度に進むこと
