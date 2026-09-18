import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DB_PATH = path.join(__dirname, "test.sqlite");

// db.js lit DB_PATH au moment de l'import : on le fixe avant tout import de l'app.
fs.rmSync(TEST_DB_PATH, { force: true });
fs.rmSync(`${TEST_DB_PATH}-wal`, { force: true });
fs.rmSync(`${TEST_DB_PATH}-shm`, { force: true });
process.env.DB_PATH = TEST_DB_PATH;

const { createApp } = await import("../server/app.js");
const { attachAnonymousHistoryToUser } = await import("../server/lib/attachAnonymousHistory.js");
const { db } = await import("../server/db.js");

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
  fs.rmSync(TEST_DB_PATH, { force: true });
  fs.rmSync(`${TEST_DB_PATH}-wal`, { force: true });
  fs.rmSync(`${TEST_DB_PATH}-shm`, { force: true });
});

function scan(productId, anonToken) {
  return fetch(`${baseUrl}/api/products/${productId}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ anon_token: anonToken }),
  }).then((res) => res.json());
}

// 1. Aucun token -> scan PRODUCT_A -> accepté
test("first scan of a product with a fresh token is accepted", async () => {
  const token = randomUUID();
  const data = await scan("PRODUCT_A", token);

  assert.equal(data.success, true);
  assert.equal(data.first_scan, true);
  assert.equal(data.scan_count, 1);
  assert.equal(data.product.public_id, "PRODUCT_A");
});

// 2. Même navigateur -> rescan PRODUCT_A -> refus métier / déjà scanné
test("rescanning the same product with the same token is rejected as business duplicate", async () => {
  const token = randomUUID();
  await scan("PRODUCT_A", token);
  const second = await scan("PRODUCT_A", token);

  assert.equal(second.success, true);
  assert.equal(second.first_scan, false);
  assert.equal(second.scan_count, 2);
  assert.match(second.message, /already scanned/i);
});

// 3. Même navigateur -> scan PRODUCT_B -> accepté
test("same token can validate a different product", async () => {
  const token = randomUUID();
  await scan("PRODUCT_A", token);
  const other = await scan("PRODUCT_B", token);

  assert.equal(other.first_scan, true);
  assert.equal(other.product.public_id, "PRODUCT_B");
});

// 4 & 5. Rechargement / nouvel onglet -> le token est piloté côté client (localStorage),
// ce que ce test d'API ne couvre pas directement ; on vérifie ici que rejouer le même
// anon_token (ce que fait le frontend au reload) redonne bien first_scan: false.
test("replaying the same token (reload / new tab) keeps returning first_scan: false", async () => {
  const token = randomUUID();
  await scan("PRODUCT_A", token);
  const reload1 = await scan("PRODUCT_A", token);
  const reload2 = await scan("PRODUCT_A", token);

  assert.equal(reload1.first_scan, false);
  assert.equal(reload2.first_scan, false);
  assert.equal(reload2.scan_count, 3);
});

// 6. Deux requêtes simultanées sur PRODUCT_A -> une seule validation métier
test("concurrent requests for the same token+product only validate once", async () => {
  const token = randomUUID();

  const [a, b] = await Promise.all([scan("PRODUCT_A", token), scan("PRODUCT_A", token)]);

  const firstScanCount = [a, b].filter((r) => r.first_scan === true).length;
  assert.equal(firstScanCount, 1);

  const row = db
    .prepare(
      `SELECT scan_count FROM product_scans s JOIN products p ON p.id = s.product_id
       WHERE s.anon_token = ? AND p.public_id = 'PRODUCT_A'`
    )
    .get(token);
  assert.equal(row.scan_count, 2);
});

// 7. Suppression du localStorage -> nouveau token -> traité comme nouveau visiteur
test("a fresh token (simulating cleared localStorage) is treated as a new visitor", async () => {
  const tokenA = randomUUID();
  const tokenB = randomUUID();

  await scan("PRODUCT_A", tokenA);
  const withNewToken = await scan("PRODUCT_A", tokenB);

  assert.equal(withNewToken.first_scan, true);
});

test("unknown product returns 404", async () => {
  const res = await fetch(`${baseUrl}/api/products/DOES_NOT_EXIST/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ anon_token: randomUUID() }),
  });
  assert.equal(res.status, 404);
});

test("missing or malformed anon_token is rejected", async () => {
  const res = await fetch(`${baseUrl}/api/products/PRODUCT_A/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ anon_token: "not-a-uuid" }),
  });
  assert.equal(res.status, 400);
});

test("the unique constraint on (anon_token, product_id) is enforced at the DB level", () => {
  const token = randomUUID();
  const product = db.prepare(`SELECT id FROM products WHERE public_id = 'PRODUCT_A'`).get();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO product_scans (anon_token, product_id, first_scanned_at, last_scanned_at, scan_count)
     VALUES (?, ?, ?, ?, 1)`
  ).run(token, product.id, now, now);

  assert.throws(() => {
    db.prepare(
      `INSERT INTO product_scans (anon_token, product_id, first_scanned_at, last_scanned_at, scan_count)
       VALUES (?, ?, ?, ?, 1)`
    ).run(token, product.id, now, now);
  }, /UNIQUE constraint failed/);
});

test("attachAnonymousHistoryToUser links a visitor's anon_token to a user_id", async () => {
  const token = randomUUID();
  await scan("PRODUCT_A", token);

  const result = attachAnonymousHistoryToUser(token, 42);
  assert.equal(result.attached, true);

  const visitor = db.prepare(`SELECT user_id FROM anonymous_visitors WHERE anon_token = ?`).get(token);
  assert.equal(visitor.user_id, 42);
});
