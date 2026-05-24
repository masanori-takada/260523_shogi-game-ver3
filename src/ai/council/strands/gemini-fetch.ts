// ============================================================
// ブラウザネイティブ Gemini REST API（fetch）
// PC/スマホ共通 — Strands SDK / Node SDK 不要
// ⚠️ APIキーはブラウザに露出します（個人利用専用）
// ============================================================

import type { z } from 'zod'

/** 全 LLM 呼び出しで共通の Gemini モデル ID */
export const GEMINI_MODEL_ID = 'gemini-3.1-flash-lite'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
  }>
  error?: { message?: string }
}

/** Gemini generateContent → JSON を Zod で検証 */
export async function geminiFetchJson<T>(
  apiKey: string,
  systemInstruction: string,
  userMessage: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const url = `${GEMINI_BASE}/models/${GEMINI_MODEL_ID}:generateContent?key=${encodeURIComponent(apiKey)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 256,
        responseMimeType: 'application/json',
      },
    }),
  })

  const body = (await res.json()) as GeminiResponse

  if (!res.ok) {
    const msg = body.error?.message ?? res.statusText
    throw new Error(`Gemini API ${res.status}: ${msg}`)
  }

  const text = body.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('Gemini API: empty response')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`Gemini API: invalid JSON: ${text.slice(0, 120)}`)
  }

  return schema.parse(parsed)
}
