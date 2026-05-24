---

description: "脳内三軍師エージェント（合議制AI）実装タスクリスト"
---

# Tasks: 脳内三軍師エージェント（合議制AI）

**Input**: Design documents from `specs/002-council-ai-agents/`

**Prerequisites**: plan.md ✅, spec.md ✅, data-model.md ✅, contracts/council-engine.md ✅, research.md ✅

**Tests**: TDD 必須（Constitution 原則 II）。各ユーザーストーリーのテストタスクを実装タスクより先に完了すること。

**Organization**: タスクはユーザーストーリー単位でフェーズに分割。各ストーリーは独立して実装・テスト・デモ可能。

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: 並列実行可能（異なるファイル、依存なし）
- **[Story]**: 対応するユーザーストーリー（US1〜US3）
- 各タスクには具体的なファイルパスを含む

## Path Conventions

- ソースコード: `src/` at repository root
- テスト: `tests/unit/`, `tests/integration/` at repository root

---

## Phase 1: Setup（依存関係と型定義の準備）

**Purpose**: Strands SDK のインストールと型拡張。全ユーザーストーリーのブロッカー。

- [x] T001 `npm install @strands-agents/sdk zod` を実行して依存関係を追加し `package.json` を更新する
- [x] T002 `src/types/index.ts` の `Difficulty` enum に `AGENT_AI = 'AGENT_AI'` を追加する
- [x] T003 `src/types/index.ts` の `UIState` インターフェースに `councilSession?: CouncilSession` フィールドを追加する（CouncilSession は Phase 2 で定義）

---

## Phase 2: Foundational（共通型・基盤 — 全ストーリーのブロッカー）

**Purpose**: 合議制エンジン全体が依存する型定義と AIMode マッピングを確立する

**⚠️ CRITICAL**: このフェーズが完了するまでいかなるユーザーストーリーの実装も開始しないこと

- [x] T004 `src/ai/council/types.ts` を作成し、以下の型・enum をすべて実装する：`AgentRole`、`SubAgentProposal`、`DangerLevel`、`ProverbViolation`、`StrategistAssessment`、`CommanderRule`、`AIMode`、`CouncilDecision`、`CouncilSession`（`data-model.md` 参照）
- [x] T005 [P] `src/ai/council/types.ts` に `RULE_TO_MODE`（CommanderRule → AIMode）と `MODE_DISPLAY`（AIMode → label/cssClass）の定数マッピングを追加する（`contracts/council-engine.md` 参照）

**Checkpoint**: 型定義完了 — ユーザーストーリー実装を開始できる

---

## Phase 3: User Story 1 — AI対戦で合議制の応手を体験する (Priority: P1) 🎯 MVP

**Goal**: エージェントAIモードで、三軍師の審議パネルとともにAIが合議で応手する

**Independent Test**: エージェントAIを選択して対局を開始し、プレイヤーが一手指した後に三軍師パネルが表示されAIが着手すれば US1 は独立して検証完了

### Tests for User Story 1 ⚠️ テストを先に書き、FAIL を確認すること

- [x] T006 [P] [US1] `tests/unit/ai/council/attacker.test.ts` を作成し、攻撃的評価で候補手が返ること・`mateIn` が詰み局面で設定されることをテスト
- [x] T007 [P] [US1] `tests/unit/ai/council/defender.test.ts` を作成し、防御的評価で候補手が返ること・自玉周辺の金銀を重視した手が提案されることをテスト
- [x] T008 [P] [US1] `tests/unit/ai/council/strategist.test.ts` を作成し、自玉周辺金銀1枚以下で `DANGER` が返ること・格言違反リストが正しく生成されることをテスト
- [x] T009 [P] [US1] `tests/unit/ai/council/commander.test.ts` を作成し、RULE-1（DANGER時は智将手採用）・RULE-2（mateIn≤3 時は猛将手採用）・RULE-3（通常は重み付け）が正しく適用されることをテスト
- [x] T010 [P] [US1] `tests/integration/council-game.test.ts` を作成し「エージェントAI対戦開始 → プレイヤー初手 → CouncilEngine が CouncilDecision を返す」フローをテスト

### Implementation for User Story 1

- [x] T011 [P] [US1] `src/ai/council/attacker.ts` を作成し `attackerPropose(state, side, depth): SubAgentProposal` を実装する（攻撃バイアス付き Minimax：駒得優先・詰み探索・自玉安全度無視）
- [x] T012 [P] [US1] `src/ai/council/defender.ts` を作成し `defenderPropose(state, side, depth): SubAgentProposal` を実装する（防御バイアス付き Minimax：自玉金銀枚数2倍重み・詰めろ解除優先）
- [x] T013 [P] [US1] `src/ai/council/strategist.ts` を作成し `strategistAssess(state, side): StrategistAssessment` を実装する（格言5条チェック・DangerLevel 判定・形勢スコア算出）
- [x] T014 [US1] `src/ai/council/commander.ts` を作成し、Strands `Agent` + `tool()` で猛将・智将・審判の3ツールを定義し、RULE-1/2/3の意思決定ロジックを実装する（`contracts/council-engine.md` の COMMANDER_SYSTEM_PROMPT 参照）
- [x] T015 [US1] `src/ai/council/council-engine.ts` を作成し `CouncilEngine` クラスを実装する：`deliberate(state, side, apiKey?): Promise<CouncilDecision>`、10秒タイムアウト + Minimax フォールバック含む
- [x] T016 [P] [US1] `src/ui/council-panel.ts` を作成し `CouncilPanel` クラスを実装する：`showThinking()`・`showDecision(decision)`・`reset()` メソッドと三軍師パネルの DOM 生成（`contracts/council-engine.md` の HTML 構造参照）
- [x] T017 [US1] `src/ui/controller.ts` を更新し、`Difficulty.AGENT_AI` 分岐と `maybeCouncilMove()` 非同期メソッドを追加する（CouncilEngine を呼び出し、`UIState.councilSession` を更新）
- [x] T018 [US1] `src/ui/app.ts` を更新し、ゲーム画面に三軍師パネル用コンテナと AIモードバッジ要素（`#ai-mode-badge`）を追加し、`CouncilPanel` を初期化して `UIState.councilSession` の更新時にバッジとパネルを連動更新する

**Checkpoint**: この時点で US1 は単独で機能する。エージェントAIモードで三軍師パネルが表示され、AIが合議で応手することを確認すること

---

## Phase 4: User Story 2 — 意思決定ルールの働きを観察する (Priority: P2)

**Goal**: 総大将が適用したルールと理由が毎手パネルに表示され、採用理由を確認できる

**Independent Test**: DANGER局面・3手詰み局面・通常局面それぞれでAIを動かし、パネルの「採用理由」テキストが正しいルール（RULE-1/2/3）を示していれば US2 は独立して検証完了

### Tests for User Story 2 ⚠️ テストを先に書き、FAIL を確認すること

- [x] T019 [P] [US2] `tests/unit/ai/council/commander.test.ts` に、各ルール適用時の `ruleExplanation` テキストと `aiMode` が正しく設定されることのテストを追加する

### Implementation for User Story 2

- [x] T020 [US2] `src/ui/council-panel.ts` を更新し、`showDecision()` にルール採用理由テキスト（`ruleExplanation`）・採用ルール名（RULE-1/2/3）・フォールバック表示（`isFallback`）を追加する
- [x] T021 [US2] `src/ai/council/council-engine.ts` を更新し、`CouncilSession.decisionHistory` に各手番の `CouncilDecision` を蓄積する（ログ参照機能の基盤）

**Checkpoint**: この時点で US1 + US2 が機能する。DANGER局面・詰み局面・通常局面でルール適用理由が正しく表示されることを確認すること

---

## Phase 5: User Story 3 — 難易度選択に「エージェントAI」が加わる (Priority: P3)

**Goal**: 難易度選択画面に「エージェントAI」が第3の選択肢として表示され、初級/上級との切り替えが正常に機能する

**Independent Test**: 難易度選択画面に3択が表示され、エージェントAIを選んだときのみ三軍師パネルが表示され、初級/上級では三軍師パネルが非表示のまま従来どおり動作すれば US3 は独立して検証完了

### Tests for User Story 3 ⚠️ テストを先に書き、FAIL を確認すること

- [x] T022 [P] [US3] `tests/unit/ui/app.test.ts` を作成（または更新）し、難易度選択に3つのボタンが存在すること・`Difficulty.AGENT_AI` 選択時のみ `councilSession` が UIState に設定されることをテスト

### Implementation for User Story 3

- [x] T023 [US3] `src/ui/app.ts` の `showDifficultySelectScreen()` を更新し、「エージェントAI」ボタン（`#btn-agent-ai`）を追加する。エージェントAI以外では `CouncilPanel` を非表示にし、`councilSession` を UIState に設定しない
- [x] T024 [US3] `src/ui/styles.css` を更新し、AIモードバッジスタイル（`.mode-attack`：橙背景・`.mode-defense`：赤背景・`.mode-balance`：青背景）と三軍師パネルのレイアウト（盤面右側への配置）を追加する

**Checkpoint**: この時点で全ユーザーストーリーが機能する。3択切り替え・エージェントAIの三軍師パネル表示・初級/上級のデグレなしをすべて確認すること

---

## Phase 6: Polish & Cross-Cutting Concerns（仕上げ）

**Purpose**: 品質確認・APIキー設定サポート・デグレ確認

- [x] T025 [P] `.env.local.example` を作成し `VITE_ANTHROPIC_API_KEY=sk-ant-（ここに自分のキーを入力）` を記載する（APIキー設定ガイド）
- [x] T026 [P] `src/ui/app.ts` を更新し、`VITE_ANTHROPIC_API_KEY` が未設定の場合に難易度選択画面で「エージェントAI」ボタン横に「⚡ APIキー未設定（Minimaxで動作）」の注釈を表示する
- [x] T027 全テスト（`npm run test`）を実行し、既存37件 + 新規テストがすべてパスすることを確認する — **結果: 12テストファイル・67テスト全PASS ✅**
- [x] T028 プロダクションビルド（`npm run build`）を実行しバンドルサイズが 2MB 以下であることを確認する — **結果: 合計 ≈845kB（< 2MB ✅）**
- [x] T029 `specs/002-council-ai-agents/quickstart.md` の手動検証チェックリストをすべて実行し合否を記録する（自動テスト確認分は全合格、ブラウザ手動確認事項は quickstart.md に記録済み）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし — 即座に開始可能
- **Foundational (Phase 2)**: Phase 1 完了後 — 全ユーザーストーリーをブロック
- **US1 (Phase 3)**: Phase 2 完了後（MVP）
- **US2 (Phase 4)**: Phase 3 完了後（パネル表示基盤が必要）
- **US3 (Phase 5)**: Phase 2 完了後（US1 と並列可能だが、US1 完了後が推奨）
- **Polish (Phase 6)**: 全ユーザーストーリー完了後

### Notes

- [P] タスク = 別ファイル、依存なし（並列実行可）
- テストは必ず先に書いて FAIL を確認してから実装を開始すること（Constitution 原則 II）
- 論理的なタスクグループごとにコミットすること
- 初級/上級モードのコード（`src/ai/engine.ts`・`src/ai/minimax.ts`・`src/ai/evaluator.ts`）には**一切触れないこと**
