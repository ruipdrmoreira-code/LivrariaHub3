const pesquisaEl = document.getElementById("pesquisa");
const tipoEl = document.getElementById("tipo");
const btnAtualizarEl = document.getElementById("btnAtualizar");
const contadorEl = document.getElementById("contador");
const gridEl = document.getElementById("gridLivros");
const templateEl = document.getElementById("templateLivro");

function formatarPreco(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "-";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(numero);
}

function limparGrid() {
  while (gridEl.firstChild) gridEl.removeChild(gridEl.firstChild);
}

function criarCard(livro) {
  const node = templateEl.content.cloneNode(true);
  node.querySelector(".titulo").textContent = livro.titulo || "Sem titulo";
  node.querySelector(".editora").textContent = `Editora: ${livro.editora || "-"}`;
  node.querySelector(".tipo").textContent = `Tipo: ${livro.tipo || "-"}`;
  node.querySelector(".isbn").textContent = `ISBN: ${livro.isbn || "-"}`;
  node.querySelector(".preco").textContent = formatarPreco(livro.preco);
  return node;
}

async function carregarLivros() {
  const q = pesquisaEl.value.trim();
  const tipo = tipoEl.value;
  const params = new URLSearchParams({ limit: "120" });
  if (q) params.set("q", q);
  if (tipo) params.set("tipo", tipo);

  contadorEl.textContent = "A carregar livros...";

  try {
    const response = await fetch(`/api/livros?${params.toString()}`);
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.detalhe || "Erro ao obter dados");
    }

    const tipoAtual = tipoEl.value;
    tipoEl.innerHTML = `<option value="">Todos os tipos</option>`;
    for (const item of data.tipos) {
      const opt = document.createElement("option");
      opt.value = item;
      opt.textContent = item;
      tipoEl.appendChild(opt);
    }
    tipoEl.value = tipoAtual;

    limparGrid();
    for (const livro of data.livros) {
      gridEl.appendChild(criarCard(livro));
    }

    contadorEl.textContent = `${data.total} livro(s) encontrados`;
  } catch (error) {
    limparGrid();
    contadorEl.textContent = `Erro: ${error.message}`;
  }
}

btnAtualizarEl.addEventListener("click", carregarLivros);
tipoEl.addEventListener("change", carregarLivros);
pesquisaEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") carregarLivros();
});

carregarLivros();
