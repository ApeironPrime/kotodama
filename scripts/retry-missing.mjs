import fs from 'node:fs'
import https from 'node:https'

function fetchPage(id) {
  return new Promise((resolve, reject) => {
    https
      .get(
        `https://www.vnjpclub.com/mimi-kara-n3-bunpo/np-${id}.html`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        },
        (res) => {
          let data = ''
          res.on('data', (chunk) => (data += chunk))
          res.on('end', () => {
            if (res.statusCode === 429) {
              resolve({ error: '429', data: '' })
            } else {
              resolve({ error: null, data })
            }
          })
        }
      )
      .on('error', reject)
  })
}

function dec_it(data) {
  if (!data) return data
  data = data.replace(/&amp;/g, '&')
  data = data.split('@').join('CAg')
  data = data.split('!').join('W5')
  data = data.split('*').join('CAgI')
  data = data.split('$').join('dGhl')
  data = data.split('%').join('YXN')
  data = data.split('&').join('YW')
  try {
    const bin = Buffer.from(data, 'base64')
    return new TextDecoder('utf-8').decode(bin)
  } catch {
    return data
  }
}

export function parseGrammarHtml(rawHtml, id) {
  let content = rawHtml
  const startStr = 'data-ykhp="'
  const start = rawHtml.indexOf(startStr)
  if (start !== -1) {
    const end = rawHtml.indexOf('"', start + startStr.length)
    const encoded = rawHtml.slice(start + startStr.length, end)
    content = dec_it(encoded)
  }

  const mainStart = content.indexOf('mimikaran3-nguphap')
  if (mainStart === -1) {
    return null
  }
  const mainContent = content.slice(mainStart)

  const groupSplits = mainContent.split(/<div\s+class=["']np-group["']>/i)
  const groups = []

  for (let i = 1; i < groupSplits.length; i++) {
    const groupChunk = groupSplits[i]

    const titleMatch = groupChunk.match(/<div\s+class=["']np-title["']>([\s\S]*?)<\/div>/i)
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : ''

    const meaningMatch = groupChunk.match(/<div\s+class=["']np-meaning["']>([\s\S]*?)<\/div>/i)
    const meaning = meaningMatch ? meaningMatch[1].replace(/<[^>]+>/g, '').trim() : ''

    const structMatch = groupChunk.match(/<div\s+class=["']np-box cautruc["']>([\s\S]*?)<\/div>/i)
    const structure = structMatch ? structMatch[1].replace(/<[^>]+>/g, '').trim() : ''

    const usageMatch = groupChunk.match(/<div\s+class=["']np-box cachdung["']>([\s\S]*?)<\/div>/i)
    const usage = usageMatch ? usageMatch[1].replace(/<[^>]+>/g, '').trim() : ''

    const examples = []
    const exSplits = groupChunk.split(/<div\s+class=["']np-ex["']>/i)
    for (let j = 1; j < exSplits.length; j++) {
      const exChunk = exSplits[j]
      const jpMatch = exChunk.match(/<div\s+class=["']jp["']>([\s\S]*?)<\/div>/i)
      const viMatch = exChunk.match(/<div\s+class=["']vi["']>([\s\S]*?)<\/div>/i)

      if (jpMatch) {
        let jpRaw = jpMatch[1].replace(/<span\s+class=["']no["']>[\s\S]*?<\/span>/gi, '').trim()
        const vi = viMatch ? viMatch[1].replace(/<[^>]+>/g, '').trim() : ''

        const jpClean = jpRaw
          .replace(/<ruby>(.*?)<rp>.*?<\/rp><rt>.*?<\/rt><rp>.*?<\/rp><\/ruby>/gi, '$1')
          .replace(/<ruby>(.*?)<rt>.*?<\/rt><\/ruby>/gi, '$1')
          .replace(/<[^>]+>/g, '')
          .trim()

        const jpRuby = jpRaw.replace(/<rp>.*?<\/rp>/gi, '').trim()

        if (jpClean) {
          examples.push({
            jp: jpClean,
            jp_ruby: jpRuby,
            vi: vi,
          })
        }
      }
    }

    if (structure || usage || examples.length > 0 || meaning || title) {
      groups.push({
        group_no: i,
        title: title || undefined,
        meaning: meaning || undefined,
        structure: structure || undefined,
        usage: usage || undefined,
        examples: examples,
      })
    }
  }

  const noteMatch = mainContent.match(/<div\s+class=["']np-box note["']>([\s\S]*?)<\/div>/i)
  const notes = noteMatch
    ? noteMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim()
    : ''

  const mainTitle = groups.find((g) => g.title)?.title || ''
  const mainMeaning =
    groups
      .map((g) => g.meaning)
      .filter(Boolean)
      .join(' | ') ||
    groups[0]?.meaning ||
    ''
  const allExamples = groups.flatMap((g) => g.examples)

  return {
    id: id,
    title: mainTitle,
    meaning: mainMeaning,
    structure: groups[0]?.structure || '',
    usage: groups[0]?.usage || '',
    examples: allExamples,
    groups: groups,
    notes: notes,
    url: `https://www.vnjpclub.com/mimi-kara-n3-bunpo/np-${id}.html`,
  }
}

async function retryMissing() {
  const currentData = JSON.parse(fs.readFileSync('data/mimi_kara_n3_grammar.json', 'utf8'))
  const existingMap = new Map(currentData.map((item) => [item.id, item]))

  const missingIds = []
  for (let i = 1; i <= 110; i++) {
    if (!existingMap.has(i)) {
      missingIds.push(i)
    }
  }

  console.log(`Missing IDs (${missingIds.length}):`, missingIds)
  if (missingIds.length === 0) {
    console.log('All 110 items are already present!')
    return
  }

  for (const id of missingIds) {
    let success = false
    let attempts = 0
    while (!success && attempts < 5) {
      attempts++
      console.log(`Fetching np-${id}.html (attempt ${attempts})...`)
      const res = await fetchPage(id)
      if (res.error === '429') {
        console.log(`Hit 429 for id ${id}, waiting 5s...`)
        await new Promise((r) => setTimeout(r, 5000))
        continue
      }
      const parsed = parseGrammarHtml(res.data, id)
      if (parsed && parsed.groups.length > 0) {
        existingMap.set(id, parsed)
        console.log(`[${id}/110] SUCCESS: "${parsed.title}" (Groups: ${parsed.groups.length})`)
        success = true
      } else {
        console.log(`Failed to parse id ${id}, waiting 3s...`)
        await new Promise((r) => setTimeout(r, 3000))
      }
    }
    await new Promise((r) => setTimeout(r, 2000))
  }

  const allItems = Array.from(existingMap.values()).sort((a, b) => a.id - b.id)
  console.log(`Total complete items: ${allItems.length}/110`)
  fs.writeFileSync('data/mimi_kara_n3_grammar.json', JSON.stringify(allItems, null, 2), 'utf8')
  console.log('Saved data/mimi_kara_n3_grammar.json!')
}

retryMissing()
