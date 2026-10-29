import { chromium } from 'playwright';

async function main() {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  const p = await b.newPage();
  await p.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.3/dist/hanzi-writer.min.js"></script>
      <style>
        body { background: #fdfbf7; margin: 40px; font-family: sans-serif; }
        .stage {
          position: relative;
          width: 280px;
          height: 280px;
          background: #fffdfa;
          border: 1px solid #e2dacd;
        }
        #writer-container {
          position: absolute;
          inset: 0;
        }
        .numbers-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .num-badge {
          position: absolute;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #c23a2b;
          color: #fff;
          font-size: 10px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: translate(-50%, -50%);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
      </style>
    </head>
    <body>
      <div class="stage">
        <div id="writer-container"></div>
        <div id="numbers-overlay" class="numbers-overlay"></div>
      </div>
      <div id="status" style="margin-top: 10px; font-weight: bold;"></div>

      <script>
        const width = 280;
        const height = 280;
        const padding = 20;

        const writer = HanziWriter.create('writer-container', '信', {
          width: width,
          height: height,
          padding: padding,
          showCharacter: false,
          showOutline: true,
          strokeColor: '#1A1817',
          outlineColor: 'rgba(215, 205, 190, 0.45)',
          charDataLoader: (char, onLoad, onError) => {
            fetch('https://cdn.jsdelivr.net/npm/hanzi-writer-data-jp@0/' + encodeURIComponent(char) + '.json')
              .then(res => res.json())
              .then(data => {
                window.charData = data;
                onLoad(data);
                renderNumbers(data);
              })
              .catch(onError);
          }
        });

        window.writer = writer;

        function renderNumbers(data) {
          const overlay = document.getElementById('numbers-overlay');
          overlay.innerHTML = '';
          const transform = HanziWriter.getScalingTransform(width, height, padding);
          
          data.medians.forEach((median, i) => {
            const startPt = median[0];
            // Screen coords calculation:
            // In HanziWriter: SVG transform is translate(x, y) scale(scale, -scale)
            // where y in SVG transform is height - transform.y
            // x_screen = transform.x + p.x * transform.scale
            // y_screen = (height - transform.y) - p.y * transform.scale
            const sx = transform.x + startPt[0] * transform.scale;
            const sy = (height - transform.y) - startPt[1] * transform.scale;

            const badge = document.createElement('div');
            badge.className = 'num-badge';
            badge.style.left = sx + 'px';
            badge.style.top = sy + 'px';
            badge.innerText = i + 1;
            overlay.appendChild(badge);
          });
        }
      </script>
    </body>
    </html>
  `);

  await p.waitForTimeout(2000);

  // Take screenshot with numbers overlay
  await p.screenshot({ path: 'C:/Users/ACER/.gemini/antigravity/brain/85bc17d9-3e02-4c5a-aed2-911f58a4e5cd/test_hw_numbers_overlay.png' });
  console.log('Saved test_hw_numbers_overlay.png');

  // Test sequential playback
  await p.evaluate(async () => {
    const total = window.charData.strokes.length;
    for (let i = 0; i < 4; i++) {
      await new Promise(resolve => {
        window.writer.animateStroke(i, { onComplete: resolve });
      });
      document.getElementById('status').innerText = 'Nét ' + (i + 1) + ' / ' + total;
      await new Promise(r => setTimeout(r, 120));
    }
  });

  await p.screenshot({ path: 'C:/Users/ACER/.gemini/antigravity/brain/85bc17d9-3e02-4c5a-aed2-911f58a4e5cd/test_hw_after_4_strokes.png' });
  console.log('Saved test_hw_after_4_strokes.png');

  await b.close();
}

main().catch(console.error);
