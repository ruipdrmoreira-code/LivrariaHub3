const puppeteer = require("puppeteer");
const fs = require("fs");

async function test() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
  
  const url = "https://www.wook.pt/arvoretematica/12-ano/8070x5817x5481/P";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  
  const scripts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("script")).map(s => s.textContent || "");
  });
  
  const interestingScripts = scripts.filter(s => s.includes("15786944") || s.includes("Porto Editora") || s.includes("dataLayer"));
  
  fs.writeFileSync("test_out4.json", JSON.stringify(interestingScripts, null, 2));
  
  await browser.close();
}

test().catch(console.error);
