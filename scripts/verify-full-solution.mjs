import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('[BROWSER]', msg.text()));

  await page.goto('http://127.0.0.1:5173/tra-tu?tab=kanji', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Test '信' (9 strokes)
  console.log('Testing 信 (9 strokes)...');
  const searchInput = await page.$('input[placeholder*="Kanji"]');
  if (searchInput) {
    await searchInput.fill('信');
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('*')).filter(e => e.textContent?.trim() === '信');
      if (candidates.length > 0) candidates[0].click();
    });

    // Wait for stroke animation to progress through all 9 strokes
    console.log('Waiting 5s for 信 animation...');
    await page.waitForTimeout(5000);

    const shotTinPath = 'C:/Users/ACER/.gemini/antigravity/brain/85bc17d9-3e02-4c5a-aed2-911f58a4e5cd/verify_tin_all_strokes.png';
    await page.screenshot({ path: shotTinPath });
    console.log('Saved screenshot of 信 with all strokes:', shotTinPath);

    // Toggle number overlay
    console.log('Testing # Số nét overlay...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const numBtn = btns.find(b => b.textContent && b.textContent.includes('Số nét'));
      if (numBtn) numBtn.click();
    });
    await page.waitForTimeout(600);

    const shotTinNumPath = 'C:/Users/ACER/.gemini/antigravity/brain/85bc17d9-3e02-4c5a-aed2-911f58a4e5cd/verify_tin_numbers.png';
    await page.screenshot({ path: shotTinNumPath });
    console.log('Saved screenshot of 信 with numbers:', shotTinNumPath);

    // Test Replay button
    console.log('Testing Replay...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const replayBtn = btns.find(b => b.textContent && b.textContent.includes('Diễn lại'));
      if (replayBtn) replayBtn.click();
    });
    await page.waitForTimeout(1200);

    const shotTinReplayPath = 'C:/Users/ACER/.gemini/antigravity/brain/85bc17d9-3e02-4c5a-aed2-911f58a4e5cd/verify_tin_replaying.png';
    await page.screenshot({ path: shotTinReplayPath });
    console.log('Saved screenshot of 信 replaying:', shotTinReplayPath);
  }

  // 2. Test '土' again
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  console.log('Testing 土 (3 strokes)...');
  const searchInput2 = await page.$('input[placeholder*="Kanji"]');
  if (searchInput2) {
    await searchInput2.fill('土');
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('*')).filter(e => e.textContent?.trim() === '土');
      if (candidates.length > 0) candidates[0].click();
    });

    await page.waitForTimeout(3000);
    const shotThoPath = 'C:/Users/ACER/.gemini/antigravity/brain/85bc17d9-3e02-4c5a-aed2-911f58a4e5cd/verify_tho_complete.png';
    await page.screenshot({ path: shotThoPath });
    console.log('Saved screenshot of 土 complete:', shotThoPath);
  }

  await browser.close();
  console.log('Verification script completed!');
}

main().catch(console.error);
