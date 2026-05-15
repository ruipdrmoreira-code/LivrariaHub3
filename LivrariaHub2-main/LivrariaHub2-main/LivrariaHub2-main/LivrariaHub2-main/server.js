const path = require("path");
const express = require("express");
const mysql = require("mysql2/promise");

const app = express();
const PORT = Number(process.env.PORT || 3000);

const DB_CONFIG = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "livrariahub",
};

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/livros", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 60, 200);
  const q = (req.query.q || "").toString().trim();
  const tipo = (req.query.tipo || "").toString().trim();

  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);

    const where = [];
    const params = [];

    if (q) {
      where.push("(titulo LIKE ? OR editora LIKE ? OR isbn LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    if (tipo) {
      where.push("tipo = ?");
      params.push(tipo);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [livros] = await connection.execute(
      `
      SELECT id, titulo, editora, disciplina, ano_escolar, tipo, isbn, codigo_interno, preco, ativo, updated_at
      FROM livros
      ${whereSql}
      ORDER BY updated_at DESC, id DESC
      LIMIT ?
      `,
      [...params, limit],
    );

    const [tipos] = await connection.execute(
      `
      SELECT DISTINCT tipo
      FROM livros
      WHERE tipo IS NOT NULL AND tipo <> ''
      ORDER BY tipo ASC
      `,
    );

    res.json({
      ok: true,
      filtros: { q, tipo, limit },
      tipos: tipos.map((row) => row.tipo),
      total: livros.length,
      livros,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      erro: "Falha ao ler dados da base de dados.",
      detalhe: error.message,
    });
  } finally {
    if (connection) await connection.end();
  }
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Frontend LivrariaHub em http://localhost:${PORT}`);
});
