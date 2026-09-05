import test from 'node:test'
import assert from 'node:assert/strict'
import { CurriculumService } from './curriculum-service.mjs'
import { SrsService } from './srs-service.mjs'

test('CurriculumService loads Mimi Kara N3 Grammar and queries items', () => {
  const service = new CurriculumService()
  const stats = service.getCurriculumStats()
  assert.ok(stats.totalMimiGrammar > 0, 'Should load Mimi Kara N3 grammar')

  const grammarResult = service.getCurriculumGrammar({ curriculum: 'mimikara_n3', limit: 10 })
  assert.ok(grammarResult.items.length > 0, 'Should return grammar items')
  assert.equal(grammarResult.items[0].level, 'N3')
  assert.ok(grammarResult.items[0].pattern.length > 0)
})

test('SrsService calculates SM-2 spaced repetition correctly', () => {
  const mockStore = {
    listCards: async () => ({ items: [], total: 0 }),
    getStats: async () => ({ totalCards: 0 }),
    submitReviewTx: async () => null,
    addCard: async () => null,
    listSavedTerms: async () => [],
  }
  const service = new SrsService(mockStore)

  const initialCard = {
    id: 'test_card',
    repetition: 0,
    intervalDays: 1,
    easeFactor: 2.5,
    masteryPercentage: 20,
    stage: 'learning',
  }

  // Submit "good" review
  const goodResult = service.calculateSm2(initialCard, 'good')
  assert.equal(goodResult.repetition, 1)
  assert.equal(goodResult.intervalDays, 1.0)
  assert.equal(goodResult.masteryPercentage, 35)
  assert.equal(goodResult.stage, 'learning')

  // Submit second "good" review
  const goodResult2 = service.calculateSm2(goodResult, 'good')
  assert.equal(goodResult2.repetition, 2)
  assert.equal(goodResult2.intervalDays, 6.0)
  assert.equal(goodResult2.masteryPercentage, 50)

  // Submit "easy" review
  const easyResult = service.calculateSm2(goodResult2, 'easy')
  assert.equal(easyResult.repetition, 3)
  assert.ok(easyResult.intervalDays > 6.0)
  assert.ok(easyResult.easeFactor > 2.5)

  // Submit "again" review resets repetition and marks due
  const againResult = service.calculateSm2(easyResult, 'again')
  assert.equal(againResult.repetition, 0)
  assert.equal(againResult.intervalDays, 0.01)
  assert.equal(againResult.stage, 'due')
  assert.ok(againResult.masteryPercentage < easyResult.masteryPercentage)

  // Invalid rating should throw
  assert.throws(() => service.calculateSm2(initialCard, 'super_easy'), /Invalid rating/)
})
