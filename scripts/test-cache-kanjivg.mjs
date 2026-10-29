import fs from 'node:fs'
import path from 'node:path'

export async function fetchAndCacheKanjiStrokes(char) {
  if (!char) return null
  const code = char.codePointAt(0).toString(16).padStart(5, '0')
  const cacheDir = path.resolve('data', 'kanjivg')
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })

  const cacheFile = path.join(cacheDir, `${code}.json`)
  if (fs.existsSync(cacheFile)) {
    try {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
    } catch {}
  }

  const url = `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg/kanji/${code}.svg`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      console.warn(`KanjiVG SVG not found for ${char} (${code}): ${res.status}`)
      return null
    }
    const svgText = await res.text()

    const strokePathRegex = /<path[^>]*\bid="([^"]*-s\d+)"[^>]*\bd="([^"]+)"[^>]*>/g
    const strokes = []
    let m
    while ((m = strokePathRegex.exec(svgText)) !== null) {
      const id = m[1]
      const d = m[2]
      const typeMatch = m[0].match(/kvg:type="([^"]+)"/)
      strokes.push({ id, d, type: typeMatch ? typeMatch[1] : undefined })
    }

    const numRegex = /<text transform="matrix\(([^)]+)\)">(\d+)<\/text>/g
    const numbers = []
    while ((m = numRegex.exec(svgText)) !== null) {
      const parts = m[1].split(/\s+/).map(Number)
      numbers.push({ num: parseInt(m[2], 10), x: parts[4], y: parts[5] })
    }

    const data = {
      kanji: char,
      code,
      strokeCount: strokes.length,
      strokes,
      numbers,
    }
    fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2))
    return data
  } catch (err) {
    console.error(`Error fetching KanjiVG for ${char}:`, err)
    return null
  }
}

async function run() {
  const c1 = await fetchAndCacheKanjiStrokes('信')
  console.log('信:', c1?.strokeCount, 'strokes')
  const c2 = await fetchAndCacheKanjiStrokes('回')
  console.log('回:', c2?.strokeCount, 'strokes')
  const c3 = await fetchAndCacheKanjiStrokes('日')
  console.log('日:', c3?.strokeCount, 'strokes')
}

run()
