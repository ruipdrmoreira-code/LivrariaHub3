const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
  await page.goto('https://www.wook.pt/arvoretematica/12-ano/8070x5817x5481/P', { waitUntil: 'domcontentloaded' });
  
  // Wait a bit
  await new Promise(r => setTimeout(r, 3000));
  
  await page.screenshot({ path: 'wook_screenshot.png' });
  
  const html = await page.content();
  fs.writeFileSync('wook_full.html', html);
  
  console.log('done');
  await browser.close();
})();
