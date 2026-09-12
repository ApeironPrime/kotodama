import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { normalizeDataset, serializeCanonicalDataset } from './normalize.mjs'

const DEFAULT_MASTER = 'D:/Project/data/tong_hop_khoa_hoc_tu_vung/06_Co_So_Du_Lieu_Tong_Hop/all_vocabulary_master.json'

function normalizeText(value) {
  return typeof value === 'string' ? value.normalize('NFC').replace(/\s+/g, ' ').trim() : ''
}

function slug(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function inferLevel(courseName) {
  const match = normalizeText(courseName).match(/(?:^|[^A-Z0-9])N([1-5])(?:$|[^A-Z0-9])/i)
  return match ? `N${match[1]}` : 'SE'
}

export function readMazziVocabularyCourses(coursesPath) {
  const files = fs
    .readdirSync(coursesPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))

  const records = []
  const sourceHash = crypto.createHash('sha256')

  for (const fileName of files) {
    const filePath = path.join(coursesPath, fileName)
    const content = fs.readFileSync(filePath)
    sourceHash.update(fileName).update('\0').update(content)
    const course = JSON.parse(content.toString('utf8'))
    if (!course || !Array.isArray(course.sub_lessons)) continue

    const courseId = String(course.course_id || slug(fileName))
    const courseName = normalizeText(course.course_name) || fileName.replace(/\.json$/i, '')
    const category = normalizeText(course.category)
    const courseCode = `mazii-${slug(courseId)}-${slug(courseName) || 'course'}`
    const level = inferLevel(courseName)

    for (const lesson of course.sub_lessons) {
      if (!lesson || !Array.isArray(lesson.words)) continue
      const lessonName = normalizeText(lesson.lesson_name) || `Bài ${lesson.lesson_id || 1}`
      for (const word of lesson.words) {
        if (!word || !normalizeText(word.noteName)) continue
        records.push({
          word: word.noteName,
          reading: word.phonetic || '',
          han_viet: '',
          meaning: word.noteMean || '',
          level,
          lesson: lessonName,
          source: 'Mazii course export',
          course_code: courseCode,
          course_title: courseName,
          course_level: level,
          course_provider_source: category ? `Mazii · ${category}` : 'Mazii',
          raw_record_id: word.noteId ?? `${courseId}:${lesson.lesson_id ?? lessonName}:${records.length + 1}`,
          example: '',
          example_vi: '',
        })
      }
    }
  }

  return { files, records, sourceHash: sourceHash.digest('hex') }
}

function parseArgs(args) {
  const options = {
    masterPath: DEFAULT_MASTER,
    coursesPath: process.env.MAZII_VOCABULARY_COURSES_PATH || '',
    outPath: path.resolve('tmp/curriculum/canonical-dataset.json'),
  }
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--master' && args[index + 1]) options.masterPath = args[++index]
    else if (args[index] === '--courses' && args[index + 1]) options.coursesPath = args[++index]
    else if (args[index] === '--out' && args[index + 1]) options.outPath = args[++index]
  }
  return options
}

export function buildMergedMazziDataset({ masterRecords, maziiRecords, sourceHash }) {
  return normalizeDataset([...masterRecords, ...maziiRecords], `mazii-vocabulary-courses:${sourceHash}`, '1.1.0')
}

function runCli() {
  const { masterPath, coursesPath, outPath } = parseArgs(process.argv.slice(2))
  if (!coursesPath) throw new Error('Missing --courses path (or MAZII_VOCABULARY_COURSES_PATH).')
  if (!fs.existsSync(masterPath)) throw new Error(`Master vocabulary file not found: ${masterPath}`)
  if (!fs.existsSync(coursesPath)) throw new Error(`Mazii courses directory not found: ${coursesPath}`)

  const masterRecords = JSON.parse(fs.readFileSync(masterPath, 'utf8'))
  if (!Array.isArray(masterRecords)) throw new Error('Master vocabulary file must contain an array.')
  const mazii = readMazziVocabularyCourses(coursesPath)
  const dataset = buildMergedMazziDataset({
    masterRecords,
    maziiRecords: mazii.records,
    sourceHash: mazii.sourceHash,
  })

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, serializeCanonicalDataset(dataset), 'utf8')
  console.log(
    JSON.stringify(
      {
        mazii_files: mazii.files.length,
        mazii_course_terms: mazii.records.length,
        total_courses: dataset.courses.length,
        total_units: dataset.units.length,
        total_terms: dataset.terms.length,
        total_course_terms: dataset.course_terms.length,
        output: outPath,
      },
      null,
      2
    )
  )
}

const isDirectExecution = () => {
  if (!process.argv[1]) return false
  const scriptPath = path.resolve(process.argv[1]).toLowerCase()
  const currentPath = path.resolve(new URL(import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1')).toLowerCase()
  return scriptPath === currentPath
}

if (isDirectExecution()) {
  try {
    runCli()
  } catch (error) {
    console.error(`[Mazii vocabulary import] ${error.message}`)
    process.exitCode = 1
  }
}
