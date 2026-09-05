import fs from 'node:fs'

const data = JSON.parse(fs.readFileSync('data/mimi_kara_n3_grammar.json', 'utf8'))
const scratchData = JSON.parse(
  fs.readFileSync('C:/Users/Phuc_Le/.gemini/antigravity/scratch/mimi_kara_n3_grammar.json', 'utf8')
)

const currentIds = new Set(data.map((x) => x.id))
const scratchMap = new Map(scratchData.map((x) => [x.id, x]))

for (let id = 1; id <= 110; id++) {
  if (!currentIds.has(id)) {
    const item = scratchMap.get(id)
    if (item) {
      console.log(`Adding missing id ${id}: ${item.title}`)
      data.push(item)
    }
  }
}

data.sort((a, b) => a.id - b.id)

function formatRuby(textWithFurigana, rawJp) {
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

for (const item of data) {
  if (!item.groups || item.groups.length === 0) {
    const exs = (item.examples || []).map((ex, idx) => {
      const { clean, ruby } = formatRuby(ex.jp_furigana, ex.jp)
      return {
        no: idx + 1,
        jp: clean,
        jp_ruby: ruby,
        vi: ex.vi || '',
      }
    })

    item.groups = [
      {
        group_no: 1,
        title: item.title,
        meaning: item.meaning,
        structure: item.structure,
        usage: item.usage,
        examples: exs,
      },
    ]
  } else {
    for (const g of item.groups) {
      for (const ex of g.examples) {
        if (!ex.jp_ruby) {
          const { clean, ruby } = formatRuby(ex.jp_furigana, ex.jp)
          ex.jp = clean
          ex.jp_ruby = ruby
        }
      }
    }
  }

  item.examples = item.groups.flatMap((g) => g.examples)
}

fs.writeFileSync('data/mimi_kara_n3_grammar.json', JSON.stringify(data, null, 2), 'utf8')
console.log(`Total complete sorted items: ${data.length}/110!`)
