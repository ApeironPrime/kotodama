import test from 'node:test'
import assert from 'node:assert/strict'
import { translateJapaneseToVietnamese } from './translation-provider.mjs'

test('translates a Japanese sentence through the configured machine provider', async () => {
  let request
  const translated = await translateJapaneseToVietnamese('授業の前に予習をします。', {
    apiKey: 'test-key',
    model: 'test-model',
    fetchImpl: async (url, options) => {
      request = { url: String(url), options }
      return {
        ok: true,
        json: async () => ({ output_text: '{"translation":"Tôi chuẩn bị bài trước giờ học."}' }),
      }
    },
  })

  assert.equal(translated, 'Tôi chuẩn bị bài trước giờ học.')
  assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/interactions')
  assert.equal(request.options.headers['x-goog-api-key'], 'test-key')
  assert.match(request.options.body, /授業の前に予習をします。/)
  assert.match(request.options.body, /"model":"test-model"/)
})

test('does not call a provider when no machine key is configured', async () => {
  const translated = await translateJapaneseToVietnamese('日本語です。', { apiKey: '' })
  assert.equal(translated, null)
})
