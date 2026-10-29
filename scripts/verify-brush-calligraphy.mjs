import { chromium } from 'playwright';

async function main() {
  console.log('Launching browser (msedge)...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to http://127.0.0.1:5173/tra-tu?tab=kanji...');
  await page.goto('http://127.0.0.1:5173/tra-tu?tab=kanji', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Click on Kanji '日' directly from canvas/list
  console.log('Clicking on kanji 日...');
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('*'));
    const nichiEl = els.find(e => e.textContent === '日' && e.children.length === 0);
    if (nichiEl) nichiEl.click();
  });
  await page.waitForTimeout(2000);

  // Take screenshot of 日 modal
  const shotNichiPath = 'C:/Users/ACER/.gemini/antigravity/brain/85bc17d9-3e02-4c5a-aed2-911f58a4e5cd/modal_nichi_brush_calligraphy.png';
  await page.screenshot({ path: shotNichiPath });
  console.log('Saved screenshot of 日 brush calligraphy:', shotNichiPath);

  // Close modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // 2. Search for Kanji '信'
  console.log('Searching for 信...');
  const searchInput = await page.$('input[placeholder*="Kanji"]');
  if (searchInput) {
    await searchInput.fill('信');
    await page.waitForTimeout(800);
    // Click on the first result
    await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('*')).filter(e => e.textContent?.trim() === '信');
      if (candidates.length > 0) candidates[0].click();
    });
    await page.waitForTimeout(2500);

    const shotTinPath = 'C:/Users/ACER/.gemini/antigravity/brain/85bc17d9-3e02-4c5a-aed2-911f58a4e5cd/modal_tin_brush_calligraphy.png';
    await page.screenshot({ path: shotTinPath });
    console.log('Saved screenshot of 信 brush calligraphy:', shotTinPath);

    // Toggle "# Số nét"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const numBtn = btns.find(b => b.textContent && b.textContent.includes('Số nét'));
      if (numBtn) numBtn.click();
    });
    await page.waitForTimeout(600);

    const shotTinNumbersPath = 'C:/Users/ACER/.gemini/antigravity/brain/85bc17d9-3e02-4c5a-aed2-911f58a4e5cd/modal_tin_brush_numbers.png';
    await page.screenshot({ path: shotTinNumbersPath });
    console.log('Saved screenshot of 信 with brush stroke numbers:', shotTinNumbersPath);

    // Switch to "Tập viết" mode
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const quizTab = tabs.find(t => t.textContent && t.textContent.includes('Tập viết'));
      if (quizTab) quizTab.click();
    });
    await page.waitForTimeout(800);

    const shotTinQuizPath = 'C:/Users/ACER/.gemini/antigravity/brain/85bc17d9-3e02-4c5a-aed2-911f58a4e5cd/modal_tin_brush_quiz.png';
    await page.screenshot({ path: shotTinQuizPath });
    console.log('Saved screenshot of 信 quiz mode:', shotTinQuizPath);
  }

  await browser.close();
  console.log('Done!');
}

main().catch(console.error);
