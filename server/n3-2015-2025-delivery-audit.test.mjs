import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'
import { NhaiKanjiService } from './nhaikanji-service.mjs'

const root = path.resolve('.')
const toanMaster = JSON.parse(fs.readFileSync(path.join(root, 'data', 'jlpt_n3_toan_master.json'), 'utf8'))

function sessionKey(exam) {
  const token = String(exam?.id || '').match(/toan-n3-(20\d{2})(07|12)-full/u)
  return token ? `${token[1]}-${token[2]}` : ''
}

function answerOf(question) {
  return Number(question?.correctAnswer ?? question?.answer)
}

test('N3 full mocks from 2015 through 2025 have deliverable text, explanations and local listening figures', () => {
  const exams = toanMaster.filter((exam) => {
    const session = sessionKey(exam)
    const year = Number(session.slice(0, 4))
    return exam?.isFullMock && String(exam?.level || '').toUpperCase() === 'N3' && year >= 2015 && year <= 2025
  })
  const service = new NhaiKanjiService()
  let totalQuestions = 0
  let explainedQuestions = 0
  let listeningMarkupImages = 0
  let localListeningImages = 0

  assert.equal(exams.length, 21)
  for (const sourceExam of exams) {
    const servedExam = service.getJlptExamDetail(sourceExam.id)
    const servedQuestions = new Map(
      servedExam.parts.flatMap((part) => (part.questions || []).map((question) => [question.id, question]))
    )

    for (const part of sourceExam.parts || []) {
      const sectionType = Number(part?.sectionType)
      for (const sourceQuestion of part.questions || []) {
        totalQuestions += 1
        const answer = answerOf(sourceQuestion)
        assert.ok(
          answer >= 1 && answer <= (sourceQuestion.options || []).length,
          `${sourceQuestion.id} has an invalid answer`
        )

        const servedQuestion = servedQuestions.get(sourceQuestion.id)
        assert.ok(servedQuestion, `${sourceQuestion.id} must be served`)
        assert.ok(String(servedQuestion.explanation || '').trim(), `${sourceQuestion.id} must have an explanation`)
        explainedQuestions += 1

        const storedText = [
          sourceQuestion.sentence,
          sourceQuestion.text,
          sourceQuestion.question,
          sourceQuestion.passage,
        ]
          .filter(Boolean)
          .join('\n')
        if (sectionType === 2 || sectionType === 3) {
          assert.doesNotMatch(storedText, /<img\b/iu, `${sourceQuestion.id} should be OCR text, not an image`)
        }
        if (sectionType === 4 && /<img\b/iu.test(storedText)) {
          listeningMarkupImages += 1
          assert.match(
            servedQuestion.image || '',
            /^\/assets\/jlpt\/listening\//u,
            `${sourceQuestion.id} needs a local figure`
          )
          localListeningImages += 1
        }
      }
    }
  }

  assert.equal(totalQuestions, 2130)
  assert.equal(explainedQuestions, totalQuestions)
  assert.equal(listeningMarkupImages, 112)
  assert.equal(localListeningImages, listeningMarkupImages)
})
