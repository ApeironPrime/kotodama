const VALID_RATINGS = new Set(['again', 'hard', 'good', 'easy'])
const VALID_TYPES = new Set(['vocab', 'kanji', 'grammar'])

export class SrsService {
  constructor(srsStore) {
    if (!srsStore) {
      throw new Error('SrsStore is required for SrsService.')
    }
    this.store = srsStore
  }

  /**
   * Pure SM-2 calculation logic
   * @param {object} card Current card state
   * @param {'again' | 'hard' | 'good' | 'easy'} rating
   */
  calculateSm2(card, rating) {
    if (!VALID_RATINGS.has(rating)) {
      throw new Error(`Invalid rating: ${rating}. Must be one of again, hard, good, easy.`)
    }

    let easeFactor = card.easeFactor ?? 2.5
    let repetition = card.repetition ?? 0
    let intervalDays = card.intervalDays ?? 1.0
    let masteryPercentage = card.masteryPercentage ?? 50
    let stage = card.stage || 'learning'

    switch (rating) {
      case 'again':
        repetition = 0
        intervalDays = 0.01 // ~15 minutes
        easeFactor = Math.max(1.3, easeFactor - 0.2)
        masteryPercentage = Math.max(10, masteryPercentage - 25)
        stage = 'due'
        break

      case 'hard':
        intervalDays = Math.max(1, Math.round(intervalDays * 1.2))
        easeFactor = Math.max(1.3, easeFactor - 0.15)
        masteryPercentage = Math.min(75, masteryPercentage + 5)
        stage = 'learning'
        break

      case 'good':
        repetition += 1
        if (repetition === 1) intervalDays = 1.0
        else if (repetition === 2) intervalDays = 6.0
        else intervalDays = Math.round(intervalDays * easeFactor)

        masteryPercentage = Math.min(95, masteryPercentage + 15)
        stage = masteryPercentage >= 80 ? 'mastered' : 'learning'
        break

      case 'easy':
        repetition += 1
        intervalDays = Math.round(intervalDays * easeFactor * 1.3) + 1.0
        easeFactor += 0.15
        masteryPercentage = Math.min(100, masteryPercentage + 25)
        stage = 'mastered'
        break

      default:
        break
    }

    const nextReviewDate = new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000).toISOString()

    return {
      easeFactor,
      repetition,
      intervalDays,
      masteryPercentage,
      stage,
      nextReviewDate,
    }
  }

  /**
   * Query filtered cards for a user from PostgreSQL
   */
  async getCards(userId, filters = {}) {
    if (!userId) throw new Error('userId is required')
    return this.store.listCards(userId, filters)
  }

  /**
   * Get 4 Summary KPIs + Streak & Heatmap for user from PostgreSQL
   */
  async getStats(userId, options = {}) {
    if (!userId) throw new Error('userId is required')
    return this.store.getStats(userId, options)
  }

  /**
   * Apply SM-2 Spaced Repetition Rating in a database transaction
   * @param {string} userId
   * @param {string} cardId
   * @param {'again' | 'hard' | 'good' | 'easy'} rating
   */
  async submitReview(userId, cardId, rating) {
    if (!userId) throw new Error('userId is required')
    if (!cardId) throw new Error('cardId is required')
    if (!VALID_RATINGS.has(rating)) {
      throw new Error(`Invalid rating: ${rating}. Must be one of again, hard, good, easy.`)
    }

    return this.store.submitReviewTx(userId, cardId, rating, (card, r) => this.calculateSm2(card, r))
  }

  /**
   * Return lightweight list of saved term+type pairs from PostgreSQL
   */
  async getSavedTerms(userId) {
    if (!userId) throw new Error('userId is required')
    return this.store.listSavedTerms(userId)
  }

  /**
   * Add a new card (or update content idempotently) to user's SRS deck in PostgreSQL
   */
  async addCard(userId, cardData) {
    if (!userId) throw new Error('userId is required')
    if (!cardData || (!cardData.term && !cardData.word)) {
      throw new Error('term is required')
    }

    const rawType = cardData.type || 'vocab'
    const type = VALID_TYPES.has(rawType) ? rawType : 'vocab'
    const term = (cardData.term || cardData.word || '').trim()

    const sanitizedData = {
      ...cardData,
      type,
      term,
    }

    return this.store.upsertCard(userId, sanitizedData)
  }
}
