import { describe, it, expect } from 'vitest'
import { geminiFetchJson } from '../../../../../src/ai/council/strands/gemini-fetch.js'
import { subAgentOutputSchema } from '../../../../../src/ai/council/strands/schemas.js'

describe('geminiFetchJson', () => {
  it('API エラー時に throw', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { message: 'invalid key' } }), { status: 403 })

    try {
      await expect(
        geminiFetchJson('bad-key', 'sys', 'user', subAgentOutputSchema),
      ).rejects.toThrow(/403/)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('JSON を Zod 検証して返す', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"moveIndex":0,"score":100,"reasoning":"test"}' }] } }],
        }),
        { status: 200 },
      )

    try {
      const result = await geminiFetchJson('key', 'sys', 'user', subAgentOutputSchema)
      expect(result.moveIndex).toBe(0)
      expect(result.score).toBe(100)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
