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
          strokeColor: '#1A1817',
          outlineColor: 'rgba(215, 205, 190, 0.45)',
          charDataLoader: (c, onLoad) => {
            fetch('https://cdn.jsdelivr.net/npm/hanzi-writer-data-jp@0/' + encodeURIComponent(c) + '.json')
              .then(r => r.json())
              .then(data => {
                onLoad(data);
                testAnimate(data);
              });
          }
        });

        async function testAnimate(data) {
          console.log('Total strokes in 土:', data.strokes.length);
          for (let i = 0; i < data.strokes.length; i++) {
            console.log('Starting stroke', i);
            const res = await new Promise(resolve => {
              w.animateStroke(i, { onComplete: resolve });
            });
            console.log('Finished stroke', i, res);
            await new Promise(r => setTimeout(r, 200));
          }
          console.log('All strokes finished!');
        }
      </script>
    </body></html>
  `);

  await p.waitForTimeout(4000);
  await p.screenshot({ path: 'C:/Users/ACER/.gemini/antigravity/brain/85bc17d9-3e02-4c5a-aed2-911f58a4e5cd/test_tho_animate.png' });
  console.log('Saved test_tho_animate.png');
  await b.close();
}

main().catch(console.error);
