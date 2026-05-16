const fs = require('fs');
const html = fs.readFileSync('wook_full.html', 'utf8');

const cheerio = require('cheerio'); // try requiring cheerio, it might be in node_modules
try {
  const $ = cheerio.load(html);
  const products = [];
  $('div.product-item, div.product, article').each((i, el) => {
     products.push($(el).html());
  });
  console.log("Found products: " + products.length);
  if(products.length > 0) {
     fs.writeFileSync('wook_products.html', products.slice(0, 2).join('\n<hr/>\n'));
  }
} catch (e) {
  console.log("cheerio not found, doing manual search");
  // fallback
}
