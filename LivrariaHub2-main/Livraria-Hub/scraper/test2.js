const puppeteer = require("puppeteer");

async function test() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  await page.goto("https://www.wook.pt/arvoretematica/11-ano/8070x5817x5470/P", { waitUntil: "domcontentloaded" });
  
  await new Promise(r => setTimeout(r, 3000));
  
  const books = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("article, [class*='product']")).map(el => el.innerHTML).slice(3, 5);
  });
  
  console.log(books);
  await browser.close();
}
test();
