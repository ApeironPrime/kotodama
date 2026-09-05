import fs from 'node:fs'

const html = fs.readFileSync(
  'C:/Users/Phuc_Le/.gemini/antigravity/brain/b7d4523f-9a9f-49df-8066-9a0a7fa93bf2/.system_generated/steps/998/content.md',
  'utf8'
)

const startStr = 'data-ykhp="'
const start = html.indexOf(startStr)
const end = html.indexOf('"', start + startStr.length)
const encoded = html.slice(start + startStr.length, end)

const idx = encoded.indexOf('mimikaran3')
console.log('mimikaran3 index in encoded:', idx)
if (idx !== -1) {
  console.log(encoded.slice(idx - 50, idx + 1000))
}
