// ============================================================
// Strands GoogleModel ファクトリ
// ⚠️ APIキーはブラウザに露出します（個人利用専用）
// ============================================================

import { GoogleModel } from '@strands-agents/sdk/models/google'

/** 全 Strands Agent で共通の Gemini モデル ID */
export const STRANDS_GEMINI_MODEL = 'gemini-2.0-flash-lite'

/** APIキーから GoogleModel インスタンスを生成 */
export function createGoogleModel(apiKey: string): GoogleModel {
  return new GoogleModel({
    apiKey,
    modelId: STRANDS_GEMINI_MODEL,
    params: {
      temperature: 0.4,
      maxOutputTokens: 512,
    },
  })
}
