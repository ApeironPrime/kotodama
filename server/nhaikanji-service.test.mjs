import test from 'node:test'
import assert from 'node:assert/strict'
import { NhaiKanjiService } from './nhaikanji-service.mjs'

test('NhaiKanjiService loads data and queries kanji, bunpo, jlpt exams', () => {
  const service = new NhaiKanjiService()
  service.ensureLoaded()

  // Test Kanji list
  const n5Kanji = service.getKanjiList({ level: 'N5', limit: 10 })
  assert.ok(n5Kanji.total > 0, 'Should have N5 kanji')
  assert.ok(n5Kanji.items.length <= 10, 'Should paginate items')

  // Test Kanji search by Hanzi / Vietnamese Tone
  const searchTho = service.getKanjiList({ query: 'tho' })
  assert.ok(searchTho.items.length > 0, 'Should find Kanji by non-accented Hanzi "tho"')
  const hasTho = searchTho.items.some((k) => k.kanji === '土' || k.hanzi.includes('THỔ'))
  assert.ok(hasTho, 'Should find THỔ for "tho"')

  // Test Kanji Detail
  const detail = service.getKanjiDetail('土')
  assert.ok(detail, 'Should find detail for 土')
  assert.equal(detail.kanji, '土')
  assert.ok(detail.summary.meaning_vi.includes('Đất'))
  if (detail.detail) {
    assert.equal(detail.detail.kanjiInfo.hanzi, 'THỔ')
    assert.ok(detail.detail.kanjiInfo.kanjialiveData.examples.length > 0)
  }

  // Test Bunpo list
  const bunpoN4 = service.getBunpoList({ level: 'N4', limit: 5 })
  assert.ok(bunpoN4.total > 0, 'Should have N4 bunpo')

  // Test Bunpo search
  const bunpoSearch = service.getBunpoList({ query: 'んです' })
  assert.ok(bunpoSearch.items.length > 0, 'Should find grammar pattern containing んです')

  // Test JLPT Exams
  const exams = service.getJlptExams({ level: 'N4' })
  assert.ok(Array.isArray(exams.exams), 'Should return exams array')

  // Test JLPT Listening N3
  const listeningExams = service.getJlptExams({ level: 'N3', section: 'listening' })
  assert.ok(Array.isArray(listeningExams.exams), 'Should return listening exams')
  assert.ok(listeningExams.exams.length > 0, 'Should have N3 listening exams')
  const examWithAudio = listeningExams.exams.find((e) => e.audioUrl)
  assert.ok(examWithAudio, 'Should have at least one listening exam with audioUrl')
  assert.equal(examWithAudio.section, 'listening')

  // Test Listening Exam Detail
  const listeningDetail = service.getJlptExamDetail(examWithAudio.id)
  assert.ok(listeningDetail, 'Should get detail for listening exam')
  assert.ok(listeningDetail.parts.length > 0, 'Should have mondai parts')
  const sampleQ = listeningDetail.parts[0].questions[0]
  assert.ok(sampleQ.options.length > 0, 'Should have options')

  // Test Submit Listening Exam
  const submitResult = service.submitJlptExam(examWithAudio.id, { [sampleQ.id]: sampleQ.answer })
  assert.ok(submitResult, 'Should score listening exam')
  assert.ok(submitResult.questionResults.length > 0, 'Should return question results')
  assert.equal(submitResult.questionResults[0].isCorrect, true)

  // Test JLPT Grammar & Reading with Passage
  const grammarReadingExams = service.getJlptExams({ level: 'N3', section: 'grammar-reading' })
  assert.ok(grammarReadingExams.exams.length > 0, 'Should have N3 grammar-reading exams')
  const sampleDokkaiExam = grammarReadingExams.exams[0]
  const dokkaiDetail = service.getJlptExamDetail(sampleDokkaiExam.id)
  assert.ok(dokkaiDetail, 'Should get detail for grammar-reading exam')
  const hasPassage = dokkaiDetail.parts.some((p) => p.passage)
  assert.ok(hasPassage, 'Should have at least one part with a reading passage')
})
