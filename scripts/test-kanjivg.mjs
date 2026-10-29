async function testKanji(char) {
  const code = char.codePointAt(0).toString(16).padStart(5, '0')
  const url = `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg/kanji/${code}.svg`
  const res = await fetch(url)
  if (!res.ok) {
    console.log(`Failed for ${char} (${code}):`, res.status)
    return
  }
  const svgText = await res.text()
  
  // Extract stroke paths (<path ... id="kvg:...-s\d+" ... d="..." />)
  const strokePathRegex = /<path[^>]*\bid="([^"]*-s\d+)"[^>]*\bd="([^"]+)"[^>]*>/g
  const strokes = []
  let m
  while ((m = strokePathRegex.exec(svgText)) !== null) {
    strokes.push({ id: m[1], d: m[2] })
  }
  
  // Extract stroke numbers (<text transform="matrix(...)">1</text>)
  const numRegex = /<text transform="matrix\(([^)]+)\)">(\d+)<\/text>/g
  const numbers = []
  while ((m = numRegex.exec(svgText)) !== null) {
    const parts = m[1].split(/\s+/).map(Number)
    numbers.push({ num: parseInt(m[2], 10), x: parts[4], y: parts[5] })
  }
  
  console.log(`Kanji: ${char} (${code}) => ${strokes.length} strokes, ${numbers.length} numbers`)
  console.log('Sample stroke:', strokes[0])
  console.log('Sample number:', numbers[0])
}

async function run() {
  await testKanji('信')
  await testKanji('回')
  await testKanji('日')
  await testKanji('一')
}

run()
