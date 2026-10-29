import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const toanMasterPath = path.join(root, 'data', 'jlpt_n3_toan_master.json')
const fullMasterPath = path.join(root, 'data', 'jlpt_full_master.json')
const manifestPath = path.join(root, 'data', 'jlpt_n3_listening_image_assets.json')
const publicRoot = path.join(root, 'public')
const downloadAssets = process.argv.includes('--download')
const verifyAssets = process.argv.includes('--verify')
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function sessionKey(exam) {
  for (const value of [exam?.id, exam?.title, exam?.year]) {
    const text = String(value || '')
    const yearFirst = text.match(/(20\d{2})\D*(07|7|12)/u)
    if (yearFirst) return `${yearFirst[1]}${yearFirst[2].padStart(2, '0')}`

    const monthFirst = text.match(/(?:^|\D)(07|7|12)\D+(20\d{2})/u)
    if (monthFirst) return `${monthFirst[2]}${monthFirst[1].padStart(2, '0')}`
  }
  return ''
}

function mondaiNumber(part) {
  return Number(String(part?.title || '').match(/Mondai\s*(\d+)/iu)?.[1])
}

function answerOf(question) {
  return Number(question?.correctAnswer ?? question?.answer)
}

function localAssetPath({ key, mondai, sourceQuestionIndex, sourceUrl }) {
  const extension = path.extname(new URL(sourceUrl).pathname).toLowerCase() || '.png'
  return `/assets/jlpt/listening/n3-${key.slice(0, 4)}-${key.slice(4)}/m${mondai}-q${sourceQuestionIndex + 1}${extension}`
}

function imageSourceFromMarkup(question) {
  const markup = String(question?.sentence || question?.text || question?.question || '')
  const source = markup.match(/<img\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1/iu)?.[2] || ''
  return source.replace(/&amp;/giu, '&').trim()
}

function validatePng(file, image) {
  if (image.length < 45 || !image.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`${file} is not a valid PNG file.`)
  }

  let offset = PNG_SIGNATURE.length
  let width = 0
  let height = 0
  let sawIhdr = false
  let sawIend = false
  while (offset + 12 <= image.length) {
    const length = image.readUInt32BE(offset)
    const type = image.subarray(offset + 4, offset + 8).toString('ascii')
    const nextOffset = offset + 12 + length
    if (nextOffset > image.length) throw new Error(`${file} has a truncated ${type} PNG chunk.`)

    if (type === 'IHDR') {
      if (sawIhdr || length !== 13) throw new Error(`${file} has an invalid IHDR PNG chunk.`)
      width = image.readUInt32BE(offset + 8)
      height = image.readUInt32BE(offset + 12)
      if (!width || !height) throw new Error(`${file} has invalid PNG dimensions.`)
      sawIhdr = true
    }
    if (type === 'IEND') {
      if (length !== 0 || nextOffset !== image.length) throw new Error(`${file} has an invalid IEND PNG chunk.`)
      sawIend = true
      break
    }
    offset = nextOffset
  }
  if (!sawIhdr || !sawIend) throw new Error(`${file} is missing required PNG chunks.`)
  return { width, height }
}

function buildManifest() {
  const toanMaster = JSON.parse(fs.readFileSync(toanMasterPath, 'utf8'))
  const fullMaster = JSON.parse(fs.readFileSync(fullMasterPath, 'utf8'))
  const targetExams = new Map(
    toanMaster
      .filter((exam) => exam?.isFullMock && String(exam?.level || '').toUpperCase() === 'N3')
      .map((exam) => [sessionKey(exam), exam])
  )
  const sourceListeningExams = fullMaster.filter(
    (exam) =>
      /JLPT-N3/u.test(String(exam?.title || '')) &&
      String(exam?.section || '').toLowerCase() === 'listening' &&
      sessionKey(exam)
  )

  const assets = {}
  const aliases = {}
  const questionAliases = {}
  const unresolvedQuestionAliases = []
  const partMappings = []
  const coverage = {}

  for (const sourceExam of sourceListeningExams) {
    const key = sessionKey(sourceExam)
    const year = Number(key.slice(0, 4))
    if (year < 2015 || year > 2025) continue

    const targetExam = targetExams.get(key)
    if (!targetExam) continue
    const targetListeningQuestions = (targetExam.parts || []).flatMap((part) =>
      Number(part?.sectionType) === 4
        ? (part.questions || []).map((question, questionIndex) => ({ part, question, questionIndex }))
        : []
    )
    const targetQuestionBySourceNumber = new Map(targetListeningQuestions.map((entry, index) => [index + 1, entry]))

    let count = 0
    let questionAliasCount = 0
    let unresolvedQuestionAliasCount = 0
    let partMappingCount = 0
    for (const sourcePart of sourceExam.parts || []) {
      const sourceMondai = mondaiNumber(sourcePart)
      if (!sourceMondai) continue

      for (const sourceQuestion of sourcePart.questions || []) {
        const hasImage = typeof sourceQuestion?.image === 'string' && Boolean(sourceQuestion.image.trim())
        const sourceQuestionNumber = Number(sourceQuestion?.number)
        const targetEntry = targetQuestionBySourceNumber.get(sourceQuestionNumber)
        const targetQuestion = targetEntry?.question
        const targetMondai = mondaiNumber(targetEntry?.part)
        if (!targetQuestion) {
          if (!hasImage) continue
          throw new Error(`${key} question ${sourceQuestionNumber} has no matching full-mock listening question.`)
        }
        if (sourceMondai !== targetMondai) {
          partMappings.push({
            examId: targetExam.id,
            sourceExamId: sourceExam.id,
            sourceMondai,
            targetMondai,
            sourceQuestionId: sourceQuestion.id,
            targetQuestionId: targetQuestion.id,
            sourceQuestionNumber,
          })
          partMappingCount += 1
        }
        const answerMatches = answerOf(targetQuestion) === answerOf(sourceQuestion)
        if (!answerMatches && hasImage) {
          throw new Error(
            `${key} question ${sourceQuestionNumber} has conflicting answer keys: ${answerOf(targetQuestion)} vs ${answerOf(sourceQuestion)}.`
          )
        }
        if (!answerMatches) {
          unresolvedQuestionAliases.push({
            examId: targetExam.id,
            sourceExamId: sourceExam.id,
            sourceMondai,
            targetMondai,
            sourceQuestionId: sourceQuestion.id,
            targetQuestionId: targetQuestion.id,
            sourceAnswer: answerOf(sourceQuestion),
            targetAnswer: answerOf(targetQuestion),
            reason: 'answer-key-conflict',
          })
          unresolvedQuestionAliasCount += 1
          continue
        }
        if (sourceQuestion.id && sourceQuestion.id !== targetQuestion.id) {
          questionAliases[sourceQuestion.id] = targetQuestion.id
          questionAliasCount += 1
        }

        if (!hasImage) continue

        const sourceUrl = sourceQuestion.image.trim()
        assets[targetQuestion.id] = {
          examId: targetExam.id,
          questionNumber: Number(targetQuestion.number),
          mondai: targetMondai,
          sourceMondai,
          sourceType: 'standalone-source',
          publicPath: localAssetPath({
            key,
            mondai: targetMondai,
            sourceQuestionIndex: targetEntry.questionIndex,
            sourceUrl,
          }),
          sourceUrl,
        }
        if (sourceQuestion.id && sourceQuestion.id !== targetQuestion.id) aliases[sourceQuestion.id] = targetQuestion.id
        count += 1
      }
    }
    coverage[key] = {
      examId: targetExam.id,
      sourceExamId: sourceExam.id,
      assets: count,
      questionAliases: questionAliasCount,
      unresolvedQuestionAliases: unresolvedQuestionAliasCount,
      partMappings: partMappingCount,
    }
  }

  const standaloneAssetCount = Object.keys(assets).length
  if (standaloneAssetCount !== 77)
    throw new Error(`Expected 77 source-verified standalone listening assets, found ${standaloneAssetCount}.`)

  for (const [key, targetExam] of targetExams) {
    const year = Number(key.slice(0, 4))
    if (year < 2015 || year > 2025) continue
    const listeningParts = (targetExam.parts || []).filter((part) => Number(part?.sectionType) === 4)
    let embeddedAssetCount = 0
    for (const part of listeningParts) {
      const mondai = mondaiNumber(part)
      if (!mondai) continue
      for (const [questionIndex, question] of (part.questions || []).entries()) {
        if (assets[question.id]) continue
        const sourceUrl = imageSourceFromMarkup(question)
        if (!sourceUrl) continue
        assets[question.id] = {
          examId: targetExam.id,
          questionNumber: Number(question.number),
          mondai,
          sourceType: 'embedded-full-mock',
          publicPath: localAssetPath({ key, mondai, sourceQuestionIndex: questionIndex, sourceUrl }),
          sourceUrl,
        }
        embeddedAssetCount += 1
      }
    }
    const previousCoverage = coverage[key] || {
      examId: targetExam.id,
      sourceExamId: null,
      assets: 0,
      questionAliases: 0,
      unresolvedQuestionAliases: 0,
      partMappings: 0,
    }
    coverage[key] = { ...previousCoverage, embeddedAssets: embeddedAssetCount }
  }

  const embeddedAssetCount = Object.keys(assets).length - standaloneAssetCount
  if (embeddedAssetCount !== 37)
    throw new Error(`Expected 37 embedded full-mock listening assets, found ${embeddedAssetCount}.`)

  return {
    schemaVersion: 1,
    scope: 'N3 full mocks from 2015 through 2025; all stored listening illustrations.',
    assets,
    aliases,
    questionAliases,
    unresolvedQuestionAliases,
    partMappings,
    coverage,
  }
}

async function fetchAsset(asset) {
  const response = await fetch(asset.sourceUrl, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.startsWith('image/'))
    throw new Error(`Expected image content, received ${contentType || 'unknown content type'}.`)
  const image = Buffer.from(await response.arrayBuffer())
  validatePng(asset.sourceUrl, image)
  return image
}

async function downloadManifestAssets(manifest) {
  const entries = Object.entries(manifest.assets)
  const results = []
  for (const [questionId, asset] of entries) {
    const destination = path.join(publicRoot, asset.publicPath.replace(/^\//u, ''))
    if (fs.existsSync(destination) && fs.statSync(destination).size > 100) {
      results.push({ questionId, bytes: fs.statSync(destination).size, reused: true })
      continue
    }

    const image = await fetchAsset(asset)
    await fsp.mkdir(path.dirname(destination), { recursive: true })
    const temporary = `${destination}.partial`
    await fsp.writeFile(temporary, image)
    await fsp.rename(temporary, destination)
    results.push({ questionId, bytes: image.length, reused: false })
  }
  return results
}

function verifyManifestAssets(manifest) {
  let totalBytes = 0
  for (const [questionId, asset] of Object.entries(manifest.assets)) {
    const destination = path.join(publicRoot, asset.publicPath.replace(/^\//u, ''))
    if (!fs.existsSync(destination))
      throw new Error(`Missing local listening asset ${questionId} (${asset.publicPath}).`)
    const image = fs.readFileSync(destination)
    validatePng(destination, image)
    totalBytes += image.length
  }
  return { files: Object.keys(manifest.assets).length, totalBytes }
}

const manifest = buildManifest()
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

if (downloadAssets) {
  const downloads = await downloadManifestAssets(manifest)
  const totalBytes = downloads.reduce((sum, entry) => sum + entry.bytes, 0)
  const newlyDownloaded = downloads.filter((entry) => !entry.reused).length
  console.log(
    `Downloaded ${newlyDownloaded} N3 listening illustration(s); verified ${downloads.length} files (${totalBytes.toLocaleString('en-US')} bytes).`
  )
}

if (verifyAssets) {
  const verification = verifyManifestAssets(manifest)
  console.log(
    `Validated ${verification.files} PNG listening illustration(s) (${verification.totalBytes.toLocaleString('en-US')} bytes).`
  )
}

console.log(
  `Wrote ${path.relative(root, manifestPath)} with ${Object.keys(manifest.assets).length} locally bundled listening illustrations.`
)
