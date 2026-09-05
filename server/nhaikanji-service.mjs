import fs from 'node:fs'
import path from 'node:path'

// Helper to remove Vietnamese diacritics for flexible search
function removeVietnameseTones(str) {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

function parseCSVLine(text) {
  const result = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  result.push(cur)
  return result
}

export class NhaiKanjiService {
  constructor(options = {}) {
    this.dataPath =
      options.dataPath ||
      process.env.NHAIKANJI_DATA_PATH ||
      'D:/VKU/data/drive-download-20260828T102340Z-1-002/nhaikanji_data'

    this.kanjiSummaryList = []
    this.kanjiMap = new Map() // kanji char -> summary object
    this.fullKanjiData = null // loaded lazily or on demand
    this.bunpoList = []
    this.jlptExamsMaster = null

    this.isLoaded = false
  }

  ensureLoaded() {
    if (this.isLoaded) {
      this.reloadFullMaster()
      return
    }

    try {
      // 1. Load Kanji Summary CSV
      const summaryFile = path.join(this.dataPath, 'kanji_summary.csv')
      if (fs.existsSync(summaryFile)) {
        let raw = fs.readFileSync(summaryFile, 'utf8').replace(/^\uFEFF/, '')
        const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0)
        if (lines.length > 1) {
          const headers = parseCSVLine(lines[0]).map((h) => h.trim().replace(/^\uFEFF/, ''))
          for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i])
            const row = {}
            headers.forEach((h, idx) => {
              row[h] = (cols[idx] || '').trim()
            })
            if (row.kanji) {
              row.normalizedHanzi = removeVietnameseTones(row.hanzi)
              row.normalizedMeaning = removeVietnameseTones(row.meaning_vi)
              this.kanjiSummaryList.push(row)
              this.kanjiMap.set(row.kanji, row)
            }
          }
        }
      }

      // 2. Load Bunpo data
      const bunpoFile = path.join(this.dataPath, 'bunpo_data.json')
      if (fs.existsSync(bunpoFile)) {
        const rawBunpo = fs.readFileSync(bunpoFile, 'utf8')
        this.bunpoList = JSON.parse(rawBunpo).map((item) => ({
          ...item,
          normalizedPattern: removeVietnameseTones(item.pattern),
          normalizedMeaning: removeVietnameseTones(item.shortMeaning || ''),
        }))
      }

      // 3. Load JLPT Full Master (N1 -> N5 từ Corodomo với Từ vựng, Ngữ pháp, Đọc hiểu có bài đọc, Nghe hiểu có Audio)
      this.fullMasterFile = path.resolve(process.cwd(), 'data', 'jlpt_full_master.json')
      this.fullMasterMtime = 0
      this.toanMasterFile = path.resolve(process.cwd(), 'data', 'jlpt_n3_toan_master.json')
      this.toanMasterMtime = 0
      this.reloadFullMaster()

      // 4. Load JLPT Exams Master dự phòng
      const jlptFile = path.join(this.dataPath, 'de_thi_jlpt', 'jlpt_all_exams_master.json')
      if (fs.existsSync(jlptFile)) {
        const rawJlpt = fs.readFileSync(jlptFile, 'utf8')
        this.jlptExamsMaster = JSON.parse(rawJlpt)
      }

      this.isLoaded = true
    } catch (err) {
      console.warn('[NhaiKanjiService] Warning during load:', err.message)
      this.isLoaded = true
    }
  }

  reloadFullMaster() {
    try {
      if (this.fullMasterFile && fs.existsSync(this.fullMasterFile)) {
        const stats = fs.statSync(this.fullMasterFile)
        if (stats.mtimeMs > this.fullMasterMtime) {
          const rawFull = fs.readFileSync(this.fullMasterFile, 'utf8')
          this.jlptFullMaster = JSON.parse(rawFull)
          this.fullMasterMtime = stats.mtimeMs
        }
      }
      if (this.toanMasterFile && fs.existsSync(this.toanMasterFile)) {
        const stats = fs.statSync(this.toanMasterFile)
        if (stats.mtimeMs > this.toanMasterMtime) {
          const rawToan = fs.readFileSync(this.toanMasterFile, 'utf8')
          this.toanMockMaster = JSON.parse(rawToan)
          this.toanMasterMtime = stats.mtimeMs
        }
      }
    } catch (err) {
      console.warn('[NhaiKanjiService] Failed to reload full master:', err.message)
    }
  }

  loadFullKanjiJson() {
    if (this.fullKanjiData) return this.fullKanjiData
    try {
      const fullFile = path.join(this.dataPath, 'kanji_full_data.json')
      if (fs.existsSync(fullFile)) {
        const raw = fs.readFileSync(fullFile, 'utf8')
        this.fullKanjiData = JSON.parse(raw)
      } else {
        this.fullKanjiData = {}
      }
    } catch (err) {
      console.warn('[NhaiKanjiService] Failed to load full kanji json:', err.message)
      this.fullKanjiData = {}
    }
    return this.fullKanjiData
  }

  getKanjiList({ level, query = '', page = 1, limit = 50 }) {
    this.ensureLoaded()
    let results = this.kanjiSummaryList

    if (level && level.toUpperCase() !== 'ALL') {
      const targetLevel = level.toUpperCase()
      results = results.filter((k) => k.jlpt_level && k.jlpt_level.toUpperCase() === targetLevel)
    }

    if (query && query.trim()) {
      const q = query.trim().toLowerCase()
      const normQ = removeVietnameseTones(q)

      results = results.filter((k) => {
        return (
          k.kanji.includes(query) ||
          k.hanzi.toLowerCase().includes(q) ||
          k.normalizedHanzi.includes(normQ) ||
          k.meaning_vi.toLowerCase().includes(q) ||
          k.normalizedMeaning.includes(normQ) ||
          (k.onyomi && k.onyomi.toLowerCase().includes(q)) ||
          (k.kunyomi && k.kunyomi.toLowerCase().includes(q))
        )
      })
    }

    const total = results.length
    const offset = (Math.max(1, page) - 1) * limit
    const items = results.slice(offset, offset + limit)

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    }
  }

  getKanjiDetail(kanjiChar) {
    this.ensureLoaded()
    const summary = this.kanjiMap.get(kanjiChar)
    const fullData = this.loadFullKanjiJson()
    const detail = fullData[kanjiChar] || null

    if (!summary && !detail) {
      return null
    }

    return {
      kanji: kanjiChar,
      summary: summary || null,
      detail: detail || null,
    }
  }

  getBunpoList({ level, bookId, query = '', page = 1, limit = 50 }) {
    this.ensureLoaded()
    let results = this.bunpoList

    if (level && level.toUpperCase() !== 'ALL') {
      const targetLevel = level.toUpperCase()
      results = results.filter((b) => b.level && b.level.toUpperCase() === targetLevel)
    }

    if (bookId && bookId !== 'all') {
      results = results.filter((b) => b.bookId === bookId)
    }

    if (query && query.trim()) {
      const q = query.trim().toLowerCase()
      const normQ = removeVietnameseTones(q)

      results = results.filter((b) => {
        return (
          b.pattern.toLowerCase().includes(q) ||
          (b.shortMeaning && b.shortMeaning.toLowerCase().includes(q)) ||
          b.normalizedPattern.includes(normQ) ||
          b.normalizedMeaning.includes(normQ) ||
          (b.structure && b.structure.toLowerCase().includes(q))
        )
      })
    }

    const total = results.length
    const offset = (Math.max(1, page) - 1) * limit
    const items = results.slice(offset, offset + limit)

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    }
  }

  getJlptExams({ level, section }) {
    this.ensureLoaded()
    let exams = []

    // 1. Nạp từ kho đề thi trọn gói ToanSensei (30 đề Full Mock Exam N3 từ 2010 đến 2025)
    if (this.toanMockMaster && Array.isArray(this.toanMockMaster) && this.toanMockMaster.length > 0) {
      this.toanMockMaster.forEach((t) => {
        exams.push({
          id: t.id,
          title: t.title,
          level: t.level || 'N3',
          year: t.year || '2025',
          session: t.session || '07',
          section: t.section || 'full_mock',
          sectionLabel: t.sectionLabel || 'Thi thử Trọn gói (180 điểm)',
          sectionLabelJP: t.sectionLabelJP || '総合模擬試験 (180点満点)',
          timeLimit: t.timeLimit || 140,
          questionCount:
            t.questionCount || (t.parts ? t.parts.reduce((acc, p) => acc + (p.questions?.length || 0), 0) : 0),
          audioUrl: t.audioUrl,
          isFullMock: true,
          available: true,
        })
      })
    }

    // 2. Nạp từ kho đề thi đầy đủ 199 đề thi N1-N5 (Corodomo Master - Luyện từng phần)
    if (this.jlptFullMaster && Array.isArray(this.jlptFullMaster) && this.jlptFullMaster.length > 0) {
      this.jlptFullMaster.forEach((t) => {
        exams.push({
          id: t.id,
          title: t.title,
          level: t.level || 'N3',
          year: t.year || '2024',
          session: t.session || '12',
          section: t.section,
          sectionLabel: t.sectionLabel,
          sectionLabelJP: t.sectionLabelJP,
          timeLimit: t.timeLimit || 40,
          questionCount:
            t.questionCount || (t.parts ? t.parts.reduce((acc, p) => acc + (p.questions?.length || 0), 0) : 0),
          audioUrl: t.audioUrl,
          isFullMock: false,
          available: true,
        })
      })
    } else if (this.jlptExamsMaster) {
      // 3. Dự phòng master cũ
      const levels = ['n5', 'n4', 'n3', 'n2', 'n1']
      levels.forEach((lvlKey) => {
        const lvlData = this.jlptExamsMaster[lvlKey]
        if (lvlData && Array.isArray(lvlData.tests)) {
          lvlData.tests.forEach((t) => {
            const qCount = t.parts ? t.parts.reduce((acc, p) => acc + (p.questions ? p.questions.length : 0), 0) : 0
            if (qCount > 0) {
              exams.push({
                id: t.id,
                title: t.title || `${t.level || lvlKey.toUpperCase()} - ${t.year} (${t.sectionLabel || 'Tổng hợp'})`,
                level: t.level || lvlKey.toUpperCase(),
                year: t.year,
                session: t.session,
                section: t.section,
                sectionLabel: t.sectionLabel,
                sectionLabelJP: t.sectionLabelJP,
                timeLimit: t.timeLimit,
                questionCount: qCount,
                isFullMock: false,
                available: true,
              })
            }
          })
        }
      })
    }

    if (level && level.toUpperCase() !== 'ALL') {
      exams = exams.filter((e) => e.level.toUpperCase() === level.toUpperCase())
    }

    if (section && section !== 'all') {
      exams = exams.filter((e) => e.section === section)
    }

    return { exams }
  }

  getJlptExamDetail(examId) {
    this.ensureLoaded()

    // 1. Tìm trong kho đề Full Mock Exam ToanSensei
    if (this.toanMockMaster && Array.isArray(this.toanMockMaster)) {
      const found = this.toanMockMaster.find((e) => e.id === examId)
      if (found) {
        return found
      }
    }

    // 2. Tìm trong kho đề Corodomo Master (Đầy đủ 199 đề thi N1 - N5)
    if (this.jlptFullMaster && Array.isArray(this.jlptFullMaster)) {
      const found = this.jlptFullMaster.find((e) => e.id === examId)
      if (found) {
        return found
      }
    }

    // 3. Dự phòng trong đề master truyền thống (N5 -> N1)
    if (this.jlptExamsMaster) {
      const levels = ['n5', 'n4', 'n3', 'n2', 'n1']
      for (const lvlKey of levels) {
        const lvlData = this.jlptExamsMaster[lvlKey]
        if (lvlData && Array.isArray(lvlData.tests)) {
          const found = lvlData.tests.find((t) => t.id === examId)
          if (found) {
            return found
          }
        }
      }
    }
    return null
  }

  submitJlptExam(examId, answers = {}) {
    const exam = this.getJlptExamDetail(examId)
    if (!exam) return null

    let totalQuestions = 0
    let correctCount = 0
    const questionResults = []

    const isFullMock = exam.isFullMock || exam.section === 'full_mock'
    const level = (exam.level || 'N3').toUpperCase()

    // Phân nhóm câu hỏi theo từng kỹ năng chuẩn JLPT
    const sectionGroups = {
      vocab: { name: 'Từ vựng (文字・語彙)', total: 0, correct: 0, weightedTotal: 0, weightedCorrect: 0, maxScore: 60, minPass: 19 },
      grammar: { name: 'Ngữ pháp (文法)', total: 0, correct: 0, weightedTotal: 0, weightedCorrect: 0, maxScore: 60, minPass: 19 },
      reading: { name: 'Đọc hiểu (読解)', total: 0, correct: 0, weightedTotal: 0, weightedCorrect: 0, maxScore: 60, minPass: 19 },
      listening: { name: 'Nghe hiểu (聴解)', total: 0, correct: 0, weightedTotal: 0, weightedCorrect: 0, maxScore: 60, minPass: 19 },
    }

    if (Array.isArray(exam.parts)) {
      exam.parts.forEach((part, partIdx) => {
        const title = (part.title || '').toLowerCase()
        const instruction = (part.instruction || '').toLowerCase()
        const sectionType = part.sectionType // 1: vocab, 2: grammar, 3: reading, 4: listening

        let targetGroup = sectionGroups.grammar
        if (sectionType === 1 || exam.section === 'vocab' || title.includes('文字') || title.includes('語彙')) {
          targetGroup = sectionGroups.vocab
        } else if (sectionType === 2 || title.includes('文法')) {
          targetGroup = sectionGroups.grammar
        } else if (
          sectionType === 3 ||
          Boolean(part.passage) ||
          title.includes('読解') ||
          instruction.includes('文章を読ん') ||
          instruction.includes('右のページ') ||
          (exam.section === 'grammar-reading' && partIdx >= 3)
        ) {
          targetGroup = sectionGroups.reading
        } else if (
          sectionType === 4 ||
          exam.section === 'listening' ||
          title.includes('聴解') ||
          title.includes('問題1では、まず')
        ) {
          targetGroup = sectionGroups.listening
        }

        if (Array.isArray(part.questions)) {
          part.questions.forEach((q, qIdx) => {
            totalQuestions++
            targetGroup.total++

            const qWeight = Number(q.scoreWeight || q.diem || 1)
            targetGroup.weightedTotal += qWeight

            const qId = q.id || `p${partIdx}_q${qIdx}`
            const userAnswer = answers[qId] ?? answers[q.number] ?? null
            const correctAnswer = q.correctAnswer ?? q.answer ?? 1
            const isCorrect = String(userAnswer) === String(correctAnswer)

            if (isCorrect) {
              correctCount++
              targetGroup.correct++
              targetGroup.weightedCorrect += qWeight
            }

            questionResults.push({
              id: qId,
              number: q.number,
              partTitle: part.title || part.titleJP,
              questionText: q.sentence || q.text || q.question,
              passage: q.passage || part.passage || null,
              image: q.image || null,
              audio: q.audio || q.audioUrl || null,
              script: q.script || null,
              scriptVi: q.scriptVi || null,
              audioStart: q.audioStart ?? null,
              audioEnd: q.audioEnd ?? null,
              audioSegments: q.audioSegments || [],
              options: q.options || [],
              scoreWeight: qWeight,
              userAnswer,
              correctAnswer,
              isCorrect,
              explanation: q.explanation || '',
            })
          })
        }
      })
    }

    const scorePercentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0

    // Chuẩn điểm đỗ chuẩn JLPT theo cấp độ (Thang 180)
    let passScore180 = 95
    let passPercentage = 53
    if (level === 'N1') {
      passScore180 = 100
      passPercentage = 56
    } else if (level === 'N2') {
      passScore180 = 90
      passPercentage = 50
    } else if (level === 'N3') {
      passScore180 = 95
      passPercentage = 53
    } else if (level === 'N4') {
      passScore180 = 90
      passPercentage = 50
    } else if (level === 'N5') {
      passScore180 = 80
      passPercentage = 45
    }

    // 3 Section chính theo cấu trúc JLPT:
    // 1. 言語知識 (文字・語彙・文法) = Vocab + Grammar (Max 60, minPass 19)
    // 2. 読解 = Reading (Max 60, minPass 19)
    // 3. 聴解 = Listening (Max 60, minPass 19)
    const sec1TotalWeight = sectionGroups.vocab.weightedTotal + sectionGroups.grammar.weightedTotal
    const sec1CorrectWeight = sectionGroups.vocab.weightedCorrect + sectionGroups.grammar.weightedCorrect
    const sec1TotalQ = sectionGroups.vocab.total + sectionGroups.grammar.total
    const sec1CorrectQ = sectionGroups.vocab.correct + sectionGroups.grammar.correct
    const sec1Score = sec1TotalWeight > 0 ? Math.round((sec1CorrectWeight / sec1TotalWeight) * 60) : 0
    const sec1Min = 19
    const isSection1Failed = sec1Score < sec1Min && sec1TotalQ > 0

    const sec2TotalWeight = sectionGroups.reading.weightedTotal
    const sec2CorrectWeight = sectionGroups.reading.weightedCorrect
    const sec2TotalQ = sectionGroups.reading.total
    const sec2CorrectQ = sectionGroups.reading.correct
    const sec2Score = sec2TotalWeight > 0 ? Math.round((sec2CorrectWeight / sec2TotalWeight) * 60) : 0
    const sec2Min = 19
    const isSection2Failed = sec2Score < sec2Min && sec2TotalQ > 0

    const sec3TotalWeight = sectionGroups.listening.weightedTotal
    const sec3CorrectWeight = sectionGroups.listening.weightedCorrect
    const sec3TotalQ = sectionGroups.listening.total
    const sec3CorrectQ = sectionGroups.listening.correct
    const sec3Score = sec3TotalWeight > 0 ? Math.round((sec3CorrectWeight / sec3TotalWeight) * 60) : 0
    const sec3Min = 19
    const isSection3Failed = sec3Score < sec3Min && sec3TotalQ > 0

    const scaledTotalScore = sec1Score + sec2Score + sec3Score
    const maxScore180 = 180

    const hasSectionalFailure = isSection1Failed || isSection2Failed || isSection3Failed
    const isOverallScorePassed = isFullMock ? scaledTotalScore >= passScore180 : scorePercentage >= passPercentage
    const passed = isOverallScorePassed && !hasSectionalFailure

    // Tính mức chuẩn CEFR
    let cefrLevel = 'Chưa đạt'
    if (passed) {
      if (level === 'N1') {
        cefrLevel = scaledTotalScore >= 142 ? 'C1' : (scaledTotalScore >= 100 ? 'B2' : 'Chưa đạt')
      } else if (level === 'N2') {
        cefrLevel = scaledTotalScore >= 112 ? 'B2' : (scaledTotalScore >= 90 ? 'B1' : 'Chưa đạt')
      } else if (level === 'N3') {
        cefrLevel = scaledTotalScore >= 104 ? 'B1' : (scaledTotalScore >= 95 ? 'A2' : 'Chưa đạt')
      } else if (level === 'N4') {
        cefrLevel = scaledTotalScore >= 90 ? 'A2' : 'Chưa đạt'
      } else if (level === 'N5') {
        cefrLevel = scaledTotalScore >= 80 ? 'A1' : 'Chưa đạt'
      }
    }

    const failedSectionNames = []
    if (isSection1Failed) failedSectionNames.push('Từ vựng & Ngữ pháp')
    if (isSection2Failed) failedSectionNames.push('Đọc hiểu')
    if (isSection3Failed) failedSectionNames.push('Nghe hiểu')

    let resultStatus = passed ? 'PASSED' : 'FAILED_SCORE'
    let resultMessage = passed ? 'CHÚC MỪNG! BẠN ĐÃ ĐỖ KỲ THI' : 'CHƯA ĐẠT (ĐIỂM TỔNG CHƯA ĐẠT ĐIỂM CHUẨN)'
    if (hasSectionalFailure) {
      resultStatus = 'FAILED_SECTIONAL'
      resultMessage = `CHƯA ĐẠT DO BỊ ĐIỂM LIỆT (${failedSectionNames.join(', ')})`
    }

    const sectionBreakdown = {
      section1: {
        name: '言語知識（文字・語彙・文法）',
        nameVi: 'Từ vựng & Ngữ pháp',
        score: sec1Score,
        max: 60,
        minPass: 19,
        isFailed: isSection1Failed,
        correct: sec1CorrectQ,
        total: sec1TotalQ,
      },
      section2: {
        name: '読解',
        nameVi: 'Đọc hiểu',
        score: sec2Score,
        max: 60,
        minPass: 19,
        isFailed: isSection2Failed,
        correct: sec2CorrectQ,
        total: sec2TotalQ,
      },
      section3: {
        name: '聴解',
        nameVi: 'Nghe hiểu',
        score: sec3Score,
        max: 60,
        minPass: 19,
        isFailed: isSection3Failed,
        correct: sec3CorrectQ,
        total: sec3TotalQ,
      },
    }

    // Chuẩn sectionalScores tương thích với giao diện cũ
    const sectionalScores = [
      {
        name: 'Từ vựng & Ngữ pháp (文字・語彙・文法)',
        correct: sec1CorrectQ,
        total: sec1TotalQ,
        percentage: sec1TotalQ > 0 ? Math.round((sec1CorrectQ / sec1TotalQ) * 100) : 0,
        scaledScore: sec1Score,
        maxScore: 60,
        minPass: 19,
        isBelowThreshold: isSection1Failed,
      },
      {
        name: 'Đọc hiểu (読解)',
        correct: sec2CorrectQ,
        total: sec2TotalQ,
        percentage: sec2TotalQ > 0 ? Math.round((sec2CorrectQ / sec2TotalQ) * 100) : 0,
        scaledScore: sec2Score,
        maxScore: 60,
        minPass: 19,
        isBelowThreshold: isSection2Failed,
      },
      {
        name: 'Nghe hiểu (聴解)',
        correct: sec3CorrectQ,
        total: sec3TotalQ,
        percentage: sec3TotalQ > 0 ? Math.round((sec3CorrectQ / sec3TotalQ) * 100) : 0,
        scaledScore: sec3Score,
        maxScore: 60,
        minPass: 19,
        isBelowThreshold: isSection3Failed,
      },
    ]

    return {
      examId,
      title: exam.title,
      level,
      isFullMock,
      totalQuestions,
      correctCount,
      scorePercentage,
      passPercentage,
      scaledTotalScore,
      maxScore180,
      passScore180,
      cefrLevel,
      passed,
      resultStatus,
      resultMessage,
      hasSectionalFailure,
      sectionBreakdown,
      sectionalScores,
      questionResults,
    }
  }
}

export const nhaiKanjiService = new NhaiKanjiService()
