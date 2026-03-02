const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../produtos.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  db.run(`INSERT OR IGNORE INTO config (key, value) VALUES ('pedido_counter', '0')`);

  db.run(`CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    descricao TEXT,
    valor REAL,
    link TEXT,
    imagem TEXT,
    canal_id TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

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
});

module.exports = db;
