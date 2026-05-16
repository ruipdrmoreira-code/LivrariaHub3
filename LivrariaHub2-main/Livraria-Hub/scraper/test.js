const puppeteer = require("puppeteer");
async function test() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  await page.goto("https://www.wook.pt/livros-escolares", { waitUntil: "domcontentloaded" });
  
  // Accept cookies if needed
  try {
    const btn = await page.$("#onetrust-accept-btn-handler");
    if (btn) await btn.click();
  } catch(e) {}
  
  await new Promise(r => setTimeout(r, 2000));
  
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a")).map(a => a.href).filter(h => h.includes("/livro/"));
  });
  console.log("Links de livros encontrados:", links.length);
  
  const items = await page.evaluate(() => {
    return document.body.innerHTML.substring(0, 500); // just checking if it's blocked
  });
  
  console.log(items);
  await browser.close();
}
test();
