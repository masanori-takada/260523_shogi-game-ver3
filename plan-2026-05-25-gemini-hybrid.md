# LLM+Minimax ハイブリッド合議制エンジン 実装プラン（Gemini版）

## Context

現在の三軍師AI（猛将・智将・審判・総大将）は、Gemini API削除後に純粋なルールベース関数として実装されている。
以下の方針でGemini 2.0 Flash Liteを使ったLLMハイブリッド実装に切り替える：

- **サブエージェント（猛将・智将・審判）**: 手の選択はMinimax維持、`reasoning`の生成のみGeminiで豊かにする
- **総大将（オーケストレーター）**: GeminiのFunctionCalling（Strands相当）を使い、3つのtoolを呼び出してRULE-1/2/3を言語的に判断
- **使用モデル**: `gemini-3.1-flash-lite`（全LLM呼び出し共通）
- **APIキー**: `AIzaSyAuh9PthQSPxDpCQYF1Zb1xz3YqmE5RNCg`（開発用ハードコード、環境変数 `VITE_GEMINI_API_KEY` でも取得）
- **SDK**: `@google/generative-ai`（Strands SDKはGeminiネイティブ非対応のため不使用）
- APIキー未設定時は現在のルールベース実装にフォールバック

> ⚠️ セキュリティ注意: APIキーはブラウザ側に露出。個人利用プロジェクトとして許容するがコードにコメントで警告を明記する。

---

## アーキテクチャ全体図

```
CouncilEngine.deliberate()
  │
  ├── [Promise.all 並列 Phase 1]
  │     ├── attackerProposeHybrid()    Minimax→手/スコア + Gemini→reasoning生成
  │     ├── defenderProposeHybrid()    Minimax→手/スコア + Gemini→reasoning生成
  │     └── strategistAssessHybrid()   格言計算 + Gemini→summary生成
  │           ↑ 各Gemini: gemini-3.1-flash-lite (全モデル共通), maxOutputTokens=150, 個別2500msタイムアウト
  │
  └── [Phase 2] GeminiCommanderAgent.decide()
        GeminiのFunctionCalling（Strands tool相当）
        ├── function: get_attacker_proposal    → SubAgentProposalをJSONで返す
        ├── function: get_defender_proposal    → SubAgentProposalをJSONで返す
        └── function: get_strategist_assessment → StrategistAssessmentをJSONで返す
        GeminiがRULE-1/2/3を適用 → JSON形式で型安全に返却
        ↑ gemini-3.1-flash-lite (全モデル共通), maxOutputTokens=512, 2500msタイムアウト
```

**タイムアウト設計**（5秒制限内に収まる）:
- Phase 1（3Gemini並列）: 最大~1000ms（Gemini Flash Liteは高速）
- Phase 2（GeminiFunctionCalling）: 最大~1200ms
- 合計推定: ~2200ms（5秒の余裕あり）

---

## 新規追加ファイル

### `src/ai/council/board-text.ts`
盤面テキスト化ユーティリティ（LLMへの入力生成、純粋関数）:
```typescript
export function boardToText(state: GameState): string
// 9×9のASCII将棋盤（後手駒は「v歩」形式）

export function moveToText(move: Move): string
// 「7六歩」「4五銀打」「5五角成」等の棋譜表記

export function gameStateToPromptContext(state: GameState, side: PlayerSide): string
// boardToText + 持ち駒 + 直前の手 を結合した完全コンテキスト文字列
```

### `src/ai/council/llm-reasoning.ts`
各サブエージェント向けGemini reasoning生成:
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

export type AgentPersona = 'attacker' | 'defender' | 'strategist'
export interface LLMReasoningContext {
  persona: AgentPersona
  boardText: string
  proposedMoveText: string
  score: number
  mateIn?: number
  dangerLevel?: DangerLevel
  proverbViolations?: string[]
}

export async function generateLLMReasoning(
  ctx: LLMReasoningContext,
  apiKey: string,
): Promise<string>
// モデル: gemini-3.1-flash-lite（全呼び出し共通）, maxOutputTokens=150
// 失敗時throw → 呼び出し元でフォールバック
```

### `src/ai/council/gemini-commander.ts`
GeminiFunctionCallingによる総大将オーケストレーター:
```typescript
import { GoogleGenerativeAI, FunctionDeclaration } from '@google/generative-ai'

export async function geminiCommanderDecide(
  attacker: SubAgentProposal,
  defender: SubAgentProposal,
  strategist: StrategistAssessment,
  state: GameState,
  apiKey: string,
): Promise<{
  finalMove: Move
  ruleExplanation: string
  commanderRule: CommanderRule
  aiMode: AIMode
}>

// FunctionDeclaration（Strands tool相当）を3つ定義:
//   get_attacker_proposal / get_defender_proposal / get_strategist_assessment
// Geminiがfunction_callを要求 → callbackでSubAgentProposal/Assessmentを返す
// Geminiの最終レスポンスをJSONパースして finalMove を決定
```

---

## 変更ファイル一覧

### `src/ai/council/attacker.ts`
- `attackerPropose()` は**変更なし**（既存テスト保護）
- 追加: `attackerProposeHybrid(state, side, depth, apiKey?): Promise<SubAgentProposal>`
  - Minimaxで move/score/mateIn を計算
  - `generateLLMReasoning({ persona: 'attacker', ... })` でreasoningを上書き
  - LLM失敗時はテンプレートreasoningのままフォールバック

### `src/ai/council/defender.ts`
- `defenderPropose()` は**変更なし**
- 追加: `defenderProposeHybrid(state, side, depth, apiKey?): Promise<SubAgentProposal>`

### `src/ai/council/strategist.ts`
- `strategistAssess()` は**変更なし**
- 追加: `strategistAssessHybrid(state, side, apiKey?): Promise<StrategistAssessment>`
  - LLMでsummaryフィールドを上書き、他のフィールドは既存計算のまま維持

### `src/ai/council/commander.ts`
- `applyCommanderRules()` は**変更なし**（既存テスト保護）
- 変更なし（gemini-commander.tsを別ファイルに完全分離）

### `src/ai/council/council-engine.ts`
- `private apiKey: string | undefined` フィールドを追加
- コンストラクタで `resolveApiKey()` を使いAPIキー解決:
  ```typescript
  function resolveApiKey(explicit?: string): string | undefined {
    if (explicit) return explicit
    // Vite環境変数（ビルド時埋め込み）
    if (import.meta.env?.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY
    // localStorage（UIフォームから保存）
    return localStorage.getItem('shogi-gemini-api-key') ?? undefined
  }
  ```
- `_runCouncil()` 内を切り替え:
  ```typescript
  const useHybrid = !!this.apiKey
  const [attacker, defender, strategist] = await Promise.all([
    useHybrid ? attackerProposeHybrid(state, side, AGENT_SEARCH_DEPTH, this.apiKey)
              : Promise.resolve(attackerPropose(state, side, AGENT_SEARCH_DEPTH)),
    useHybrid ? defenderProposeHybrid(state, side, AGENT_SEARCH_DEPTH, this.apiKey)
              : Promise.resolve(defenderPropose(state, side, AGENT_SEARCH_DEPTH)),
    useHybrid ? strategistAssessHybrid(state, side, this.apiKey)
              : Promise.resolve(strategistAssess(state, side)),
  ])
  const commanderResult = useHybrid
    ? await geminiCommanderDecide(attacker, defender, strategist, state, this.apiKey!)
    : applyCommanderRules(attacker, defender, strategist, state)
  ```
- `TIMEOUT_MS = 5000` は変更なし

### `package.json`
- 追加: `@google/generative-ai`
- Strands SDK / Anthropic SDK は追加しない

### `src/ui/app.ts` / `src/ui/controller.ts`
- `CouncilEngine` にAPIキーを渡す（`VITE_GEMINI_API_KEY` または開発用ハードコードキー）
- ※今回はUIフォームなしで環境変数 + ハードコードキーのみ対応

---

## APIキー設定

開発用（`src/ai/council/council-engine.ts` または `llm-reasoning.ts` 内）:
```typescript
// ⚠️ WARNING: This API key is exposed in browser. For personal use only.
const DEV_API_KEY = 'AIzaSyAuh9PthQSPxDpCQYF1Zb1xz3YqmE5RNCg'
```

本番用（`.env.local`）:
```
VITE_GEMINI_API_KEY=AIzaSyAuh9PthQSPxDpCQYF1Zb1xz3YqmE5RNCg
```

優先度: `VITE_GEMINI_API_KEY` 環境変数 > DEV_API_KEY ハードコード

---

## LLMプロンプト設計

### サブエージェント共通（gemini-3.1-flash-lite、maxOutputTokens: 150）

**猛将（attacker）**:
```
[system] あなたは将棋AIの「猛将」。攻撃担当。60字以内で攻め手の理由を日本語で簡潔に説明してください。
[user]
【局面】{boardText}
【提案手】{moveText}
【攻撃スコア】{score}
{mateIn ? `【詰み】${mateIn}手詰み発見` : ''}
この手の攻撃的な意図を60字以内で説明してください。
```

**智将（defender）**:
```
[system] あなたは将棋AIの「智将」。守り担当。60字以内で守り手の理由を日本語で簡潔に説明してください。
[user]
【局面】{boardText}
【危険度】{dangerLevel}
【提案手】{moveText}
【防御スコア】{score}
この手の守備的な意図を60字以内で説明してください。
```

**審判（strategist）**:
```
[system] あなたは将棋AIの「審判」。局面全体を客観評価。80字以内で形勢を日本語で説明してください。
[user]
【局面】{boardText}
【形勢スコア】{positionalScore}（正=先手有利、負=後手有利）
【格言違反】{violations.join('、') || 'なし'}
局面の形勢を80字以内で評価してください。
```

### 総大将（GeminiFunctionCalling、gemini-3.1-flash-lite、maxOutputTokens: 512）

```
[system]
あなたは将棋AIの「総大将」です。3つのfunction（get_attacker_proposal, get_defender_proposal, get_strategist_assessment）を必ずすべて呼び出し、以下のルールを適用して最終手を決定してください。

RULE-1（最優先）: 審判のdangerLevelが「DANGER」→ 智将の手を採用
RULE-2（第二優先）: 猛将がmateIn <= 3を発見 → 猛将の手を採用  
RULE-3（通常）: 形勢スコアと各スコアを比較して判断

最終回答は以下のJSONで返してください：
{"selectedAgent":"attacker"|"defender","appliedRule":"RULE_1"|"RULE_2"|"RULE_3","explanation":"採用理由（日本語100字以内）"}

[user] 三軍師の意見を収集し、RULEを適用して最終手を決定してください。
```

---

## フォールバック戦略（階層）

| レベル | 条件 | 動作 |
|--------|------|------|
| 0 | APIキー未設定 | 従来ルールベース（applyCommanderRules + テンプレートreasoning）|
| 1 | 正常動作 | Hybrid（Minimax + Gemini reasoning + GeminiFunctionCalling Commander）|
| 2 | reasoning生成失敗のみ | move/scoreはMinimax、reasoningはテンプレートにフォールバック |
| 3 | GeminiCommander失敗 | applyCommanderRules()にフォールバック |
| 4 | 全体5秒タイムアウト | _fallbackDecision()→findBestMove()（現状維持）|

---

## 実装順序

1. `src/ai/council/board-text.ts`（依存なし・純粋関数）
2. `package.json` に `@google/generative-ai` を追加（`npm install @google/generative-ai`）
3. `src/ai/council/llm-reasoning.ts`（board-text.ts依存）
4. `attacker.ts` / `defender.ts` / `strategist.ts` にHybrid関数を追加
5. `src/ai/council/gemini-commander.ts`（GeminiFunctionCalling総大将）
6. `council-engine.ts` の切り替えロジック実装（APIキー解決 + useHybrid分岐）
7. `src/ui/controller.ts` の CouncilEngine初期化にAPIキーを渡す
8. テストファイルの追加

---

## テスト戦略

**既存テストへの影響**: なし（既存関数は変更しない）

**新規テスト**:
- `tests/unit/ai/council/board-text.test.ts` — 純粋関数（LLM不要）
- `tests/unit/ai/council/llm-reasoning.test.ts` — `@google/generative-ai` をvi.mockでモック
- `tests/unit/ai/council/gemini-commander.test.ts` — FunctionCalling呼び出しをvi.mockでモック
- `tests/unit/ai/council/attacker-hybrid.test.ts` — LLMフォールバック動作の確認
- `tests/integration/council-hybrid.test.ts` — APIキーなし=フォールバック動作の確認

---

## 検証方法

1. `npm test` で既存37件のテストがパスすることを確認
2. `npm run dev` 起動（APIキーはハードコード済みまたは `.env.local` に設定）
3. ブラウザで「エージェントAI」を選択して対局
4. 三軍師パネルのreasoningがGemini生成テキスト（文脈を踏まえた日本語）になっていることを確認
5. ネットワークオフラインで対局し、フォールバック動作（テンプレートreasoning）を確認
