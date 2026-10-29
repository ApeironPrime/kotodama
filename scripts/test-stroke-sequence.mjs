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
          showCharacter: false,
          showOutline: true,
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
  await p.waitForTimeout(1500);

  // Test animateStroke(0)
  console.log('Animating stroke 0...');
  await p.evaluate(() => {
    return new Promise(resolve => {
      window.writer.animateStroke(0, { onComplete: resolve });
    });
  });
  await p.waitForTimeout(500);

  // Test animateStroke(1)
  console.log('Animating stroke 1...');
  await p.evaluate(() => {
    return new Promise(resolve => {
      window.writer.animateStroke(1, { onComplete: resolve });
    });
  });
  await p.waitForTimeout(500);

  // Take screenshot
  await p.screenshot({ path: 'C:/Users/ACER/.gemini/antigravity/brain/85bc17d9-3e02-4c5a-aed2-911f58a4e5cd/test_stroke_0_and_1.png' });
  console.log('Saved screenshot of stroke 0 and 1');

  await b.close();
}

main().catch(console.error);
