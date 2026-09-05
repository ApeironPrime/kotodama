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
          res.on('end', () => resolve(data))
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

  // If page contains data-ykhp protected container, extract and decode it
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

  // Find all <div class="np-group"> blocks
  const groupSplits = mainContent.split(/<div\s+class=["']np-group["']>/i)
  const groups = []

  for (let i = 1; i < groupSplits.length; i++) {
    const groupChunk = groupSplits[i]

    // Title
    const titleMatch = groupChunk.match(/<div\s+class=["']np-title["']>([\s\S]*?)<\/div>/i)
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : ''

    // Meaning
    const meaningMatch = groupChunk.match(/<div\s+class=["']np-meaning["']>([\s\S]*?)<\/div>/i)
    const meaning = meaningMatch ? meaningMatch[1].replace(/<[^>]+>/g, '').trim() : ''

    // Structure
    const structMatch = groupChunk.match(/<div\s+class=["']np-box cautruc["']>([\s\S]*?)<\/div>/i)
    const structure = structMatch ? structMatch[1].replace(/<[^>]+>/g, '').trim() : ''

    // Usage
    const usageMatch = groupChunk.match(/<div\s+class=["']np-box cachdung["']>([\s\S]*?)<\/div>/i)
    const usage = usageMatch ? usageMatch[1].replace(/<[^>]+>/g, '').trim() : ''

    // Examples
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

  // Note
  const noteMatch = mainContent.match(/<div\s+class=["']np-box note["']>([\s\S]*?)<\/div>/i)
  const notes = noteMatch
    ? noteMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim()
    : ''

  // Fallback: title from first group or top
  const mainTitle = groups.find((g) => g.title)?.title || ''
  const mainMeaning =
    groups
      .map((g) => g.meaning)
      .filter(Boolean)
      .join(' | ') ||
    groups[0]?.meaning ||
    ''

  // Collect all examples for backward compatibility
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

async function scrapeAll() {
  console.log('Starting full scrape of Mimikara N3 grammar (1..110)...')
  const results = []

  for (let id = 1; id <= 110; id++) {
    try {
      const html = await fetchPage(id)
      const parsed = parseGrammarHtml(html, id)
      if (parsed && parsed.groups.length > 0) {
        results.push(parsed)
        const totalEx = parsed.groups.reduce((s, g) => s + g.examples.length, 0)
        console.log(`[${id}/110] OK: "${parsed.title}" (Groups: ${parsed.groups.length}, Total Ex: ${totalEx})`)
      } else {
        console.log(`[${id}/110] FAILED TO PARSE (Groups: 0)`)
      }
    } catch (err) {
      console.log(`[${id}/110] ERROR: ${err.message}`)
    }
    // Small delay between requests
    await new Promise((r) => setTimeout(r, 60))
  }

  console.log(`Scraped ${results.length}/110 items successfully!`)
  fs.writeFileSync('data/mimi_kara_n3_grammar.json', JSON.stringify(results, null, 2), 'utf8')
  console.log('Saved data/mimi_kara_n3_grammar.json!')
}

if (process.argv[1].endsWith('scrape-mimikara-n3-full.mjs')) {
  scrapeAll()
}
