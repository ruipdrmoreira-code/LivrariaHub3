const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');
  await page.goto('https://www.wook.pt/arvoretematica/12-ano/8070x5817x5481/P', { waitUntil: 'domcontentloaded' });
  
  const html = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.product-item'));
    return items.slice(0, 1).map(i => i.innerHTML).join('\n');
  });
  
  const fs = require('fs');
  fs.writeFileSync('wook_item_test.html', html);
  console.log('done');
  await browser.close();
})();
