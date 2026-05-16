const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Load the saved HTML
  const html = fs.readFileSync('wook_full.html', 'utf8');
  await page.setContent(html);

  const dados = await page.evaluate(() => {
    const limpar = (v) => (v || "").replace(/\s+/g, " ").trim();
    const resultados = [];
    const vistos = new Set();
    const paraArray = (v) => (Array.isArray(v) ? v : [v]);

    const guardar = (livro) => {
      if (!livro?.titulo || !livro?.link) return;
      const chave = `${livro.titulo}|${livro.link}`;
      if (vistos.has(chave)) return;
      vistos.add(chave);
      resultados.push(livro);
    };

    const links = Array.from(document.querySelectorAll("a[href*='/livro/']"));
    for (const link of links) {
      const wrap = link.closest("article, li, div.product-item, div.product, div.card");
      if (!wrap) continue;
      
      const heading = wrap.querySelector("h2, h3, [class*='product-title'], [class*='titulo']");
      const titulo = limpar(
        link.getAttribute("title") ||
          heading?.textContent ||
          link.getAttribute("aria-label") ||
          link.textContent ||
          ""
      );
      if (titulo.length < 2) continue;
      
      const texto = wrap.innerText || "";
      const precoMatch = texto.match(/(\d+[,.]\d{2})\s*€/);
      
      // Try to find editora
      let editora = "";
      const editoraEl = wrap.querySelector(".publisher, .brand, [class*='editora'], [data-brand]");
      if (editoraEl) {
          editora = limpar(editoraEl.textContent);
      } else {
          // Sometimes it's in a span or something inside wrap
          const rx = /Editora\s*[:\-]?\s*([^\n|·]{3,120})/i;
          const m = texto.match(rx);
          if (m) editora = limpar(m[1]);
      }
      
      guardar({
        titulo,
        preco: precoMatch ? precoMatch[1] : "",
        moeda: "EUR",
        link: link.getAttribute("href") || "",
        editora: editora,
        isbn: "",
        textoRaw: texto.replace(/\n/g, " | ")
      });
    }

    return resultados;
  });

  fs.writeFileSync('wook_extracted.json', JSON.stringify(dados, null, 2));
  console.log('done');
  await browser.close();
})();
