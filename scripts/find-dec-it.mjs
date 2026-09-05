import fs from 'node:fs'

const html = fs.readFileSync(
  'C:/Users/Phuc_Le/.gemini/antigravity/brain/b7d4523f-9a9f-49df-8066-9a0a7fa93bf2/.system_generated/steps/998/content.md',
  'utf8'
)

const matches = html.match(/src="data:text\/javascript;base64,([^"]+)"/gi) || []
for (let i = 0; i < matches.length; i++) {
  const b64 = matches[i].replace(/src="data:text\/javascript;base64,/, '').replace(/"$/, '')
  const decoded = Buffer.from(b64, 'base64').toString('utf8')
  if (decoded.includes('dec_it') || decoded.includes('atob') || decoded.includes('fromCharCode')) {
    console.log(`Script ${i}:`)
    console.log(decoded)
  }
}
