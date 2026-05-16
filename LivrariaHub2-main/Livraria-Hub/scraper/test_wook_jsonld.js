const puppeteer = require("puppeteer");
const fs = require("fs");

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://www.wook.pt/arvoretematica/12-ano/8070x5817x5481/P");
  
  const dados = await page.evaluate(() => {
    const resultados = [];
    const paraArray = (v) => (Array.isArray(v) ? v : [v]);
    
    const scripts = Array.from(document.querySelectorAll("script[type='application/ld+json']"));
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || "[]");
        const stack = paraArray(data);
        while (stack.length) {
          const item = stack.pop();
          if (!item || typeof item !== "object") continue;
          if (Array.isArray(item)) {
            stack.push(...item);
            continue;
          }
          if (item["@graph"]) stack.push(...paraArray(item["@graph"]));
          if (item.itemListElement) stack.push(...paraArray(item.itemListElement));
          if (item.mainEntity) stack.push(...paraArray(item.mainEntity));
          if (item.item) stack.push(...paraArray(item.item));

          const tipo = item["@type"];
          const isProduct =
            tipo === "Product" ||
            (Array.isArray(tipo) && tipo.includes("Product")) ||
            (item.name && (item.offers || item.url));
          if (!isProduct) continue;

          const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
          resultados.push({
            name: item.name,
            price: offer?.price || offer?.lowPrice || "MISSING_PRICE",
            url: item.url || offer?.url || "MISSING_URL",
            isbn: item.isbn || "MISSING_ISBN",
            brand: item.brand || item.publisher || "MISSING_BRAND"
          });
        }
      } catch(e) {}
    }
    return resultados;
  });
  
  fs.writeFileSync("test_wook_jsonld.json", JSON.stringify(dados, null, 2));
  await browser.close();
}
main();
