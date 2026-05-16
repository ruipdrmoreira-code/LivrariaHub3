const puppeteer = require("puppeteer");
const fs = require("fs");

async function main() {
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1280, height: 1024 } });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  
  await page.goto("https://www.wook.pt/arvoretematica/12-ano/8070x5817x5481/P", { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));
  
  // take a screenshot to see what it looks like
  await page.screenshot({ path: "wook_list_screenshot.png" });
  
  const html = await page.evaluate(() => {
    // get the outerHTML of elements that contain '/livro/'
    const links = Array.from(document.querySelectorAll("a[href*='/livro/']"));
    const results = [];
    for(let i=0; i<Math.min(links.length, 3); i++) {
        const wrap = links[i].closest('.product-item, [class*="product"], article, li, div');
        results.push(wrap ? wrap.outerHTML : links[i].outerHTML);
    }
    return results.join("\n\n---\n\n");
  });
  
  fs.writeFileSync("wook_items.html", html);
  await browser.close();
}

main();
