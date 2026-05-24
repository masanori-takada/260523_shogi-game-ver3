# Data Model: 脳内三軍師エージェント（合議制AI）

**Branch**: `002-council-ai-agents` | **Date**: 2026-05-24

---

## 新規型定義（`src/ai/council/types.ts`）

### SubAgentProposal（サブエージェントの提案）

```typescript
export interface SubAgentProposal {
  move: Move           // 候補手（既存型）
  score: number        // 評価スコア（正=有利、負=不利）
  role: AgentRole      // ATTACKER | DEFENDER
  reasoning: string    // 評価の理由（パネル表示用テキスト）
  mateIn?: number      // 詰み手数（猛将のみ、見つかれば設定）
}

export enum AgentRole {
  ATTACKER  = 'ATTACKER',   // 猛将
  DEFENDER  = 'DEFENDER',   // 智将
  STRATEGIST = 'STRATEGIST', // 審判
}
```

### StrategistAssessment（審判の評価結果）

```typescript
export type DangerLevel = 'SAFE' | 'CAUTION' | 'DANGER'

export interface ProverbViolation {
  proverb: string     // 違反した格言テキスト
  severity: 'MINOR' | 'MAJOR'
}

export interface StrategistAssessment {
  dangerLevel: DangerLevel      // 自玉の危険度
  positionalScore: number       // 形勢スコア（正=有利）
  proverbViolations: ProverbViolation[]  // 格言違反リスト
  summary: string               // パネル表示用サマリーテキスト
}
```

### CommanderRule（総大将の意思決定ルール）

```typescript
export enum CommanderRule {
  RULE_1_DANGER_DEFENSE  = 'RULE_1', // 危険度HIGH → 智将手を強制採用
  RULE_2_CHECKMATE_FIRST = 'RULE_2', // 3手詰み発見 → 猛将手を最優先
  RULE_3_WEIGHTED        = 'RULE_3', // 通常 → 形勢スコアで重み付け統合
}
```

### AIMode（画面表示用のモード名称）

```typescript
export type AIMode = 'ATTACK' | 'DEFENSE' | 'BALANCE'

// CommanderRule → AIMode マッピング
// RULE_1（危険回避） → DEFENSE（守りモード）
// RULE_2（詰み優先） → ATTACK（攻めモード）
// RULE_3（重み付け） → BALANCE（形勢判断モード）
```

### CouncilDecision（一手番の審議結果・合議の最終出力）

```typescript
export interface CouncilDecision {
  attackerProposal: SubAgentProposal      // 猛将の提案
  defenderProposal: SubAgentProposal      // 智将の提案
  strategistAssessment: StrategistAssessment  // 審判の評価
  commanderRule: CommanderRule            // 総大将が適用したルール
  aiMode: AIMode                          // ★ 画面表示用モード（攻め/守り/形勢判断）
  finalMove: Move                         // 採用された最終手
  ruleExplanation: string                 // ルール適用理由（パネル表示用）
  isFallback: boolean                     // タイムアウト時のフォールバックフラグ
}
```

### CouncilSession（審議セッション状態）

```typescript
export interface CouncilSession {
  isThinking: boolean              // 審議中フラグ
  currentDecision?: CouncilDecision  // 最新の審議結果
  decisionHistory: CouncilDecision[] // 全手番の審議ログ
}
```

---

## 既存型の変更（`src/types/index.ts`）

### Difficulty enum の拡張

```typescript
export enum Difficulty {
  BEGINNER  = 'BEGINNER',   // 初級: Minimax 深さ2（変更なし）
  ADVANCED  = 'ADVANCED',   // 上級: Minimax 深さ4（変更なし）
  AGENT_AI  = 'AGENT_AI',   // ★新規: 三軍師合議制エンジン
}
```

### UIState の拡張

```typescript
export interface UIState {
  // 既存フィールド（変更なし）
  gameState: GameState
  selectedSquare: Square | null
  selectedHandPiece: PieceType | null
  highlightedSquares: Square[]
  isThinking: boolean
  pendingPromotion: { move: BoardMove } | null

  // ★新規フィールド
  councilSession?: CouncilSession  // エージェントAIモード時のみ設定
}
```

---

## エンティティ関係図

```
GameState (既存)
    │
    ├── 使用 ──→ SubAgentProposal (猛将・智将)
    │                  │
    │                  └── Move (既存)
    │
    ├── 使用 ──→ StrategistAssessment (審判)
    │
    └── 生成 ──→ CouncilDecision (総大将)
                       │
                       ├── attackerProposal: SubAgentProposal
                       ├── defenderProposal: SubAgentProposal
                       ├── strategistAssessment: StrategistAssessment
                       ├── commanderRule: CommanderRule
                       └── finalMove: Move (既存)

UIState (既存・拡張)
    └── councilSession?: CouncilSession
                            └── currentDecision: CouncilDecision
```

---

## 状態遷移

### CouncilSession の状態遷移

```
[初期状態]
  isThinking: false
  currentDecision: undefined
        │
        │ AI手番開始
        ▼
[審議中]
  isThinking: true
  currentDecision: undefined（前回の結果を保持）
        │
        │ 審議完了
        ▼
[審議完了]
  isThinking: false
  currentDecision: CouncilDecision（最新結果）
  decisionHistory: [..., CouncilDecision]
```

### DangerLevel の判定基準

```
SAFE:    自玉周辺金銀 ≥ 3枚 AND 格言違反なし
CAUTION: 自玉周辺金銀 = 2枚 OR 格言違反1件以上
DANGER:  自玉周辺金銀 ≤ 1枚 OR 相手の詰めろがかかっている
```
