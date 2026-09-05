import fs from 'node:fs'

const html = fs.readFileSync(
  'C:/Users/Phuc_Le/.gemini/antigravity/brain/b7d4523f-9a9f-49df-8066-9a0a7fa93bf2/.system_generated/steps/998/content.md',
  'utf8'
)

console.log('html length:', html.length)
const startStr = 'data-ykhp="'
const start = html.indexOf(startStr)
console.log('start:', start)
if (start !== -1) {
  const end = html.indexOf('"', start + startStr.length)
  console.log('end:', end)
  const encoded = html.slice(start + startStr.length, end)
  console.log('encoded length:', encoded.length)
  console.log('encoded substring:', encoded.slice(500, 700))
}
