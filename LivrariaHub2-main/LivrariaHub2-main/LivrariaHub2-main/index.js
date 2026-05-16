const puppeteer = require("puppeteer");
const mysql = require("mysql2/promise");

const DB_CONFIG = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "livrariahub",
};

const URLS_WOOK = [
  "https://www.wook.pt/livros-escolares",
  "https://www.wook.pt/arvoretematica/1-ano/8070x5817x5822/P",
  "https://www.wook.pt/arvoretematica/2-ano/8070x5817x5830/P",
  "https://www.wook.pt/arvoretematica/3-ano/8070x5817x5838/P",
  "https://www.wook.pt/arvoretematica/4-ano/8070x5817x5382/P",
  "https://www.wook.pt/arvoretematica/5-ano/8070x5817x5393/P",
  "https://www.wook.pt/arvoretematica/6-ano/8070x5817x5404/P",
  "https://www.wook.pt/arvoretematica/7-ano/8070x5817x5415/P",
  "https://www.wook.pt/arvoretematica/8-ano/8070x5817x5429/P",
  "https://www.wook.pt/arvoretematica/9-ano/8070x5817x5444/P",
  "https://www.wook.pt/arvoretematica/10-ano/8070x5817x5459/P",
  "https://www.wook.pt/arvoretematica/11-ano/8070x5817x5470/P",
  "https://www.wook.pt/arvoretematica/12-ano/8070x5817x5481/P",
  "https://www.wook.pt/arvoretematica/pre-escolar/8070x5817x5818/P",
];
const ESPERA_ENTRE_PAGINAS_MS = 2500;
const APAGAR_NAO_ESCOLARES = process.env.SCRAPER_DELETE_NON_SCHOOL === "true";
const EDU_KEYWORDS = [
  "manual",
  "escolar",
  "educacao",
  "educação",
  "caderno de atividades",
  "caderno atividades",
  "fichas",
  "exames",
  "escola",
  "ensino",
  "professor",
  "aluno",
  "didatico",
  "didático",
  "preparacao",
  "preparação",
  "portugues",
  "português",
  "matematica",
  "matemática",
  "ciencias",
  "ciências",
  "historia",
  "história",
  "geografia",
  "fisico-quimica",
  "físico-química",
  "secundario",
  "secundário",
  "1º ano",
  "2º ano",
  "3º ano",
  "4º ano",
  "5º ano",
  "6º ano",
  "7º ano",
  "8º ano",
  "9º ano",
  "10º ano",
  "11º ano",
  "12º ano",
];
const NON_SCHOOL_KEYWORDS = [
  "romance",
  "novela",
  "ficcao",
  "ficção",
  "literatura",
  "poesia",
  "conto",
];

function normalizarUrl(url) {
  if (!url) return "https://www.wook.pt/";
  if (url.startsWith("http")) return url;
  return `https://www.wook.pt${url}`;
}

function limparTexto(valor) {
  return (valor || "").replace(/\s+/g, " ").trim();
}

function limparTitulo(titulo) {
  return limparTexto(String(titulo || ""))
    .replace(/\b\d{1,2}\s*%\b/g, "")
    .replace(/\s+-\s+\d{1,2}\s*%/g, "")
    .replace(/\(\s*\d{1,2}\s*%\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parsePreco(valor) {
  if (!valor) return 0;
  const texto = String(valor).replace(/[^\d,.]/g, "").replace(",", ".");
  const numero = Number.parseFloat(texto);
  return Number.isFinite(numero) ? Number(numero.toFixed(2)) : 0;
}

function gerarIsbnFallback(link, titulo) {
  const base = `${link}|${titulo}`;
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    hash = (hash * 31 + base.charCodeAt(i)) >>> 0;
  }
  const hashTexto = String(hash).padStart(10, "0").slice(0, 10);
  return `9790${hashTexto}`;
}

function mapearTipo(textoBase) {
  const texto = (textoBase || "").toLowerCase();
  if (texto.includes("caderno")) return "CADERNO_ATIVIDADES";
  if (texto.includes("manual")) return "MANUAL";
  if (texto.includes("infantil")) return "INFANTIL";
  if (texto.includes("python") || texto.includes("sql") || texto.includes("tecnico")) return "TECNICO";
  return "MANUAL";
}

function mapearDisciplina(textoBase) {
  const texto = (textoBase || "").toLowerCase();
  if (texto.includes("estudo do meio")) return "Estudo do Meio";
  if (texto.includes("historia e geografia de portugal") || texto.includes("história e geografia de portugal")) {
    return "Historia e Geografia de Portugal";
  }
  if (texto.includes("educacao visual") || texto.includes("educação visual")) return "Educacao Visual";
  if (texto.includes("educacao tecnologica") || texto.includes("educação tecnológica")) return "Educacao Tecnologica";
  if (texto.includes("educacao musical") || texto.includes("educação musical")) return "Educacao Musical";
  if (texto.includes("educacao fisica") || texto.includes("educação física")) return "Educacao Fisica";
  if (texto.includes("língua portuguesa") || texto.includes("lingua portuguesa") || texto.includes("português") || texto.includes("portugues")) {
    return "Portugues";
  }
  if (texto.includes("matemática") || texto.includes("matematica") || texto.includes("macs")) {
    return "Matematica";
  }
  if (texto.includes("inglês") || texto.includes("ingles")) return "Ingles";
  if (texto.includes("francês") || texto.includes("frances")) return "Frances";
  if (texto.includes("espanhol")) return "Espanhol";
  if (texto.includes("portugu")) return "Portugues";
  if (texto.includes("matem")) return "Matematica";
  if (texto.includes("hist")) return "Historia";
  if (texto.includes("hgp")) return "Historia e Geografia de Portugal";
  if (texto.includes("geograf")) return "Geografia";
  if (texto.includes("fisico") || texto.includes("físico") || texto.includes("quim") || texto.includes("fq")) {
    return "Fisico-Quimica";
  }
  if (texto.includes("biolog")) return "Biologia";
  if (texto.includes("filosof")) return "Filosofia";
  if (texto.includes("ciencias") || texto.includes("ciências") || texto.includes("cn")) return "Ciencias";
  return "Educacao";
}

function mapearAnoEscolar(textoBase) {
  const texto = (textoBase || "").toLowerCase();
  const regexes = [
    /(?:^|[^\d])(1[0-2]|[1-9])(?:\s*[\.\-º°o]\s*|\s*)ano\b/i,
    /\b(1[0-2]|[1-9])-(?:ano)\b/i,
    /\bano\b\s*(1[0-2]|[1-9])/i,
  ];
  for (const regex of regexes) {
    const match = texto.match(regex);
    if (match) return Number(match[1]);
  }
  if (texto.includes("pré-escolar") || texto.includes("pre-escolar") || texto.includes("pre escolar")) return -1;
  return 0;
}

function extrairContextoRelevante(texto) {
  const base = String(texto || "");
  const linhas = base
    .split(/\r?\n/)
    .map((l) => limparTexto(l))
    .filter(Boolean);
  const relevantes = linhas.filter((linha) =>
    /classificação temática|classificacao tematica|livros escolares|apoio escolar|pré-escolar|pre-escolar|ensino básico|ensino basico|secundário|secundario|\b[1-9]\s*[.º°o]?\s*ano\b|\b1[0-2]\s*[.º°o]?\s*ano\b|matem|portugu|hist|geograf|fisic|quim|biolog|franc|ingl|espanhol|filosof|ciencias|hgp|estudo do meio|educação visual|educacao visual|educação tecnológica|educacao tecnologica/i.test(
      linha,
    ),
  );
  return relevantes.join(" | ");
}

function temDadosMinimos(livro) {
  if (!livro?.titulo || !livro?.link) return false;
  const temEditora = livro.editora && livro.editora.toLowerCase() !== "desconhecida";
  const temIsbn = Boolean(livro.isbn);
  const temPreco = Number(livro.preco) > 0;
  return temPreco || temEditora || temIsbn;
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ehLivroEscolar(livro) {
  const texto = `${livro?.titulo || ""} ${livro?.link || ""} ${livro?.editora || ""}`.toLowerCase();
  return EDU_KEYWORDS.some((keyword) => texto.includes(keyword));
}

function ehLivroEscolarEstrito(livro) {
  const texto = `${livro?.titulo || ""} ${livro?.link || ""} ${livro?.editora || ""} ${livro?.disciplina || ""} ${livro?.contextoSecao || ""}`.toLowerCase();
  const temIndicadorNaoEscolar = NON_SCHOOL_KEYWORDS.some((keyword) => texto.includes(keyword));
  const temIndicadorEscolar = EDU_KEYWORDS.some((keyword) => texto.includes(keyword));
  const anoEscolar = Number(livro?.anoEscolar || 0);
  const tipo = String(livro?.tipo || "").toUpperCase();
  const tipoEscolar = ["MANUAL", "CADERNO_ATIVIDADES"].includes(tipo);

  if (!temIndicadorEscolar && anoEscolar <= 0 && !tipoEscolar) return false;
  if (temIndicadorNaoEscolar && anoEscolar <= 0 && !tipoEscolar) return false;
  return true;
}

async function aceitarCookies(page) {
  const botoes = [
    "#onetrust-accept-btn-handler",
    "button[aria-label*='Aceitar']",
    "button[id*='accept']",
  ];
  for (const selector of botoes) {
    const botao = await page.$(selector);
    if (botao) {
      await botao.click();
      return;
    }
  }
}

async function extrairLivrosDaPagina(page) {
  const dados = await page.evaluate(() => {
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
          guardar({
            titulo: item.name || "",
            preco: offer?.price || offer?.lowPrice || "",
            moeda: offer?.priceCurrency || "EUR",
            link: item.url || offer?.url || "",
            editora: item.brand?.name || item.publisher?.name || "",
            isbn: item.isbn || "",
          });
        }
      } catch (_e) {
        // ignora json inválido
      }
    }

    if (resultados.length < 10) {
      const links = Array.from(document.querySelectorAll("a[href*='/livro/']"));
      for (const link of links) {
        const titulo = (link.getAttribute("title") || link.textContent || "").trim();
        if (titulo.length < 2) continue;
        const container = link.closest("article, li, div");
        const texto = container?.innerText || "";
        const precoMatch = texto.match(/(\d+[,.]\d{2})\s*€/);
        guardar({
          titulo,
          preco: precoMatch ? precoMatch[1] : "",
          moeda: "EUR",
          link: link.getAttribute("href") || "",
          editora: "",
          isbn: "",
        });
      }
    }

    return resultados;
  });

  return dados.map((item) => ({
    titulo: limparTitulo(item.titulo),
    preco: parsePreco(item.preco),
    link: normalizarUrl(item.link),
    editora: limparTexto(item.editora) || "Desconhecida",
    isbn: limparTexto(item.isbn),
  }));
}

async function extrairDetalhesLivro(page, urlLivro) {
  await page.goto(urlLivro, { waitUntil: "domcontentloaded", timeout: 60000 });
  await esperar(1500);

  const detalhe = await page.evaluate(() => {
    const limpar = (v) => (v || "").replace(/\s+/g, " ").trim();
    const extrairRelevante = (texto) => {
      const linhas = String(texto || "")
        .split(/\r?\n/)
        .map((l) => limpar(l))
        .filter((l) => Boolean(l) && l.length <= 180);
      const relevantes = linhas.filter((linha) =>
        /classificação temática|classificacao tematica|livros escolares|apoio escolar|pré-escolar|pre-escolar|ensino básico|ensino basico|secundário|secundario|\b[1-9]\s*[.º°o]?\s*ano\b|\b1[0-2]\s*[.º°o]?\s*ano\b|matem|portugu|hist|geograf|fisic|quim|biolog|franc|ingl|espanhol|filosof|ciencias|hgp|estudo do meio|educação visual|educacao visual|educação tecnológica|educacao tecnologica/i.test(
          linha,
        ),
      );
      return relevantes.join(" | ");
    };
    const scripts = Array.from(document.querySelectorAll("script[type='application/ld+json']"));
    let titulo = "";
    let editora = "";
    let isbn = "";
    let preco = "";
    let precoTexto = "";
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || "{}");
        const stack = Array.isArray(data) ? [...data] : [data];
        while (stack.length) {
          const item = stack.pop();
          if (!item || typeof item !== "object") continue;
          if (Array.isArray(item)) {
            stack.push(...item);
            continue;
          }
          if (item["@graph"]) stack.push(...(Array.isArray(item["@graph"]) ? item["@graph"] : [item["@graph"]]));
          if (item["@type"] === "Product" || (Array.isArray(item["@type"]) && item["@type"].includes("Product"))) {
            titulo = titulo || limpar(item.name || "");
            editora = editora || limpar(item.brand?.name || item.publisher?.name || "");
            isbn = isbn || limpar(item.isbn || "");
            const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
            preco = preco || limpar(String(offer?.price || offer?.lowPrice || ""));
          }
        }
      } catch (_e) {
        // ignora json inválido
      }
    }

    const breadcrumb = Array.from(document.querySelectorAll("nav a, .breadcrumb a, [class*='breadcrumb'] a"))
      .map((a) => limpar(a.textContent || ""))
      .filter(Boolean);

    const textoPagina = limpar(document.body?.innerText || "");
    const textoRelevante = extrairRelevante(document.body?.innerText || "");
    const precoMatch = textoPagina.match(/(\d{1,3}(?:[.,]\d{2}))\s*€/);
    if (precoMatch) precoTexto = precoMatch[1];
    const classificacaoMatch = (textoRelevante || textoPagina).match(/Classificação Temática:\s*([^\n|]+)/i);
    const anoCampo =
      Array.from(document.querySelectorAll("dt, th, strong, b"))
        .map((n) => limpar(n.textContent || ""))
        .find((t) => /ano.*escolar|escolaridade|ano/i.test(t)) || "";
    const descricaoCurta = Array.from(document.querySelectorAll("meta[name='description']"))
      .map((m) => limpar(m.getAttribute("content") || ""))
      .filter(Boolean)
      .join(" ");
    return {
      titulo,
      editora,
      isbn,
      preco,
      precoTexto,
      breadcrumb,
      textoPagina,
      textoRelevante,
      descricaoCurta,
      classificacaoTematica: limpar(classificacaoMatch?.[1] || ""),
      anoCampo,
    };
  });

  const textoBase = [
    detalhe.titulo,
    detalhe.breadcrumb.join(" "),
    detalhe.classificacaoTematica,
    detalhe.textoRelevante,
    detalhe.descricaoCurta,
    detalhe.anoCampo,
  ].join(" ");

  return {
    titulo: limparTitulo(detalhe.titulo),
    editora: limparTexto(detalhe.editora) || "Desconhecida",
    isbn: limparTexto(detalhe.isbn),
    preco: parsePreco(detalhe.preco) || parsePreco(detalhe.precoTexto),
    tipo: mapearTipo(textoBase),
    disciplina: mapearDisciplina(textoBase),
    anoEscolar: mapearAnoEscolar(`${detalhe.anoCampo} ${textoBase}`),
  };
}

async function extrairLinksEscolaresDaPagina(page) {
  const links = await page.evaluate(() => {
    const candidatos = [];
    const palavras = ["escolar", "educa", "manual", "caderno", "exame", "ensino", " ano"];
    const anchors = Array.from(document.querySelectorAll("a[href]"));
    for (const a of anchors) {
      const href = (a.getAttribute("href") || "").trim();
      const texto = (a.textContent || "").trim();
      const base = `${href} ${texto}`.toLowerCase();
      if (!href || href.startsWith("#")) continue;
      if (palavras.some((p) => base.includes(p))) {
        candidatos.push({ href, label: texto || title || aria });
      }
    }
    const unicos = [];
    const vistos = new Set();
    for (const item of candidatos) {
      const chave = `${item.href}|${item.label}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      unicos.push(item);
    }
    return unicos;
  });

  return links
    .map((item) => ({
      url: normalizarUrl(item.href),
      label: limparTexto(item.label),
    }))
    .filter((item) => /livros-escolares|apoio-escolar|\/arvoretematica\//i.test(item.url))
    .filter((item) => /\b([1-9]|1[0-2])\s*[.º°o]?\s*ano\b|pré-escolar|pre-escolar|apoio escolar|livros escolares/i.test(`${item.label} ${item.url}`))
    .slice(0, 16);
}

async function extrairContextoSecao(page) {
  return page.evaluate(() => {
    const limpar = (v) => (v || "").replace(/\s+/g, " ").trim();
    const h1 = limpar(document.querySelector("h1")?.textContent || "");
    const breadcrumb = Array.from(document.querySelectorAll(".breadcrumb a, nav[aria-label*='breadcrumb'] a, nav a"))
      .map((a) => limpar(a.textContent || ""))
      .filter(Boolean)
      .slice(-8);
    return { h1, breadcrumb };
  });
}

function chaveSecao(url) {
  const match = String(url || "").match(/\/(\d+(?:x\d+)+)\/P/i);
  return match ? match[1] : "";
}

async function guardarNoMySql(livros) {
  const connection = await mysql.createConnection(DB_CONFIG);
  try {
    const [rows] = await connection.execute(
      `
        SELECT disciplina, ano_escolar, tipo
        FROM livros
        WHERE (disciplina IS NOT NULL AND disciplina <> '')
           OR ano_escolar IS NOT NULL
           OR (tipo IS NOT NULL AND tipo <> '')
        ORDER BY updated_at DESC
        LIMIT 1
      `,
    );

    const defaults = rows?.[0] || {};
    const disciplinaPadrao = "Educacao";
    const anoEscolarPadrao = Number.isFinite(Number(defaults.ano_escolar))
      ? Number(defaults.ano_escolar)
      : 0;
    const tipoPadrao = "MANUAL";

    const sql = `
      INSERT INTO livros
      (editora, disciplina, ano_escolar, tipo, titulo, isbn, codigo_interno, preco, ativo, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        editora = VALUES(editora),
        disciplina = VALUES(disciplina),
        ano_escolar = VALUES(ano_escolar),
        tipo = VALUES(tipo),
        preco = VALUES(preco),
        updated_at = NOW(),
        deleted_at = NULL
    `;

    let inseridos = 0;
    for (const livro of livros) {
      if (!temDadosMinimos(livro)) continue;
      const isbnFinal = livro.isbn || gerarIsbnFallback(livro.link, livro.titulo);
      const codigoInterno = livro.link.split("/").filter(Boolean).pop()?.slice(0, 50) || null;

      await connection.execute(sql, [
        livro.editora,
        livro.disciplina || disciplinaPadrao,
        Number.isFinite(Number(livro.anoEscolar)) ? Number(livro.anoEscolar) : anoEscolarPadrao,
        livro.tipo || mapearTipo(`${livro.titulo} ${livro.disciplina || ""}`) || tipoPadrao,
        livro.titulo.slice(0, 255),
        isbnFinal.slice(0, 20),
        codigoInterno,
        livro.preco,
      ]);
      inseridos += 1;
    }

    if (APAGAR_NAO_ESCOLARES) {
      // Opcional: limpeza destrutiva apenas quando ativada explicitamente por variavel de ambiente.
      await connection.execute(
        `
        DELETE FROM livros
        WHERE (disciplina IS NULL OR LOWER(disciplina) NOT IN ('educacao', 'educação'))
           OR (tipo IS NOT NULL AND UPPER(tipo) NOT IN ('MANUAL', 'CADERNO_ATIVIDADES', 'TECNICO', 'INFANTIL'))
        `,
      );
    }

    // Corrige registos antigos que ficaram com tipo "ROMANCE" apesar de serem escolares.
    await connection.execute(
      `
      UPDATE livros
      SET tipo = 'MANUAL',
          disciplina = CASE
            WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%portugu%' THEN 'Portugues'
            WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%matemat%' THEN 'Matematica'
            WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%ingl%' THEN 'Ingles'
            WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%franc%' THEN 'Frances'
            WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%espanhol%' THEN 'Espanhol'
            WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%hist%' THEN 'Historia'
            WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%geograf%' THEN 'Geografia'
            WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%fisic%'
              OR LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%quim%' THEN 'Fisico-Quimica'
            WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%biolog%' THEN 'Biologia'
            WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%filosof%' THEN 'Filosofia'
            WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%ciencias%'
              OR LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%ciências%' THEN 'Ciencias'
            ELSE COALESCE(NULLIF(disciplina, ''), 'Educacao')
          END,
          updated_at = NOW()
      WHERE UPPER(COALESCE(tipo, '')) = 'ROMANCE'
        AND (
          COALESCE(ano_escolar, 0) BETWEEN 1 AND 12
          OR LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) REGEXP '(manual|caderno|atividades|livro escolar|escolar|ensino|[[:<:]](1|2|3|4|5|6|7|8|9|10|11|12)[[:>:]]\\s*([.º°o-]?\\s*ano)|portugu|matemat|ingl|franc|espanhol|hist|geograf|fisic|quim|biolog|filosof|ciencias|hgp)'
        )
      `,
    );

    // Remove registos pobres: sem preco, sem editora valida e sem ISBN.
    await connection.execute(
      `
      DELETE FROM livros
      WHERE COALESCE(preco, 0) <= 0
        AND (editora IS NULL OR TRIM(editora) = '' OR LOWER(editora) = 'desconhecida')
        AND (isbn IS NULL OR TRIM(isbn) = '')
      `,
    );

    // Remove livros escolares sem preco util.
    await connection.execute(
      `
      DELETE FROM livros
      WHERE COALESCE(preco, 0) <= 0
        AND LOWER(COALESCE(disciplina, '')) IN ('educacao', 'educação', 'portugues', 'matematica', 'ingles', 'frances', 'espanhol', 'historia', 'geografia', 'fisico-quimica', 'biologia', 'filosofia', 'ciencias')
      `,
    );

    // Garante que sobram apenas livros escolares (remove lixo antigo de romance/literatura).
    await connection.execute(
      `
      DELETE FROM livros
      WHERE UPPER(COALESCE(tipo, '')) = 'ROMANCE'
         OR LOWER(COALESCE(disciplina, '')) = 'literatura'
      `,
    );

    // Reclassifica disciplinas antigas com base nos textos do proprio registo.
    await connection.execute(
      `
      UPDATE livros
      SET disciplina = CASE
        WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%portugu%' THEN 'Portugues'
        WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%matemat%' THEN 'Matematica'
        WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%ingl%' THEN 'Ingles'
        WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%franc%' THEN 'Frances'
        WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%espanhol%' THEN 'Espanhol'
        WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%hist%' THEN 'Historia'
        WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%geograf%' THEN 'Geografia'
        WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%fisic%' OR LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%quim%' THEN 'Fisico-Quimica'
        WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%biolog%' THEN 'Biologia'
        WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%filosof%' THEN 'Filosofia'
        WHEN LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%ciencias%' OR LOWER(CONCAT_WS(' ', titulo, editora, codigo_interno, isbn)) LIKE '%ciências%' THEN 'Ciencias'
        ELSE disciplina
      END,
      updated_at = NOW()
      WHERE LOWER(COALESCE(disciplina, '')) IN ('educacao', 'educação')
      `,
    );

    return inseridos;
  } finally {
    await connection.end();
  }
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    );

    const livrosColetados = [];
    const chaves = new Set();
    const secoesVisitadas = new Set();

    for (const url of URLS_WOOK) {
      console.log(`A ler: ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await aceitarCookies(page);
      await esperar(ESPERA_ENTRE_PAGINAS_MS);

      const livrosPagina = await extrairLivrosDaPagina(page);
      for (const livro of livrosPagina) {
        const chave = `${livro.titulo}|${livro.link}`;
        if (chaves.has(chave)) continue;
        chaves.add(chave);
        livrosColetados.push(livro);
      }

      const linksEscolares = await extrairLinksEscolaresDaPagina(page);
      for (const linkEscolar of linksEscolares) {
        if (secoesVisitadas.has(linkEscolar.url)) continue;
        secoesVisitadas.add(linkEscolar.url);
        console.log(`A ler secao escolar: ${linkEscolar.url}`);
        await page.goto(linkEscolar.url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await esperar(1800);
        const contextoSecao = await extrairContextoSecao(page);
        const livrosEscolaresPagina = await extrairLivrosDaPagina(page);
        for (const livro of livrosEscolaresPagina) {
          const chave = `${livro.titulo}|${livro.link}`;
          if (chaves.has(chave)) continue;
          chaves.add(chave);
          livrosColetados.push({
            ...livro,
            contextoSecao: `${linkEscolar.label || ""} ${contextoSecao.h1 || ""} ${(contextoSecao.breadcrumb || []).join(" ")}`,
          });
        }
      }
    }

    console.log(`Livros extraidos: ${livrosColetados.length}`);
    const livrosEscolares = livrosColetados.filter(ehLivroEscolar);
    console.log(`Livros escolares filtrados: ${livrosEscolares.length}`);
    if (livrosEscolares.length === 0) throw new Error("Nao foram encontrados livros escolares.");
    const paginaDetalhe = await browser.newPage();
    await paginaDetalhe.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    );

    const livrosEnriquecidos = [];
    for (const livro of livrosEscolares) {
      try {
        const detalhe = await extrairDetalhesLivro(paginaDetalhe, livro.link);
        const textoContexto = `${livro.contextoSecao || ""} ${detalhe.titulo || ""}`;
        const anoSecao = mapearAnoEscolar(textoContexto);
        const disciplinaTitulo = mapearDisciplina(`${detalhe.titulo || ""} ${livro.titulo || ""}`);
        livrosEnriquecidos.push({
          ...livro,
          ...detalhe,
          titulo: detalhe.titulo || livro.titulo,
          editora: detalhe.editora || livro.editora,
          isbn: detalhe.isbn || livro.isbn,
          preco: detalhe.preco || livro.preco,
          disciplina: detalhe.disciplina === "Educacao" ? disciplinaTitulo : detalhe.disciplina,
          anoEscolar: detalhe.anoEscolar || anoSecao,
        });
      } catch (erroDetalhe) {
        livrosEnriquecidos.push({
          ...livro,
          titulo: limparTitulo(livro.titulo),
          tipo: mapearTipo(`${livro.titulo} ${livro.contextoSecao || ""}`),
          disciplina: mapearDisciplina(`${livro.titulo} ${livro.contextoSecao || ""}`),
          anoEscolar: mapearAnoEscolar(`${livro.titulo} ${livro.contextoSecao || ""}`),
        });
      }
    }

    await paginaDetalhe.close();
    const livrosFinais = livrosEnriquecidos.filter(ehLivroEscolarEstrito);
    console.log(`Livros apos filtro estrito: ${livrosFinais.length}`);
    const totalInseridos = await guardarNoMySql(livrosFinais);
    console.log(`Registos inseridos/atualizados na BD: ${totalInseridos}`);
  } finally {
    await browser.close();
  }
}

main().catch((erro) => {
  console.error("Erro no scraper:", erro.message);
  process.exit(1);
});