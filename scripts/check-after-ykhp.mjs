import fs from 'node:fs'

const html = fs.readFileSync(
  'C:/Users/Phuc_Le/.gemini/antigravity/brain/b7d4523f-9a9f-49df-8066-9a0a7fa93bf2/.system_generated/steps/998/content.md',
  'utf8'
)

const start = html.indexOf('data-ykhp="')
const end = html.indexOf('">', start)
console.log('After data-ykhp tag:')
console.log(html.slice(end, end + 1500))
