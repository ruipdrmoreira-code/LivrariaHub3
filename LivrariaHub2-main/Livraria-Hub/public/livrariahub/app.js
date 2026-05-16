const pesquisaEl = document.getElementById("pesquisa");
const tipoEl = document.getElementById("tipo");
const filtroEditoraEl = document.getElementById("filtroEditora");
const filtroDisciplinaEl = document.getElementById("filtroDisciplina");
const filtroAnoEl = document.getElementById("filtroAno");
const btnAtualizarEl = document.getElementById("btnAtualizar");
const btnLimparEl = document.getElementById("btnLimparFiltros");
const contadorEl = document.getElementById("contador");
const gridEl = document.getElementById("gridLivros");
const templateEl = document.getElementById("templateLivro");

function formatarPreco(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "—";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(numero);
}

function textoEditoraResumo(raw) {
  let s = String(raw || "")
    .replace(/\u00A0/g, " ")
    .trim();
  if (!s || s === "-" || /^-+$/i.test(s)) return "Não indicada";
  const low = s.toLowerCase();
  if (low === "desconhecida" || low === "desconhecido") return "Não indicada";
  s = s.replace(/[\u00B7\u2022\u2027\u2219\u22C5\u30FB‧⋅·]/g, "·");
  const dot = s.indexOf("·");
  if (dot > 0) s = s.slice(0, dot).trim();
  s = s.replace(/\s*-\s*ver\s+detalhes\b.*/i, "").trim();
  s = s.replace(/\s+i\s+\d{1,3}[.,]\d{2}\s*€.*$/i, "").trim();
  s = s.replace(/\s+\d{1,3}[.,]\d{2}\s*€.*$/i, "").trim();
  s = s.replace(/\s+\d{1,2}\s*%\s*DESCONTO.*$/i, "").trim();
  s = s.replace(/\bDESCONTO\b.*$/i, "").trim();
  s = s.replace(
    /\s*,\s*(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}.*$/i,
    "",
  ).trim();
  s = s.replace(/^[/|\\\s—–-]+/, "").trim();
  return s || "Não indicada";
}

function textoTituloLimpo(raw) {
  const orig = String(raw || "").trim();
  if (!orig) return "";
  if (/^\d{1,2}\s*%$/i.test(orig)) return "";
  let s = orig;
  for (let i = 0; i < 4; i++) {
    const antes = s;
    s = s.replace(/\s*[-–—]\s*\d{1,2}\s*%\s*(DE\s+DESC\w*)?\s*$/i, "").trim();
    s = s.replace(/\s+\d{1,2}\s*%\s*(DE\s+DESC\w*)?\s*$/i, "").trim();
    if (s === antes) break;
  }
  return s || orig;
}

function tituloDeSlugCodigo(codigo) {
  let seg = String(codigo || "").trim();
  if (!seg || seg.length < 6 || /^\d+$/.test(seg)) return "";
  try {
    seg = decodeURIComponent(seg);
  } catch {
    /* ignore */
  }
  let t = seg.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  t = t.replace(/\s*x\s*\d+$/i, "").replace(/\s+P\d+$/i, "").trim();
  if (t.length < 6) return "";
  return t
    .split(/\s+/)
    .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .filter(Boolean)
    .join(" ");
}

function formatarDisciplinaLabel(d) {
  const s = String(d || "").replace(/_/g, " ").trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function tituloParaCard(livro) {
  let raw = String(livro.titulo || "").trim();
  if (/^livro\s*\(\s*isbn/i.test(raw)) raw = "";
  let t = textoTituloLimpo(raw || livro.titulo);
  if (!t) t = tituloDeSlugCodigo(livro.codigo_interno);
  if (!t && livro.disciplina && livro.disciplina !== "Educacao") {
    const partes = [];
    if (livro.tipo === "CADERNO_ATIVIDADES") partes.push("Caderno de atividades");
    else if (livro.tipo) partes.push(String(livro.tipo).replace(/_/g, " "));
    partes.push(formatarDisciplinaLabel(livro.disciplina));
    if (livro.ano_escolar >= 1 && livro.ano_escolar <= 12) {
      partes.push(`${livro.ano_escolar}.º ano`);
    }
    t = partes.join(" — ");
  }
  if (!t) {
    const isbn = String(livro.isbn || "").trim();
    if (isbn) return `Livro (ISBN ${isbn})`;
  }
  return t || "Sem título";
}

function iniciaisCapa(titulo) {
  const t = String(titulo || "")
    .replace(/^livro\s*\([^)]+\)\s*/i, "")
    .trim();
  const w = t.split(/\s+/).filter(Boolean);
  if (w.length >= 2) return (w[0][0] + w[1][0]).toUpperCase();
  if (w.length === 1 && w[0].length >= 2) return w[0].slice(0, 2).toUpperCase();
  return "?";
}

function limparGrid() {
  while (gridEl.firstChild) gridEl.removeChild(gridEl.firstChild);
}

function preencherSelect(selectEl, items, valorAtual, labelVazio) {
  const cur = valorAtual;
  selectEl.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = labelVazio;
  selectEl.appendChild(opt0);
  for (const item of items || []) {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    selectEl.appendChild(opt);
  }
  selectEl.value = cur && [...selectEl.options].some((o) => o.value === cur) ? cur : "";
}

/** Select com valor completo (filtro) e etiqueta curta (evita texto gigante no dropdown). */
function preencherSelectRotulos(selectEl, items, valorAtual, labelVazio) {
  const cur = valorAtual;
  selectEl.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = labelVazio;
  selectEl.appendChild(opt0);
  for (const item of items || []) {
    const valor = item && typeof item === "object" && item.valor != null ? item.valor : item;
    const etiqueta =
      item && typeof item === "object" && item.etiqueta != null ? item.etiqueta : String(valor);
    const opt = document.createElement("option");
    opt.value = valor;
    opt.textContent = etiqueta;
    opt.title = String(valor);
    selectEl.appendChild(opt);
  }
  selectEl.value = cur && [...selectEl.options].some((o) => o.value === cur) ? cur : "";
}

const TIPO_OPCOES_LABEL = {
  MANUAL: "Manual",
  CADERNO_ATIVIDADES: "Caderno de atividades",
  INFANTIL: "Infantil",
  TECNICO: "Técnico",
};

function criarCard(livro) {
  const node = templateEl.content.cloneNode(true);
  const titulo = tituloParaCard(livro);
  const cover = node.querySelector(".lib-card-cover");
  const hue = ((Number(livro.id) || 0) * 47) % 360;
  cover.style.setProperty("--cover-hue", String(hue));

  node.querySelector(".lib-cover-letters").textContent = iniciaisCapa(titulo);
  node.querySelector(".titulo").textContent = titulo;
  node.querySelector(".editora").textContent = `Editora: ${textoEditoraResumo(livro.editora)}`;
  node.querySelector(".tipo").textContent = `Tipo: ${TIPO_OPCOES_LABEL[livro.tipo] || (livro.tipo ? String(livro.tipo).replace(/_/g, " ") : "—")}`;
  node.querySelector(".isbn").textContent = `ISBN: ${livro.isbn || "—"}`;
  node.querySelector(".preco").textContent = formatarPreco(livro.preco);

  const badge = node.querySelector(".lib-badge");
  if (livro.ano_escolar >= 1 && livro.ano_escolar <= 12) {
    badge.textContent = `${livro.ano_escolar}º Ano`;
  } else {
    badge.textContent = "";
  }

  return node;
}

function estadoFiltros() {
  return {
    q: pesquisaEl.value.trim(),
    tipo: tipoEl.value,
    editora: filtroEditoraEl.value,
    disciplina: filtroDisciplinaEl.value,
    ano: filtroAnoEl.value,
  };
}

async function carregarLivros() {
  const st = estadoFiltros();
  const params = new URLSearchParams({ limit: "20000", offset: "0" });
  if (st.q) params.set("q", st.q);
  if (st.tipo) params.set("tipo", st.tipo);
  if (st.editora) params.set("editora", st.editora);
  if (st.disciplina) params.set("disciplina", st.disciplina);
  if (st.ano) params.set("ano_escolar", st.ano);

  contadorEl.textContent = "A carregar livros…";

  try {
    const response = await fetch(`/api/livros?${params.toString()}`);
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.detalhe || "Erro ao obter dados");
    }

    preencherSelectRotulos(filtroEditoraEl, data.editoras, st.editora, "Todas as editoras");
    preencherSelectRotulos(filtroDisciplinaEl, data.disciplinas, st.disciplina, "Todas as disciplinas");
    const anosOpts = (data.anos || []).map((n) => String(n));
    preencherSelect(filtroAnoEl, anosOpts, st.ano, "Todos os anos");

    const tipoAtual = st.tipo;
    tipoEl.innerHTML = `<option value="">Todos os tipos</option>`;
    for (const item of data.tipos || []) {
      const opt = document.createElement("option");
      opt.value = item;
      opt.textContent = TIPO_OPCOES_LABEL[item] || String(item).replace(/_/g, " ").toLowerCase();
      tipoEl.appendChild(opt);
    }
    tipoEl.value = tipoAtual;

    limparGrid();
    for (const livro of data.livros || []) {
      gridEl.appendChild(criarCard(livro));
    }

    const n = (data.livros || []).length;
    const t = typeof data.total === "number" ? data.total : n;
    contadorEl.textContent =
      n === t ? `${t} livro(s) encontrados` : `A mostrar ${n} de ${t} livros (usa offset na API para o resto).`;
  } catch (error) {
    limparGrid();
    contadorEl.textContent = `Erro: ${error.message}`;
  }
}

btnAtualizarEl.addEventListener("click", carregarLivros);
btnLimparEl.addEventListener("click", () => {
  pesquisaEl.value = "";
  tipoEl.value = "";
  filtroEditoraEl.value = "";
  filtroDisciplinaEl.value = "";
  filtroAnoEl.value = "";
  carregarLivros();
});
tipoEl.addEventListener("change", carregarLivros);
filtroEditoraEl.addEventListener("change", carregarLivros);
filtroDisciplinaEl.addEventListener("change", carregarLivros);
filtroAnoEl.addEventListener("change", carregarLivros);
pesquisaEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") carregarLivros();
});

carregarLivros();
