import https from 'node:https'

https.get(
  'https://www.vnjpclub.com/mimi-kara-n3-bunpo/np-97.html',
  {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  },
  (res) => {
    console.log('Status:', res.statusCode)
    console.log('Headers location:', res.headers.location)
    let d = ''
    res.on('data', (c) => (d += c))
    res.on('end', () => console.log('Body:', d))
  }
)
