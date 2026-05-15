<!doctype html>
<html lang="pt-PT">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LivrariaHub — Catálogo escolar</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="{{ asset('livrariahub/styles.css') }}" />
  </head>
  <body>
    <header class="app-nav">
      <div class="app-nav-inner">
        <a href="{{ url('/catalogo') }}" class="brand">
          <span class="brand-icon" aria-hidden="true">📚</span>
          <span class="brand-text">LivrariaHub</span>
        </a>
        <nav class="nav-links" aria-label="Principal">
          <a href="{{ url('/') }}">Início</a>
          <a href="{{ url('/catalogo') }}" class="active">Catálogo</a>
        </nav>
        <div class="nav-search">
          <input id="pesquisa" type="search" placeholder="Procurar título, editora, ISBN…" autocomplete="off" />
          <button id="btnAtualizar" type="button" class="btn-search" aria-label="Pesquisar">🔍</button>
        </div>
        <div class="nav-user">
          <span class="user-name">{{ auth()->user()->name }}</span>
          <form method="POST" action="{{ route('logout') }}" class="logout-form">
            @csrf
            <button type="submit" class="btn-ghost">Sair</button>
          </form>
        </div>
      </div>
    </header>

    <section class="hero">
      <div class="hero-inner">
        <h1>LivrariaHub Portugal</h1>
        <p>Consulta livros escolares por disciplina, editora, ano e tipo — dados sincronizados com a tua base MySQL.</p>
      </div>
    </section>

    <div class="app-layout">
      <aside class="sidebar" aria-labelledby="filtros-titulo">
        <h2 id="filtros-titulo" class="sidebar-title">Filtros</h2>
        <label class="field-label" for="filtroEditora">Editora</label>
        <select id="filtroEditora">
          <option value="">Todas as editoras</option>
        </select>
        <label class="field-label" for="filtroAno">Ano escolar</label>
        <select id="filtroAno">
          <option value="">Todos os anos</option>
        </select>
        <label class="field-label" for="filtroDisciplina">Disciplina</label>
        <select id="filtroDisciplina">
          <option value="">Todas as disciplinas</option>
        </select>
        <label class="field-label" for="tipo">Tipo</label>
        <select id="tipo">
          <option value="">Todos os tipos</option>
        </select>
        <button type="button" id="btnLimparFiltros" class="btn-outline">Limpar filtros</button>
      </aside>

      <main class="content">
        <p id="contador" class="contador">A carregar…</p>
        <div id="gridLivros" class="lib-grid" role="list"></div>
      </main>
    </div>

    <template id="templateLivro">
      <article class="lib-card" role="listitem">
        <div class="lib-card-cover">
          <span class="lib-cover-letters" aria-hidden="true"></span>
        </div>
        <span class="lib-badge"></span>
        <div class="lib-card-body">
          <h3 class="lib-card-title titulo"></h3>
          <p class="lib-card-meta editora"></p>
          <p class="lib-card-meta tipo"></p>
          <p class="lib-card-meta isbn"></p>
          <p class="lib-card-price preco"></p>
        </div>
      </article>
    </template>

    <script src="{{ asset('livrariahub/app.js') }}"></script>
  </body>
</html>
