const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../produtos.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Configurações
  db.run(`CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
  db.run(`INSERT OR IGNORE INTO config (key, value) VALUES ('pedido_counter', '0')`);
  db.run(`INSERT OR IGNORE INTO config (key, value) VALUES ('mp_access_token', '')`);

  // Produtos (com cargo_id)
  db.run(`CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    descricao TEXT,
    valor REAL,
    link TEXT,
    imagem TEXT,
    canal_id TEXT,
    cargo_id TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Pedidos - com pagamento_id como TEXT (sem ".0")
  db.run(`CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id TEXT UNIQUE,
    pedido_numero INTEGER,
    produto_id INTEGER,
    comprador_id TEXT,
    comprador_email TEXT,
    valor REAL,
    status TEXT DEFAULT 'aguardando_pagamento',
    pagamento_id TEXT,
    qr_code TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    concluido_em DATETIME
  )`);

  // Carrinhos
  db.run(`CREATE TABLE IF NOT EXISTS carrinhos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id TEXT UNIQUE,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Itens do carrinho
  db.run(`CREATE TABLE IF NOT EXISTS carrinho_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    carrinho_id INTEGER,
    produto_id INTEGER,
    quantidade INTEGER DEFAULT 1,
    FOREIGN KEY(carrinho_id) REFERENCES carrinhos(id),
    FOREIGN KEY(produto_id) REFERENCES produtos(id)
  )`);

  // Cupons
  db.run(`CREATE TABLE IF NOT EXISTS cupons (
    codigo TEXT PRIMARY KEY,
    tipo TEXT CHECK(tipo IN ('porcentagem', 'fixo')),
    valor REAL,
    usos_max INTEGER DEFAULT 1,
    usos_atual INTEGER DEFAULT 0,
    expiracao DATE,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Sorteios
  db.run(`CREATE TABLE IF NOT EXISTS sorteios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    premio TEXT,
    data_inicio DATETIME,
    data_fim DATETIME,
    ativo INTEGER DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sorteios_participantes (
    sorteio_id INTEGER,
    comprador_id TEXT,
    numero_sorte INTEGER,
    FOREIGN KEY(sorteio_id) REFERENCES sorteios(id)
  )`);

  // Afiliados
  db.run(`CREATE TABLE IF NOT EXISTS afiliados (
    usuario_id TEXT PRIMARY KEY,
    codigo TEXT UNIQUE,
    comissao_percent REAL DEFAULT 10
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS comissoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    afiliado_id TEXT,
    pedido_id TEXT,
    valor REAL,
    pago INTEGER DEFAULT 0,
    FOREIGN KEY(afiliado_id) REFERENCES afiliados(usuario_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS pedido_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id TEXT,
    produto_id INTEGER,
    quantidade INTEGER,
    valor_unitario REAL,
    FOREIGN KEY(pedido_id) REFERENCES pedidos(pedido_id)
  )`);

  console.log('✅ Banco de dados atualizado (todas as tabelas)');
});

module.exports = db;
