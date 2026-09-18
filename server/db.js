import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "poc.sqlite");

if (DB_PATH !== ":memory:") {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS anonymous_visitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anon_token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    user_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS product_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anon_token TEXT NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id),
    first_scanned_at TEXT NOT NULL,
    last_scanned_at TEXT NOT NULL,
    scan_count INTEGER NOT NULL DEFAULT 1,
    UNIQUE (anon_token, product_id)
  );

  CREATE TABLE IF NOT EXISTS repeat_scan_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anon_token TEXT NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id),
    occurred_at TEXT NOT NULL
  );
`);

const seedProduct = db.prepare(
  `INSERT OR IGNORE INTO products (public_id, name) VALUES (?, ?)`
);
const seedDemoProducts = db.transaction((rows) => {
  for (const [publicId, name] of rows) seedProduct.run(publicId, name);
});
seedDemoProducts([
  ["PRODUCT_A", "Produit A"],
  ["PRODUCT_B", "Produit B"],
  ["GTIN123456", "Produit demo GTIN123456"],
]);

export function nowIso() {
  return new Date().toISOString();
}
