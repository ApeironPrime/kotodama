import test from 'node:test'
import assert from 'node:assert/strict'
import { createDictionaryService, romajiToHiragana } from './dictionary-service.mjs'
import { readConfig } from './config.mjs'

test('romajiToHiragana converts Japanese romanization correctly', () => {
  assert.equal(romajiToHiragana('gakkou'), 'がっこう')
  assert.equal(romajiToHiragana('watashi'), 'わたし')
  assert.equal(romajiToHiragana('taberu'), 'たべる')
  assert.equal(romajiToHiragana('arigatou'), 'ありがとう')
})

test('dictionaryService connects and queries vocabulary, kanji and examples', async () => {
  const config = readConfig()
  const dict = createDictionaryService(config.dictionary.dbPath)

  if (!dict.available) {
    return
  }

  // 1. Search by Kanji
  const kanjiResults = await dict.search('学校', { limit: 5 })
  assert.ok(kanjiResults.length > 0)
  assert.equal(kanjiResults[0].word, '学校')
  assert.equal(kanjiResults[0].reading, 'がっこう')
  assert.ok(kanjiResults[0].kanjis.length >= 2)

  // 2. Search by Romaji
  const romajiResults = await dict.search('gakkou', { limit: 5 })
  assert.ok(romajiResults.length > 0)
  assert.equal(romajiResults[0].word, '学校')

  // 3. Word detail
  const wordDetail = await dict.getWordDetail('先生')
  assert.ok(wordDetail)
  assert.ok(wordDetail.kanjis.length >= 2)

  // 4. Kanji detail
  const kanjiDetail = dict.getKanjiDetail('学')
  assert.ok(kanjiDetail)
  assert.equal(kanjiDetail.character, '学')
  assert.ok(kanjiDetail.hanViet)
})
