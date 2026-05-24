# Quickstart: 脳内三軍師エージェント（合議制AI）

**Branch**: `002-council-ai-agents` | **Date**: 2026-05-24

---

## 前提条件

- Node.js 20 以上
- npm 9 以上
- Anthropic API キー（エージェントAIモードの使用に必要）

---

## セットアップ

```bash
# 依存関係のインストール（Strands SDK + Zod を追加）
npm install @strands-agents/sdk zod

# Anthropic APIキーの設定（開発環境）
# .env.local ファイルを作成
echo "VITE_ANTHROPIC_API_KEY=sk-ant-..." > .env.local

# 開発サーバー起動
npm run dev
# → http://localhost:5173 でブラウザが開く
```

---

## エージェントAIモードの動作確認

1. ブラウザで `http://localhost:5173` を開く
2. 「人間対AI」をクリック
3. 難易度選択で「エージェントAI」をクリック
4. 対局開始後、先手（人間）が一手指す
5. 画面右側の「三軍師の審議」パネルに各エージェントの意見が表示される
6. 総大将が最終手を決定し、後手（AI）が着手する

---

## プロジェクト構成（新規追加分）

```text
src/
├── ai/
│   └── council/                        # 新規: 三軍師合議制エンジン
│       ├── types.ts                    # 合議制専用型定義
│       ├── attacker.ts                 # 猛将（攻め担当サブエージェント）
│       ├── defender.ts                 # 智将（守り担当サブエージェント）
│       ├── strategist.ts               # 審判（形勢判断サブエージェント）
│       ├── commander.ts                # 総大将（Strands Agent・意思決定）
│       └── council-engine.ts           # CouncilEngine（外部インターフェース）
└── ui/
    └── council-panel.ts                # 新規: 三軍師審議パネルUI

tests/
├── unit/ai/
│   └── council/
│       ├── attacker.test.ts            # 猛将の単体テスト
│       ├── defender.test.ts            # 智将の単体テスト
│       ├── strategist.test.ts          # 審判の単体テスト
│       └── commander.test.ts           # 総大将のルールテスト
└── integration/
    └── council-game.test.ts            # 合議制AI対戦統合テスト
```

---

## 動作確認チェックリスト

実装完了後、以下を手動で確認すること:

- [ ] 難易度選択画面に「初級」「上級」「エージェントAI」の3択が表示される
- [ ] 「初級」「上級」を選ぶと三軍師パネルが表示されない（従来動作を維持）
- [ ] 「エージェントAI」を選ぶと三軍師パネルが表示される
- [ ] パネルに猛将🗡️・智将🛡️・審判⚖️・総大将👑の4者が表示される
- [ ] DANGER局面で智将の手が採用され「⚠️ 危険度高：智将の守り手を採用」が表示される
- [ ] 3手詰みで猛将の手が採用され「✅ 詰み発見：猛将の攻め手を最優先」が表示される
- [ ] APIキー未設定時にフォールバック（Minimax）で動作し、パネルに「⚡ フォールバック中」と表示される
- [ ] 既存の「初級」「上級」テスト（37件）が引き続きパスする
