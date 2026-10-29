import { chromium } from 'playwright';

async function main() {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const p = await b.newPage();
  await p.setContent(`
    <!DOCTYPE html>
    <html><body>
      <div id="target"></div>
      <script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.3/dist/hanzi-writer.min.js"></script>
      <script>
        window.writer = HanziWriter.create('target', '信', {
          width: 300,
          height: 300,
          charDataLoader: (char, onLoad, onError) => {
            fetch('https://cdn.jsdelivr.net/npm/hanzi-writer-data-jp@0/' + encodeURIComponent(char) + '.json')
              .then(res => res.json())
              .then(onLoad)
              .catch(onError);
          }
        });
      </script>
    </body></html>
  `);
  await p.waitForTimeout(2000);
  const data = await p.evaluate(() => {
    const svg = document.querySelector('#target svg');
    return {
      svgAttrs: svg ? Array.from(svg.attributes).map(a => `${a.name}="${a.value}"`) : null,
      children: svg ? Array.from(svg.children).map(c => ({
        tag: c.tagName,
        attrs: Array.from(c.attributes).map(a => `${a.name}="${a.value}"`),
        childCount: c.children.length
      })) : null
    };
  });
  console.log(JSON.stringify(data, null, 2));
  await b.close();
}

main().catch(console.error);
