import https from 'node:https'

const jsUrls = [
  'https://www.vnjpclub.com/wp-content/litespeed/js/2f7a6888de2167be4ead046e47aacbc5.js?ver=b6d5b',
  'https://www.vnjpclub.com/wp-content/litespeed/js/a0f5904d6dd183775c553dd9dca8e682.js?ver=d7e79',
  'https://www.vnjpclub.com/wp-content/litespeed/js/cf916dc7b459bec25d8b9a92c22ae948.js?ver=a3ce0',
  'https://www.vnjpclub.com/wp-content/litespeed/js/2edc9c3441e7c41a20e44346d7ee1649.js?ver=39def',
  'https://www.vnjpclub.com/wp-content/litespeed/js/8dea5b7dbe88cb2626fba47ed6b7e1b9.js?ver=fdf51',
  'https://www.vnjpclub.com/wp-content/litespeed/js/bf7e5eb08ba45a14a7a8ba41ac8ead6e.js?ver=40071',
  'https://www.vnjpclub.com/wp-content/litespeed/js/609e45246353faaac0813c1162743790.js?ver=ca032',
  'https://www.vnjpclub.com/wp-content/litespeed/js/f5164f408be49fb6d4b28c071db18090.js?ver=d6ac0',
  'https://www.vnjpclub.com/wp-content/litespeed/js/23eb060caf44e70c745b62424308f4bf.js?ver=9ad38',
  'https://www.vnjpclub.com/wp-content/litespeed/js/be7e458ed8904f3b464036cb0f000ea7.js?ver=13ff9',
  'https://www.vnjpclub.com/wp-content/litespeed/js/ff4763ae902bbf4b5b91b5c844592210.js?ver=1239e',
]

function fetchUrl(url) {
  return new Promise((resolve) => {
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => resolve({ url, data }))
      })
      .on('error', () => resolve({ url, data: '' }))
  })
}

async function check() {
  for (const u of jsUrls) {
    const { url, data } = await fetchUrl(u)
    if (data.includes('ykhp') || data.includes('protected') || data.includes('atob')) {
      console.log('FOUND IN:', url)
      const idx = data.indexOf('ykhp') !== -1 ? data.indexOf('ykhp') : data.indexOf('atob')
      console.log(data.slice(Math.max(0, idx - 100), idx + 400))
    }
  }
}

check()
