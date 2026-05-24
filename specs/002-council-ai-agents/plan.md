# Implementation Plan: 脳内三軍師エージェント（合議制AI）

**Branch**: `002-council-ai-agents` | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-council-ai-agents/spec.md`

---

## Summary

将棋ゲームのAI対戦モードに、役割の異なる3体のサブエージェント（猛将・智将・審判）と親エージェント（総大将）による合議制AIを追加する。難易度選択に「エージェントAI」を新たな第3の選択肢として加え、選択時のみ Strands Agents TypeScript SDK を使った合議制エンジンが起動し、「三軍師の審議」パネルに各エージェントの意見と総大将の最終判断をリアルタイム表示する。「初級」「上級」は一切変更しない。

---

## Technical Context

**Language/Version**: TypeScript 5.4（既存）

**Primary Dependencies**:
- `@strands-agents/sdk` 1.0（新規）— ブラウザネイティブ対応済み
- `zod` 3.x（新規）— ツール入力スキーマ検証
- `vite` 5.x / `vitest` 1.x（既存）

**Storage**: localStorage（難易度設定の保存。既存）

**Testing**: Vitest 1.x + jsdom（既存）

**Target Platform**: ブラウザ（Chrome/Firefox/Safari）+ GitHub Pages

**Project Type**: ブラウザ向けシングルページアプリケーション（SPA）

**Performance Goals**:
- 「エージェントAI」モード: 15秒以内に合議結果を表示
- 「初級」「上級」モード: 従来どおり5秒以内（変更なし）

**Constraints**:
- 「初級」「上級」のコードには一切触れない（既存テスト37件を保護）
- GitHub Pages（静的ホスティング）のため、バックエンドサーバーを追加しない
- APIキー未設定時はMinimaxフォールバックで動作し続ける

**Scale/Scope**: 既存コードベースへの機能追加（新規ファイル 8〜10本）

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Feature has an approved `spec.md` with at least one independently testable user story
- [x] P1 user story is clearly identified and constitutes a standalone MVP（US1: 三軍師パネルを伴う合議制AI対戦）
- [x] All user stories are independently testable and deliverable without cross-story dependencies
- [x] Test tasks are listed before implementation tasks for every user story（tasks.md で担保）
- [x] All specification artifacts are scoped to the feature branch（002-council-ai-agents）

**Constitution Check: PASS ✅**

---

## Project Structure

### Documentation（this feature）

```text
specs/002-council-ai-agents/
├── plan.md              ← このファイル
├── spec.md              ✅ 作成済み
├── research.md          ✅ 作成済み
├── data-model.md        ✅ 作成済み
├── quickstart.md        ✅ 作成済み
├── contracts/
│   └── council-engine.md ✅ 作成済み
├── checklists/
│   └── requirements.md  ✅ 作成済み
└── tasks.md             （/speckit-tasks コマンドで生成）
```

### Source Code（repository root）

```text
src/
├── types/
│   └── index.ts              ← 変更: Difficulty に AGENT_AI 追加、UIState に councilSession 追加
├── ai/
│   ├── evaluator.ts          ← 変更なし
│   ├── minimax.ts            ← 変更なし
│   ├── engine.ts             ← 変更なし
│   └── council/              ← 新規ディレクトリ
│       ├── types.ts          ← 新規: CouncilDecision 等の型定義
│       ├── attacker.ts       ← 新規: 猛将サブエージェント（攻撃的Minimax）
│       ├── defender.ts       ← 新規: 智将サブエージェント（防御的Minimax）
│       ├── strategist.ts     ← 新規: 審判（格言チェック + 形勢スコア）
│       ├── commander.ts      ← 新規: 総大将（Strands Agent + ツール定義）
│       └── council-engine.ts ← 新規: CouncilEngine（UIControllerとのIF）
└── ui/
    ├── app.ts                ← 変更: 難易度選択に「エージェントAI」ボタン追加
    ├── controller.ts         ← 変更: AGENT_AI分岐 + CouncilEngine 呼び出し
    └── council-panel.ts      ← 新規: 三軍師審議パネルUI

tests/
├── unit/ai/
│   └── council/
│       ├── attacker.test.ts       ← 新規
│       ├── defender.test.ts       ← 新規
│       ├── strategist.test.ts     ← 新規
│       └── commander.test.ts      ← 新規（ルール適用ロジック）
└── integration/
    └── council-game.test.ts       ← 新規
```

---

## Architecture: Strands Agents 統合パターン

### 総大将（Strands Agent）+ サブエージェント（tools）の構成

```
UIController.maybeCouncilMove()
    │
    ▼
CouncilEngine.deliberate(state, side)
    │
    ▼
Commander（Strands Agent）
    systemPrompt: 意思決定ルール RULE-1/2/3
    ├── tool: get_attacker_proposal → attackerPropose(state, side, depth)
    ├── tool: get_defender_proposal → defenderPropose(state, side, depth)
    └── tool: get_strategist_assessment → strategistAssess(state, side)
    │
    Agent.invoke("現局面の最善手を三軍師に諮問し、意思決定ルールに従って最終手を決定せよ")
    │
    ▼
LLMがRULE-1/2/3を適用して最終手を選択（JSON出力）
    │
    ▼
CouncilDecision { attackerProposal, defenderProposal, strategistAssessment, finalMove, ruleExplanation }
```

### Strands tool() の実装パターン

```typescript
// commander.ts（概念コード）
import { Agent, tool } from '@strands-agents/sdk'
import z from 'zod'

const attackerTool = tool({
  name: 'get_attacker_proposal',
  description: '猛将（攻め担当）が候補手を提案。詰みと駒得を最優先。',
  inputSchema: z.object({
    gameStateJson: z.string().describe('JSON形式のGameState'),
    depth: z.number().describe('探索深度'),
  }),
  callback: ({ gameStateJson, depth }) => {
    const state = deserializeGameState(gameStateJson)
    return JSON.stringify(attackerPropose(state, side, depth))
  },
})
// 同様に defenderTool, strategistTool を定義

const commanderAgent = new Agent({
  model: { modelId: 'claude-haiku-4-5-20251001', apiKey },
  systemPrompt: COMMANDER_SYSTEM_PROMPT,
  tools: [attackerTool, defenderTool, strategistTool],
})
```

---

## Complexity Tracking

> Constitution Check は全項目 PASS のため、追記事項なし。

---

## Key Design Decisions（research.md からの要約）

| 決定事項 | 採用内容 | 理由 |
|---------|---------|------|
| SDK環境 | ブラウザ直接実行（Strands v1.0） | サーバー不要、ブラウザネイティブ対応済み |
| モデル | Anthropic claude-haiku-4-5（直接） | Bedrock不要、低レイテンシ |
| サブAI実装 | TypeScript数値関数 → Strands tool() | LLMより数値エンジンが信頼性高い |
| 既存コード | 初級/上級は一切変更なし | ユーザー要件・デグレ防止 |
| フォールバック | タイムアウト10秒でMinimax上級相当 | 安定動作の確保 |
| APIキー管理 | .env.local / UIフォーム / フォールバック | GitHub Pages対応 |
