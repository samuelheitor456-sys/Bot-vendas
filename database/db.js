const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../produtos.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Configurações gerais (já existe)
  db.run(`CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  // Inserir valores padrão se não existirem
  db.run(`INSERT OR IGNORE INTO config (key, value) VALUES ('pedido_counter', '0')`);
  db.run(`INSERT OR IGNORE INTO config (key, value) VALUES ('mp_access_token', '')`); // ← NOVO

  // Produtos (já deve existir com cargo_id)
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

  // Pedidos
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

  console.log('✅ Banco de dados atualizado (config MP)');
});

module.exports = db;
