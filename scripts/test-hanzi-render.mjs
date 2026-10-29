import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Hanzi Writer Test</title>
  <script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.3/dist/hanzi-writer.min.js"></script>
  <style>
    body {
      background: #F7F5F0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      font-family: serif;
    }
    .grid-container {
      position: relative;
      width: 320px;
      height: 320px;
      background: #FFFDF9;
      border: 2px solid #E4D8C5;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      border-radius: 8px;
    }
    .grid-lines {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    #target {
      position: absolute;
      inset: 0;
    }
  </style>
</head>
<body>
  <h2>Thư pháp Hanzi Writer (Bút lông Nhật Bản - AnimCJK)</h2>
  <div class="grid-container">
    <svg class="grid-lines" viewBox="0 0 320 320">
      <line x1="106.6" y1="0" x2="106.6" y2="320" stroke="rgba(194,58,43,0.18)" stroke-dasharray="4,4"/>
      <line x1="213.3" y1="0" x2="213.3" y2="320" stroke="rgba(194,58,43,0.18)" stroke-dasharray="4,4"/>
      <line x1="0" y1="106.6" x2="320" y2="106.6" stroke="rgba(194,58,43,0.18)" stroke-dasharray="4,4"/>
      <line x1="0" y1="213.3" x2="320" y2="213.3" stroke="rgba(194,58,43,0.18)" stroke-dasharray="4,4"/>
      <line x1="0" y1="0" x2="320" y2="320" stroke="rgba(194,58,43,0.12)" stroke-dasharray="2,2"/>
      <line x1="320" y1="0" x2="0" y2="320" stroke="rgba(194,58,43,0.12)" stroke-dasharray="2,2"/>
    </svg>
    <div id="target"></div>
  </div>

  <script>
    const writer = HanziWriter.create('target', '信', {
      width: 320,
      height: 320,
      padding: 24,
      showCharacter: false,
      showOutline: true,
      strokeColor: '#1A1817',
      outlineColor: 'rgba(215, 205, 190, 0.45)',
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 250,
      charDataLoader: (char, onComplete, onError) => {
        fetch('https://cdn.jsdelivr.net/npm/hanzi-writer-data-jp@0/' + encodeURIComponent(char) + '.json')
          .then(res => res.json())
          .then(onComplete)
          .catch(onError);
      }
    });

    window.writer = writer;
  </script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

server.listen(9877, async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:9877');
  await page.waitForTimeout(2000); // wait for data load
  
  // Take screenshot of outline before writing
  await page.screenshot({ path: 'C:/Users/ACER/.gemini/antigravity/brain/85bc17d9-3e02-4c5a-aed2-911f58a4e5cd/hanzi_writer_test_outline.png' });
  console.log('Saved outline screenshot');

  // Start animation
  await page.evaluate(() => window.writer.animateCharacter());
  // wait 900ms to capture mid stroke
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'C:/Users/ACER/.gemini/antigravity/brain/85bc17d9-3e02-4c5a-aed2-911f58a4e5cd/hanzi_writer_test_mid.png' });
  console.log('Saved mid screenshot');

  // Wait for finish
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'C:/Users/ACER/.gemini/antigravity/brain/85bc17d9-3e02-4c5a-aed2-911f58a4e5cd/hanzi_writer_test_full.png' });
  console.log('Saved full screenshot');

  await browser.close();
  server.close();
  process.exit(0);
});
