import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { NhaiKanjiService } from './nhaikanji-service.mjs'

test('NhaiKanjiService normalizes levelled Mazii Kanji courses for the existing API', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kotodama-kanji-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.mkdirSync(path.join(root, 'courses'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'courses', 'kanji_all_levels.json'),
    JSON.stringify([
      {
        id: 'n5-day',
        kanji: '日',
        level: 'N5',
        mean: 'NHẬT, NHỰT',
        on: 'ニチ ジツ',
        kun: 'ひ -び -か',
        stroke_count: '4',
        detail: 'mặt trời; ngày',
        examples: [{ w: '日本', p: ' にほん', m: 'Nhật Bản', h: 'NHẬT BẢN' }],
      },
      {
        id: 'n4-language',
        kanji: '語',
        level: 'N4',
        mean: 'NGỮ',
        on: 'ゴ',
        kun: 'かた.る',
        stroke_count: 14,
        detail: 'ngôn ngữ; từ',
        comp: '言五',
        compDetail: [
          { w: '言', h: 'NGÔN' },
          { w: '五', h: 'NGŨ' },
        ],
        examples: [{ w: '日本語', p: ' にほんご', m: 'tiếng Nhật', h: 'NHẬT BẢN NGỮ' }],
      },
    ])
  )

  const service = new NhaiKanjiService({ mazziDataPath: root, dataPath: path.join(root, 'legacy') })
  const n5 = service.getKanjiList({ level: 'N5', limit: 10 })
  assert.equal(n5.total, 1)
  assert.equal(n5.items[0].kanji, '日')
  assert.equal(n5.items[0].meaning_vi, 'Nhật Bản')

  const searchNgu = service.getKanjiList({ query: 'ngu', limit: 10 })
  assert.equal(searchNgu.total, 1)
  assert.equal(searchNgu.items[0].kanji, '語')

  const detail = service.getKanjiDetail('語')
  assert.equal(detail.summary.hanzi, 'NGỮ')
  assert.equal(detail.detail.kanjiInfo.jlptLevel, 'N4')
  assert.equal(detail.detail.kanjiInfo.kanjialiveData.examples[0].reading, 'にほんご')
  assert.equal(detail.detail.kanjiInfo.kanjialiveData.examples[0].meaning, 'tiếng Nhật')
  assert.equal(detail.detail.kanjiInfo.story, 'Cấu tạo: 言 (NGÔN) + 五 (NGŨ)')
})

test('NhaiKanjiService loads canonical repo fixtures with N5/N4 isolation and detail verification', () => {
  const fixturePath = fileURLToPath(new URL('./fixtures/nhaikanji', import.meta.url))
  const service = new NhaiKanjiService({ dataPath: fixturePath, mazziDataPath: '' })

  // 1. N5 Kanji list contains 土 and 日, excludes N4 kanji
  const n5 = service.getKanjiList({ level: 'N5', limit: 5 })
  assert.ok(n5.items.length > 0, 'N5 list must have items')
  assert.ok(n5.items.some((k) => k.kanji === '土'), 'N5 list must contain 土')
  assert.ok(n5.items.some((k) => k.kanji === '日'), 'N5 list must contain 日')
  assert.equal(n5.items.some((k) => k.kanji === '語'), false, 'N5 list must not contain N4 kanji 語')
  assert.equal(n5.items.every((k) => k.jlpt_level === 'N5'), true, 'All N5 items must have level N5')

  // 2. N4 Kanji list contains 語, excludes N5 kanji
  const n4 = service.getKanjiList({ level: 'N4', limit: 5 })
  assert.ok(n4.items.length > 0, 'N4 list must have items')
  assert.ok(n4.items.some((k) => k.kanji === '語'), 'N4 list must contain 語')
  assert.equal(n4.items.some((k) => k.kanji === '土'), false, 'N4 list must not contain N5 kanji 土')
  assert.equal(n4.items.every((k) => k.jlpt_level === 'N4'), true, 'All N4 items must have level N4')

  // 3. Kanji Detail for 土
  const detailTho = service.getKanjiDetail('土')
  assert.ok(detailTho, 'Must find detail for 土')
  assert.equal(detailTho.kanji, '土')
  assert.equal(detailTho.summary.hanzi, 'THỔ')
  assert.equal(detailTho.summary.meaning_vi, 'Đất')
  assert.ok(detailTho.detail, 'Must have full detail for 土')
  assert.equal(detailTho.detail.kanjiInfo.jlptLevel, 'N5')
  assert.ok(detailTho.detail.kanjiInfo.kanjialiveData.examples.length > 0, 'Must have vocab examples')
  assert.equal(detailTho.detail.kanjiInfo.kanjialiveData.examples[0].word, '土')

  // 4. Kanji Detail for non-existent kanji returns null
  assert.equal(service.getKanjiDetail('NON_EXISTENT_KANJI'), null)

  // 5. Bunpo list N4 contains んです and isolates from N5
  const bunpoN4 = service.getBunpoList({ level: 'N4', limit: 5 })
  assert.ok(bunpoN4.items.length > 0, 'N4 Bunpo must have items')
  assert.ok(bunpoN4.items.some((b) => b.pattern.includes('んです')), 'N4 Bunpo must contain んです')
  assert.equal(bunpoN4.items.some((b) => b.level === 'N5'), false, 'N4 Bunpo must not contain N5 items')

  // 6. Bunpo list N5 contains です and isolates from N4
  const bunpoN5 = service.getBunpoList({ level: 'N5', limit: 5 })
  assert.ok(bunpoN5.items.length > 0, 'N5 Bunpo must have items')
  assert.ok(bunpoN5.items.some((b) => b.pattern.includes('です')), 'N5 Bunpo must contain です')
  assert.equal(bunpoN5.items.some((b) => b.level === 'N4'), false, 'N5 Bunpo must not contain N4 items')

  // 7. JLPT Exams returns array
  const exams = service.getJlptExams({ level: 'N4' })
  assert.ok(Array.isArray(exams.exams), 'Exams must be an array')
})

test('NhaiKanjiService does not crash and does not fabricate data when data source is omitted', () => {
  const prevEnv = process.env.NHAIKANJI_DATA_PATH
  delete process.env.NHAIKANJI_DATA_PATH
  try {
    const service = new NhaiKanjiService()
    const n5 = service.getKanjiList({ level: 'N5', limit: 5 })
    assert.deepEqual(n5.items, [], 'Must return empty items without data source')
    assert.equal(n5.total, 0, 'Total must be 0')
    assert.equal(service.getKanjiDetail('土'), null, 'Must return null for detail without data source')

    const bunpoN4 = service.getBunpoList({ level: 'N4', limit: 5 })
    assert.deepEqual(bunpoN4.items, [], 'Must return empty bunpo items without data source')
    assert.equal(bunpoN4.total, 0, 'Bunpo total must be 0')
  } finally {
    if (prevEnv !== undefined) {
      process.env.NHAIKANJI_DATA_PATH = prevEnv
    } else {
      delete process.env.NHAIKANJI_DATA_PATH
    }
  }
})

test('NhaiKanjiService safely handles non-existent or empty dataPath without throwing', () => {
  const emptyService = new NhaiKanjiService({ dataPath: '/non/existent/path/for/kotodama/test', mazziDataPath: '' })

  const list = emptyService.getKanjiList({ level: 'N5' })
  assert.deepEqual(list.items, [])
  assert.equal(list.total, 0)

  const detail = emptyService.getKanjiDetail('土')
  assert.equal(detail, null)

  const bunpo = emptyService.getBunpoList({ level: 'N4' })
  assert.deepEqual(bunpo.items, [])
  assert.equal(bunpo.total, 0)
})
