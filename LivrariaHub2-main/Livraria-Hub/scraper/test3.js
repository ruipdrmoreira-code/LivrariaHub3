const puppeteer = require("puppeteer");
async function test() {
  const res = await fetch("https://www.wook.pt/livro/preparacao-para-o-exame-final-nacional-2026-filosofia-11-ano-antonio-correia-lopes/29424749", { headers: { "User-Agent": "Mozilla/5.0" }});
  const html = await res.text();
  console.log("Includes Porto Editora:", html.includes("Porto Editora"));
  console.log("Includes Areal:", html.includes("Areal"));
  
  const m = html.match(/.{0,50}Porto Editora.{0,50}/g);
  if (m) console.log(m);
  
  const n = html.match(/.{0,50}Areal.{0,50}/g);
  if (n) console.log(n);
  
  const b = html.match(/<[^>]+brand[^>]*>([^<]+)<\//i);
  console.log("Brand:", b);
}
test();
