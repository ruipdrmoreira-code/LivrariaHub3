const puppeteer = require("puppeteer");
const fs = require("fs");

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://www.wook.pt/arvoretematica/12-ano/8070x5817x5481/P");
  
  // same logic as extrairLivrosDaPagina fallback
  const dados = await page.evaluate(() => {
    const resultados = [];
    const links = Array.from(document.querySelectorAll("a[href*='/livro/']"));
    for (const link of links) {
      const wrap = link.closest("article, li, div");
      const texto = wrap ? wrap.innerText : "";
      const precoMatch = texto.match(/(\d+[,.]\d{2})\s*€/);
      
      resultados.push({
        href: link.href,
        text: texto,
        preco: precoMatch ? precoMatch[1] : null
      });
    }
    return resultados;
  });
  
  fs.writeFileSync("test_wook.json", JSON.stringify(dados, null, 2));
  await browser.close();
}

main();
