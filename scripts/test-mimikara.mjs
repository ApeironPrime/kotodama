import fs from 'node:fs'

const html = fs.readFileSync(
  'C:/Users/Phuc_Le/.gemini/antigravity/brain/b7d4523f-9a9f-49df-8066-9a0a7fa93bf2/.system_generated/steps/998/content.md',
  'utf8'
)

console.log('html.indexOf mimikara:', html.indexOf('mimikara'))
const start = html.indexOf('data-ykhp="')
const end = html.indexOf('">', start)
const str = html.slice(start, end)
console.log('str.indexOf mimikara:', str.indexOf('mimikara'))
if (str.indexOf('mimikara') !== -1) {
  const p = str.indexOf('mimikara')
  console.log('Surrounding:', str.slice(p - 30, p + 100))
}
