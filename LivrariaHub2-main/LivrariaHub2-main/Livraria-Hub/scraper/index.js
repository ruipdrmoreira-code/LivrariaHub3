const puppeteer = require("puppeteer");
const mysql = require("mysql2/promise");

const DB_CONFIG = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || process.env.DB_USERNAME || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || process.env.DB_DATABASE || "livrariahub",
};

/** Secções iniciais (1.º ao 12.º ano). Pré-escolar removido a pedido. */
const URLS_WOOK = [
  "https://www.wook.pt/livros-escolares",
  "https://www.wook.pt/arvoretematica/ensino-e-educacao/25188x25789x25945/P",
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
];
const ESPERA_ENTRE_PAGINAS_MS = 2500;
/** Máximo de páginas ?page=N por cada URL de listagem (podes subir com SCRAPER_MAX_PAGES). */
const MAX_PAGINAS_POR_LISTAGEM = Math.min(Number(process.env.SCRAPER_MAX_PAGES || 8), 25);
/** Se "false", também grava anos fora de 1–12 (não recomendado). */
const APENAS_ANOS_1_A_12 = process.env.SCRAPER_ONLY_YEARS_1_12 !== "false";
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

/** Título legível a partir do último segmento do URL Wook (/livro/...-slug). */
function tituloDeSlugUrlWook(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  let pathname = "";
  try {
    pathname = new URL(u.startsWith("http") ? u : `https://www.wook.pt${u}`).pathname;
  } catch {
    return "";
  }
  const seg = pathname.split("/").filter(Boolean).pop() || "";
  if (!seg || seg.length < 6 || /^\d+$/.test(seg)) return "";
  let decoded = seg;
  try {
    decoded = decodeURIComponent(seg);
  } catch {
    decoded = seg;
  }
  let t = decoded.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  t = t.replace(/\s*x\s*\d+$/i, "").replace(/\s+P\d+$/i, "").trim();
  if (t.length < 5) return "";
  return limparTexto(
    t
      .split(/\s+/)
      .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
      .filter(Boolean)
      .join(" "),
  );
}

/** Ano escolar 1–12 a partir do URL Wook (ex.: /5-ano/...). */
function derivarAnoDaUrlWook(url) {
  const m = String(url || "").match(/\/(\d{1,2})-ano\b/i);
  if (!m) return 0;
  const n = Number(m[1]);
  return n >= 1 && n <= 12 ? n : 0;
}

function urlComPagina(base, num) {
  if (num <= 1) return base;
  try {
    const u = new URL(base);
    u.searchParams.set("page", String(num));
    return u.href;
  } catch (_e) {
    return `${base}${base.includes("?") ? "&" : "?"}page=${num}`;
  }
}

/** Editoras frequentes no título (fallback quando a página não traz brand). */
const EDITORAS_NO_TITULO = [
  { re: /\bPorto\s+Editora\b/i, nome: "Porto Editora" },
  { re: /\bAreal\s+Editores\b/i, nome: "Areal Editores" },
  { re: /\bTexto\s+Editores\b/i, nome: "Texto Editores" },
  { re: /\bLeya\b/i, nome: "Leya" },
  { re: /\bASA\b(?!\w)/i, nome: "ASA Editores" },
  { re: /\bGradiva\b/i, nome: "Gradiva" },
  { re: /\bCambridge\b/i, nome: "Cambridge University Press" },
  { re: /\bOxford\b/i, nome: "Oxford University Press" },
  { re: /\bRaiz\s+Editores\b/i, nome: "Raiz Editores" },
  { re: /\bPlátano\b|\bPlatano\b/i, nome: "Plátano Editora" },
  { re: /\bGailivro\b/i, nome: "Gailivro" },
  { re: /\bHachette\b/i, nome: "Hachette" },
  { re: /\bMcGraw[-\s]?Hill\b/i, nome: "McGraw-Hill" },
  { re: /\bSantillana\b/i, nome: "Santillana" },
  { re: /\bZigzag\b/i, nome: "Zigzag" },
  { re: /\bEu\s+Leio\b/i, nome: "Eu Leio" },
  { re: /\bEdi[cç][oõ]es\s+Asa\b|\bEdi[cç]oes\s+Asa\b/i, nome: "ASA Editores" },
  { re: /\bDid[aá]ctica\b/i, nome: "Didática" },
  { re: /\bLidel\b/i, nome: "Lidel" },
  { re: /\bBru[aã]\b/i, nome: "Bruã" },
  { re: /\bEuroimpala\b/i, nome: "Euroimpala" },
  { re: /\bManuscrito\b/i, nome: "Manuscrito" },
  { re: /\bIdeia\s+Editorial\b/i, nome: "Ideia Editorial" },
  { re: /\bVera\s+Veras\b/i, nome: "Vera Veras" },
  { re: /\bEdelvives\b/i, nome: "Edelvives" },
  { re: /\bBooksmile\b/i, nome: "Booksmile" },
  { re: /\bIdeias\s+de\s+Ler\b/i, nome: "Ideias de Ler" },
  { re: /\bNovatec\b/i, nome: "Novatec" },
  { re: /\bELFI\b/i, nome: "ELFI" },
  { re: /\bPanda\b(?!\s+TV)/i, nome: "Panda" },
  { re: /\bPresen[cç]a\b/i, nome: "Presença" },
  { re: /\bCiviliza[cç][aã]o\s+Editora\b/i, nome: "Civilização Editora" },
  { re: /\bLeya\s+Educa[cç][aã]o\b/i, nome: "Leya Educação" },
  { re: /\bOrion\b/i, nome: "Orion" },
];

function inferirEditoraDoTitulo(titulo) {
  const t = String(titulo || "");
  for (const { re, nome } of EDITORAS_NO_TITULO) {
    if (re.test(t)) return nome;
  }
  return "";
}

function resolverAnoEscolarFinal(livro) {
  const textoTituloCtx = `${livro?.titulo || ""} ${livro?.contextoSecao || ""}`;
  const doTituloOuCtx = mapearAnoEscolar(textoTituloCtx);
  if (doTituloOuCtx >= 1 && doTituloOuCtx <= 12) return doTituloOuCtx;

  const aDet = Number(livro?.anoEscolar || 0);
  if (aDet >= 1 && aDet <= 12) return aDet;

  const uLink = derivarAnoDaUrlWook(livro?.link);
  if (uLink >= 1 && uLink <= 12) return uLink;

  const uLista = derivarAnoDaUrlWook(livro?.urlListagem);
  if (uLista >= 1 && uLista <= 12) return uLista;

  return aDet || 0;
}

function resolverEditoraFinal(livro) {
  let raw = sanearNomeEditora(livro?.editora || "").replace(/^[/|\\\s—–-]+/, "").trim();
  if (raw && raw.toLowerCase() !== "desconhecida") return raw.slice(0, 255);
  const doTitulo = inferirEditoraDoTitulo(livro?.titulo);
  if (doTitulo) return doTitulo.slice(0, 255);
  const doSlug = editoraDoSlugUrlWook(livro?.link);
  if (doSlug) return doSlug.slice(0, 255);
  return "Desconhecida";
}

/** Nome da editora a partir do URL /editora/slug (fallback). */
function editoraDoSlugUrlWook(url) {
  const m = String(url || "").match(/\/editora\/([^/?#]+)/i);
  if (!m || !m[1]) return "";
  let slug = m[1];
  try {
    slug = decodeURIComponent(slug);
  } catch {
    /* ignore */
  }
  if (/^\d+$/i.test(slug)) return "";
  const nome = limparTexto(slug.replace(/[-_]+/g, " "));
  if (nome.length < 3 || nome.length > 80) return "";
  return nome
    .split(/\s+/)
    .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .filter(Boolean)
    .join(" ")
    .slice(0, 255);
}

function livroAnoPermitido(livro) {
  if (!APENAS_ANOS_1_A_12) return true;
  const a = resolverAnoEscolarFinal(livro);
  return a >= 1 && a <= 12;
}

function limparTexto(valor) {
  return (valor || "").replace(/\s+/g, " ").trim();
}

/** Normaliza separadores “tipo ponto médio” da Wook para um único carácter cortável. */
function normalizarSeparadoresFicha(s) {
  return String(s || "")
    .replace(/\u00A0/g, " ")
    .replace(/[\u00B7\u2022\u2027\u2219\u22C5\u30FB‧⋅·]/g, "·");
}

/** Corta texto típico da ficha Wook (UI, stock, avaliações) que cai no campo editora. */
function cortarLixoUiEditora(s) {
  let t = normalizarSeparadoresFicha(limparTexto(String(s || "")));
  if (!t) return "";
  // Na Wook o separador costuma ser hífen antes de "ver detalhes", não só o ponto médio (·).
  t = t.replace(/\s*-\s*ver\s+detalhes\b.*/i, "").trim();
  t = t.replace(/\s+e\s+ver\s+detalhes\b.*/i, "").trim();
  t = t.replace(/\s*·\s*.*$/s, "").trim();
  t = t.replace(/\s*\|\s*.*$/s, "").trim();
  t = t.replace(/\s+i\s+\d{1,3}[.,]\d{2}\s*€.*$/i, "").trim();
  t = t.replace(/\s+\d{1,3}[.,]\d{2}\s*€.*$/i, "").trim();
  t = t.replace(/\s+\d{1,3}[.,]\d{2}\s*€\s+i\s+.*$/i, "").trim();
  t = t.replace(/\s+\d{1,2}\s*%\s*DESCONTO.*$/i, "").trim();
  t = t.replace(/\bDESCONTO\b.*$/i, "").trim();
  t = t.replace(/\bseja\s+o\s+primeiro\s+a\s+comentar\b.*$/i, "").trim();
  t = t.replace(/\bE(\s+E){2,}\b.*$/i, "").trim();
  const cortes = [
    /\s+ver\s+detalhes\b.*/i,
    /\s+detalhes\s+do\s+produto\b.*/i,
    /\s+avalia[cç][aã]o\s+dos\s+leitores\b.*/i,
    /\s+avalia[cç][oõ]es?\s+dos\s+leitores\b.*/i,
    /\s*\(?\s*\d+\s+coment[aá]rios?\s*\)?/gi,
    /\(\s*\d+\s*\)\s*/g,
    /\besgotado\b.*$/i,
    /\bn[aã]o\s+dispon[ií]vel\b.*$/i,
    /\s+e\s+e\s+e\s+e\s+e\s+/gi,
  ];
  for (let pass = 0; pass < 4; pass++) {
    for (const rx of cortes) {
      t = t.replace(rx, " ").trim();
    }
  }
  t = t.replace(
    /\s*,\s*(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}.*$/i,
    "",
  ).trim();
  t = t.replace(/\s{2,}/g, " ").trim();
  t = t.replace(/^[/|\\\s—–-]+/, "").trim();
  return t;
}

/** Remove vírgulas iniciais e trechos que são só data ("novembro de 2009"), para não gravar lixo na editora. */
function segmentoEhSohMetadado(seg) {
  const t = cortarLixoUiEditora(String(seg || ""));
  if (t.length < 4) return true;
  return /^(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}$/i.test(t);
}

const MESES_PT = "janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro";

function sanearNomeEditora(texto) {
  let s = cortarLixoUiEditora(String(texto || ""))
    .replace(/^[,;\s]+/, "")
    .replace(/\s{2,}/g, " ");
  if (!s || s.toLowerCase() === "desconhecida") return "";
  if (segmentoEhSohMetadado(s)) return "";
  const rxDataAposVirgula = new RegExp(`\\s*,\\s*(${MESES_PT})\\s+de\\s+\\d{4}.*$`, "i");
  const partes = s
    .split(",")
    .map((p) => cortarLixoUiEditora(p.trim()).replace(rxDataAposVirgula, "").trim())
    .filter(Boolean);
  for (const p of partes) {
    if (segmentoEhSohMetadado(p)) continue;
    let cand = limparTexto(p);
    if (cand.length < 3) continue;
    if (cand.length > 120) {
      cand = cortarLixoUiEditora(cand);
      if (cand.length > 120) cand = cand.slice(0, 120).replace(/\s+\S*$/, "").trim();
    }
    if (cand.length >= 3) return cand;
  }
  let mono = cortarLixoUiEditora(s).replace(rxDataAposVirgula, "").trim();
  mono = mono.replace(new RegExp(`^(${MESES_PT})\\s+de\\s+\\d{4}.*$`, "i"), "").trim();
  if (segmentoEhSohMetadado(mono) || mono.length < 3) return "";
  if (mono.length > 120) mono = mono.slice(0, 120).replace(/\s+\S*$/, "").trim();
  return mono.length >= 3 ? mono : "";
}

function tituloAceitavel(t) {
  const s = limparTexto(String(t || ""));
  if (s.length < 4) return false;
  if (/^\d{1,2}\s*%\s*$/i.test(s)) return false;
  if (/^\d+[.,]\d{2}\s*€\s*$/i.test(s)) return false;
  if (s.length <= 14 && /^[\d.,\s€%|]+$/i.test(s)) return false;
  if (s.length <= 10 && /\d{1,2}\s*%/.test(s) && !/\b(ano|º|volume|livro|caderno|manual|portugu|matem|hist|ingl|exame|fich|prep)\b/i.test(s)) {
    return false;
  }
  return true;
}

/** Primeira frase da meta description (fallback de título na ficha Wook). */
function primeiroTrechoMetaDescricao(texto) {
  const s = limparTexto(String(texto || ""));
  if (s.length < 12 || s.length > 500) return "";
  const trecho = limparTexto((s.split(/[.·\n]/)[0] || "").trim());
  if (trecho.length < 12 || /^[\d.,\s€%]+$/i.test(trecho)) return "";
  return trecho;
}

/** Prefere o primeiro título que não seja só desconto / ruído (ex.: "10%"). */
function escolherTituloFinal(...candidatos) {
  for (const c of candidatos) {
    const t = limparTitulo(limparTexto(c || ""));
    if (tituloAceitavel(t)) return t;
  }
  const fallback = limparTitulo(limparTexto(candidatos.find(Boolean) || ""));
  return fallback || "";
}

function limparTitulo(titulo) {
  let t = limparTexto(String(titulo || ""));
  // Só remover percentagens / promo no **fim** do título (evita apagar tudo se houver "10%" a meio)
  for (let i = 0; i < 4; i++) {
    const antes = t;
    t = t.replace(/\s*[-–—]\s*\d{1,2}\s*%\s*(DE\s+DESC\w*)?\s*$/i, "").trim();
    t = t.replace(/\s+\d{1,2}\s*%\s*(DE\s+DESC\w*)?\s*$/i, "").trim();
    t = t.replace(/\s*\(\s*\d{1,2}\s*%\s*\)\s*$/i, "").trim();
    if (t === antes) break;
  }
  t = t.replace(/\s*\|\s*\d+[.,]\d{2}\s*€.*$/i, "").trim();
  t = t.replace(/\s{2,}/g, " ").trim();
  if (/^\d{1,2}\s*%$/i.test(t)) return "";
  return t;
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
  if (
    texto.includes("caderno") ||
    texto.includes("atividades") ||
    texto.includes("ficha") ||
    /exerc[ií]cio/.test(texto) ||
    texto.includes("testes e exame") ||
    texto.includes("preparar os testes") ||
    texto.includes("guia de estudo") ||
    texto.includes("caderno de apoio")
  ) {
    return "CADERNO_ATIVIDADES";
  }
  if (texto.includes("manual")) return "MANUAL";
  if (texto.includes("infantil")) return "INFANTIL";
  if (texto.includes("python") || texto.includes("sql") || texto.includes("tecnico") || texto.includes("técnico")) {
    return "TECNICO";
  }
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
  const patterns = [
    /\b(\d{1,2})\s*[.º°]{1,2}\s*ano\b/i,
    /\b(\d{1,2})\s*\.\s*º\s*ano\b/i,
    /(?:^|[^\d])(1[0-2]|[1-9])(?:\s*[\.\-º°o]\s*|\s*)ano\b/i,
    /\b(1[0-2]|[1-9])-(?:ano)\b/i,
    /\bano\b\s*(1[0-2]|[1-9])/i,
  ];
  for (const re of patterns) {
    const m = texto.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 12) return n;
    }
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

/** Scroll para carregar listagens com lazy-load. */
async function scrollPagina(page) {
  try {
    await page.evaluate(async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const max = Math.min(document.scrollingElement?.scrollHeight || 8000, 20000);
      for (let y = 0; y < max; y += 700) {
        window.scrollTo(0, y);
        await sleep(120);
      }
      window.scrollTo(0, 0);
    });
  } catch (_e) {
    /* ignora */
  }
}

async function extrairLivrosDaPagina(page, urlListagem = "") {
  const dados = await page.evaluate(() => {
    const limpar = (v) => (v || "").replace(/\s+/g, " ").trim();
    const resultados = [];
    const vistos = new Set();
    const paraArray = (v) => (Array.isArray(v) ? v : [v]);

    const textoOrganizacao = (x) => {
      if (!x) return "";
      if (typeof x === "string") return x.trim();
      if (typeof x === "object") {
        if (x.name) return String(x.name).trim();
        if (x.legalName) return String(x.legalName).trim();
        if (Array.isArray(x)) return x.map(textoOrganizacao).filter(Boolean).join(" | ");
      }
      return "";
    };

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
          const ed =
            textoOrganizacao(item.brand) ||
            textoOrganizacao(item.publisher) ||
            textoOrganizacao(item.manufacturer) ||
            textoOrganizacao(item.producer);
          guardar({
            titulo: item.name || "",
            preco: offer?.price || offer?.lowPrice || "",
            moeda: offer?.priceCurrency || "EUR",
            link: item.url || offer?.url || "",
            editora: ed,
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
        const wrap = link.closest("article, li, div");
        const heading = wrap?.querySelector("h2, h3, [class*='product-title'], [class*='titulo']");
        const titulo = limpar(
          link.getAttribute("title") ||
            heading?.textContent ||
            link.getAttribute("aria-label") ||
            link.textContent ||
            "",
        );
        if (titulo.length < 2) continue;
        const texto = wrap?.innerText || "";
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
    titulo: (() => {
      const t = limparTitulo(item.titulo);
      return t || tituloDeSlugUrlWook(normalizarUrl(item.link)) || "";
    })(),
    preco: parsePreco(item.preco),
    link: normalizarUrl(item.link),
    editora:
      sanearNomeEditora(limparTexto(item.editora)) ||
      inferirEditoraDoTitulo(limparTitulo(item.titulo)) ||
      "Desconhecida",
    isbn: limparTexto(item.isbn),
    urlListagem,
  }));
}

async function extrairDetalhesLivro(page, urlLivro) {
  await page.goto(urlLivro, { waitUntil: "domcontentloaded", timeout: 60000 });
  await esperar(1200);
  await scrollPagina(page);
  await esperar(400);

  const detalhe = await page.evaluate(() => {
    const limpar = (v) => (v || "").replace(/\s+/g, " ").trim();
    const normalizarSep = (s) =>
      String(s || "")
        .replace(/\u00A0/g, " ")
        .replace(/[\u00B7\u2022\u2027\u2219\u22C5\u30FB‧⋅·]/g, "·");
    const limparBlocoEditoraWook = (raw) => {
      let v = limpar(normalizarSep(raw));
      if (!v) return "";
      const cutDashVer = v.search(/\s*-\s*ver\s+detalhes\b/i);
      if (cutDashVer > 0) v = limpar(v.slice(0, cutDashVer));
      const dot = v.search(/\s*·\s*/);
      if (dot > 0) v = limpar(v.slice(0, dot));
      v = v.replace(/\s+i\s+\d{1,3}[.,]\d{2}\s*€.*$/i, "").trim();
      v = v.replace(/\s+\d{1,3}[.,]\d{2}\s*€.*$/i, "").trim();
      v = v.replace(/\s+\d{1,2}\s*%\s*DESCONTO.*$/i, "").trim();
      v = v.replace(/\bDESCONTO\b.*$/i, "").trim();
      v = v.replace(/\bseja\s+o\s+primeiro\s+a\s+comentar\b.*$/i, "").trim();
      v = v.replace(/\bE(\s+E){2,}\b.*$/i, "").trim();
      v = v
        .replace(/\s+ver\s+detalhes\b.*/i, "")
        .replace(/\s+detalhes\s+do\s+produto\b.*/i, "")
        .replace(/\s+avalia[cç][aã]o\s+dos\s+leitores\b.*/i, "")
        .replace(/\s*\(?\s*\d+\s+coment[aá]rios?\s*\)?/gi, "")
        .replace(/\(\s*\d+\s*\)\s*/g, "")
        .replace(/\besgotado\b.*$/i, "")
        .replace(/\bn[aã]o\s+dispon[ií]vel\b.*$/i, "")
        .trim();
      v = v
        .replace(
          /\s*,\s*(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}\s*$/i,
          "",
        )
        .trim();
      return limpar(String(v).replace(/^[/|\\\s—–-]+/, "").trim());
    };
    const nomeDeSlugEditora = (href) => {
      const m = String(href || "").match(/\/editora\/([^/?#]+)/i);
      if (!m || !m[1]) return "";
      let slug = m[1];
      try {
        slug = decodeURIComponent(slug);
      } catch (_e) {
        /* ignore */
      }
      if (/^\d+$/i.test(slug)) return "";
      const nome = limpar(slug.replace(/[-_]+/g, " "));
      if (nome.length < 3 || nome.length > 80) return "";
      return nome
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    };
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

    const textoOrganizacao = (x) => {
      if (!x) return "";
      if (typeof x === "string") return x.trim();
      if (typeof x === "object") {
        if (x.name) return String(x.name).trim();
        if (x.legalName) return String(x.legalName).trim();
        if (Array.isArray(x)) return x.map(textoOrganizacao).filter(Boolean).join(" | ");
      }
      return "";
    };

    const scripts = Array.from(document.querySelectorAll("script[type='application/ld+json']"));
    let tituloJsonLd = "";
    let editora = "";
    let isbn = "";
    let preco = "";
    let precoTexto = "";
    const orgNames = [];
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
          if (item["@graph"]) {
            const g = item["@graph"];
            stack.push(...(Array.isArray(g) ? g : [g]));
            continue;
          }
          const types = item["@type"];
          const typArr = Array.isArray(types) ? types : types ? [types] : [];
          if (typArr.some((x) => x === "Organization" || x === "Brand" || x === "Corporation")) {
            const on = textoOrganizacao(item);
            const onL = limparBlocoEditoraWook(on);
            if (onL && onL.length > 2 && onL.length < 120) orgNames.push(onL);
            else if (on && on.length > 2 && on.length < 120) orgNames.push(limpar(on));
          }
          if (item["@type"] === "Product" || (Array.isArray(item["@type"]) && item["@type"].includes("Product"))) {
            tituloJsonLd = tituloJsonLd || limpar(item.name || "");
            const ed =
              textoOrganizacao(item.brand) ||
              textoOrganizacao(item.publisher) ||
              textoOrganizacao(item.manufacturer) ||
              textoOrganizacao(item.producer);
            editora = editora || limparBlocoEditoraWook(limpar(ed));
            isbn = isbn || limpar(item.isbn || "");
            const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
            preco = preco || limpar(String(offer?.price || offer?.lowPrice || ""));
          }
        }
      } catch (_e) {
        // ignora json inválido
      }
    }

    const descricaoCurta = Array.from(document.querySelectorAll("meta[name='description']"))
      .map((m) => limpar(m.getAttribute("content") || ""))
      .filter(Boolean)
      .join(" ");

    const tituloRUidoso = (s) => {
      const x = limpar(s);
      if (!x || x.length < 4) return true;
      if (/^\d{1,2}\s*%\s*$/i.test(x)) return true;
      if (/^[\d.,\s€%|]+$/i.test(x) && x.length <= 14) return true;
      if (x.length <= 10 && /\d{1,2}\s*%/.test(x) && !/\b(ano|º|volume|livro|caderno|manual|portugu|matem|hist|ingl|exame|fich|prep)\b/i.test(x)) {
        return true;
      }
      return false;
    };
    const stripMarcaSite = (s) =>
      limpar(String(s || "").replace(/\s*[\-|–]\s*Wook.*$/i, "").replace(/\s*\|\s*Wook.*$/i, ""));

    const candidatosTitulo = [];
    const pushTit = (raw) => {
      const x = stripMarcaSite(raw || "");
      if (!tituloRUidoso(x) && x.length >= 4) candidatosTitulo.push(x);
    };
    for (const m of [
      document.querySelector('meta[property="og:title"]')?.getAttribute("content"),
      document.querySelector('meta[name="twitter:title"]')?.getAttribute("content"),
    ]) {
      pushTit(m || "");
    }
    const itempropName = document.querySelector('[itemprop="name"]');
    if (itempropName) {
      pushTit(itempropName.getAttribute("content"));
      pushTit(itempropName.textContent);
    }
    document.querySelectorAll("h1").forEach((h) => pushTit(h.textContent));
    const docTitle = stripMarcaSite(document.querySelector("title")?.textContent || "");
    pushTit(docTitle);
    if (!tituloRUidoso(tituloJsonLd) && tituloJsonLd.length >= 4) candidatosTitulo.push(tituloJsonLd);
    const validos = candidatosTitulo.filter((x) => !tituloRUidoso(x) && x.length >= 6);
    let titulo =
      (validos.length ? validos.sort((a, b) => b.length - a.length)[0] : null) ||
      candidatosTitulo.find((x) => !tituloRUidoso(x)) ||
      tituloJsonLd ||
      docTitle ||
      "";
    if ((!titulo || tituloRUidoso(titulo)) && descricaoCurta) {
      const snip = limpar((descricaoCurta || "").split(/[.·\n]/)[0] || "");
      if (snip.length >= 12 && snip.length < 280 && !/^[\d.,\s€%]+$/i.test(snip)) titulo = snip;
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

    let editoraDom = "";
    const metaBrand = document.querySelector('meta[property="product:brand"], meta[name="product:brand"]');
    if (metaBrand) editoraDom = limparBlocoEditoraWook(metaBrand.getAttribute("content") || "");

    const dts = Array.from(document.querySelectorAll("dt"));
    for (const dt of dts) {
      const t = limpar(dt.textContent || "");
      if (/editora|editor\b|marca|publisher/i.test(t)) {
        const dd = dt.nextElementSibling;
        if (dd && String(dd.tagName || "").toUpperCase() === "DD") {
          const v = limparBlocoEditoraWook(dd.textContent || "");
          if (v.length >= 2 && v.length < 200) {
            editoraDom = editoraDom || v;
            break;
          }
        }
      }
    }

    if (!editoraDom) {
      const anchors = Array.from(document.querySelectorAll('a[href*="/editora/"]'));
      for (const a of anchors) {
        const txt = limparBlocoEditoraWook(a.textContent || "");
        if (
          txt.length >= 3 &&
          txt.length < 100 &&
          !/^ver\s+/i.test(txt) &&
          !/^wook$/i.test(txt) &&
          !/detalhes|avalia[cç]/i.test(txt)
        ) {
          editoraDom = txt;
          break;
        }
      }
      if (!editoraDom) {
        for (const a of anchors) {
          const slugNome = nomeDeSlugEditora(a.getAttribute("href") || "");
          if (slugNome) {
            editoraDom = slugNome;
            break;
          }
        }
      }
    }

    const itempropBrand = document.querySelector('[itemprop="brand"]');
    if (itempropBrand) {
      const v = limparBlocoEditoraWook(itempropBrand.textContent || itempropBrand.getAttribute("content") || "");
      if (v.length >= 2) editoraDom = editoraDom || v;
    }

    if (!editoraDom) {
      const cand = document.querySelector(
        "[data-publisher], [data-brand], [data-editor], .publisher, .book-publisher, .product-brand, .editora-livro, .editora",
      );
      if (cand) {
        const v = limparBlocoEditoraWook(
          cand.textContent || cand.getAttribute("data-publisher") || cand.getAttribute("data-brand") || "",
        );
        if (v.length >= 2 && v.length < 150) editoraDom = editoraDom || v;
      }
    }

    if (!editoraDom) {
      const rxs = [
        /Editora\s*[:\-]?\s*([^\n|·]{3,120})/i,
        /\bEditor\s*[:\-]?\s*([^\n|·]{3,120})/i,
        /Publicad[oa]\s+por\s*[:\-]?\s*([^\n|·]{3,120})/i,
        /Marca\s*[:\-]?\s*([^\n|·]{3,120})/i,
      ];
      for (const rx of rxs) {
        const m = textoPagina.match(rx);
        if (m && m[1]) {
          editoraDom = limparBlocoEditoraWook(limpar(m[1].split(/\s{2,}/)[0]));
          if (editoraDom.length >= 2) break;
        }
      }
    }

    const orgFallback = orgNames.find((n) => !/wook|fnac|iberlibro/i.test(n)) || orgNames[0] || "";
    let editoraFinal = limparBlocoEditoraWook(limpar(editoraDom || orgFallback || editora));
    const lixoEd = /ver\s+detalhes|€|\bDESCONTO\b|avalia[cç]|coment[aá]rio/i;
    if (!editoraFinal || editoraFinal.replace(/^[,.\s]+/, "").length < 2 || lixoEd.test(editoraFinal)) {
      for (const a of document.querySelectorAll('a[href*="/editora/"]')) {
        const slugNome = nomeDeSlugEditora(a.getAttribute("href") || "");
        if (slugNome) {
          editoraFinal = slugNome;
          break;
        }
      }
    }

    return {
      titulo,
      editora: editoraFinal,
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

  const tituloFinal = limparTitulo(limparTexto(detalhe.titulo));
  const edSan = sanearNomeEditora(detalhe.editora);
  const editoraBruta = edSan || inferirEditoraDoTitulo(tituloFinal) || "Desconhecida";

  return {
    titulo: tituloFinal,
    editora: editoraBruta,
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
        const titleAttr = (a.getAttribute("title") || "").trim();
        const aria = (a.getAttribute("aria-label") || "").trim();
        candidatos.push({ href, label: texto || titleAttr || aria });
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
    .filter((item) => !/pre-escolar|pré-escolar/i.test(item.url))
    .filter((item) =>
      /\b([1-9]|1[0-2])\s*[.º°o]?\s*ano\b|apoio escolar|livros escolares|ensino basico|ensino básico|secundário|secundario/i.test(
        `${item.label} ${item.url}`,
      ),
    )
    .slice(0, 48);
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
        (() => {
          const t =
            (livro.tipo && String(livro.tipo).trim()) ||
            mapearTipo(`${livro.titulo || ""} ${livro.disciplina || ""} ${livro.contextoSecao || ""}`) ||
            tipoPadrao;
          return String(t).toUpperCase().trim();
        })(),
        livro.titulo.slice(0, 255),
        isbnFinal.slice(0, 20),
        codigoInterno,
        livro.preco,
      ]);
      inseridos += 1;
    }

    await connection.execute(
      `
      UPDATE livros SET
        tipo = CASE
          WHEN (
            LOWER(titulo) LIKE '%caderno%' OR LOWER(titulo) LIKE '%atividades%' OR LOWER(titulo) LIKE '%fichas%'
            OR LOWER(titulo) LIKE '%exercício%' OR LOWER(titulo) LIKE '%exercicio%' OR LOWER(titulo) LIKE '%fichas de%'
            OR LOWER(titulo) LIKE '%testes e exame%' OR LOWER(titulo) LIKE '%preparar os testes%'
            OR LOWER(titulo) LIKE '%guia de estudo%' OR LOWER(titulo) LIKE '%caderno de apoio%'
          ) THEN 'CADERNO_ATIVIDADES'
          WHEN LOWER(titulo) LIKE '%infantil%' OR LOWER(titulo) LIKE '%pré-escolar%' OR LOWER(titulo) LIKE '%pre-escolar%' THEN 'INFANTIL'
          WHEN LOWER(titulo) LIKE '%python%' OR LOWER(titulo) LIKE '%sql%' OR LOWER(titulo) LIKE '%técnico%' OR LOWER(titulo) LIKE '%tecnico%' THEN 'TECNICO'
          ELSE 'MANUAL'
        END,
        updated_at = NOW()
      WHERE deleted_at IS NULL
        AND (
          tipo IS NULL OR TRIM(COALESCE(tipo, '')) = ''
          OR UPPER(TRIM(tipo)) NOT IN ('MANUAL','CADERNO_ATIVIDADES','TECNICO','INFANTIL')
        )
      `,
    );

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
      for (let pag = 1; pag <= MAX_PAGINAS_POR_LISTAGEM; pag += 1) {
        const pageUrl = urlComPagina(url, pag);
        console.log(`A ler: ${pageUrl}`);
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
        if (pag === 1) await aceitarCookies(page);
        await scrollPagina(page);
        await esperar(pag === 1 ? ESPERA_ENTRE_PAGINAS_MS : 1400);

        const livrosPagina = await extrairLivrosDaPagina(page, pageUrl);
        let novosNesta = 0;
        for (const livro of livrosPagina) {
          const chave = `${livro.titulo}|${livro.link}`;
          if (chaves.has(chave)) continue;
          chaves.add(chave);
          novosNesta += 1;
          livrosColetados.push(livro);
        }

        if (pag === 1) {
          const linksEscolares = await extrairLinksEscolaresDaPagina(page);
          for (const linkEscolar of linksEscolares) {
            if (secoesVisitadas.has(linkEscolar.url)) continue;
            secoesVisitadas.add(linkEscolar.url);
            console.log(`A ler secao escolar: ${linkEscolar.url}`);
            await page.goto(linkEscolar.url, { waitUntil: "domcontentloaded", timeout: 60000 });
            await scrollPagina(page);
            await esperar(1800);
            const contextoSecao = await extrairContextoSecao(page);
            const livrosEscolaresPagina = await extrairLivrosDaPagina(page, linkEscolar.url);
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

        if (pag > 1 && novosNesta === 0) break;
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
          titulo: (() => {
            const t = escolherTituloFinal(
              detalhe.titulo,
              livro.titulo,
              primeiroTrechoMetaDescricao(detalhe.descricaoCurta),
            );
            return t || tituloDeSlugUrlWook(livro.link) || "";
          })(),
          isbn: detalhe.isbn || livro.isbn,
          preco: detalhe.preco || livro.preco,
          disciplina: detalhe.disciplina === "Educacao" ? disciplinaTitulo : detalhe.disciplina,
          anoEscolar: detalhe.anoEscolar || anoSecao,
        });
      } catch (erroDetalhe) {
        livrosEnriquecidos.push({
          ...livro,
          titulo: escolherTituloFinal(livro.titulo) || tituloDeSlugUrlWook(livro.link) || "",
          tipo: mapearTipo(`${livro.titulo} ${livro.contextoSecao || ""}`),
          disciplina: mapearDisciplina(`${livro.titulo} ${livro.contextoSecao || ""}`),
          anoEscolar: mapearAnoEscolar(`${livro.titulo} ${livro.contextoSecao || ""}`),
          editora:
            sanearNomeEditora(livro.editora) || inferirEditoraDoTitulo(limparTitulo(livro.titulo)) || "Desconhecida",
        });
      }
    }

    await paginaDetalhe.close();
    for (const l of livrosEnriquecidos) {
      l.anoEscolar = resolverAnoEscolarFinal(l);
      l.editora = resolverEditoraFinal(l);
    }
    const livrosFinais = livrosEnriquecidos.filter(ehLivroEscolarEstrito).filter(livroAnoPermitido);
    console.log(
      `Livros apos filtro estrito e ano 1-12 (${APENAS_ANOS_1_A_12 ? "ativo" : "desativado"}): ${livrosFinais.length}`,
    );
    const totalInseridos = await guardarNoMySql(livrosFinais);
    console.log(`Registos inseridos/atualizados na BD: ${totalInseridos}`);
    console.log(
      "Nota: 'Livros escolares filtrados' = desta corrida antes de gravar. O site mostra o total de linhas na tabela livros (inclui corridas anteriores e livros que ja la estavam).",
    );
  } finally {
    await browser.close();
  }
}

main().catch((erro) => {
  console.error("Erro no scraper:", erro.message);
  process.exit(1);
});