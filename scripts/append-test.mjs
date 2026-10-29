import fs from 'node:fs'

const file = 'server/nhaikanji-service.test.mjs'
const content = fs.readFileSync(file, 'utf8')
const testSnippet = `\ntest('NhaiKanjiService retrieves and caches stroke order vector data', async () => {\n  const service = new NhaiKanjiService()\n  const strokeData = await service.getKanjiStrokeData('信')\n  assert.ok(strokeData)\n  assert.equal(strokeData.kanji, '信')\n  assert.equal(strokeData.strokeCount, 9)\n  assert.equal(strokeData.strokes.length, 9)\n  assert.equal(strokeData.numbers.length, 9)\n  assert.ok(strokeData.strokes[0].d.startsWith('M'))\n})\n`

fs.writeFileSync(file, content.trimEnd() + '\n' + testSnippet, 'utf8')
console.log('Successfully appended test!')
