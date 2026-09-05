import fs from 'node:fs'

const html = fs.readFileSync(
  'C:/Users/Phuc_Le/.gemini/antigravity/brain/b7d4523f-9a9f-49df-8066-9a0a7fa93bf2/.system_generated/steps/998/content.md',
  'utf8'
)

// Search for ykhp in scripts
const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || []
for (const s of scripts) {
  if (
    s.includes('ykhp') ||
    s.includes('protected') ||
    s.includes('atob') ||
    s.includes('decode') ||
    s.includes('replace')
  ) {
    console.log('--- SCRIPT MATCH ---')
    console.log(s.slice(0, 500))
  }
}
