# Contract: CouncilEngine（合議制AIエンジン）

**Branch**: `002-council-ai-agents` | **Date**: 2026-05-24

---

## 概要

`CouncilEngine` は三軍師合議制AIの外部インターフェースです。
既存の `AIEngine` と同じ呼び出しインターフェースを持ちながら、内部で3体のサブエージェント（猛将・智将・審判）と総大将による合議を実行します。

---

## CouncilEngine クラス

```typescript
// src/ai/council/council-engine.ts

export class CouncilEngine {
  /**
   * 合議制で最善手を計算する（非同期）
   * UIControllerから呼び出される
   *
   * @param state   現在の局面
   * @param side    AIの手番（SENTE | GOTE）
   * @param apiKey  Anthropic APIキー（未指定時はenv変数を使用）
   * @returns       審議結果（最終手を含む）
   * @throws        CouncilTimeoutError（10秒超過時 → フォールバック後に解決）
   */
  async deliberate(
    state: GameState,
    side: PlayerSide,
    apiKey?: string,
  ): Promise<CouncilDecision>
}
```

---

## サブエージェント関数のコントラクト

### attackerPropose（猛将）

```typescript
// src/ai/council/attacker.ts

/**
 * 攻撃的評価で候補手を提案する
 * - 相手玉への詰みを優先探索（mateSearch）
 * - 駒得スコアを最大化するMinimax
 * - 自玉の安全度は考慮しない
 *
 * @param state  現在の局面
 * @param side   AIの手番
 * @param depth  探索深度（2=初級相当 / 4=上級相当）
 */
export function attackerPropose(
  state: GameState,
  side: PlayerSide,
  depth: number,
): SubAgentProposal
```

**評価関数の重み付け**（既存 `evaluate()` ベース + 攻撃バイアス）:
- 駒の価値差: +1.0x（標準）
- 相手玉への距離ボーナス: +0.5x（近いほど高評価）
- 詰み発見: +100000（最優先）
- 自玉の安全度: **無視**（0x）

---

### defenderPropose（智将）

```typescript
// src/ai/council/defender.ts

/**
 * 防御的評価で候補手を提案する
 * - 自玉の安全度を最大化
 * - 相手の詰めろ（次の手で詰む脅威）を解除
 * - 相手の攻め駒を遠ざける
 *
 * @param state  現在の局面
 * @param side   AIの手番
 * @param depth  探索深度
 */
export function defenderPropose(
  state: GameState,
  side: PlayerSide,
  depth: number,
): SubAgentProposal
```

**評価関数の重み付け**（防御バイアス）:
- 駒の価値差: +0.5x（低減）
- 自玉周辺の金銀枚数: +2.0x（最重視）
- 自玉への相手駒の距離: +1.0x（遠いほど高評価）
- 詰めろ解除: +50000（最優先）

---

### strategistAssess（審判）

```typescript
// src/ai/council/strategist.ts

/**
 * 局面の形勢判断と危険度評価を行う
 * - 将棋格言に基づく評価
 * - 自玉の金銀枚数チェック
 * - 相手の詰めろ検知
 *
 * @param state  現在の局面
 * @param side   AIの手番（評価する側）
 */
export function strategistAssess(
  state: GameState,
  side: PlayerSide,
): StrategistAssessment
```

**格言チェックリスト**（順に評価）:

| 格言 | 判定条件 | 重大度 |
|------|---------|--------|
| 玉の守りは金銀3枚 | 自玉周辺金銀 ≤ 2枚 → CAUTION / ≤ 1枚 → DANGER | MAJOR |
| 守りの要は金 | 自玉周辺に金がゼロ | MAJOR |
| 拠点の放置 | 相手のと金・成り駒が自陣2段目以内 | MINOR |
| 飛車先不突き損 | 序盤（手数≤20）で飛車が封鎖 | MINOR |

---

## 総大将エージェント（Strands Agent）のシステムプロンプトコントラクト

```typescript
// src/ai/council/commander.ts

// 総大将エージェントへのシステムプロンプト
const COMMANDER_SYSTEM_PROMPT = `
あなたは将棋の「総大将」です。
3つのツールを使って部下の意見を聞き、以下のルールで最終手を決定してください。

## 意思決定ルール（優先順位順）

RULE-1【危険度優先】:
  審判（strategist）が "DANGER" を報告した場合
  → 猛将の提案がどれだけ良くても、必ず智将の守り手を採用する

RULE-2【詰み優先】:
  猛将（attacker）が mateIn: 3 以下（3手詰み以内）を報告した場合
  → RULE-1より優先して猛将の攻め手を採用する
  （ただし審判がDANGERかつ詰みが確実でない場合はRULE-1を優先）

RULE-3【重み付け統合】:
  上記以外の通常局面
  → 審判の形勢スコアが正（自分有利）なら攻め寄り（猛将:智将 = 7:3）
  → 審判の形勢スコアが負（相手有利）なら守り寄り（猛将:智将 = 3:7）
  → スコアが均衡（±200以内）なら均等（猛将:智将 = 5:5）

## 出力形式
必ず以下のJSON形式で最終手を出力してください：
{
  "selectedMove": <猛将の手 or 智将の手>,
  "appliedRule": "RULE_1" | "RULE_2" | "RULE_3",
  "explanation": "<プレイヤー向けの日本語説明（30文字以内）>"
}
`
```

---

## UIController との統合コントラクト

```typescript
// src/ui/controller.ts の変更点（追加部分のみ）

// CouncilEngine 呼び出し（Difficulty.AGENT_AI 時）
private async maybeCouncilMove(): Promise<void> {
  // 1. isThinking = true、councilSession.isThinking = true
  // 2. CouncilEngine.deliberate(state, side) を呼び出す
  // 3. CouncilDecision を受け取る
  // 4. applyMove(decision.finalMove) を実行
  // 5. UIState.councilSession.currentDecision を更新
  // 6. isThinking = false、councilSession.isThinking = false
}
```

---

## CouncilPanel UI コントラクト

```typescript
// src/ui/council-panel.ts

export class CouncilPanel {
  /**
   * パネルを作成する
   * @param container  パネルのマウント先 HTMLElement
   */
  constructor(container: HTMLElement)

  /**
   * 審議中状態を表示（各エージェントに「思考中...」を表示）
   */
  showThinking(): void

  /**
   * 審議結果を表示
   * @param decision  CouncilDecision（総大将の最終判断）
   */
  showDecision(decision: CouncilDecision): void

  /**
   * パネルをリセット（次の手番に備える）
   */
  reset(): void
}
```

---

## モードバッジ コントラクト

総大将の意思決定が下るたびに、盤面ヘッダーの手番インジケーター横にバッジを表示する。

```typescript
export type AIMode = 'ATTACK' | 'DEFENSE' | 'BALANCE'

/**
 * CommanderRule → AIMode のマッピング
 */
export const RULE_TO_MODE: Record<CommanderRule, AIMode> = {
  [CommanderRule.RULE_1_DANGER_DEFENSE]:  'DEFENSE',  // 守りモード
  [CommanderRule.RULE_2_CHECKMATE_FIRST]: 'ATTACK',   // 攻めモード
  [CommanderRule.RULE_3_WEIGHTED]:        'BALANCE',  // 形勢判断モード
}

/**
 * AIMode → 表示テキスト・スタイルのマッピング
 */
export const MODE_DISPLAY: Record<AIMode, { label: string; cssClass: string }> = {
  ATTACK:  { label: '⚔️ 攻めモード',     cssClass: 'mode-attack'  },   // 橙背景
  DEFENSE: { label: '🛡️ 守りモード',     cssClass: 'mode-defense' },   // 赤背景
  BALANCE: { label: '⚖️ 形勢判断モード', cssClass: 'mode-balance' },   // 青背景
}
```

**バッジの更新タイミング**:
1. エージェントAI思考開始 → バッジを「⏳ 審議中...」に切り替え
2. 審議完了・着手 → バッジを当該モード（攻め/守り/形勢判断）に更新
3. 次の手番（人間番）→ バッジはそのまま残す（前回の判断を参照できるように）

---

## パネルのHTML構造

```html
<!-- 盤面ヘッダー（既存 turn-indicator の横に追加） -->
<div class="game-header">
  <span class="turn-indicator" id="turn-indicator">後手の番</span>
  <!-- ★ 新規: AIモードバッジ（エージェントAIモード時のみ表示） -->
  <span class="ai-mode-badge mode-balance" id="ai-mode-badge">⚖️ 形勢判断モード</span>
  <button class="resign-btn" id="btn-resign">投了</button>
</div>

<!-- 三軍師の審議パネル（盤面右側に追加） -->
<div class="council-panel">
  <h3 class="council-title">👑 三軍師の審議</h3>

  <div class="council-agent attacker">
    <span class="agent-icon">🗡️</span>
    <span class="agent-name">猛将（攻め）</span>
    <span class="agent-move">７六歩</span>
    <span class="agent-score">+320</span>
    <span class="agent-mate">詰み: なし</span>
  </div>

  <div class="council-agent defender">
    <span class="agent-icon">🛡️</span>
    <span class="agent-name">智将（守り）</span>
    <span class="agent-move">６八金</span>
    <span class="agent-score">+150</span>
  </div>

  <div class="council-agent strategist">
    <span class="agent-icon">⚖️</span>
    <span class="agent-name">審判（形勢）</span>
    <span class="danger-level safe">SAFE</span>
    <span class="agent-score">+180</span>
    <span class="proverb-check">格言: ✅ 異常なし</span>
  </div>

  <div class="council-commander">
    <span class="agent-icon">👑</span>
    <span class="agent-name">総大将の裁定</span>
    <!-- ★ モードバッジ（パネル内にも大きく表示） -->
    <span class="mode-badge-large mode-balance">⚖️ 形勢判断モード</span>
    <span class="rule-applied">RULE-3: 重み付け統合</span>
    <span class="final-move">７六歩</span>
    <span class="explanation">形勢互角のため均等判断</span>
  </div>
</div>
```
