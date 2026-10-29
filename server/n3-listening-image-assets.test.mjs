import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { NhaiKanjiService } from './nhaikanji-service.mjs'

const root = path.resolve('.')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data', 'jlpt_n3_listening_image_assets.json'), 'utf8'))
const pdfExtractionReport = JSON.parse(
  fs.readFileSync(
    path.join(root, 'reports', 'n3-quality-audit', 'listening-question-pdf-image-extraction.json'),
    'utf8'
  )
)
const fullMaster = JSON.parse(fs.readFileSync(path.join(root, 'data', 'jlpt_full_master.json'), 'utf8'))
const toanMaster = JSON.parse(fs.readFileSync(path.join(root, 'data', 'jlpt_n3_toan_master.json'), 'utf8'))
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const sourceQuestions = new Map(
  fullMaster
    .filter((exam) => String(exam?.section || '').toLowerCase() === 'listening')
    .flatMap((exam) => exam.parts || [])
    .flatMap((part) => part.questions || [])
    .map((question) => [question.id, question])
)
const targetQuestions = new Map(
  toanMaster
    .filter((exam) => exam?.isFullMock && String(exam?.level || '').toUpperCase() === 'N3')
    .flatMap((exam) => exam.parts || [])
    .flatMap((part) => part.questions || [])
    .map((question) => [question.id, question])
)

function answerOf(question) {
  return Number(question?.correctAnswer ?? question?.answer)
}

function assertValidPng(asset) {
  const destination = path.join(root, 'public', asset.publicPath.replace(/^\//u, ''))
  const image = fs.readFileSync(destination)
  assert.ok(image.length > 100, `${asset.publicPath} should not be empty`)
  assert.ok(image.subarray(0, pngSignature.length).equals(pngSignature), `${asset.publicPath} must be a PNG`)
  assert.equal(image.subarray(12, 16).toString('ascii'), 'IHDR', `${asset.publicPath} must start with IHDR`)
  assert.ok(image.readUInt32BE(16) > 0, `${asset.publicPath} must have a positive width`)
  assert.ok(image.readUInt32BE(20) > 0, `${asset.publicPath} must have a positive height`)
  assert.equal(image.subarray(-8, -4).toString('ascii'), 'IEND', `${asset.publicPath} must end with IEND`)
}

test('source-verified N3 listening illustrations have stable local destinations and sources', () => {
  const entries = Object.entries(manifest.assets)
  assert.equal(entries.length, 114)
  assert.equal(Object.keys(manifest.aliases).length, 77)
  assert.ok(Object.keys(manifest.questionAliases).length >= Object.keys(manifest.aliases).length)
  const sourceTypeCounts = { 'standalone-source': 0, 'embedded-full-mock': 0 }
  for (const [, asset] of entries) {
    assert.match(asset.publicPath, /^\/assets\/jlpt\/listening\/n3-20(?:1[5-9]|2[0-5])-(?:07|12)\/m[1-5]-q\d+\.png$/u)
    assert.ok(asset.sourceType in sourceTypeCounts, `unexpected source type ${asset.sourceType}`)
    sourceTypeCounts[asset.sourceType] += 1
    if (asset.sourceType === 'standalone-source') {
      assert.match(asset.sourceUrl, /^https:\/\/dethitiengnhat\.com\/image\/.+\.png$/u)
    } else {
      assert.match(asset.sourceUrl, /^https?:\/\/i\.ibb\.co\/.+\.png$/u)
    }
    assert.equal(typeof asset.examId, 'string')
    assert.ok(Number.isInteger(asset.questionNumber))
    assertValidPng(asset)
  }
  assert.deepEqual(sourceTypeCounts, { 'standalone-source': 77, 'embedded-full-mock': 37 })
  for (const targetQuestionId of Object.values(manifest.aliases)) {
    assert.ok(manifest.assets[targetQuestionId], `missing primary asset for alias ${targetQuestionId}`)
  }
  for (const [sourceQuestionId, targetQuestionId] of Object.entries(manifest.aliases)) {
    assert.equal(manifest.questionAliases[sourceQuestionId], targetQuestionId)
  }
  for (const [sourceQuestionId, targetQuestionId] of Object.entries(manifest.questionAliases)) {
    assert.equal(answerOf(sourceQuestions.get(sourceQuestionId)), answerOf(targetQuestions.get(targetQuestionId)))
  }
  for (const unresolved of manifest.unresolvedQuestionAliases) {
    assert.equal(unresolved.reason, 'answer-key-conflict')
    assert.notEqual(unresolved.sourceAnswer, unresolved.targetAnswer)
  }
  const december2018M5 = manifest.partMappings.filter(
    (mapping) => mapping.examId === 'toan-n3-201812-full' && mapping.sourceMondai === 4 && mapping.targetMondai === 5
  )
  assert.equal(december2018M5.length, 9)
  assert.equal(december2018M5[0].sourceQuestionNumber, 20)
  assert.equal(december2018M5[0].targetQuestionId, 'toan_q_2018_12_94')

  assert.equal(pdfExtractionReport.extractedAssetCount, 37)
  assert.equal(pdfExtractionReport.assets.length, 37)
  assert.equal(new Set(pdfExtractionReport.assets.map((asset) => asset.questionId)).size, 37)
  for (const extracted of pdfExtractionReport.assets) {
    const asset = manifest.assets[extracted.questionId]
    assert.equal(asset?.sourceType, 'embedded-full-mock')
    assert.equal(asset.publicPath, extracted.publicPath)
    assert.match(extracted.sourcePdfUrl, /^https:\/\/drive\.google\.com\/file\/d\//u)
    assert.ok(['native-image', 'vector-crop'].includes(extracted.provenance.kind))
  }
})

test('full N3 mocks expose bundled listening illustrations without retaining the broken host', () => {
  const service = new NhaiKanjiService()
  const exam = service.getJlptExamDetail('toan-n3-201512-full')
  const question = (number) => exam.parts.flatMap((part) => part.questions || []).find((item) => item.number === number)

  for (const number of [75, 90, 91, 92, 93]) {
    const item = question(number)
    assert.ok(item?.image, `question ${number} should have a visual asset`)
    assert.match(item.image, /^\/assets\/jlpt\/listening\//u)
    assert.doesNotMatch(item.image, /i\.ibb\.co/u)
  }
  assert.match(
    question(75).sentence,
    /i\.ibb\.co/u,
    'the stored source remains auditable and is stripped by the client'
  )

  const december2025 = service.getJlptExamDetail('toan-n3-202512-full')
  const december2025Question = (number) =>
    december2025.parts.flatMap((part) => part.questions || []).find((item) => item.number === number)
  for (const number of [76, 89, 90, 91, 92]) {
    assert.match(december2025Question(number).image, /^\/assets\/jlpt\/listening\//u)
  }

  const standalone = service.getJlptExamDetail('cm2u2wco4002g134io8nm04te-listening')
  const standaloneQuestion = (number) =>
    standalone.parts.flatMap((part) => part.questions || []).find((item) => item.number === number)
  for (const number of [1, 16, 17, 18, 19]) {
    assert.match(standaloneQuestion(number).image, /^\/assets\/jlpt\/listening\//u)
  }
  for (const number of [1, 7, 16, 20]) {
    assert.match(standaloneQuestion(number).explanation, /^Đáp án [1-4] —/u)
  }
})
