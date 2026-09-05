import https from 'node:https'

https.get(
  'https://www.vnjpclub.com/mimi-kara-n3-bunpo/np-5.html',
  {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  },
  (res) => {
    let data = ''
    res.on('data', (chunk) => (data += chunk))
    res.on('end', () => {
      console.log('Response status:', res.statusCode)
      console.log('Data length:', data.length)
      console.log('Has ykhp:', data.includes('data-ykhp'))
      const start = data.indexOf('data-ykhp="')
      if (start !== -1) {
        console.log('ykhp slice:', data.slice(start, start + 300))
      }
    })
  }
)
