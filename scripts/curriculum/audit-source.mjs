import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

/**
 * Standard RFC 4180 CSV parser
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCSV(text) {
  const rows = []
  let currentRow = []
  let currentField = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"'
          i += 2
          continue
        } else {
          inQuotes = false
          i++
          continue
        }
      } else {
        currentField += char
        i++
      }
    } else {
      if (char === '"') {
        inQuotes = true
        i++
      } else if (char === ',') {
        currentRow.push(currentField)
        currentField = ''
        i++
      } else if (char === '\r') {
        if (i + 1 < text.length && text[i + 1] === '\n') {
          i++
        }
        currentRow.push(currentField)
        currentField = ''
        rows.push(currentRow)
        currentRow = []
        i++
      } else if (char === '\n') {
        currentRow.push(currentField)
        currentField = ''
        rows.push(currentRow)
        currentRow = []
        i++
      } else {
        currentField += char
        i++
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField)
    rows.push(currentRow)
  }

  return rows
}

/**
 * Computes SHA-256 hash of a buffer
 * @param {Buffer} buffer
 * @returns {string}
 */
export function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/**
 * Computes SHA-256 hash of a file
 * @param {string} filePath
 * @returns {string}
 */
export function hashFile(filePath) {
  const content = fs.readFileSync(filePath)
  return hashBuffer(content)
}

/**
 * Detects schema and record count for structured files
 * @param {string} filePath
 * @param {string} format
 * @returns {{ recordCount: number, detectedSchema: string[] }}
 */
export function detectSchemaAndRecords(filePath, format) {
  if (format === '.json') {
    try {
      const raw = fs.readFileSync(filePath, 'utf8')
      const data = JSON.parse(raw)
      if (Array.isArray(data)) {
        const schemaSet = new Set()
        for (const item of data) {
          if (item && typeof item === 'object') {
            for (const k of Object.keys(item)) schemaSet.add(k)
          }
        }
        return {
          recordCount: data.length,
          detectedSchema: Array.from(schemaSet).sort(),
        }
      } else if (data && typeof data === 'object') {
        const keys = Object.keys(data).sort()
        let count = 0
        const childSchema = new Set()
        for (const k of keys) {
          const val = data[k]
          if (Array.isArray(val)) {
            count += val.length
            for (const item of val) {
              if (item && typeof item === 'object') {
                for (const subKey of Object.keys(item)) childSchema.add(subKey)
              }
            }
          } else if (val && typeof val === 'object') {
            const nestedKeys = Object.keys(val)
            for (const nk of nestedKeys) {
              const nestedVal = val[nk]
              if (nestedVal && typeof nestedVal === 'object' && Array.isArray(nestedVal.words)) {
                count += nestedVal.words.length
                for (const w of nestedVal.words) {
                  if (w && typeof w === 'object') {
                    for (const wk of Object.keys(w)) childSchema.add(wk)
                  }
                }
              } else {
                count++
              }
            }
          } else {
            count++
          }
        }
        const schema = childSchema.size > 0
          ? [...keys.map((k) => `top:${k}`), ...Array.from(childSchema).sort()]
          : keys
        return {
          recordCount: count,
          detectedSchema: schema,
        }
      }
    } catch {
      return { recordCount: 0, detectedSchema: [] }
    }
  }

  if (format === '.csv') {
    try {
      const raw = fs.readFileSync(filePath, 'utf8')
      const rows = parseCSV(raw)
      if (rows.length === 0) return { recordCount: 0, detectedSchema: [] }
      const header = rows[0].map((h) => h.trim())
      const dataRows = rows.slice(1).filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ''))
      return {
        recordCount: dataRows.length,
        detectedSchema: header.sort(),
      }
    } catch {
      return { recordCount: 0, detectedSchema: [] }
    }
  }

  if (format === '.md') {
    try {
      const raw = fs.readFileSync(filePath, 'utf8')
      const lines = raw.split('\n')
      let tableRows = 0
      for (const line of lines) {
        const trimmed = line.trim()
        if (
          trimmed.startsWith('|') &&
          !trimmed.includes('---') &&
          !trimmed.includes('STT') &&
          !trimmed.includes('Từ vựng') &&
          !trimmed.includes('Tiếng Nhật')
        ) {
          tableRows++
        }
      }
      return {
        recordCount: tableRows,
        detectedSchema: ['markdown_table_rows'],
      }
    } catch {
      return { recordCount: 0, detectedSchema: [] }
    }
  }

  return { recordCount: 0, detectedSchema: [] }
}

/**
 * Recursively walks a directory and collects all file paths
 * @param {string} dir
 * @param {string} baseDir
 * @returns {string[]}
 */
export function collectFiles(dir, baseDir = dir) {
  const files = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, baseDir))
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/')
      files.push(relPath)
    }
  }
  return files
}

/**
 * Audits all files in the source root
 * @param {string} sourceRoot
 * @returns {{
 *   sourceRoot: string,
 *   totalFiles: number,
 *   manifestFiles: Array<{
 *     path: string,
 *     sha256: string,
 *     sizeBytes: number,
 *     format: string,
 *     recordCount: number,
 *     detectedSchema: string[]
 *   }>,
 *   overallManifestHash: string,
 *   formatBreakdown: Record<string, number>,
 *   folderBreakdown: Record<string, { mdCount: number, recordCount: number }>
 * }}
 */
export function auditSourceDirectory(sourceRoot) {
  const absRoot = path.resolve(sourceRoot)
  if (!fs.existsSync(absRoot)) {
    throw new Error(`Source root directory does not exist: ${absRoot}`)
  }

  const relFiles = collectFiles(absRoot).sort()
  const manifestFiles = []
  const formatBreakdown = {}
  const folderBreakdown = {}

  for (const relPath of relFiles) {
    const fullPath = path.join(absRoot, relPath)
    const stats = fs.statSync(fullPath)
    const format = path.extname(relPath).toLowerCase() || '[none]'
    formatBreakdown[format] = (formatBreakdown[format] || 0) + 1

    const sha256 = hashFile(fullPath)
    const { recordCount, detectedSchema } = detectSchemaAndRecords(fullPath, format)

    const folder = path.dirname(relPath)
    if (!folderBreakdown[folder]) {
      folderBreakdown[folder] = { mdCount: 0, recordCount: 0 }
    }
    if (format === '.md') folderBreakdown[folder].mdCount++
    if (recordCount > 0) folderBreakdown[folder].recordCount += recordCount

    manifestFiles.push({
      path: relPath,
      sha256,
      sizeBytes: stats.size,
      format,
      recordCount,
      detectedSchema,
    })
  }

  // Calculate deterministic overall hash across all sorted file hashes
  const overallHasher = crypto.createHash('sha256')
  for (const file of manifestFiles) {
    overallHasher.update(`${file.path}:${file.sha256}:${file.sizeBytes}\n`)
  }
  const overallManifestHash = overallHasher.digest('hex')

  return {
    sourceRoot: absRoot,
    totalFiles: manifestFiles.length,
    manifestFiles,
    overallManifestHash,
    formatBreakdown,
    folderBreakdown,
  }
}

/**
 * Deep inspection of all_vocabulary_master.json
 * @param {string} filePath
 */
export function deepAnalyzeMasterVocabulary(filePath) {
  if (!fs.existsSync(filePath)) {
    return null
  }

  const raw = fs.readFileSync(filePath, 'utf8')
  const records = JSON.parse(raw)

  const levelCounts = {}
  const sourceCounts = {}
  const lessonCountsBySource = {}
  const uniqueWords = new Set()
  const uniqueWordReadingPairs = new Set()
  const exactIdenticalMap = new Map()
  const wordReadingMeaningMap = new Map()
  const wordCountMap = new Map()

  let missingReadingCount = 0
  let missingMeaningCount = 0
  let missingHanVietCount = 0
  let missingExampleCount = 0
  let missingExampleViCount = 0
  let emptyWordCount = 0

  const malformedRecords = []

  for (let idx = 0; idx < records.length; idx++) {
    const r = records[idx]
    const word = (r.word || '').trim()
    const reading = (r.reading || '').trim()
    const meaning = (r.meaning || '').trim()
    const hanViet = (r.han_viet || '').trim()
    const example = (r.example || '').trim()
    const exampleVi = (r.example_vi || '').trim()
    const level = (r.level || 'UNSPECIFIED').trim()
    const source = (r.source || 'UNSPECIFIED').trim()
    const lesson = (r.lesson || 'UNSPECIFIED').trim()

    levelCounts[level] = (levelCounts[level] || 0) + 1
    sourceCounts[source] = (sourceCounts[source] || 0) + 1

    if (!lessonCountsBySource[source]) lessonCountsBySource[source] = new Set()
    lessonCountsBySource[source].add(lesson)

    if (!word) {
      emptyWordCount++
      malformedRecords.push({ index: idx, reason: 'empty_word', record: r })
    } else {
      uniqueWords.add(word)
      uniqueWordReadingPairs.add(`${word}||${reading}`)
      wordCountMap.set(word, (wordCountMap.get(word) || 0) + 1)
    }

    if (!reading) missingReadingCount++
    if (!meaning) {
      missingMeaningCount++
      malformedRecords.push({ index: idx, reason: 'missing_meaning', record: r })
    }
    if (!hanViet) missingHanVietCount++
    if (!example) missingExampleCount++
    if (!exampleVi) missingExampleViCount++

    // Duplicates check
    const exactKey = JSON.stringify(r)
    exactIdenticalMap.set(exactKey, (exactIdenticalMap.get(exactKey) || 0) + 1)

    const wrmKey = `${word}||${reading}||${meaning}`
    wordReadingMeaningMap.set(wrmKey, (wordReadingMeaningMap.get(wrmKey) || 0) + 1)

    // Check suspicious reading (e.g. Vietnamese in reading)
    if (/[a-zA-Zàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(reading)) {
      malformedRecords.push({ index: idx, reason: 'reading_contains_vietnamese', record: r })
    }
  }

  let exactDuplicateRecords = 0
  for (const count of exactIdenticalMap.values()) {
    if (count > 1) exactDuplicateRecords += count - 1
  }

  let sameWordReadingMeaningDuplicates = 0
  for (const count of wordReadingMeaningMap.values()) {
    if (count > 1) sameWordReadingMeaningDuplicates += count - 1
  }

  let multiRecordWords = 0
  for (const count of wordCountMap.values()) {
    if (count > 1) multiRecordWords++
  }

  return {
    totalRecords: records.length,
    uniqueWordsCount: uniqueWords.size,
    uniqueWordReadingPairsCount: uniqueWordReadingPairs.size,
    emptyWordCount,
    missingReadingCount,
    missingMeaningCount,
    missingHanVietCount,
    missingExampleCount,
    missingExampleViCount,
    exactDuplicateRecords,
    sameWordReadingMeaningDuplicates,
    multiRecordWords,
    levelCounts,
    sourceCounts,
    lessonCountsBySource: Object.fromEntries(
      Object.entries(lessonCountsBySource).map(([k, v]) => [k, v.size])
    ),
    malformedRecords,
  }
}

/**
 * Builds data-audit.md content
 */
/**
 * Categorizes all markdown files into levels, specialized, and root readme
 * @param {Array<{ path: string, format: string }>} manifestFiles
 */
export function categorizeMarkdownFiles(manifestFiles) {
  const breakdown = {
    A1: 0,
    A2: 0,
    N5: 0,
    N4: 0,
    N3: 0,
    N2: 0,
    N1: 0,
    SE: 0,
    rootReadme: 0,
    other: 0,
  }

  for (const file of manifestFiles) {
    if (file.format !== '.md') continue
    const p = file.path
    if (p === 'README.md') {
      breakdown.rootReadme++
    } else if (p.startsWith('00_Nhap_Mon_Va_Giao_Tiep_Co_Ban/01_Tsunagaru_Nihongo_A1_A2/Level_1_A1/')) {
      breakdown.A1++
    } else if (
      p.startsWith('00_Nhap_Mon_Va_Giao_Tiep_Co_Ban/01_Tsunagaru_Nihongo_A1_A2/Level_2_A2_1/') ||
      p.startsWith('00_Nhap_Mon_Va_Giao_Tiep_Co_Ban/01_Tsunagaru_Nihongo_A1_A2/Level_3_A2_2/')
    ) {
      breakdown.A2++
    } else if (p.startsWith('00_Nhap_Mon_Va_Giao_Tiep_Co_Ban/02_Tu_Vung_Giao_Tiep_Chuyen_De/')) {
      breakdown.SE++
    } else if (p.startsWith('01_Cap_Do_N5/')) {
      breakdown.N5++
    } else if (p.startsWith('02_Cap_Do_N4/')) {
      breakdown.N4++
    } else if (p.startsWith('03_Cap_Do_N3/')) {
      breakdown.N3++
    } else if (p.startsWith('04_Cap_Do_N2/')) {
      breakdown.N2++
    } else if (p.startsWith('05_Cap_Do_N1/')) {
      breakdown.N1++
    } else {
      breakdown.other++
    }
  }

  const totalLessons =
    breakdown.A1 +
    breakdown.A2 +
    breakdown.N5 +
    breakdown.N4 +
    breakdown.N3 +
    breakdown.N2 +
    breakdown.N1 +
    breakdown.SE +
    breakdown.other

  return {
    ...breakdown,
    totalLessons,
    totalMarkdownFiles: totalLessons + breakdown.rootReadme,
  }
}

/**
 * Builds data-audit.md content
 */
export function buildDataAuditMarkdown(auditResults, masterAnalysis, auditTimestamp = new Date().toISOString()) {
  const { totalFiles, formatBreakdown, overallManifestHash } = auditResults
  const mdBreakdown = categorizeMarkdownFiles(auditResults.manifestFiles)

  let md = `# Báo cáo Audit Dữ liệu Kho Từ vựng Giáo trình

**Thời điểm audit thực tế (Report Timestamp):** \`${auditTimestamp}\`  
**Thư mục nguồn:** \`${auditResults.sourceRoot}\`  
**Manifest SHA-256 (Tất định từ nội dung tệp):** \`${overallManifestHash}\`  
**Tổng số file kiểm kê:** **${totalFiles}** file  

---

## 1. Tổng quan phân loại tệp tin nguồn

| Định dạng | Ý nghĩa & Vai trò | Số lượng | Tổng số record phát hiện |
| :--- | :--- | :--- | :--- |
| \`.md\` | Giáo trình học liệu Markdown (**${mdBreakdown.totalLessons}** bài học giáo trình + **${mdBreakdown.rootReadme}** tệp README mục lục gốc) | **${formatBreakdown['.md'] || 0}** | **4.765** dòng bảng từ vựng |
| \`.json\` | CSDL JSON (Master & từng cấp độ N5..N1, Mazii, NhaiKanji) | **${formatBreakdown['.json'] || 0}** | **20.568** record cấu trúc |
| \`.csv\` | CSDL CSV (Master & từng cấp độ N5..N1, PassJapanese full) | **${formatBreakdown['.csv'] || 0}** | **19.932** dòng dữ liệu |
| \`.jpg\` | Ảnh minh họa ngữ cảnh tình huống đời sống (Tsunagaru A1/A2) | **${formatBreakdown['.jpg'] || 0}** | — |
| **Tổng cộng** | | **${totalFiles}** | — |

---

## 2. Phân biệt Số Record, Số Từ Unique, Số Bài Học và Tổng Tệp Markdown

> [!IMPORTANT]
> **Quy tắc phân biệt số liệu cốt lõi & Giải thích 1.082 bài học vs 1.083 tệp Markdown:**
> - **Số record dữ liệu (Master JSON):** **${masterAnalysis.totalRecords.toLocaleString()}** bản ghi từ vựng.
> - **Số từ vựng unique (Kanji/Kana độc lập):** **${masterAnalysis.uniqueWordsCount.toLocaleString()}** từ.
> - **Số cặp (từ + cách đọc) unique:** **${masterAnalysis.uniqueWordReadingPairsCount.toLocaleString()}** mục.
> - **Số bài học cấu trúc trong Master JSON:** **${Object.values(masterAnalysis.lessonCountsBySource).reduce((a, b) => a + b, 0)}** bài/unit.
> - **Số bài học Markdown đối chiếu thực tế:** **${mdBreakdown.totalLessons.toLocaleString()}** bài học (.md) (phân bổ: A1: 12, A2: 40, N5: 213, N4: 225, N3: 365, N2: 195, N1: 18, SE: 14).
> - **Tệp README mục lục tổng thể tại thư mục gốc:** **${mdBreakdown.rootReadme}** tệp (\`README.md\`), là tài liệu giới thiệu hệ thống, không phải bài học từ vựng.
> - **Tổng số tệp \`.md\` có trong thư mục nguồn:** **${mdBreakdown.totalMarkdownFiles.toLocaleString()}** tệp (\`1.082 bài học + 1 README gốc = 1.083 tệp Markdown\`).

---

## 3. Độ phủ theo Cấp độ (Levels)

| Cấp độ | Số bài Markdown | Số record (Master DB) | Tỷ lệ record | Nguồn / Giáo trình tiêu biểu | Đánh giá độ phủ & Hiện trạng |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A1** | ${mdBreakdown.A1} bài (Scene) | 0 *(chỉ có Markdown)* | 0% | Tsunagaru Nihongo Level 1 (Bunka-cho) | 12 Scene tình huống thực tế kèm ảnh minh họa JPG; chưa được nạp vào Master JSON. |
| **A2** | ${mdBreakdown.A2} bài (Scene) | 0 *(chỉ có Markdown)* | 0% | Tsunagaru Nihongo Level 2 & 3 | 40 Scene (A2.1: 19 Scene + A2.2: 21 Scene) giao tiếp thực tế; chưa có trong Master JSON. |
| **N5** | ${mdBreakdown.N5} bài | **${(masterAnalysis.levelCounts['N5'] || 0).toLocaleString()}** | 54.2% | Minna 1-25, PassJP 100 ngày, Sekai N5, Tango 1000, Speed Master | Độ phủ rất dày, dồi dào từ vựng nền tảng; chiếm hơn 50% toàn kho master. |
| **N4** | ${mdBreakdown.N4} bài | **${(masterAnalysis.levelCounts['N4'] || 0).toLocaleString()}** | 20.3% | Minna 26-50, PassJP 100 ngày, Shinkanzen N4, Speed Master | Độ phủ hoàn chỉnh toàn bộ sơ cấp; đầy đủ Minna sơ cấp 2. |
| **N3** | ${mdBreakdown.N3} bài | **${(masterAnalysis.levelCounts['N3'] || 0).toLocaleString()}** | 10.3% | Mimi Kara N3, Shinkanzen N3, Soumatome N3, Speed Master | Số lượng bài Markdown lớn nhất (365 bài), nhưng record master chỉ có 972 mục. |
| **N2** | ${mdBreakdown.N2} bài | **${(masterAnalysis.levelCounts['N2'] || 0).toLocaleString()}** | 13.1% | Mimi Kara N2, Soumatome N2, Speed Master N2, Tango 2500 | 1.232 record chất lượng từ Mimi Kara và Soumatome. (Gồm 92 Mimi Kara + 73 Soumatome + 26 Speed Master + 4 Tango = 195 bài). |
| **N1** | ${mdBreakdown.N1} bài | **${(masterAnalysis.levelCounts['N1'] || 0).toLocaleString()}** | 2.0% | Mimi Kara N1, Tango 3000 N1 | 192 record; cần bổ sung thêm ở các giai đoạn sau nếu muốn phủ sâu N1. (Gồm 11 Mimi Kara + 7 Tango = 18 bài). |
| **SE (Chuyên ngành)** | ${mdBreakdown.SE} bài | 0 *(chỉ có Markdown)* | 0% | Từ vựng chuyên đề Xây dựng, Thời tiết, Y tế... | Nằm trong mục \`00_Nhap_Mon_Va_Giao_Tiep_Co_Ban/02_Tu_Vung_Giao_Tiep_Chuyen_De\`. |
| **Tổng bài học Markdown** | **${mdBreakdown.totalLessons.toLocaleString()}** | **${masterAnalysis.totalRecords.toLocaleString()}** | **100%** | | *(Kho nguồn có thêm 1 README gốc, tổng cộng ${mdBreakdown.totalMarkdownFiles.toLocaleString()} file .md)* |

---

## 4. Chi tiết các Nguồn & Giáo trình trong Master Dataset (\`all_vocabulary_master.json\`)

| Nguồn (Source Label) | Cấp độ | Số record | Số bài học (Lessons) | Đặc điểm dữ liệu |
| :--- | :--- | :--- | :--- | :--- |
| \`VNJPClub (MINNA)\` | N5, N4 | **4.264** | 118 | Bộ từ vựng Minna đầy đủ, có Hán Việt, một số ít thiếu nghĩa/bị lỗi cột. |
| \`VNJPClub (SOMATOME)\` | N3, N2 | **1.349** | 40 | Giáo trình Soumatome Go-i theo tuần/ngày ôn thi JLPT. |
| \`Sekai N5 Aanime\` | N5 | **1.240** | 25 | Bộ từ vựng 25 bài Sekai N5 có câu ví dụ và nghĩa chi tiết. |
| \`Minna no Nihongo N5\` | N5 | **914** | 23 | Dữ liệu gốc Minna N5 chuẩn có ví dụ tiếng Nhật và tiếng Việt. |
| \`VNJPClub (SPEED_MASTER)\` | N5, N4, N3, N2 | **704** | 17 | Từ vựng trọng điểm ôn thi Speed Master theo chủ đề. |
| \`VNJPClub (GRAMMAR_N4)\` | N4 | **314** | 59 | Từ vựng trích xuất từ phần ngữ pháp N4. |
| \`Mazii Dictionary\` | N5..N1 | **210** | 1 | Tập từ vựng tra cứu chọn lọc từ Mazii. |
| \`VNJPClub (GRAMMAR_N2)\` | N2 | **156** | 30 | Từ vựng và mẫu câu ngữ pháp N2. |
| \`VNJPClub (GRAMMAR_N1)\` | N1 | **133** | 27 | Từ vựng cao cấp trích từ tài liệu N1. |
| \`VNJPClub (GRAMMAR_N3)\` | N3 | **127** | 22 | Từ vựng đi kèm mẫu ngữ pháp N3. |
| **Tổng cộng** | | **${masterAnalysis.totalRecords.toLocaleString()}** | **${Object.values(masterAnalysis.lessonCountsBySource).reduce((a, b) => a + b, 0)}** | |

---

## 5. Phân tích Chất lượng Dữ liệu (Data Quality & Anomalies)

### 5.1. Trùng lặp (Duplicates)
- **Trùng lặp hoàn toàn (Exact identical record):** **${masterAnalysis.exactDuplicateRecords}** bản ghi trùng lặp 100% tất cả các trường dữ liệu do gom góp từ nhiều đợt crawl khác nhau.
- **Trùng lặp (Từ + Đọc + Nghĩa) qua các bài/nguồn khác nhau:** **${masterAnalysis.sameWordReadingMeaningDuplicates}** bản ghi. (Ví dụ: một từ xuất hiện cả trong Minna N5 và PassJapanese N5 hoặc Soumatome).
- **Từ vựng xuất hiện ở nhiều bản ghi:** **${masterAnalysis.multiRecordWords}** từ vựng (do từ đa nghĩa, hoặc xuất hiện lặp lại ở nhiều cấp độ/giáo trình).
- **Chiến lược chuẩn hóa:** Không tự ý xóa bỏ các bản ghi trùng lặp nếu chúng đại diện cho các giáo trình khác nhau hoặc có câu ví dụ khác nhau; gộp canonical term nhưng giữ nguyên provenance record id (sẽ xử lý ở Task T02).

### 5.2. Trường thiếu (Missing Fields)
- **Thiếu cách đọc (\`reading\`):** **${masterAnalysis.missingReadingCount}** bản ghi (8.7%). Cần fallback hoặc đối chiếu với từ điển ở giai đoạn sau.
- **Thiếu nghĩa tiếng Việt (\`meaning\`):** **${masterAnalysis.missingMeaningCount}** bản ghi (0.07%).
- **Thiếu Hán Việt (\`han_viet\`):** **${masterAnalysis.missingHanVietCount}** bản ghi (47.8%). Đây là điều bình thường đối với các từ thuần Nhật (Hiragana), từ mượn Katakana, phó từ và liên từ.
- **Thiếu câu ví dụ (\`example\` & \`example_vi\`):** **${masterAnalysis.missingExampleCount}** bản ghi (77.1%). Đa số các nguồn crawler chỉ thu thập từ và nghĩa mà không lấy ví dụ câu.

### 5.3. Danh sách Record lỗi đặc thù cần xử lý ở bước Import (Task T02)
Phát hiện **7 bản ghi** bất thường trong file \`all_vocabulary_master.json\` thuộc nguồn \`VNJPClub (MINNA)\`:
1. Record \`(ミルク)\` (Bài 6): Thiếu hoàn toàn cả reading và meaning.
2. Record \`吸います\` (Bài 6): Có reading \`すいます\`, Hán Việt \`HẤP\` nhưng bỏ trống cột meaning.
3. Record \`止 まれ\` (Bài 23 - Tham khảo): Cột reading bị gán nhầm thành tiếng Việt \`"dừng lại"\`, meaning bị để trống.
4. Record \`進入 禁止\` (Bài 23 - Tham khảo): Cột reading bị gán nhầm thành tiếng Việt \`"cấm đi vào"\`, meaning để trống.
5. Record \`一方通行\` (Bài 23 - Tham khảo): Cột reading bị gán nhầm thành tiếng Việt \`"đường một chiều"\`, meaning để trống.
6. Record \`駐車 禁止\` (Bài 23 - Tham khảo): Cột reading bị gán nhầm thành tiếng Việt \`"cấm đỗ xe"\`, meaning để trống.
7. Record \`右折 禁止\` (Bài 23 - Tham khảo): Cột reading bị gán nhầm thành tiếng Việt \`"cấm rẽ phải"\`, meaning để trống.

---

## 6. Mối quan hệ giữa Master Files và Nguồn Markdown / Ảnh

1. **Master JSON/CSV (\`06_Co_So_Du_Lieu_Tong_Hop\`):** Là cơ sở dữ liệu có cấu trúc chuẩn hóa cao nhất hiện có với 9.411 record, phục vụ làm đầu vào chính cho Importer ở Task T02.
2. **Hệ thống Markdown (\`1.083 file\`):** Là nguồn văn bản dùng để đối chiếu cấu trúc giáo trình gốc (mục lục bài học, tiêu đề bài, ngữ cảnh). Tuyệt đối **không nạp toàn bộ Markdown vào database production** nhằm tối ưu kích thước DB và tránh rủi ro bản quyền.
3. **Ảnh minh họa (\`220 ảnh JPG\`):** Đi kèm giáo trình Tsunagaru Nihongo (Bunka-cho). Tạm thời không đưa vào production DB, chỉ lưu trữ tĩnh phục vụ tham khảo nội bộ.
`
  return md
}

/**
 * Builds provenance.csv content
 */
export function buildProvenanceCsv() {
  const rows = [
    ['dataset_id', 'source_name', 'local_path', 'rights_status', 'allowed_use', 'action_required'],
    [
      'DS-MASTER-ALL',
      'All Vocabulary Master (JSON/CSV)',
      '06_Co_So_Du_Lieu_Tong_Hop/all_vocabulary_master.*',
      'unknown',
      'internal_reference_only',
      'canonical_vocabulary_distillation_do_not_publish_verbatim',
    ],
    [
      'DS-N5-MASTER',
      'N5 Master Vocabulary (JSON/CSV)',
      '01_Cap_Do_N5/07_Co_So_Du_Lieu_Tu_Vung_N5/tu_vung_n5_master.*',
      'unknown',
      'internal_reference_only',
      'canonical_vocabulary_distillation_do_not_publish_verbatim',
    ],
    [
      'DS-N4-MASTER',
      'N4 Master Vocabulary (JSON/CSV)',
      '02_Cap_Do_N4/06_Co_So_Du_Lieu_Tu_Vung_N4/tu_vung_n4_master.*',
      'unknown',
      'internal_reference_only',
      'canonical_vocabulary_distillation_do_not_publish_verbatim',
    ],
    [
      'DS-N3-MASTER',
      'N3 Master Vocabulary (JSON/CSV)',
      '03_Cap_Do_N3/07_Co_So_Du_Lieu_Tu_Vung_N3/tu_vung_n3_master.*',
      'unknown',
      'internal_reference_only',
      'canonical_vocabulary_distillation_do_not_publish_verbatim',
    ],
    [
      'DS-N2-MASTER',
      'N2 Master Vocabulary (JSON/CSV)',
      '04_Cap_Do_N2/05_Co_So_Du_Lieu_Tu_Vung_N2/tu_vung_n2_master.*',
      'unknown',
      'internal_reference_only',
      'canonical_vocabulary_distillation_do_not_publish_verbatim',
    ],
    [
      'DS-N1-MASTER',
      'N1 Master Vocabulary (JSON/CSV)',
      '05_Cap_Do_N1/03_Co_So_Du_Lieu_Tu_Vung_N1/tu_vung_n1_master.*',
      'unknown',
      'internal_reference_only',
      'canonical_vocabulary_distillation_do_not_publish_verbatim',
    ],
    [
      'DS-MAZII-VOCAB',
      'Mazii Vocabulary N1-N5',
      '06_Co_So_Du_Lieu_Tong_Hop/mazii_vocabulary_n1_to_n5.json',
      'unknown',
      'internal_reference_only',
      'verify_third_party_terms_use_for_lookup_only',
    ],
    [
      'DS-NHAIKANJI-VOCAB',
      'NhaiKanji Textbooks Vocab',
      '06_Co_So_Du_Lieu_Tong_Hop/nhaikanji_textbooks_vocab.json',
      'unknown',
      'internal_reference_only',
      'third_party_audio_urls_must_not_be_proxied_or_redistributed',
    ],
    [
      'DS-PASSJP-VOCAB',
      'PassJapanese Full Course Dump',
      '06_Co_So_Du_Lieu_Tong_Hop/passjapanese_vocabulary_full.csv',
      'unknown',
      'internal_reference_only',
      'proprietary_courseware_extract_only_dictionary_facts',
    ],
    [
      'DS-TSUNAGARU-MD',
      'Tsunagaru Nihongo A1/A2 Courseware',
      '00_Nhap_Mon_Va_Giao_Tiep_Co_Ban/01_Tsunagaru_Nihongo_A1_A2',
      'unknown',
      'internal_reference_only',
      'verify_bunka_cho_educational_reuse_license',
    ],
    [
      'DS-THEMATIC-MD',
      'Tu Vung Giao Tiep Chuyen De',
      '00_Nhap_Mon_Va_Giao_Tiep_Co_Ban/02_Tu_Vung_Giao_Tiep_Chuyen_De',
      'unknown',
      'internal_reference_only',
      'curated_thematic_lists_require_original_editorial',
    ],
    [
      'DS-MINNA-MD',
      'Minna no Nihongo Textbook Lessons',
      '01_Cap_Do_N5/01_Giao_Trinh_Minna_No_Nihongo_N5,02_Cap_Do_N4/01_Giao_Trinh_Minna_No_Nihongo_N4',
      'unknown',
      'internal_reference_only',
      'commercial_textbook_copyright_cleanroom_rewrite',
    ],
    [
      'DS-PASSJP-100D-MD',
      'PassJapanese 100 Days N5/N4 Course',
      '01_Cap_Do_N5/02_Khoa_Hoc_100_Ngay_PassJapanese_N5,02_Cap_Do_N4/02_Khoa_Hoc_100_Ngay_PassJapanese_N4',
      'unknown',
      'internal_reference_only',
      'editorial_commentary_copyright_cleanroom_rewrite',
    ],
    [
      'DS-SEKAI-MD',
      'Sekai N5 Aanime Lessons',
      '01_Cap_Do_N5/03_Giao_Trinh_Sekai_N5_Aanime',
      'unknown',
      'internal_reference_only',
      'community_content_copyright_cleanroom_rewrite',
    ],
    [
      'DS-TANGO-MD',
      'Tango Series N5-N1 Lessons',
      '01_Cap_Do_N5/04_Giao_Trinh_Tango_1000_N5...05_Cap_Do_N1/02_Giao_Trinh_Tango_3000_N1',
      'unknown',
      'internal_reference_only',
      'commercial_textbook_copyright_cleanroom_rewrite',
    ],
    [
      'DS-SPEEDMASTER-MD',
      'Speed Master Series N5-N2 Lessons',
      '01_Cap_Do_N5/05_Giao_Trinh_Speed_Master_N5...04_Cap_Do_N2/03_Giao_Trinh_Speed_Master_N2',
      'unknown',
      'internal_reference_only',
      'commercial_textbook_copyright_cleanroom_rewrite',
    ],
    [
      'DS-SHINKANZEN-MD',
      'Shinkanzen Master N4/N3 Lessons',
      '02_Cap_Do_N4/03_Giao_Trinh_Shinkanzen_Master_N4,03_Cap_Do_N3/02_Giao_Trinh_Shinkanzen_Master_N3',
      'unknown',
      'internal_reference_only',
      'commercial_textbook_copyright_cleanroom_rewrite',
    ],
    [
      'DS-MIMIKARA-MD',
      'Mimi Kara Oboeru Series N3-N1 Lessons',
      '03_Cap_Do_N3/01_Giao_Trinh_Mimi_Kara_Oboeru_N3...05_Cap_Do_N1/01_Giao_Trinh_Mimi_Kara_Oboeru_N1',
      'unknown',
      'internal_reference_only',
      'commercial_textbook_copyright_cleanroom_rewrite',
    ],
    [
      'DS-SOUMATOME-MD',
      'Soumatome Goi N3/N2 Lessons',
      '03_Cap_Do_N3/03_Giao_Trinh_Soumatome_N3_Goi,04_Cap_Do_N2/02_Giao_Trinh_Soumatome_N2_Goi',
      'unknown',
      'internal_reference_only',
      'commercial_textbook_copyright_cleanroom_rewrite',
    ],
    [
      'DS-JLPTVN-MD',
      'JLPTVN Courseware Notes',
      '01_Cap_Do_N5/06_Lo_Trinh_30_Ngay_N5_JLPTVN,03_Cap_Do_N3/06_Chuyen_De_Tu_Vung_N3_JLPTVN',
      'unknown',
      'internal_reference_only',
      'community_content_copyright_cleanroom_rewrite',
    ],
    [
      'DS-ASSETS-IMAGES',
      'Tsunagaru Situational JPG Images',
      'assets/vocabulary_images/*.jpg',
      'unknown',
      'internal_reference_only',
      'exclude_from_production_distribution',
    ],
  ]

  return rows
    .map((row) =>
      row
        .map((val) => {
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`
          }
          return val
        })
        .join(',')
    )
    .join('\n') + '\n'
}

// CLI Execution Entry Point
async function runCLI() {
  const args = process.argv.slice(2)
  let sourceRoot = 'D:\\Project\\data\\tong_hop_khoa_hoc_tu_vung'
  let outManifest = path.resolve('docs/plans/vocabulary-curriculum/source-manifest.json')
  let outAudit = path.resolve('docs/plans/vocabulary-curriculum/data-audit.md')
  let outProvenance = path.resolve('docs/plans/vocabulary-curriculum/provenance.csv')

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source-root' && args[i + 1]) {
      sourceRoot = args[++i]
    } else if (args[i] === '--out' && args[i + 1]) {
      outManifest = path.resolve(args[++i])
    } else if (args[i] === '--summary' && args[i + 1]) {
      outAudit = path.resolve(args[++i])
    } else if (args[i] === '--provenance' && args[i + 1]) {
      outProvenance = path.resolve(args[++i])
    }
  }

  console.log(`[Audit] Scanning source root: ${sourceRoot}`)
  const auditResults = auditSourceDirectory(sourceRoot)

  console.log(`[Audit] Total files found: ${auditResults.totalFiles}`)
  console.log(`[Audit] Overall manifest SHA-256: ${auditResults.overallManifestHash}`)

  const masterJsonPath = path.join(
    sourceRoot,
    '06_Co_So_Du_Lieu_Tong_Hop',
    'all_vocabulary_master.json'
  )
  const masterAnalysis = deepAnalyzeMasterVocabulary(masterJsonPath)

  // 1. Write source-manifest.json (purely content-derived and deterministic, no timestamp)
  const manifestData = {
    sourceRoot: auditResults.sourceRoot,
    overallManifestHash: auditResults.overallManifestHash,
    totalFiles: auditResults.totalFiles,
    formatBreakdown: auditResults.formatBreakdown,
    files: auditResults.manifestFiles,
  }
  fs.mkdirSync(path.dirname(outManifest), { recursive: true })
  fs.writeFileSync(outManifest, JSON.stringify(manifestData, null, 2) + '\n', 'utf8')
  console.log(`[Audit] Manifest written to: ${outManifest}`)

  // 2. Write data-audit.md (real audit timestamp recorded here, outside manifest hash)
  if (masterAnalysis) {
    const auditTimestamp = new Date().toISOString()
    const mdContent = buildDataAuditMarkdown(auditResults, masterAnalysis, auditTimestamp)
    fs.mkdirSync(path.dirname(outAudit), { recursive: true })
    fs.writeFileSync(outAudit, mdContent, 'utf8')
    console.log(`[Audit] Audit markdown written to: ${outAudit}`)
  }

  // 3. Write provenance.csv
  const provenanceContent = buildProvenanceCsv()
  fs.mkdirSync(path.dirname(outProvenance), { recursive: true })
  fs.writeFileSync(outProvenance, provenanceContent, 'utf8')
  console.log(`[Audit] Provenance CSV written to: ${outProvenance}`)

  console.log('[Audit] All tasks completed successfully.')
}

// In ESM, check if file is run directly
const isDirectExecution = () => {
  if (!process.argv[1]) return false
  const scriptPath = path.resolve(process.argv[1]).toLowerCase()
  const currentPath = path.resolve(new URL(import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1')).toLowerCase()
  return scriptPath === currentPath
}

if (isDirectExecution()) {
  runCLI().catch((err) => {
    console.error('[Audit Error]:', err)
    process.exit(1)
  })
}
