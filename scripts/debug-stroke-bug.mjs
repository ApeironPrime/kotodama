import { chromium } from 'playwright';

async function main() {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const p = await b.newPage();
  p.on('console', m => console.log('LOG:', m.text()));
  await p.setContent(`
    <!DOCTYPE html>
    <html><body>
      <div id="target"></div>
      <script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.3/dist/hanzi-writer.min.js"></script>
      <script>
        const w = HanziWriter.create('target', '土', {
          width: 280,
          height: 280,
          charDataLoader: (c, onLoad) => {
            fetch('https://cdn.jsdelivr.net/npm/hanzi-writer-data-jp@0/' + encodeURIComponent(c) + '.json')
              .then(r => r.json())
              .then(data => {
                console.log('charData loaded with strokes:', data.strokes.length);
                onLoad(data);
                run();
              });
          }
        });

        function run() {
          console.log('Calling animateStroke(0)...');
          w.animateStroke(0, {
            onComplete: (res) => {
              console.log('Stroke 0 onComplete called with:', JSON.stringify(res));
              console.log('Calling animateStroke(1)...');
              w.animateStroke(1, {
                onComplete: (res2) => {
                  console.log('Stroke 1 onComplete called with:', JSON.stringify(res2));
                }
              });
            }
          });
        }
      </script>
    </body></html>
  `);

  await p.waitForTimeout(4000);
  await b.close();
}

main().catch(console.error);
