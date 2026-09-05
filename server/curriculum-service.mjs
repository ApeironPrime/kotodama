import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
let DatabaseSync = null
try {
  const sqlite = await import('node:sqlite')
  DatabaseSync = sqlite.DatabaseSync
} catch (error) {
  console.warn('[CurriculumService] node:sqlite is not available:', error.message)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

export class CurriculumService {
  constructor(options = {}) {
    this.nihongoDbPath = options.nihongoDbPath || 'd:/Tieng_Nhat/web/server/data/nihongo.db'
    this.mimiGrammarJsonPath = options.mimiGrammarJsonPath || path.join(rootDir, 'data', 'mimi_kara_n3_grammar.json')
    this.bunpoJsonPath = options.bunpoJsonPath || path.join(rootDir, 'bunpo_data.json')

    this.nihongoDb = null
    this.mimiGrammarList = []
    this.bunpoList = []

    this.init()
  }

  init() {
    // 1. Connect to nihongo.db if available
    try {
      if (DatabaseSync && fs.existsSync(this.nihongoDbPath)) {
        this.nihongoDb = new DatabaseSync(this.nihongoDbPath, { readOnly: true })
        console.log(`[CurriculumService] Connected to external SQLite: ${this.nihongoDbPath}`)
      }
    } catch (err) {
      console.warn(`[CurriculumService] Could not open nihongo.db at ${this.nihongoDbPath}:`, err.message)
      this.nihongoDb = null
    }

    // 2. Load Mimi Kara N3 Grammar JSON
    try {
      if (fs.existsSync(this.mimiGrammarJsonPath)) {
        const raw = fs.readFileSync(this.mimiGrammarJsonPath, 'utf8')
        this.mimiGrammarList = JSON.parse(raw)
        console.log(`[CurriculumService] Loaded ${this.mimiGrammarList.length} items from mimi_kara_n3_grammar.json`)
      }
    } catch (err) {
      console.warn(`[CurriculumService] Error loading mimi_kara_n3_grammar.json:`, err.message)
      this.mimiGrammarList = []
    }

    // 3. Load Bunpo JSON
    try {
      if (fs.existsSync(this.bunpoJsonPath)) {
        const raw = fs.readFileSync(this.bunpoJsonPath, 'utf8')
        this.bunpoList = JSON.parse(raw)
      }
    } catch {
      this.bunpoList = []
    }
  }

  /**
   * Get curriculum word list with filtering, searching, and pagination
   */
  getCurriculumWords({ curriculum = 'all', level = 'ALL', unit = null, query = '', page = 1, limit = 50 }) {
    if (!this.nihongoDb) {
      return { items: [], total: 0, page, limit, totalPages: 0 }
    }

    try {
      let sql = `SELECT * FROM curriculum_words WHERE 1=1`
      const params = []

      if (curriculum && curriculum !== 'all') {
        sql += ` AND curriculum_code = ?`
        params.push(curriculum)
      }

      if (level && level !== 'ALL') {
        const lvlLower = level.toLowerCase()
        sql += ` AND (curriculum_code LIKE ? OR unit_title LIKE ?)`
        params.push(`%${lvlLower}%`, `%${level}%`)
      }

      if (unit) {
        sql += ` AND unit_number = ?`
        params.push(Number(unit))
      }

      if (query && query.trim()) {
        const q = `%${query.trim()}%`
        sql += ` AND (kanji LIKE ? OR kana LIKE ? OR hanviet LIKE ? OR meaning LIKE ?)`
        params.push(q, q, q, q)
      }

      // Count total
      const countSql = sql.replace('SELECT *', 'SELECT count(*) as total')
      const countStmt = this.nihongoDb.prepare(countSql)
      const countRow = countStmt.get(...params)
      const total = countRow ? countRow.total : 0

      // Query page
      sql += ` ORDER BY unit_number ASC, index_num ASC LIMIT ? OFFSET ?`
      const offset = (page - 1) * limit
      const stmt = this.nihongoDb.prepare(sql)
      const rows = stmt.all(...params, limit, offset)

      const items = rows.map((r) => {
        let examples = []
        try {
          if (r.examples) {
            examples = typeof r.examples === 'string' ? JSON.parse(r.examples) : r.examples
          }
        } catch {
          examples = []
        }

        // Infer JLPT Level from curriculum_code (e.g. mimikara_n3 -> N3)
        let inferredLevel = 'N3'
        if (r.curriculum_code) {
          const match = r.curriculum_code.match(/n([1-5])/i)
          if (match) inferredLevel = `N${match[1]}`
        }

        return {
          id: r.id,
          curriculumCode: r.curriculum_code,
          unitNumber: r.unit_number,
          unitTitle: r.unit_title || `Unit ${r.unit_number}`,
          lessonTitle: r.lesson_title || '',
          indexNum: r.index_num,
          word: r.kanji || r.kana,
          reading: r.kana,
          hanViet: r.hanviet || '',
          meaning: r.meaning,
          jlptLevel: inferredLevel,
          partOfSpeech: r.pos_type || 'Danh từ',
          examples: Array.isArray(examples) ? examples : [],
          audioUrl: r.audio_url || '',
        }
      })

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    } catch (err) {
      console.error('[CurriculumService] getCurriculumWords error:', err)
      return { items: [], total: 0, page, limit, totalPages: 0 }
    }
  }

  /**
   * Get curriculum grammar list combining Shinkanzen, Mimi Kara N3 and Bunpo
   */
  getCurriculumGrammar({ curriculum = 'all', level = 'ALL', lesson = null, query = '', page = 1, limit = 50 }) {
    const combined = []

    // 1. Shinkanzen from nihongo.db
    if (this.nihongoDb && (curriculum === 'all' || curriculum.startsWith('shinkanzen'))) {
      try {
        let sql = `SELECT * FROM curriculum_grammar WHERE 1=1`
        const params = []

        if (curriculum && curriculum !== 'all') {
          sql += ` AND curriculum_code = ?`
          params.push(curriculum)
        }

        if (level && level !== 'ALL') {
          const lvlLower = level.toLowerCase()
          sql += ` AND curriculum_code LIKE ?`
          params.push(`%${lvlLower}%`)
        }

        if (lesson) {
          sql += ` AND lesson_id = ?`
          params.push(String(lesson))
        }

        const stmt = this.nihongoDb.prepare(sql)
        const rows = stmt.all(...params)

        for (const r of rows) {
          let parsedData = {}
          try {
            parsedData = typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : r.raw_data || {}
          } catch {
            parsedData = {}
          }

          let inferredLevel = 'N3'
          if (r.curriculum_code) {
            const match = r.curriculum_code.match(/n([1-5])/i)
            if (match) inferredLevel = `N${match[1]}`
          }

          const shinkanzenExs = Array.isArray(parsedData.examples) ? parsedData.examples : []
          const formattedShinkanzenExs = shinkanzenExs.map((ex, i) => {
            const { clean, ruby } = formatFuriganaClean(ex.jp_furigana, ex.jp)
            return {
              no: ex.no || i + 1,
              jp: clean || ex.jp || '',
              jp_ruby: ruby || ex.jp_ruby || ex.jp || '',
              vi: ex.vi || '',
              audio: ex.audio || '',
            }
          })

          const singleGroup = {
            group_no: 1,
            structure: parsedData.structure || '',
            meaning: parsedData.shortMeaning || parsedData.meaning || '',
            usage: parsedData.meaning || '',
            examples: formattedShinkanzenExs,
          }

          combined.push({
            id: `shinkanzen_${r.id}`,
            source: 'shinkanzen',
            curriculumCode: r.curriculum_code,
            lessonId: r.lesson_id,
            lessonTitle: r.lesson_title,
            title: r.title,
            pattern: parsedData.pattern || r.title,
            structure: parsedData.structure || '',
            shortMeaning: parsedData.shortMeaning || parsedData.meaning || '',
            explanation: parsedData.meaning || '',
            usageScope: parsedData.usageScope || '',
            notes: parsedData.notes || '',
            level: inferredLevel,
            groups: [singleGroup],
            examples: formattedShinkanzenExs,
          })
        }
      } catch (err) {
        console.warn('[CurriculumService] Error querying curriculum_grammar:', err.message)
      }
    }

    function formatFuriganaClean(textWithFurigana, rawJp) {
      if (textWithFurigana && typeof textWithFurigana === 'string') {
        let clean = textWithFurigana.replace(/([^（(\s]+)[（(][）)]\s*\[[^\]]+\]/g, '$1')
        clean = clean.replace(/([^[\s]+)\[([^\]]+)\]/g, '$1')
        clean = clean
          .replace(/[（(][）)]/g, '')
          .replace(/\s+/g, ' ')
          .trim()

        let ruby = textWithFurigana.replace(/([^（(\s]+)[（(][）)]\s*\[([^\]]+)\]/g, '<ruby>$1<rt>$2</rt></ruby>')
        ruby = ruby.replace(/([^[\s]+)\[([^\]]+)\]/g, '<ruby>$1<rt>$2</rt></ruby>')
        ruby = ruby
          .replace(/[（(][）)]/g, '')
          .replace(/\s+/g, ' ')
          .trim()

        return { clean: clean || rawJp || '', ruby: ruby || rawJp || '' }
      }
      const clean = (rawJp || '')
        .replace(/[（(][^）)]*[）)]/g, '')
        .replace(/[（(][）)]/g, '')
        .trim()
      return { clean, ruby: clean }
    }

    // 2. Mimi Kara N3 Grammar JSON
    if (curriculum === 'all' || curriculum === 'mimikara_n3' || curriculum === 'mimikara') {
      for (const m of this.mimiGrammarList) {
        if (level && level !== 'ALL' && level !== 'N3') continue
        const lessonNum = String(Math.ceil(m.id / 10))
        if (lesson && String(lesson) !== lessonNum) continue

        const cleanTitle = (m.title || '').replace(/[（(][）)]/g, '').trim()

        const formattedGroups = (
          m.groups && m.groups.length > 0
            ? m.groups
            : [
                {
                  group_no: 1,
                  title: cleanTitle,
                  meaning: m.meaning,
                  structure: m.structure,
                  usage: m.usage,
                  examples: m.examples || [],
                },
              ]
        ).map((g, gIdx) => ({
          group_no: g.group_no || gIdx + 1,
          title: g.title,
          meaning: g.meaning,
          structure: g.structure,
          usage: g.usage,
          examples: (g.examples || []).map((ex, exIdx) => {
            const { clean, ruby } = formatFuriganaClean(ex.jp_furigana, ex.jp_ruby || ex.jp)
            return {
              no: ex.no || exIdx + 1,
              jp: ex.jp || clean,
              jp_ruby: ex.jp_ruby || ruby,
              vi: ex.vi || '',
              audio: ex.audio || '',
            }
          }),
        }))

        const allExamples = formattedGroups.flatMap((g) => g.examples)

        combined.push({
          id: `mimikara_n3_${m.id}`,
          source: 'mimikara',
          curriculumCode: 'mimikara_n3',
          lessonId: lessonNum,
          lessonTitle: `Bài ${lessonNum} (Mẫu ${(Number(lessonNum) - 1) * 10 + 1} - ${Math.min(Number(lessonNum) * 10, this.mimiGrammarList.length)})`,
          title: cleanTitle,
          pattern: cleanTitle,
          structure: m.structure || formattedGroups[0]?.structure || '',
          shortMeaning: m.meaning || formattedGroups[0]?.meaning || '',
          explanation: m.usage || formattedGroups[0]?.usage || '',
          usageScope: m.usage || '',
          notes: m.notes || '',
          level: 'N3',
          groups: formattedGroups,
          examples: allExamples,
        })
      }
    }

    // 3. Filter by query if provided
    let filtered = combined
    if (query && query.trim()) {
      const q = query.trim().toLowerCase()
      filtered = combined.filter(
        (g) =>
          g.pattern.toLowerCase().includes(q) ||
          g.title.toLowerCase().includes(q) ||
          g.shortMeaning.toLowerCase().includes(q) ||
          g.explanation.toLowerCase().includes(q)
      )
    }

    // 4. Deduplicate items that have very similar patterns, prioritizing Shinkanzen (with audio)
    const seenPatterns = new Map()
    const deduplicated = []
    for (const item of filtered) {
      const normKey = item.pattern.replace(/[〜~①②③\s]/g, '').trim()
      if (!seenPatterns.has(normKey)) {
        seenPatterns.set(normKey, item)
        deduplicated.push(item)
      } else {
        // If existing doesn't have audio but current does, replace
        const existing = seenPatterns.get(normKey)
        const hasAudio = item.examples?.some((e) => Boolean(e.audio))
        const existingHasAudio = existing.examples?.some((e) => Boolean(e.audio))
        if (!existingHasAudio && hasAudio) {
          const idx = deduplicated.indexOf(existing)
          if (idx !== -1) {
            deduplicated[idx] = item
            seenPatterns.set(normKey, item)
          }
        }
      }
    }

    const total = deduplicated.length
    const offset = (page - 1) * limit
    const pagedItems = deduplicated.slice(offset, offset + limit)

    return {
      items: pagedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Get units for a word curriculum book
   */
  getCurriculumUnits(curriculum = 'all') {
    if (!this.nihongoDb) return []
    try {
      let sql = `SELECT DISTINCT unit_number, unit_title, count(*) as count FROM curriculum_words WHERE 1=1`
      const params = []
      if (curriculum && curriculum !== 'all') {
        sql += ` AND curriculum_code = ?`
        params.push(curriculum)
      }
      sql += ` GROUP BY unit_number, unit_title ORDER BY unit_number ASC`
      return this.nihongoDb.prepare(sql).all(...params)
    } catch (err) {
      console.warn('[CurriculumService] Error fetching units:', err.message)
      return []
    }
  }

  /**
   * Get lessons for a grammar curriculum book
   */
  getGrammarLessons(curriculum = 'all') {
    const lessons = []
    if (this.nihongoDb && (curriculum === 'all' || curriculum.startsWith('shinkanzen'))) {
      try {
        let sql = `SELECT DISTINCT lesson_id, lesson_title, count(*) as count FROM curriculum_grammar WHERE 1=1`
        const params = []
        if (curriculum && curriculum !== 'all') {
          sql += ` AND curriculum_code = ?`
          params.push(curriculum)
        }
        sql += ` GROUP BY lesson_id, lesson_title ORDER BY lesson_id ASC`
        const rows = this.nihongoDb.prepare(sql).all(...params)
        lessons.push(...rows)
      } catch (err) {
        console.warn('[CurriculumService] Error fetching grammar lessons:', err.message)
      }
    }

    if (curriculum === 'all' || curriculum === 'mimikara_n3' || curriculum === 'mimikara') {
      const totalMimi = this.mimiGrammarList.length || 110
      const totalLessons = Math.ceil(totalMimi / 10)
      for (let i = 1; i <= totalLessons; i++) {
        const start = (i - 1) * 10 + 1
        const end = Math.min(i * 10, totalMimi)
        lessons.push({
          lesson_id: String(i),
          lesson_title: `Bài ${i} (Mẫu ${start} - ${end})`,
          count: end - start + 1,
        })
      }
    }

    return lessons
  }

  /**
   * Get curriculum stats (available books and counts)
   */
  getCurriculumStats() {
    const wordBooks = []
    const grammarBooks = []

    if (this.nihongoDb) {
      try {
        const wGroups = this.nihongoDb
          .prepare('SELECT curriculum_code, count(*) as count FROM curriculum_words GROUP BY curriculum_code')
          .all()
        for (const g of wGroups) {
          wordBooks.push({ code: g.curriculum_code, count: g.count })
        }

        const gGroups = this.nihongoDb
          .prepare('SELECT curriculum_code, count(*) as count FROM curriculum_grammar GROUP BY curriculum_code')
          .all()
        for (const g of gGroups) {
          grammarBooks.push({ code: g.curriculum_code, count: g.count })
        }
      } catch (err) {
        console.warn('[CurriculumService] Error fetching stats from nihongo.db:', err.message)
      }
    }

    if (this.mimiGrammarList.length > 0) {
      grammarBooks.push({ code: 'mimikara_n3', count: this.mimiGrammarList.length })
    }

    return {
      wordBooks,
      grammarBooks,
      totalMimiGrammar: this.mimiGrammarList.length,
      hasExternalDb: Boolean(this.nihongoDb),
    }
  }
}
