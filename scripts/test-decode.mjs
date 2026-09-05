import fs from 'node:fs'

const html = fs.readFileSync(
  'C:/Users/Phuc_Le/.gemini/antigravity/brain/b7d4523f-9a9f-49df-8066-9a0a7fa93bf2/.system_generated/steps/998/content.md',
  'utf8'
)

function decodeYkhp(raw) {
  let s = raw
    // HTML entities
    .replace(/&amp;Qt/g, 'YW')
    .replace(/&amp;Qi/g, 'ad')
    .replace(/&amp;J/g, 'la')
    .replace(/&amp;N/g, 'ce')
    .replace(/&amp;1/g, 'am')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // Special markers
    .replace(/!z/g, 'ss')
    .replace(/%z/g, 'as')
    .replace(/!n/g, 'in')
    .replace(/!r/g, 'nk')
    .replace(/!b/g, 'nb')
    .replace(/I\*\*D/g, '')
    .replace(/I\*\*@/g, '')

  // Decode any base64 chunks encoded like Q8OzIHbhursgbmjGsOKApi9Iw6xuaCBuaMaw4oCm
  // A simple regex to replace base64 strings
  s = s.replace(/([A-Za-z0-9+/=]{16,})/g, (m) => {
    try {
      const decoded = Buffer.from(m, 'base64').toString('utf8')
      // If it contains vietnamese or valid html/jp characters, use it
      if (/[\p{L}\p{N}<>]/u.test(decoded) && !/[\x00-\x08\x0E-\x1F]/.test(decoded)) {
        return decoded
      }
    } catch {}
    return m
  })

  return s
}

const startStr = 'data-ykhp="'
const start = html.indexOf(startStr)
if (start !== -1) {
  const end = html.indexOf('">', start)
  const encoded = html.slice(start + startStr.length, end)
  const decoded = decodeYkhp(encoded)
  console.log('Decoded contains mimikaran3-nguphap:', decoded.includes('mimikaran3-nguphap'))
  fs.writeFileSync('scripts/decoded-sample.html', decoded, 'utf8')
  console.log('Wrote scripts/decoded-sample.html')
}
