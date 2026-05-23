# Implementation Plan: 将棋ゲーム (Shogi Game)

**Branch**: `001-shogi-game` | **Date**: 2026-05-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-shogi-game/spec.md`

## Summary

ブラウザで動作する将棋ゲームを実装する。人間対人間・人間対AI（初級/上級）の両対局モードを提供し、
将棋の全ルール（合法手生成・成り・持ち駒・禁じ手・詰み判定）を正確に実装する。

技術スタック: TypeScript 5.x + Vite 5.x（フレームワークなし）。ゲームエンジンは純粋関数で構成し、
AIは Minimax + αβ枝刈りで実装する。

## Technical Context

**Language/Version**: TypeScript 5.x

**Primary Dependencies**:
- Vite 5.x (ビルドツール・開発サーバー)
- Vitest 1.x (テストフレームワーク)
- jsdom (Vitest のブラウザ環境シミュレート用)

外部依存は最小限。将棋ロジックもAIエンジンも自前実装。

**Storage**: In-memory（ゲーム状態）+ localStorage（難易度設定のみ）

**Testing**: Vitest + jsdom（ユニットテスト・統合テスト）

**Target Platform**: モダンWebブラウザ（Chrome / Firefox / Safari / Edge 最新版）

**Project Type**: Web application（クライアントサイドSPA、サーバー不要）

**Performance Goals**:
- AI応手時間: 初級 < 1秒、上級 < 5秒
- UI 操作応答: 即時（< 16ms）
- バンドルサイズ: < 2MB

**Constraints**:
- サーバー不要（静的ファイルのみ）
- オフラインで動作すること
- スマートフォンブラウザでも基本操作が可能であること

**Scale/Scope**: シングルページ、ローカル対戦（ネットワーク不要）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Feature has an approved `spec.md` with at least one independently testable user story
  - ✅ 5本のユーザーストーリーあり、すべて独立検証可能
- [x] P1 user story is clearly identified and constitutes a standalone MVP
  - ✅ P1「対局を開始して駒を動かす」= 盤面表示・駒移動・手番管理のみで対局体験が成立
- [x] All user stories are independently testable and deliverable without cross-story dependencies
  - ✅ P2（成り）、P3（持ち駒打ち）、P4（AI対戦）、P5（詰み判定）それぞれ独立して追加可能
- [x] Test tasks are listed before implementation tasks for every user story
  - ✅ tasks.md で各ユーザーストーリーのテストタスクを実装タスクより先に配置すること（tasks フェーズで対応）
- [x] All specification artifacts are scoped to the feature branch
  - ✅ ブランチ `001-shogi-game` に全スペックファイルをコミット

**Constitution Check: 全項目 PASS ✅**

## Project Structure

### Documentation (this feature)

```text
specs/001-shogi-game/
├── plan.md              # このファイル（/speckit-plan コマンド出力）
├── spec.md              # フィーチャー仕様
├── research.md          # Phase 0 調査結果
├── data-model.md        # Phase 1 データモデル
├── quickstart.md        # Phase 1 クイックスタートガイド
├── contracts/
│   └── game-engine.md   # Phase 1 ゲームエンジンAPIコントラクト
├── checklists/
│   └── requirements.md  # スペック品質チェックリスト
└── tasks.md             # Phase 2 タスクリスト（/speckit-tasks コマンドで生成）
```

### Source Code (repository root)

```text
shogi/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.ts
│   ├── types/
│   │   └── index.ts          # PieceType, PlayerSide, Move, GameState 等
│   ├── core/                 # ゲームエンジン（純粋関数・副作用なし）
│   │   ├── board.ts          # 盤面操作ユーティリティ
│   │   ├── piece.ts          # 各駒の動き定義
│   │   ├── move-generator.ts # 合法手生成
│   │   ├── rules.ts          # ルール検証（禁じ手・強制成り・千日手）
│   │   ├── game.ts           # GameEngine 実装
│   │   └── game-record.ts    # 棋譜管理・エクスポート
│   ├── ai/                   # AIエンジン
│   │   ├── engine.ts         # AIEngine インターフェース実装
│   │   ├── minimax.ts        # Minimax + αβ枝刈り
│   │   └── evaluator.ts      # 局面評価関数
│   └── ui/                   # UIレイヤー
│       ├── app.ts            # アプリケーション初期化・対局設定画面
│       ├── board-view.ts     # 盤面描画（DOM操作）
│       ├── piece-view.ts     # 駒の描画・ハイライト
│       ├── hand-view.ts      # 持ち駒エリア描画
│       └── controller.ts    # UIController 実装
└── tests/
    ├── unit/
    │   ├── core/
    │   │   ├── move-generator.test.ts  # 合法手生成のユニットテスト
    │   │   ├── rules.test.ts           # 禁じ手・詰み判定のユニットテスト
    │   │   └── game.test.ts            # GameEngine のユニットテスト
    │   └── ai/
    │       └── evaluator.test.ts       # 評価関数のユニットテスト
    └── integration/
        ├── game-flow.test.ts           # 対局フロー統合テスト（人間対人間）
        └── ai-game.test.ts             # AI対戦統合テスト
```

**Structure Decision**: シングルプロジェクト構成（Option 1）を選択。
バックエンドサーバーが不要なため、`src/` + `tests/` のフラット構成が最適。

## Complexity Tracking

> Constitution Check に違反なし。このセクションは不要。
