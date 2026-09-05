import fs from 'node:fs'

const html = fs.readFileSync(
  'C:/Users/Phuc_Le/.gemini/antigravity/brain/b7d4523f-9a9f-49df-8066-9a0a7fa93bf2/.system_generated/steps/998/content.md',
  'utf8'
)

let idx = 0
while ((idx = html.indexOf('ykhp', idx)) !== -1) {
  console.log('Match at idx:', idx)
  console.log(html.slice(Math.max(0, idx - 40), idx + 100))
  idx += 4
}
