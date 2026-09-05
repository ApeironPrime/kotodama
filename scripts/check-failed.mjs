import https from 'node:https'

function fetchPage(id) {
  return new Promise((resolve, reject) => {
    https
      .get(
        `https://www.vnjpclub.com/mimi-kara-n3-bunpo/np-${id}.html`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        },
        (res) => {
          let data = ''
          res.on('data', (chunk) => (data += chunk))
          res.on('end', () => resolve(data))
        }
      )
      .on('error', reject)
  })
}

async function checkFailed() {
  const failedIds = [97, 98, 99, 100, 102, 104, 106, 107]
  for (const id of failedIds) {
    const html = await fetchPage(id)
    console.log(
      `np-${id}.html: length=${html.length}, includes ykhp=${html.includes('data-ykhp')}, title=${html.match(/<title>(.*?)<\/title>/i)?.[1]}`
    )
  }
}
checkFailed()
