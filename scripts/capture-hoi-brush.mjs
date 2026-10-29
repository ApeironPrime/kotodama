import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://127.0.0.1:5173/tra-tu?tab=kanji', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const searchInput = await page.$('input[placeholder*="Kanji"]');
  if (searchInput) {
    await searchInput.fill('回');
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('*')).filter(e => e.textContent?.trim() === '回');
      if (candidates.length > 0) candidates[0].click();
    });
    // Wait for stroke animation to complete
    await page.waitForTimeout(3000);

    const shotHoiPath = 'C:/Users/ACER/.gemini/antigravity/brain/85bc17d9-3e02-4c5a-aed2-911f58a4e5cd/modal_hoi_brush_calligraphy.png';
    await page.screenshot({ path: shotHoiPath });
    console.log('Saved screenshot of 回 brush calligraphy:', shotHoiPath);
  }

  await browser.close();
}

main().catch(console.error);
