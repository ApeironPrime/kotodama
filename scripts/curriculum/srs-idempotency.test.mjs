import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { SrsStore, applySrsSchemaSQLite } from '../../server/srs-store.mjs'
import { SrsService } from '../../server/srs-service.mjs'

test('SRS Source Context & Idempotency integration tests', async (t) => {
  const db = new DatabaseSync(':memory:')
  applySrsSchemaSQLite(db)

  // Seed test users
  const user1 = randomUUID()
  const user2 = randomUUID()
  db.prepare('insert into users (id, name, email, password_hash) values (?, ?, ?, ?)').run(
    user1, 'Learner One', 'learner1@test.com', 'hash1'
  )
  db.prepare('insert into users (id, name, email, password_hash) values (?, ?, ?, ?)').run(
    user2, 'Learner Two', 'learner2@test.com', 'hash2'
  )

  const store = new SrsStore(db)
  const service = new SrsService(store)

  await t.test('1. Same surface word in two different curriculum contexts creates two distinct cards', async () => {
    // Card 1: '私' in Minna N5 Lesson 1
    const card1 = await service.addCard(user1, {
      type: 'vocab',
      term: '私',
      reading: 'わたし',
      meaning: 'tôi (ngôi thứ nhất)',
      courseCode: 'minna-n5',
      unitId: 'minna-n5:unit-1',
      termId: 'term_watashi_01',
      sourceContext: 'minna-n5:unit-1:term_watashi_01',
    })

    assert.ok(card1.id, 'Card 1 should have an id')
    assert.equal(card1.term, '私')
    assert.equal(card1.sourceContext, 'minna-n5:unit-1:term_watashi_01')
    assert.equal(card1.courseCode, 'minna-n5')

    // Card 2: '私' in Soumatome N5 Lesson 3 (different context, same surface word)
    const card2 = await service.addCard(user1, {
      type: 'vocab',
      term: '私',
      reading: 'わたし / わたくし',
      meaning: 'tôi, bản thân (lịch sự)',
      courseCode: 'soumatome-n5',
      unitId: 'soumatome-n5:unit-3',
      termId: 'term_watashi_02',
      sourceContext: 'soumatome-n5:unit-3:term_watashi_02',
    })

    assert.ok(card2.id, 'Card 2 should have an id')
    assert.notEqual(card1.id, card2.id, 'Different contexts must create distinct card IDs')
    assert.equal(card2.sourceContext, 'soumatome-n5:unit-3:term_watashi_02')

    // Verify both cards exist in listCards
    const listRes = await service.getCards(user1, { limit: 10 })
    const watashiCards = listRes.items.filter((c) => c.term === '私')
    assert.equal(watashiCards.length, 2, 'Should have 2 distinct cards for 私')
  })

  await t.test('2. Re-adding the same word with the SAME sourceContext is idempotent (updates metadata, preserves progress)', async () => {
    // Review card 1 to advance SM-2 progress
    const listRes = await service.getCards(user1, { limit: 10 })
    const card1 = listRes.items.find((c) => c.sourceContext === 'minna-n5:unit-1:term_watashi_01')
    assert.ok(card1)

    const reviewed = await service.submitReview(user1, card1.id, 'good')
    assert.equal(reviewed.repetition, 1)
    assert.ok(reviewed.masteryPercentage > 20)

    // Re-add with same source context but updated meaning
    const reAdded = await service.addCard(user1, {
      type: 'vocab',
      term: '私',
      reading: 'わたし',
      meaning: 'tôi, bản thân tôi (nghĩa cập nhật)',
      courseCode: 'minna-n5',
      unitId: 'minna-n5:unit-1',
      termId: 'term_watashi_01',
      sourceContext: 'minna-n5:unit-1:term_watashi_01',
    })

    assert.equal(reAdded.id, card1.id, 'Must reuse the exact same card ID')
    assert.equal(reAdded.meaning, 'tôi, bản thân tôi (nghĩa cập nhật)', 'Meaning should be updated')
    assert.equal(reAdded.repetition, 1, 'Repetition must be preserved')
    assert.equal(reAdded.masteryPercentage, reviewed.masteryPercentage, 'Mastery must be preserved')
  })

  await t.test('3. Legacy cards without sourceContext default to empty string and are distinct', async () => {
    const legacyCard = await service.addCard(user1, {
      type: 'vocab',
      term: '私',
      reading: 'わたし',
      meaning: 'tôi (legacy deck không gắn bài)',
    })

    assert.equal(legacyCard.sourceContext, '', 'Legacy cards have empty sourceContext')
    assert.ok(legacyCard.id)

    // Now user1 has 3 '私' cards: minna, soumatome, and legacy
    const listRes = await service.getCards(user1, { limit: 10 })
    const watashiCards = listRes.items.filter((c) => c.term === '私')
    assert.equal(watashiCards.length, 3, 'User should have 3 distinct cards with different contexts')
  })

  await t.test('4. getSavedTerms returns sourceContext, courseCode, unitId, termId for frontend lookup', async () => {
    const saved = await service.getSavedTerms(user1)
    assert.ok(Array.isArray(saved))
    const watashiEntries = saved.filter((s) => s.term === '私')
    assert.equal(watashiEntries.length, 3)

    const minnaEntry = watashiEntries.find((s) => s.sourceContext === 'minna-n5:unit-1:term_watashi_01')
    assert.ok(minnaEntry)
    assert.equal(minnaEntry.courseCode, 'minna-n5')
    assert.equal(minnaEntry.unitId, 'minna-n5:unit-1')
    assert.equal(minnaEntry.termId, 'term_watashi_01')
  })

  await t.test('5. Multi-user isolation: user 2 does not see user 1 cards', async () => {
    const u2Cards = await service.getCards(user2, { limit: 10 })
    const u2HasWatashi = u2Cards.items.some((c) => c.term === '私')
    assert.equal(u2HasWatashi, false, 'User 2 deck must not contain user 1 cards')

    const u2Saved = await service.getSavedTerms(user2)
    assert.equal(u2Saved.filter((s) => s.term === '私').length, 0)
  })
})
