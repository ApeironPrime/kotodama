function rowToCard(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    term: row.term,
    reading: row.reading || '',
    hanViet: row.han_viet || '',
    meaning: row.meaning || '',
    jlptLevel: row.jlpt_level || 'N5',
    partOfSpeech: row.part_of_speech || '',
    structure: row.structure || '',
    explanation: row.explanation || '',
    radical: row.radical || '',
    strokeCount: row.stroke_count || 0,
    story: row.story || '',
    masteryPercentage: row.mastery_percentage ?? 20,
    stage: row.stage || 'learning',
    repetition: row.repetition ?? 0,
    intervalDays: row.interval_days ?? 1.0,
    easeFactor: row.ease_factor ?? 2.5,
    nextReviewDate: row.next_review_at ? new Date(row.next_review_at).toISOString() : new Date().toISOString(),
    groups: row.groups || [],
    examples: row.examples || [],
  }
}

const STARTER_CARD = Object.freeze({
  type: 'grammar',
  term: '～みたいだ',
  reading: 'みたいだ',
  hanViet: 'HÌNH NHƯ, CỨ NHƯ LÀ',
  meaning: 'Có vẻ như…/Hình như… / Cứ như là… / Như là, kiểu như…',
  jlptLevel: 'N3',
  structure: 'N＋みたいだ／V普通形＋みたいだ／イAい＋みたいだ／ナA(だ)＋みたいだ',
  explanation: 'Diễn tả phán đoán dựa trên dấu hiệu nhưng chưa chắc chắn, so sánh ví von hoặc nêu ví dụ tiêu biểu.',
  masteryPercentage: 20,
  stage: 'learning',
  repetition: 0,
  intervalDays: 1.0,
  easeFactor: 2.5,
  groups: [
    {
      group_no: 1,
      title: '～みたいだ',
      meaning: 'Có vẻ như…/Hình như…',
      structure: 'N＋みたいだ／V普通形＋みたいだ／イAい＋みたいだ／ナA(だ)＋みたいだ',
      usage:
        'Diễn tả phán đoán dựa trên dấu hiệu nhưng chưa chắc chắn. Thường dựa vào những gì nhìn thấy, nghe thấy hoặc cảm nhận; sắc thái hội thoại.',
      examples: [
        {
          no: 1,
          jp: '星がたくさん出ている。あしたも晴れみたい',
          jp_ruby:
            '<ruby>星<rt>ほし</rt></ruby>がたくさん<ruby>出<rt>で</rt></ruby>ている。あしたも<ruby>晴<rt>は</rt></ruby>れみたい',
          vi: 'Trời có nhiều sao. Có vẻ mai cũng sẽ nắng.',
        },
      ],
    },
    {
      group_no: 2,
      title: '～みたいだ',
      meaning:
        'Diễn tả cảm giác hoặc ấn tượng mạnh khiến người nói tưởng như vậy, “cứ như là…”, dù thực tế không hẳn thế. Mang tính cảm nhận chủ quan.',
      structure: 'N／V普通形',
      usage:
        'Diễn tả cảm giác hoặc ấn tượng mạnh khiến người nói tưởng như vậy, “cứ như là…”, dù thực tế không hẳn thế. Mang tính cảm nhận chủ quan.',
      examples: [
        {
          no: 1,
          jp: '宝くじで１０００万円当たった。夢みたいだ。',
          jp_ruby:
            '<ruby>宝<rt>たから</rt></ruby>くじで１０００<ruby>万<rt>まん</rt></ruby><ruby>円<rt>えん</rt></ruby><ruby>当<rt>あ</rt></ruby>たった。<ruby>夢<rt>ゆめ</rt></ruby>みたいだ。',
          vi: 'Trúng xổ số 10 triệu yên. Cứ như là trong mơ vậy.',
        },
      ],
    },
    {
      group_no: 3,
      title: '～みたいだ',
      meaning: 'Như là, kiểu như…',
      structure: 'N＋みたいだ',
      usage: 'Dùng để nêu một ví dụ tiêu biểu nhằm diễn tả tính chất của một đối tượng giống với ví dụ đó.',
      examples: [
        {
          no: 1,
          jp: '彼みたいな強い人になりたい。',
          jp_ruby:
            '<ruby>彼<rt>かれ</rt></ruby>みたいな<ruby>強<rt>つよ</rt></ruby>い<ruby>人<rt>ひと</rt></ruby>になりたい。',
          vi: 'Tôi muốn trở thành người mạnh mẽ như anh ấy.',
        },
      ],
    },
  ],
  examples: [
    {
      jp: '星がたくさん出ている。あしたも晴れみたい',
      jp_ruby:
        '<ruby>星<rt>ほし</rt></ruby>がたくさん<ruby>出<rt>で</rt></ruby>ている。あしたも<ruby>晴<rt>は</rt></ruby>れみたい',
      vi: 'Trời có nhiều sao. Có vẻ mai cũng sẽ nắng.',
    },
  ],
})

export class SrsStore {
  constructor(pool) {
    if (!pool) throw new Error('PostgreSQL pool is required for SrsStore.')
    this.pool = pool
  }

  async ensureStarterCard(userId) {
    if (!userId) return null
    const query = `
      insert into srs_cards (
        user_id, type, term, reading, han_viet, meaning, jlpt_level,
        structure, explanation, mastery_percentage, stage, repetition,
        interval_days, ease_factor, next_review_at, groups, examples
      ) values (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, now(), $15, $16
      )
      on conflict (user_id, type, term) do nothing
      returning *;
    `
    const values = [
      userId,
      STARTER_CARD.type,
      STARTER_CARD.term,
      STARTER_CARD.reading,
      STARTER_CARD.hanViet,
      STARTER_CARD.meaning,
      STARTER_CARD.jlptLevel,
      STARTER_CARD.structure,
      STARTER_CARD.explanation,
      STARTER_CARD.masteryPercentage,
      STARTER_CARD.stage,
      STARTER_CARD.repetition,
      STARTER_CARD.intervalDays,
      STARTER_CARD.easeFactor,
      JSON.stringify(STARTER_CARD.groups),
      JSON.stringify(STARTER_CARD.examples),
    ]
    const result = await this.pool.query(query, values)
    return rowToCard(result.rows[0])
  }

  async listCards(userId, { type = 'all', status = 'all', level = 'ALL', query = '', page = 1, limit = 50 }) {
    await this.ensureStarterCard(userId)

    const conditions = ['user_id = $1']
    const values = [userId]
    let paramIndex = 2

    if (type !== 'all') {
      conditions.push(`type = $${paramIndex++}`)
      values.push(type)
    }

    if (level && level !== 'ALL') {
      conditions.push(`upper(jlpt_level) = upper($${paramIndex++})`)
      values.push(level)
    }

    if (query && query.trim()) {
      const q = `%${query.trim().toLowerCase()}%`
      conditions.push(
        `(lower(term) like $${paramIndex} or lower(reading) like $${paramIndex} or lower(meaning) like $${paramIndex} or lower(han_viet) like $${paramIndex})`
      )
      values.push(q)
      paramIndex++
    }

    if (status !== 'all') {
      if (status === 'mastered') {
        conditions.push('mastery_percentage >= 80')
      } else if (status === 'learning') {
        conditions.push('mastery_percentage >= 40 and mastery_percentage < 80')
      } else if (status === 'due') {
        conditions.push('next_review_at <= now() and mastery_percentage < 80')
      } else if (status === 'new') {
        conditions.push('mastery_percentage < 40')
      }
    }

    const whereClause = conditions.join(' and ')

    // Get total count
    const countSql = `select count(*) as count from srs_cards where ${whereClause}`
    const countRes = await this.pool.query(countSql, values)
    const total = Number.parseInt(countRes.rows[0]?.count || '0', 10)

    // Get paginated items
    const offset = Math.max(0, (page - 1) * limit)
    const itemsSql = `
      select * from srs_cards
      where ${whereClause}
      order by updated_at desc, created_at desc
      limit $${paramIndex++} offset $${paramIndex++}
    `
    const itemsRes = await this.pool.query(itemsSql, [...values, limit, offset])
    const items = itemsRes.rows.map(rowToCard)

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    }
  }

  async upsertCard(userId, cardData) {
    if (!userId) throw new Error('userId is required')
    const type = cardData.type || 'vocab'
    const term = (cardData.term || cardData.word || '').trim()
    if (!term) throw new Error('term is required')

    const reading = cardData.reading || ''
    const hanViet = cardData.hanViet || ''
    const meaning = cardData.meaning || ''
    const jlptLevel = (cardData.jlptLevel || cardData.level || 'N5').toUpperCase()
    const partOfSpeech = cardData.partOfSpeech || (type === 'vocab' ? 'Từ vựng' : '')
    const structure = cardData.structure || ''
    const explanation = cardData.explanation || ''
    const radical = cardData.radical || ''
    const strokeCount = Number.isInteger(cardData.strokeCount) ? cardData.strokeCount : 0
    const story = cardData.story || ''
    const groups = cardData.groups || []
    const examples = (cardData.examples || []).map((ex) => ({
      jp: ex.jp || '',
      jp_furigana: ex.jp_furigana || '',
      jp_ruby: ex.jp_ruby || '',
      vi: ex.vi || '',
      audio: ex.audio || '',
    }))

    const initialMastery = cardData.masteryPercentage ?? 20
    const initialStage = cardData.stage || 'learning'
    const initialRepetition = cardData.repetition ?? 0
    const initialInterval = cardData.intervalDays ?? 1.0
    const initialEaseFactor = cardData.easeFactor ?? 2.5
    const initialNextReview = cardData.nextReviewDate ? new Date(cardData.nextReviewDate) : new Date(Date.now() + 24 * 60 * 60 * 1000)

    const sql = `
      insert into srs_cards (
        user_id, type, term, reading, han_viet, meaning, jlpt_level,
        part_of_speech, structure, explanation, radical, stroke_count, story,
        mastery_percentage, stage, repetition, interval_days, ease_factor,
        next_review_at, groups, examples
      ) values (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18,
        $19, $20, $21
      )
      on conflict (user_id, type, term) do update set
        meaning = case when excluded.meaning <> '' then excluded.meaning else srs_cards.meaning end,
        reading = case when excluded.reading <> '' then excluded.reading else srs_cards.reading end,
        han_viet = case when excluded.han_viet <> '' then excluded.han_viet else srs_cards.han_viet end,
        jlpt_level = case when excluded.jlpt_level <> '' then excluded.jlpt_level else srs_cards.jlpt_level end,
        part_of_speech = case when excluded.part_of_speech <> '' then excluded.part_of_speech else srs_cards.part_of_speech end,
        structure = case when excluded.structure <> '' then excluded.structure else srs_cards.structure end,
        explanation = case when excluded.explanation <> '' then excluded.explanation else srs_cards.explanation end,
        radical = case when excluded.radical <> '' then excluded.radical else srs_cards.radical end,
        stroke_count = case when excluded.stroke_count > 0 then excluded.stroke_count else srs_cards.stroke_count end,
        story = case when excluded.story <> '' then excluded.story else srs_cards.story end,
        groups = case when jsonb_array_length(excluded.groups) > 0 then excluded.groups else srs_cards.groups end,
        examples = case when jsonb_array_length(excluded.examples) > 0 then excluded.examples else srs_cards.examples end,
        updated_at = now()
      returning *;
    `

    const values = [
      userId,
      type,
      term,
      reading,
      hanViet,
      meaning,
      jlptLevel,
      partOfSpeech,
      structure,
      explanation,
      radical,
      strokeCount,
      story,
      initialMastery,
      initialStage,
      initialRepetition,
      initialInterval,
      initialEaseFactor,
      initialNextReview,
      JSON.stringify(groups),
      JSON.stringify(examples),
    ]

    const result = await this.pool.query(sql, values)
    return rowToCard(result.rows[0])
  }

  async submitReviewTx(userId, cardId, rating, calculateSm2Fn) {
    if (!userId || !cardId || !rating) return null

    const client = await this.pool.connect()
    try {
      await client.query('begin')

      // Select with row lock for update
      const selectSql = `select * from srs_cards where id = $1 and user_id = $2 for update`
      const selectRes = await client.query(selectSql, [cardId, userId])
      if (!selectRes.rows.length) {
        await client.query('rollback')
        return null
      }

      const currentCard = rowToCard(selectRes.rows[0])
      const sm2Result = calculateSm2Fn(currentCard, rating)

      // Update card
      const updateSql = `
        update srs_cards set
          ease_factor = $1,
          repetition = $2,
          interval_days = $3,
          mastery_percentage = $4,
          stage = $5,
          next_review_at = $6,
          updated_at = now()
        where id = $7 and user_id = $8
        returning *;
      `
      const updateRes = await client.query(updateSql, [
        sm2Result.easeFactor,
        sm2Result.repetition,
        sm2Result.intervalDays,
        sm2Result.masteryPercentage,
        sm2Result.stage,
        sm2Result.nextReviewDate,
        cardId,
        userId,
      ])

      // Insert review event
      const eventSql = `
        insert into srs_review_events (user_id, card_id, rating, reviewed_at, review_date)
        values ($1, $2, $3, now(), (now() at time zone 'UTC')::date);
      `
      await client.query(eventSql, [userId, cardId, rating])

      await client.query('commit')
      return rowToCard(updateRes.rows[0])
    } catch (err) {
      await client.query('rollback').catch(() => {})
      throw err
    } finally {
      client.release()
    }
  }

  async listSavedTerms(userId) {
    if (!userId) return []
    await this.ensureStarterCard(userId)
    const sql = `select term, type from srs_cards where user_id = $1 order by created_at asc`
    const res = await this.pool.query(sql, [userId])
    return res.rows.map((r) => ({ term: r.term, type: r.type }))
  }

  async getStats(userId, { type = 'all' } = {}) {
    if (!userId) return null
    await this.ensureStarterCard(userId)

    const cardsSql = `
      select
        type,
        mastery_percentage,
        stage,
        next_review_at
      from srs_cards
      where user_id = $1
    `
    const cardsRes = await this.pool.query(cardsSql, [userId])
    const allRows = cardsRes.rows

    const targetRows = type === 'all' ? allRows : allRows.filter((r) => r.type === type)
    const totalCards = targetRows.length
    const now = new Date()

    let masteredCount = 0
    let dueTodayCount = 0
    let totalMastery = 0

    for (const r of targetRows) {
      if ((r.mastery_percentage || 0) >= 80) masteredCount++
      if (new Date(r.next_review_at) <= now) dueTodayCount++
      totalMastery += r.mastery_percentage || 0
    }

    const averageMastery = totalCards > 0 ? Math.round(totalMastery / totalCards) : 0
    const vocabCount = allRows.filter((r) => r.type === 'vocab').length
    const grammarCount = allRows.filter((r) => r.type === 'grammar').length
    const kanjiCount = allRows.filter((r) => r.type === 'kanji').length

    // Query review events for streak & heatmap
    const eventsSql = `
      select
        to_char(review_date, 'YYYY-MM-DD') as date_str,
        count(*) as count
      from srs_review_events
      where user_id = $1 and review_date >= current_date - interval '120 days'
      group by review_date
      order by review_date asc
    `
    const eventsRes = await this.pool.query(eventsSql, [userId])
    const activityMap = new Map()
    for (const row of eventsRes.rows) {
      activityMap.set(row.date_str, Number.parseInt(row.count, 10))
    }

    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)

    let streak = 0
    let longestStreak = 0
    let tempStreak = 0

    let checkDate = new Date(today)
    if (!activityMap.has(todayStr) || activityMap.get(todayStr) === 0) {
      checkDate.setDate(checkDate.getDate() - 1)
    }

    while (true) {
      const dateStr = checkDate.toISOString().slice(0, 10)
      if (activityMap.has(dateStr) && (activityMap.get(dateStr) || 0) > 0) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }

    // Generate last 112 days (16 weeks x 7 days) heatmap
    const heatmap = []
    const startHeatmap = new Date(today)
    startHeatmap.setDate(startHeatmap.getDate() - 111)

    for (let i = 0; i < 112; i++) {
      const d = new Date(startHeatmap)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      const count = activityMap.get(dateStr) || 0

      let level = 0
      if (count > 15) level = 4
      else if (count >= 10) level = 3
      else if (count >= 5) level = 2
      else if (count >= 1) level = 1

      if (count > 0) {
        tempStreak++
        if (tempStreak > longestStreak) longestStreak = tempStreak
      } else {
        tempStreak = 0
      }

      heatmap.push({
        date: dateStr,
        count,
        level,
      })
    }

    longestStreak = Math.max(longestStreak, streak)
    const reviewedToday = activityMap.get(todayStr) || 0

    return {
      totalCards,
      masteredCount,
      dueTodayCount,
      averageMastery,
      vocabCount,
      grammarCount,
      kanjiCount,
      streak,
      longestStreak,
      reviewedToday,
      heatmap,
    }
  }
}
