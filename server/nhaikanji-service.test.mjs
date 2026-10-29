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

test('NhaiKanjiService normalizes Hack Nao Kanji JSON dataset correctly', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kotodama-hack-nao-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  const mockFile = path.join(root, 'hack_nao.json')
  fs.writeFileSync(
    mockFile,
    JSON.stringify({
      thong_tin_tong_quan: { tong_so_kanji: 2 },
      N5: [
        {
          stt: 1,
          kanji: '一',
          han_viet: 'NHẤT',
          nghia: 'Một',
          cap_do: 'N5',
          tap: 1,
          am_on: ['イチ'],
          am_kun: ['ひと'],
          so_net: 1,
          bo_thu: '⼀',
          ten_bo_thu: 'いち',
          nghia_bo_thu: 'one',
          cau_chuyen_ghi_nho: '1 (一) bước sang ngang',
          tu_vung_vi_du: [
            {
              tu: '一',
              cach_doc: 'いち',
              han_viet: 'NHẤT',
              nghia: 'Số 1',
              cau_vi_du: '一のつぎは二です。',
              nghia_cau_vi_du: 'Sau số một là số hai.',
            },
          ],
        },
        {
          stt: 2,
          kanji: '二',
          han_viet: 'NHỊ',
          nghia: 'Hai',
          cap_do: 'N5',
          tap: 1,
          am_on: ['ニ'],
          am_kun: ['ふた'],
          so_net: 2,
          bo_thu: '⼆',
          ten_bo_thu: 'に',
          nghia_bo_thu: 'two',
          cau_chuyen_ghi_nho: '2 nét ngang là NHỊ',
          tu_vung_vi_du: [],
        },
      ],
      N4: [],
      N3: [],
      N2: [],
      N1: [],
    })
  )

  const service = new NhaiKanjiService({ kanjiDataPath: mockFile })
  const n5 = service.getKanjiList({ level: 'N5' })
  assert.equal(n5.total, 2)
  assert.equal(n5.items[0].kanji, '一')
  assert.equal(n5.items[0].hanzi, 'NHẤT')
  assert.equal(n5.items[0].story, '1 (一) bước sang ngang')
  assert.equal(n5.items[0].next_kanji, '二')
  assert.equal(n5.items[1].prev_kanji, '一')

  const detail = service.getKanjiDetail('一')
  assert.ok(detail)
  assert.equal(detail.summary.hanzi, 'NHẤT')
  assert.equal(detail.detail.kanjiInfo.kanjialiveData.examples[0].word, '一')
  assert.equal(detail.detail.kanjiInfo.kanjialiveData.examples[0].example, '一のつぎは二です。')
  assert.equal(detail.detail.kanjiInfo.kanjialiveData.examples[0].exampleVi, 'Sau số một là số hai.')
})

test('reviewed 2014 N3 listening explanations are served without the mismatched transcripts', () => {
  const service = new NhaiKanjiService()
  const question = (examId, number) =>
    service
      .getJlptExamDetail(examId)
      .parts.flatMap((part) => part.questions)
      .find((item) => item.number === number)

  const reviewed = question('toan-n3-201312-full', 80)
  assert.equal(reviewed.correctAnswer, 2)
  assert.equal(reviewed.answer, 2)
  assert.equal(reviewed.script, null)
  assert.match(reviewed.explanation, /リストでクラスをかくにんする/)

  for (const examId of ['toan-n3-201407-full', 'toan-n3-201412-full']) {
    for (let number = 75; number <= 102; number++) {
      const reviewedListening = question(examId, number)
      assert.equal(reviewedListening.script, null)
      assert.match(reviewedListening.explanation, /^Đáp án \d+ —/)
      assert.match(reviewedListening.explanation, /Dịch /)
    }
  }

  const correctedKey = question('toan-n3-201412-full', 100)
  assert.equal(correctedKey.correctAnswer, 3)
  assert.equal(correctedKey.answer, 3)
  assert.match(correctedKey.explanation, /khóa dữ liệu 1→3/)
})

test('historical N3 section exams inherit only content-matched N3 explanations', () => {
  const service = new NhaiKanjiService()
  const exam = service.getJlptExamDetail('cm2u2xxmo019t134izzsjxgrl-grammar-reading')
  const question = (number) => exam.parts.flatMap((part) => part.questions).find((item) => item.number === number)

  assert.match(question(36).explanation, /Có chỗ em chưa hiểu rõ cách điền/)
  assert.match(question(39).explanation, /必ず持ってきてください/)
  assert.match(question(43).explanation, /これから出かけるところだから/)
  assert.match(question(46).explanation, /「おります」 là khiêm nhường ngữ của 「いる」/)
  for (const [number, phrase] of [
    [49, 'Nからのメール'],
    [50, '友達がいるので'],
    [51, 'VばVるほど'],
    [52, 'こういう色のかばん'],
    [53, '生活しているという点で'],
  ]) {
    assert.match(question(number).explanation, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')))
  }

  const mismatchedService = new NhaiKanjiService()
  const reload = mismatchedService.reloadFullMaster.bind(mismatchedService)
  mismatchedService.reloadFullMaster = () => {
    reload()
    const sourceExam = mismatchedService.jlptFullMaster.find(
      (item) => item.id === 'cm2u2xxmo019t134izzsjxgrl-grammar-reading'
    )
    const sourceQuestions = sourceExam.parts.flatMap((part) => part.questions || [])
    const mismatchOptions = sourceQuestions.find((item) => item.number === 39)
    mismatchOptions.options[1] = { ...mismatchOptions.options[1], text: '非常' }
    const mismatchPrompt = sourceQuestions.find((item) => item.number === 43)
    mismatchPrompt.question += '異なる文'
    mismatchPrompt.sentence += '異なる文'
    const mismatchStarScript = sourceQuestions.find((item) => item.number === 49)
    mismatchStarScript.script = mismatchStarScript.script.replace('メール', 'めえる')
  }
  const mismatchedExam = mismatchedService.getJlptExamDetail('cm2u2xxmo019t134izzsjxgrl-grammar-reading')
  const mismatchedQuestion = (number) =>
    mismatchedExam.parts.flatMap((part) => part.questions).find((item) => item.number === number)
  assert.equal(mismatchedQuestion(39).explanation, null, 'a changed option must not inherit an explanation')
  assert.equal(mismatchedQuestion(43).explanation, null, 'a changed prompt must not inherit an explanation')
  assert.equal(
    mismatchedQuestion(49).explanation,
    null,
    'a star-order explanation requires the reconstructed script to match'
  )
})

test('N3 December 2016 vocabulary section aligns corrected source options and receives explanations', () => {
  const service = new NhaiKanjiService()
  const section = service.getJlptExamDetail('cm2u2wlnt0097134ira8pl9rk-vocab')
  const source = service.getJlptExamDetail('toan-n3-201612-full')
  const sectionQuestion = (number) =>
    section.parts.flatMap((part) => part.questions || []).find((item) => item.number === number)
  const sourceQuestion = (number) =>
    source.parts.flatMap((part) => part.questions || []).find((item) => item.number === number)

  for (const number of [1, 11, 14, 16, 17, 18, 21, 23, 24, 25, 29, 30]) {
    const actual = sectionQuestion(number)
    const canonical = sourceQuestion(number)
    assert.ok(actual)
    assert.ok(canonical)
    assert.equal(Number(actual.correctAnswer ?? actual.answer), Number(canonical.correctAnswer ?? canonical.answer))
    assert.deepEqual(
      actual.options.map((option) => String(option.text).replace(/\s+/gu, '')),
      canonical.options.map((option) =>
        String(option)
          .replace(/^\s*[1-4][.．、\s　]*/u, '')
          .replace(/\s+/gu, '')
      )
    )
    assert.ok(actual.explanation, `Question ${number} should inherit its curated explanation.`)
  }

  assert.match(sectionQuestion(16).question, /佐藤さん/u)
  assert.match(sectionQuestion(16).explanation, /ấn tượng/u)
  assert.doesNotMatch(sectionQuestion(16).explanation, /Từ điển cục bộ/u)
  assert.match(sectionQuestion(14).question, /赤ちゃん/u)
  assert.match(sectionQuestion(17).question, /（ ）/u)
  assert.match(sectionQuestion(1).explanation, /かんきゃく/u)
  assert.match(sectionQuestion(11).explanation, /「満足」.*hài lòng/su)
  assert.match(sectionQuestion(21).explanation, /tư thế/u)
  assert.doesNotMatch(sectionQuestion(21).explanation, /Từ điển cục bộ/u)
  assert.match(sectionQuestion(18).explanation, /vắng khách/u)
  assert.doesNotMatch(sectionQuestion(18).explanation, /ồn ào/u)
  assert.match(sectionQuestion(24).explanation, /chìm xuống/u)
  assert.doesNotMatch(sectionQuestion(24).explanation, /葫蘆/u)
  assert.match(sectionQuestion(23).question, /野菜/u)
  assert.match(sectionQuestion(25).question, /ずっと（ ）にしていた/u)
  assert.equal(sectionQuestion(29).options[0].text, '多すぎて残りました')
  assert.equal(sectionQuestion(16).options[1].text, 'タイトル')
  assert.equal(sectionQuestion(21).options[3].text, '間隔')
  assert.equal(sectionQuestion(30).correctAnswer, '2')
  assert.equal(sectionQuestion(30).options[1].text, '渡ってはいけません')
  assert.equal(sectionQuestion(30).options[2].text, '走ってはいけません')
})

test('N3 December 2016 grammar section receives source-matched explanations and verified ★ keys', () => {
  const service = new NhaiKanjiService()
  const section = service.getJlptExamDetail('cm2u2wlnt0097134ira8pl9rk-grammar-reading')
  const source = service.getJlptExamDetail('toan-n3-201612-full')
  const sectionQuestion = (number) =>
    section.parts.flatMap((part) => part.questions || []).find((item) => item.number === number)
  const sourceQuestion = (number) =>
    source.parts.flatMap((part) => part.questions || []).find((item) => item.number === number)
  const answerSequence = [2, 4, 3, 1, 4, 2, 3, 2, 3, 1, 2, 4, 1, 2, 4, 2, 1, 3, 3, 4, 1, 3, 2]

  for (let number = 36; number <= 58; number++) {
    const actual = sectionQuestion(number)
    const canonical = sourceQuestion(number)
    assert.ok(actual, `Section question ${number} should exist.`)
    assert.ok(canonical, `Full mock question ${number} should exist.`)
    assert.equal(Number(actual.correctAnswer ?? actual.answer), answerSequence[number - 36])
    assert.equal(Number(canonical.correctAnswer ?? canonical.answer), answerSequence[number - 36])
    assert.ok(actual.explanation, `Section question ${number} should receive its explanation.`)
    assert.match(actual.explanation, /Dịch:/u)
    for (const choice of [1, 2, 3, 4]) assert.match(actual.explanation, new RegExp(`^${choice}\\.`, 'mu'))
  }

  for (const [number, answer, order, starPosition] of [
    [49, 2, [4, 2, 3, 1], 1],
    [50, 4, [3, 1, 4, 2], 2],
    [51, 2, [4, 3, 2, 1], 2],
    [52, 1, [2, 3, 1, 4], 2],
    [53, 3, [1, 4, 3, 2], 2],
  ]) {
    const item = sourceQuestion(number)
    assert.equal(item.correctAnswer, answer)
    assert.deepEqual(item.starCorrectOrder, order)
    assert.equal(item.starPosition, starPosition)
    assert.equal(item.starCorrectOrder[item.starPosition], answer)
  }
  assert.match(sectionQuestion(52).question, /待てって/u)
  assert.match(sectionQuestion(57).options[2].text, /持つのかもしれません/u)

  const mismatchedService = new NhaiKanjiService()
  const reload = mismatchedService.reloadFullMaster.bind(mismatchedService)
  mismatchedService.reloadFullMaster = () => {
    reload()
    const sourceExam = mismatchedService.toanMockMaster.find((item) => item.id === 'toan-n3-201612-full')
    const sourceQuestion = sourceExam.parts.flatMap((part) => part.questions || []).find((item) => item.number === 49)
    sourceQuestion.starPosition = 2
    const clozePart = sourceExam.parts.find((part) => part.questions?.some((item) => item.number === 54))
    clozePart.passage = clozePart.passage.replace('日本人の天気の話', '日本人の曇りの話')
  }
  const mismatchedExam = mismatchedService.getJlptExamDetail('cm2u2wlnt0097134ira8pl9rk-grammar-reading')
  const mismatchedQuestion = (number) =>
    mismatchedExam.parts.flatMap((part) => part.questions || []).find((item) => item.number === number)
  assert.equal(
    mismatchedQuestion(49).explanation,
    null,
    'A ★ explanation must not attach when the printed slot differs.'
  )
  assert.equal(
    mismatchedQuestion(54).explanation,
    null,
    'A cloze explanation must not attach when its passage differs.'
  )
})

test('N3 July 2017 grammar section serves complete answers, ★ explanations, and cloze translations', () => {
  const service = new NhaiKanjiService()
  const section = service.getJlptExamDetail('cm2u2wq1c00ck134imolbo8ac-grammar-reading')
  const full = service.getJlptExamDetail('toan-n3-201707-full')
  const sectionQuestion = (number) =>
    section.parts.flatMap((item) => item.questions || []).find((item) => item.number === number)
  const fullQuestion = (number) =>
    full.parts.flatMap((item) => item.questions || []).find((item) => item.number === number)
  const answerSequence = [1, 4, 2, 1, 3, 2, 3, 4, 1, 3, 4, 2, 2, 2, 1, 3, 2, 4, 2, 1, 3, 4, 3]

  for (let number = 36; number <= 58; number++) {
    const actual = sectionQuestion(number)
    const canonical = fullQuestion(number)
    assert.ok(actual, `Section question ${number} should exist.`)
    assert.ok(canonical, `Full mock question ${number} should exist.`)
    assert.equal(Number(actual.correctAnswer ?? actual.answer), answerSequence[number - 36])
    assert.equal(Number(canonical.correctAnswer ?? canonical.answer), answerSequence[number - 36])
    assert.ok(actual.explanation, `Section question ${number} should receive its explanation.`)
  }

  assert.equal(sectionQuestion(37).options[2].text, 'のに対して')
  assert.match(sectionQuestion(37).explanation, /3\. のに対して/u)
  assert.match(fullQuestion(47).explanation, /1\. をしていく/u)
  assert.ok(sectionQuestion(42).question.startsWith('A 小学校'))
  assert.equal(sectionQuestion(43).options[1].text, '買うことにする')
  assert.equal(sectionQuestion(43).options[3].text, '買ってしまう')
  const clozePassage = section.parts.find((part) => part.questions?.some((item) => item.number === 54)).passage
  assert.doesNotMatch(clozePassage, /拍除|描除|招除/u)

  for (const [number, answer, order, starPosition] of [
    [49, 2, [1, 3, 2, 4], 2],
    [50, 1, [4, 3, 1, 2], 2],
    [51, 3, [2, 4, 3, 1], 2],
    [52, 2, [4, 1, 2, 3], 2],
    [53, 4, [3, 2, 4, 1], 2],
  ]) {
    const item = fullQuestion(number)
    assert.equal(item.correctAnswer, answer)
    assert.deepEqual(item.starCorrectOrder, order)
    assert.equal(item.starPosition, starPosition)
    assert.equal(item.starCorrectOrder[item.starPosition], answer)
    assert.match(sectionQuestion(number).explanation, /Câu hoàn chỉnh:.*Dịch:/su)
    if (number === 49) {
      assert.equal(item.starVerificationStatus, 'disputed')
      assert.match(sectionQuestion(number).explanation, /còn bất đồng nguồn/u)
    }
  }

  for (const [number, answer] of [
    [54, 2],
    [55, 1],
    [56, 3],
    [57, 4],
    [58, 3],
  ]) {
    const item = sectionQuestion(number)
    assert.equal(Number(item.correctAnswer ?? item.answer), answer)
    assert.match(item.explanation, /Câu hoàn chỉnh:.*Dịch:/su)
    for (const option of [1, 2, 3, 4]) assert.match(item.explanation, new RegExp(`^${option}\\.`, 'mu'))
  }
})

test('N3 December 2017 grammar answers and all-choice explanations follow the Drive PDF', () => {
  const service = new NhaiKanjiService()
  const exam = service.getJlptExamDetail('toan-n3-201712-full')
  const section = service.getJlptExamDetail('cm2u2wuad00fw134ipsfpq3fu-grammar-reading')
  const question = (source, number) =>
    source.parts.flatMap((part) => part.questions || []).find((item) => Number(item.number) === number)
  const fullQuestion = (number) => question(exam, number)
  const sectionQuestion = (number) => question(section, number)
  const answers = [4, 2, 1, 3, 4, 1, 2, 3, 1, 2, 4, 1, 3, 3, 2, 2, 4, 1, 3, 1, 2, 1, 4]
  const driveSource = 'https://drive.google.com/file/d/1U0CZnFUibxiS9PFX_BdfWK2QgaDB-m6C/view'

  for (let number = 36; number <= 58; number++) {
    for (const [examType, item] of [
      ['full mock', fullQuestion(number)],
      ['section', sectionQuestion(number)],
    ]) {
      assert.ok(item, `${examType} question ${number} should exist.`)
      assert.equal(Number(item.correctAnswer ?? item.answer), answers[number - 36])
      assert.ok(item.explanation, `${examType} question ${number} should have a complete explanation.`)
      assert.match(item.explanation, /Dịch:/u)
    }
  }

  assert.match(fullQuestion(45).question, /りんごはそのまま食べる/u)
  assert.doesNotMatch(fullQuestion(45).question, /そのま食べる/u)
  assert.doesNotMatch(sectionQuestion(42).question, /客きゃく/u)
  assert.equal(sectionQuestion(42).options[0].text, 'でいらっしゃいます')
  assert.equal(sectionQuestion(42).options[2].text, 'と申し上げます')
  assert.equal(sectionQuestion(42).options[3].text, 'とおっしゃいます')
  assert.equal(sectionQuestion(57).options[1].text, 'そんな部屋')

  for (const [number, order, script] of [
    [49, [4, 2, 3, 1], 'まででいいですから'],
    [50, [3, 4, 2, 1], '患者だったらどうしてほしいかということを考えながら'],
    [51, [1, 3, 2, 4], 'どうしても寝られないとき以外は'],
    [52, [2, 1, 4, 3], 'あったのか聞いても答えてくれないので何も'],
    [53, [4, 2, 1, 3], '車の運転ができない私には生活する'],
  ]) {
    const item = fullQuestion(number)
    assert.deepEqual(item.starCorrectOrder, order)
    assert.equal(item.starPosition, 2)
    assert.equal(item.starCorrectOrder[item.starPosition], answers[number - 36])
    assert.equal(item.script, script)
    assert.ok(item.starVerificationSources.includes(driveSource))
    assert.match(item.explanation, /Thứ tự bốn mảnh ghép đúng là/u)
  }

  for (let number = 54; number <= 58; number++) {
    const explanation = fullQuestion(number).explanation
    for (const option of [1, 2, 3, 4]) assert.match(explanation, new RegExp(`^${option}\\.`, 'mu'))
  }
})

test('N3 December 2018 grammar content and explanations follow the Drive PDF', () => {
  const service = new NhaiKanjiService()
  const exam = service.getJlptExamDetail('toan-n3-201812-full')
  const section = service.getJlptExamDetail('cm2u2x30900ml134ilniaj8pm-grammar-reading')
  const question = (source, number) =>
    source.parts.flatMap((part) => part.questions || []).find((item) => Number(item.number) === number)
  const fullQuestion = (number) => question(exam, number)
  const sectionQuestion = (number) => question(section, number)
  const sourceUrl = 'https://drive.google.com/file/d/1IIZSnchqU4xzRTWbwO18l99FzgOaQfn5/view'
  const starAnswers = [3, 4, 1, 4, 2]
  const starOrders = [
    [2, 3, 4, 1],
    [3, 2, 4, 1],
    [4, 2, 1, 3],
    [2, 1, 4, 3],
    [1, 3, 2, 4],
  ]
  const starScripts = [
    'やっていたように何度も書いてみることに',
    '毎週見ていた大好きなドラマがとうとう',
    'めがねのような形をしていることから',
    'たっていないのでわからないことばかり',
    'まであそこにあった白い段ボール箱に',
  ]
  const clozeAnswers = [1, 1, 2, 4, 3]
  const grammarAnswers = [1, 4, 4, 3, 2, 4, 3, 1, 2, 1, 2, 4, 3, ...starAnswers, ...clozeAnswers]

  for (let number = 36; number <= 58; number++) {
    const expectedAnswer = grammarAnswers[number - 36]
    for (const [examType, item] of [
      ['full mock', fullQuestion(number)],
      ['section', sectionQuestion(number)],
    ]) {
      assert.ok(item, `${examType} question ${number} should exist.`)
      assert.equal(Number(item.correctAnswer ?? item.answer), expectedAnswer)
      assert.ok(item.explanation, `${examType} question ${number} should have a complete explanation.`)
      assert.match(item.explanation, /Dịch:/u)
      for (const option of [1, 2, 3, 4]) {
        assert.match(item.explanation, new RegExp(`(?:^|\\s)${option}\\.`, 'mu'))
      }
    }
  }

  for (let index = 0; index < starAnswers.length; index++) {
    const number = 49 + index
    const item = fullQuestion(number)
    assert.ok(item, `full mock question ${number} should exist`)
    assert.equal(Number(item.correctAnswer ?? item.answer), starAnswers[index])
    assert.deepEqual(item.starCorrectOrder, starOrders[index])
    assert.equal(item.starPosition, index === 0 ? 1 : 2)
    assert.equal(item.starCorrectOrder[item.starPosition], starAnswers[index])
    assert.equal(item.script, starScripts[index])
    assert.ok(item.starVerificationSources.includes(sourceUrl))
  }

  for (let number = 49; number <= 58; number++) {
    const item = fullQuestion(number)
    for (const option of [1, 2, 3, 4]) {
      assert.match(item.explanation, new RegExp(`(?:^|\\s)${option}\\.`, 'mu'))
    }
  }

  const clozeSectionPart = section.parts.find((part) => part.questions?.some((item) => Number(item.number) === 54))
  assert.match(clozeSectionPart.passage, /私は\s*6\s*月に日本人の友達の家/u)
  assert.doesNotMatch(clozeSectionPart.passage, /私は\s*8\s*月に日本人の友達の家/u)
  assert.match(clozeSectionPart.passage, /それまで、ベッド/u)
  assert.match(fullQuestion(55).explanation, /Sohu.*それに/u)
  assert.match(fullQuestion(58).explanation, /SOFL.*4/u)
  assert.equal(fullQuestion(56).options[0], '1.部屋')
  assert.equal(sectionQuestion(38).options[0].text, 'ちっとも')
  assert.equal(sectionQuestion(40).options[1].text, 'やりなおした')
  assert.match(fullQuestion(48).question, /今日はもうお帰りですか/u)
})

test('N3 July 2024 section exams keep their session metadata and content separate from December', () => {
  const service = new NhaiKanjiService()
  const exams = service.getJlptExams({ level: 'N3' }).exams
  const julyId = 'cm2u2yale01jo134i8wwru1oo-vocab'
  const julySummary = exams.find((exam) => exam.id === julyId)
  const decemberSummary = exams.find((exam) => exam.id === 'toan-n3-202412-full')

  assert.equal(julySummary.year, '2024')
  assert.equal(julySummary.session, '07')
  assert.equal(decemberSummary.year, '2024')
  assert.equal(decemberSummary.session, '12')

  const fullMocks = exams.filter((exam) => exam.isFullMock)
  assert.equal(fullMocks.length, 30)
  for (const exam of fullMocks) {
    const match = exam.id.match(/^toan-n3-(\d{4})(\d{2})-full$/)
    assert.ok(match, `Unexpected full mock id: ${exam.id}`)
    assert.equal(exam.year, match[1], `${exam.id} year`)
    assert.equal(String(exam.session).padStart(2, '0'), match[2], `${exam.id} session`)
  }

  const historicalSections = exams.filter((exam) => exam.id.startsWith('cm2u'))
  assert.equal(historicalSections.length, 53)
  for (const exam of historicalSections) {
    const match = exam.title.match(/JLPT-N3\s+(07|12)\s+(\d{4})/)
    assert.ok(match, `Unexpected historical exam title: ${exam.title}`)
    assert.equal(exam.year, match[2], `${exam.id} year`)
    assert.equal(String(exam.session).padStart(2, '0'), match[1], `${exam.id} session`)
  }

  const julyDetail = service.getJlptExamDetail(julyId)
  const decemberDetail = service.getJlptExamDetail('toan-n3-202412-full')
  assert.equal(julyDetail.year, '2024')
  assert.equal(julyDetail.session, '07')
  assert.equal(decemberDetail.year, '2024')
  assert.equal(decemberDetail.session, '12')
  assert.match(julyDetail.parts[0].questions[0].question, /割って/)
  assert.match(decemberDetail.parts[0].questions[0].question, /配った/)
})

test('December 2013 source text replaces the image-only star, cloze and reading prompts', () => {
  const service = new NhaiKanjiService()
  const exam = service.getJlptExamDetail('toan-n3-201312-full')
  const question = (number) => exam.parts.flatMap((part) => part.questions).find((item) => item.number === number)

  for (let number = 49; number <= 53; number++) {
    const item = question(number)
    assert.ok(item.starPrompt?.before)
    assert.equal(item.starCorrectOrder[2], item.correctAnswer)
    assert.equal(item.passage, null)
  }
  const cloze = exam.parts.find((part) => part.id === 'toan_part_2013_12_m2_g3')
  assert.match(cloze.passage, /ごぶさたしております/)
  assert.match(cloze.passage, /（23）/)
  assert.equal(question(54).passage, null)

  for (let number = 59; number <= 62; number++) {
    assert.ok(question(number).passage.includes('<p>'))
    assert.doesNotMatch(question(number).passage, /<img\b/i)
  }
})

test('N3 December 2012 star question 16 uses the PDF-verified key and star slot', () => {
  const service = new NhaiKanjiService()
  const exam = service.getJlptExamDetail('toan-n3-201212-full')
  const question = exam.parts.flatMap((part) => part.questions).find((item) => item.id === 'toan_q_2012_12_51')

  assert.deepEqual(question.starCorrectOrder, [4, 2, 3, 1])
  assert.equal(question.starPosition, 2)
  assert.equal(question.correctAnswer, 3)
  assert.equal(question.starCorrectOrder[question.starPosition], question.correctAnswer)
  assert.match(question.explanation, /ô ★ thứ ba nhận lựa chọn 3/)
})

test('sample N3 option notes use the bundled Kanji and grammar distinctions', () => {
  const service = new NhaiKanjiService()
  const questions = service.getJlptExamDetail('toan-n3-201312-full').parts.flatMap((part) => part.questions)
  const note = (number) => questions.find((item) => item.number === number).explanation

  const kanjiQuestion = questions.find((item) => item.number === 9)
  assert.equal(kanjiQuestion.options[3], '4.憎')
  for (const kanji of ['培', '倍', '増', '憎']) assert.match(note(9), new RegExp(kanji))
  for (const word of ['全く', '必ず', '非常に', '決して']) assert.match(note(37), new RegExp(word))
  assert.match(note(39), /にとって/)
  assert.match(note(39), /によって/)
})

test('NhaiKanjiService retrieves and caches stroke order vector data', async () => {
  const service = new NhaiKanjiService()
  const strokeData = await service.getKanjiStrokeData('信')
  assert.ok(strokeData)
  assert.equal(strokeData.kanji, '信')
  assert.equal(strokeData.strokeCount, 9)
  assert.equal(strokeData.strokes.length, 9)
  assert.equal(strokeData.numbers.length, 9)
  assert.ok(strokeData.strokes[0].d.startsWith('M'))
})

test('NhaiKanjiService retrieves and caches calligraphic brush outline data', async () => {
  const service = new NhaiKanjiService()
  const brushData = await service.getKanjiBrushData('信')
  assert.ok(brushData)
  assert.ok(Array.isArray(brushData.strokes))
  assert.ok(Array.isArray(brushData.medians))
  assert.equal(brushData.strokes.length, 9)
  assert.equal(brushData.medians.length, 9)
  assert.ok(brushData.strokes[0].startsWith('M'))
  assert.ok(brushData.strokes[0].endsWith('Z'))
})

