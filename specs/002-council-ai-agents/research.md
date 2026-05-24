# Research: 脳内三軍師エージェント（合議制AI）

**Branch**: `002-council-ai-agents` | **Date**: 2026-05-24

---

## Decision 1: Strands Agents TypeScript SDK のブラウザ互換性

**Decision**: `@strands-agents/sdk` v1.0 をブラウザ向けViteプロジェクトに直接インストール・使用する

**Rationale**:
- 公式ブログに「The SDK runs natively in the browser with no server required」と明記
- `agents-as-tools`（`.asTool()` / サブエージェントをツール配列に直接渡す）はv1.0で対応済み
- Node.jsとブラウザの両環境に対応

**Alternatives considered**:
- Python版Strands + FastAPIバックエンド → GitHub Pages静的ホスティングと非互換
- Node.jsスクリプトのみでStrands使用 → ブラウザ上の合議制UIが実装できない

**Installation**:
```bash
npm install @strands-agents/sdk zod
```

---

## Decision 2: モデルプロバイダーの選択

**Decision**: Anthropic モデルプロバイダーを直接使用（Amazon Bedrock 不使用）

**Rationale**:
- Strands v1.0はAmazon Bedrock・OpenAI・Anthropic・Geminiを第一級サポート
- 既存プロジェクトはAnthropicエコシステム（Claude Code）を使用しており一貫性がある
- AWS認証情報の設定が不要なため、開発者体験が向上する

**API Key 管理**:
- 開発環境: `.env.local` の `VITE_ANTHROPIC_API_KEY` 経由でViteに注入
- 本番環境（GitHub Pages）: UIにAPIキー入力フォームを追加（ユーザー自身のキーを使用）
- フォールバック: APIキー未設定時は既存Minimaxエンジンに自動切り替え

**Model**: `claude-haiku-4-5-20251001`（応答速度優先・コスト効率）
- 将棋の意思決定判断には高い推論能力よりも低レイテンシが重要
- 合議は数値評価エンジン（Minimax）が行い、LLMは意思決定ルール適用のみ担当

---

## Decision 3: サブエージェントの実装方針

**Decision**: サブエージェント（猛将・智将・審判）は**純粋TypeScript関数**として実装し、Strands の `tool()` でラップする

**Rationale**:
- 仕様（Assumptions）に「ClaudeのLLMではなく既存の数値評価エンジンを内部で呼び出す」と明記
- Minimaxエンジンは信頼性の高い手を計算できるが、LLMに将棋の指し手を直接考えさせるのは品質が不安定
- Strands `tool()` を使うことで、総大将（Agent）がツール呼び出し結果を言語的に解釈し意思決定できる

**Tool as Sub-Agent パターン**:
```typescript
// サブエージェント = Strands tool() でラップされたTypeScript関数
const attackerTool = tool({
  name: 'get_attacker_proposal',
  description: '猛将（攻め担当）が候補手を提案する',
  inputSchema: z.object({ gameStateJson: z.string() }),
  callback: ({ gameStateJson }) => {
    // 攻撃的Minimaxで計算
    return JSON.stringify(attackerPropose(...))
  }
})

// 総大将 = Strands Agent（意思決定ループ）
const commanderAgent = new Agent({
  tools: [attackerTool, defenderTool, strategistTool],
  systemPrompt: '意思決定ルール（RULE-1/2/3）...',
})
```

---

## Decision 4: 既存コードとの統合方法

**Decision**: 新しい `src/ai/council/` ディレクトリを追加し、既存の `src/ai/` は変更しない

**Rationale**:
- 既存の `AIEngine`・`findBestMove`・`evaluate` は初級/上級モードで引き続き使用
- 「初級」「上級」は今のままで変更不要（ユーザー要件）
- `src/types/index.ts` の `Difficulty` enumに `AGENT_AI = 'AGENT_AI'` を追加するのみ

**影響範囲の最小化**:
- `src/ui/app.ts`: 難易度選択ボタンに「エージェントAI」を追加
- `src/ui/controller.ts`: `Difficulty.AGENT_AI` の分岐を追加（`CouncilEngine`を呼び出す）
- `src/types/index.ts`: `Difficulty` enumに `AGENT_AI` 追加

---

## Decision 5: 三軍師パネルのUI設計

**Decision**: ゲーム画面の右側に新しい `<div class="council-panel">` を追加

**Layout**:
```
[後手持ち駒] [将棋盤9x9] [先手持ち駒] | [三軍師の審議パネル]
```

**パネルの表示内容**:
- 猛将（🗡️）: 候補手・攻め評価スコア
- 智将（🛡️）: 候補手・守り評価スコア
- 審判（⚖️）: 危険度 (SAFE/CAUTION/DANGER)・形勢スコア・格言チェック
- 総大将（👑）: 採用ルール（RULE-1/2/3）・最終手・理由テキスト

**Strands Streaming対応**: LLMの思考過程をリアルタイムでパネルに表示（streaming callback）

---

## Decision 6: タイムアウトとフォールバック

**Decision**: 10秒タイムアウト → 既存Minimaxエンジン（上級）にフォールバック

**実装**:
```typescript
const result = await Promise.race([
  commanderAgent.invoke(prompt),
  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
])
// タイムアウト時は findBestMove(state, side, Difficulty.ADVANCED) を使用
```

---

## Decision 7: 格言チェック（審判の評価ロジック）

**採用する将棋格言**（審判が形勢判断に使用）:
1. **玉の守りは金銀3枚**: 自玉周辺の金銀数が2枚以下 → CAUTION / 1枚以下 → DANGER
2. **飛車先の歩は3七まで**: 飛車の前の歩が進んでいるか（攻勢の指標）
3. **端歩は突いておけ**: 序盤での端歩の有無（機動性の指標）
4. **守りは金、攻めは銀**: 金を攻めに使っていないか（非効率の検知）
5. **拠点の評価**: 相手陣に成り駒・と金が侵入しているか（優勢指標）

**Sources**:
- [Strands Agents TypeScript SDK](https://strandsagents.com/blog/strands-agents-typescript-v1/)
- [Agents as Tools ドキュメント](https://strandsagents.com/docs/user-guide/concepts/multi-agent/agents-as-tools/)
- [TypeScript SDK GitHub](https://github.com/strands-agents/sdk-typescript)
- [AWS Open Source Blog - Strands 1.0](https://aws.amazon.com/blogs/opensource/introducing-strands-agents-1-0-production-ready-multi-agent-orchestration-made-simple/)
