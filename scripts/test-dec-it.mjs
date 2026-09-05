import fs from 'node:fs'

function dec_it(data) {
  if (!data) return data
  data = data.replace(/&amp;/g, '&')
  data = data.split('@').join('CAg')
  data = data.split('!').join('W5')
  data = data.split('*').join('CAgI')
  data = data.split('$').join('dGhl')
  data = data.split('%').join('YXN')
  data = data.split('&').join('YW')
  try {
    const bin = Buffer.from(data, 'base64')
    return new TextDecoder('utf-8').decode(bin)
  } catch {
    return data
  }
}

const html = fs.readFileSync(
  'C:/Users/Phuc_Le/.gemini/antigravity/brain/b7d4523f-9a9f-49df-8066-9a0a7fa93bf2/.system_generated/steps/998/content.md',
  'utf8'
)

const startStr = 'data-ykhp="'
const start = html.indexOf(startStr)
if (start !== -1) {
  const end = html.indexOf('"', start + startStr.length)
  const encoded = html.slice(start + startStr.length, end)
  const decoded = dec_it(encoded)
  console.log('Decoded length:', decoded.length)
  console.log('Includes mimikaran3-nguphap:', decoded.includes('mimikaran3-nguphap'))
  console.log(decoded.slice(0, 1000))
}
