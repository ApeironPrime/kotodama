import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  parseCSV,
  hashBuffer,
  hashFile,
  detectSchemaAndRecords,
  auditSourceDirectory,
  deepAnalyzeMasterVocabulary,
  buildProvenanceCsv,
  categorizeMarkdownFiles,
} from './audit-source.mjs'

describe('audit-source.mjs', () => {
  test('parseCSV handles simple rows and quoted commas', () => {
    const input = 'word,reading,meaning\n私,わたし,"Tôi, bản thân"\n'
    const rows = parseCSV(input)
    assert.equal(rows.length, 2)
    assert.deepEqual(rows[0], ['word', 'reading', 'meaning'])
    assert.deepEqual(rows[1], ['私', 'わたし', 'Tôi, bản thân'])
  })

  test('parseCSV handles escaped quotes', () => {
    const input = 'word,note\n犬,"Chó, ""cún cưng"""\n'
    const rows = parseCSV(input)
    assert.equal(rows.length, 2)
    assert.equal(rows[1][1], 'Chó, "cún cưng"')
  })

  test('hashBuffer and hashFile compute correct SHA-256', () => {
    const buf = Buffer.from('hello world', 'utf8')
    const hash = hashBuffer(buf)
    assert.equal(hash, 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9')

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-hash-'))
    const filePath = path.join(tmpDir, 'file.txt')
    fs.writeFileSync(filePath, buf)
    assert.equal(hashFile(filePath), hash)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('detectSchemaAndRecords extracts schema from JSON array', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'))
    const jsonPath = path.join(tmpDir, 'test.json')
    const sampleData = [
      { word: '本', reading: 'ほん', meaning: 'Sách' },
      { word: '猫', reading: 'ねこ', meaning: 'Mèo', han_viet: 'MIÊU' },
    ]
    fs.writeFileSync(jsonPath, JSON.stringify(sampleData), 'utf8')

    const result = detectSchemaAndRecords(jsonPath, '.json')
    assert.equal(result.recordCount, 2)
    assert.deepEqual(result.detectedSchema, ['han_viet', 'meaning', 'reading', 'word'])

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('auditSourceDirectory walks mock tree deterministically', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-tree-'))
    const subA = path.join(tmpDir, 'sub_a')
    const subB = path.join(tmpDir, 'sub_b')
    fs.mkdirSync(subA, { recursive: true })
    fs.mkdirSync(subB, { recursive: true })

    fs.writeFileSync(path.join(subA, 'data.csv'), 'w,r,m\na,b,c\n', 'utf8')
    fs.writeFileSync(path.join(subB, 'note.md'), '# Title\n| STT | Từ |\n|---|---|\n| 1 | 猫 |\n', 'utf8')

    const audit1 = auditSourceDirectory(tmpDir)
    const audit2 = auditSourceDirectory(tmpDir)

    assert.equal(audit1.totalFiles, 2)
    assert.equal(audit1.overallManifestHash, audit2.overallManifestHash)
    assert.equal(audit1.manifestFiles[0].path, 'sub_a/data.csv')
    assert.equal(audit1.manifestFiles[1].path, 'sub_b/note.md')

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('deepAnalyzeMasterVocabulary detects duplicates, missing fields, and anomalies', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-vocab-'))
    const masterPath = path.join(tmpDir, 'master.json')
    const sample = [
      { word: '犬', reading: 'いぬ', meaning: 'Chó', level: 'N5', source: 'Test', lesson: 'B1' },
      { word: '犬', reading: 'いぬ', meaning: 'Chó', level: 'N5', source: 'Test', lesson: 'B1' }, // exact dupe
      { word: '猫', reading: 'ねこ', meaning: '', level: 'N5', source: 'Test', lesson: 'B1' }, // missing meaning
      { word: '鳥', reading: 'chim', meaning: '', level: 'N5', source: 'Test', lesson: 'B1' }, // reading contains vietnamese
      { word: '', reading: 'き', meaning: 'Cây', level: 'N5', source: 'Test', lesson: 'B1' }, // empty word
    ]
    fs.writeFileSync(masterPath, JSON.stringify(sample), 'utf8')

    const analysis = deepAnalyzeMasterVocabulary(masterPath)
    assert.equal(analysis.totalRecords, 5)
    assert.equal(analysis.uniqueWordsCount, 3) // 犬, 猫, 鳥
    assert.equal(analysis.exactDuplicateRecords, 1)
    assert.equal(analysis.emptyWordCount, 1)
    assert.equal(analysis.missingMeaningCount, 2)
    assert.ok(analysis.malformedRecords.some((m) => m.reason === 'reading_contains_vietnamese'))

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('buildProvenanceCsv contains unknown status for all rows', () => {
    const csv = buildProvenanceCsv()
    const rows = parseCSV(csv)
    assert.ok(rows.length > 5)
    // All rows except header must have rights_status = unknown
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].length >= 4) {
        assert.equal(rows[i][3], 'unknown', `Row ${i} must have rights_status: unknown`)
      }
    }
  })

  test('categorizeMarkdownFiles correctly distinguishes lessons from root readme', () => {
    const mockFiles = [
      { path: 'README.md', format: '.md' },
      { path: '00_Nhap_Mon_Va_Giao_Tiep_Co_Ban/01_Tsunagaru_Nihongo_A1_A2/Level_1_A1/Scene_01.md', format: '.md' },
      { path: '00_Nhap_Mon_Va_Giao_Tiep_Co_Ban/01_Tsunagaru_Nihongo_A1_A2/Level_2_A2_1/Scene_01.md', format: '.md' },
      { path: '00_Nhap_Mon_Va_Giao_Tiep_Co_Ban/02_Tu_Vung_Giao_Tiep_Chuyen_De/topic.md', format: '.md' },
      { path: '01_Cap_Do_N5/01_Giao_Trinh_Minna_No_Nihongo_N5/Bai_01.md', format: '.md' },
      { path: '02_Cap_Do_N4/01_Giao_Trinh_Minna_No_Nihongo_N4/Bai_26.md', format: '.md' },
      { path: '03_Cap_Do_N3/01_Giao_Trinh_Mimi_Kara_Oboeru_N3/Unit_01.md', format: '.md' },
      { path: '04_Cap_Do_N2/01_Giao_Trinh_Mimi_Kara_Oboeru_N2/Unit_01.md', format: '.md' },
      { path: '05_Cap_Do_N1/01_Giao_Trinh_Mimi_Kara_Oboeru_N1/Unit_01.md', format: '.md' },
      { path: '06_Co_So_Du_Lieu_Tong_Hop/all_vocabulary_master.json', format: '.json' }, // not md
    ]

    const result = categorizeMarkdownFiles(mockFiles)
    assert.equal(result.rootReadme, 1)
    assert.equal(result.A1, 1)
    assert.equal(result.A2, 1)
    assert.equal(result.SE, 1)
    assert.equal(result.N5, 1)
    assert.equal(result.N4, 1)
    assert.equal(result.N3, 1)
    assert.equal(result.N2, 1)
    assert.equal(result.N1, 1)
    assert.equal(result.totalLessons, 8)
    assert.equal(result.totalMarkdownFiles, 9)
  })
})
