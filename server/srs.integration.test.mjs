import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { SrsStore } from './srs-store.mjs'
import { SrsService } from './srs-service.mjs'

const { Pool } = pg
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  test('PostgreSQL SRS persistence (SKIPPED: DATABASE_URL not set)', { skip: true }, () => {})
} else {
  test('PostgreSQL SRS persistence and multi-user isolation across simulated restarts', async () => {
    const pool = new Pool({ connectionString, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined })

    // Create 2 test users
    const userAId = randomUUID()
    const userBId = randomUUID()

    await pool.query(`
      insert into users (id, name, email, password_hash, role)
      values
        ($1, 'User A', $2, 'hash1', 'learner'),
        ($3, 'User B', $4, 'hash2', 'learner')
    `, [userAId, `usera_${Date.now()}@test.com`, userBId, `userb_${Date.now()}@test.com`])

    try {
      // 1. First process: SrsStore and SrsService
      const store1 = new SrsStore(pool)
      const service1 = new SrsService(store1)

      // Add 3 cards for User A: vocab, grammar, kanji
      const vocabCard = await service1.addCard(userAId, {
        type: 'vocab',
        term: '勉強',
        reading: 'べんきょう',
        hanViet: 'MIỄN CƯỠNG',
        meaning: 'Học tập',
        jlptLevel: 'N5',
        examples: [{ jp: '日本語を勉強する', vi: 'Học tiếng Nhật' }],
      })
      assert.ok(vocabCard.id)
      assert.equal(vocabCard.term, '勉強')
      assert.equal(vocabCard.type, 'vocab')

      const grammarCard = await service1.addCard(userAId, {
        type: 'grammar',
        term: '～てたまらない',
        meaning: 'Rất... không chịu nổi',
        structure: 'V-て + たまらない',
        jlptLevel: 'N3',
      })
      assert.ok(grammarCard.id)
      assert.equal(grammarCard.term, '～てたまらない')

      const kanjiCard = await service1.addCard(userAId, {
        type: 'kanji',
        term: '語',
        reading: 'ゴ / かたる',
        hanViet: 'NGỮ',
        meaning: 'ngôn ngữ, lời nói',
        jlptLevel: 'N5',
        strokeCount: 14,
        radical: '言',
      })
      assert.ok(kanjiCard.id)
      assert.equal(kanjiCard.term, '語')
      assert.equal(kanjiCard.type, 'kanji')

      // Review vocab card with "good" rating
      const reviewedVocab = await service1.submitReview(userAId, vocabCard.id, 'good')
      assert.ok(reviewedVocab)
      assert.equal(reviewedVocab.repetition, 1)
      assert.ok(reviewedVocab.masteryPercentage > vocabCard.masteryPercentage)

      // 2. SIMULATE RESTART: Instantiate fresh SrsStore & SrsService with same DB
      const store2 = new SrsStore(pool)
      const service2 = new SrsService(store2)

      // Verify User A has all 3 cards + starter card
      const userACards = await service2.getCards(userAId, { limit: 10 })
      assert.ok(userACards.total >= 3, 'User A should have all added cards')

      const retrievedVocab = userACards.items.find((c) => c.term === '勉強')
      assert.ok(retrievedVocab, 'Vocab card should persist')
      assert.equal(retrievedVocab.repetition, 1, 'Review repetition must persist')
      assert.equal(retrievedVocab.meaning, 'Học tập')

      const retrievedKanji = userACards.items.find((c) => c.term === '語')
      assert.ok(retrievedKanji, 'Kanji card should persist')
      assert.equal(retrievedKanji.strokeCount, 14)
      assert.equal(retrievedKanji.radical, '言')

      // Verify stats & heatmap for User A
      const statsA = await service2.getStats(userAId)
      assert.ok(statsA.totalCards >= 3)
      assert.equal(statsA.reviewedToday, 1, 'Reviewed today count should be 1 from srs_review_events')
      assert.equal(statsA.streak, 1, 'Streak should be 1')
      const todayStr = new Date().toISOString().slice(0, 10)
      const todayHeatmap = statsA.heatmap.find((h) => h.date === todayStr)
      assert.ok(todayHeatmap)
      assert.equal(todayHeatmap.count, 1)

      // 3. Verify User B isolation
      const userBCards = await service2.getCards(userBId, { limit: 10 })
      const bHasStudy = userBCards.items.some((c) => c.term === '勉強')
      const bHasKanji = userBCards.items.some((c) => c.term === '語')
      assert.equal(bHasStudy, false, 'User B must not see User A cards')
      assert.equal(bHasKanji, false, 'User B must not see User A kanji')

      // 4. Idempotent Card Addition: Adding existing card updates meaning but preserves SM-2 progress
      const reAdded = await service2.addCard(userAId, {
        type: 'vocab',
        term: '勉強',
        reading: 'べんきょう',
        meaning: 'Học tập / Rèn luyện chăm chỉ',
      })
      assert.equal(reAdded.meaning, 'Học tập / Rèn luyện chăm chỉ')
      assert.equal(reAdded.repetition, 1, 'Repetition must not be reset')
      assert.equal(reAdded.masteryPercentage, reviewedVocab.masteryPercentage, 'Mastery percentage must not be reset')

      // 5. Invalid rating rejected
      await assert.rejects(
        () => service2.submitReview(userAId, vocabCard.id, 'invalid_rating'),
        /Invalid rating/
      )
    } finally {
      // Clean up test users (cascades to srs_cards and srs_review_events)
      await pool.query('delete from users where id in ($1, $2)', [userAId, userBId])
      await pool.end()
    }
  })
}
