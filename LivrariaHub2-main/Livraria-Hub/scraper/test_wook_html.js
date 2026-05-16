const puppeteer = require("puppeteer");
const fs = require("fs");

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  
  await page.goto("https://www.wook.pt/arvoretematica/12-ano/8070x5817x5481/P", { waitUntil: "domcontentloaded", timeout: 60000 });
  
  // Accept cookies if present
  try {
    const btn = await page.$("#onetrust-accept-btn-handler");
    if (btn) await btn.click();
  } catch(e) {}
  
  await new Promise(r => setTimeout(r, 2000));
  
  const html = await page.evaluate(() => {
    // get the outerHTML of the first 3 book elements
    const items = Array.from(document.querySelectorAll(".product-item, [class*='product-item'], article"));
    if (items.length > 0) {
      return items.slice(0, 3).map(el => el.outerHTML).join("\n\n---\n\n");
    }
    // fallback if no such elements
    return document.body.innerHTML.slice(0, 5000);
  });
  
  fs.writeFileSync("wook_sample.html", html);
  
  await browser.close();
}

main();
