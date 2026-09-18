import { Router } from "express";
import { db, nowIso } from "../db.js";

const router = Router();

const ANON_TOKEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getProduct = db.prepare(`SELECT * FROM products WHERE public_id = ?`);

const upsertVisitor = db.prepare(`
  INSERT INTO anonymous_visitors (anon_token, created_at, last_seen_at)
  VALUES (@anon_token, @now, @now)
  ON CONFLICT (anon_token) DO UPDATE SET last_seen_at = @now
`);

const insertScan = db.prepare(`
  INSERT INTO product_scans (anon_token, product_id, first_scanned_at, last_scanned_at, scan_count)
  VALUES (@anon_token, @product_id, @now, @now, 1)
  ON CONFLICT (anon_token, product_id) DO NOTHING
`);

const bumpScan = db.prepare(`
  UPDATE product_scans
  SET scan_count = scan_count + 1, last_scanned_at = @now
  WHERE anon_token = @anon_token AND product_id = @product_id
`);

const getScan = db.prepare(`
  SELECT * FROM product_scans WHERE anon_token = ? AND product_id = ?
`);

const insertRepeatEvent = db.prepare(`
  INSERT INTO repeat_scan_events (anon_token, product_id, occurred_at)
  VALUES (?, ?, ?)
`);

// La transaction est ce qui garantit le verrouillage : deux requêtes concurrentes
// sur le même (anon_token, product_id) sont sérialisées par SQLite/better-sqlite3,
// et la contrainte UNIQUE empêche de toute façon une double validation métier.
const recordScan = db.transaction((anonToken, productDbId) => {
  const now = nowIso();

  upsertVisitor.run({ anon_token: anonToken, now });

  const insertResult = insertScan.run({
    anon_token: anonToken,
    product_id: productDbId,
    now,
  });

  const firstScan = insertResult.changes === 1;

  if (firstScan) {
    return { firstScan, scanCount: 1, firstScannedAt: now };
  }

  bumpScan.run({ anon_token: anonToken, product_id: productDbId, now });
  insertRepeatEvent.run(anonToken, productDbId, now);
  const row = getScan.get(anonToken, productDbId);
  return { firstScan, scanCount: row.scan_count, firstScannedAt: row.first_scanned_at };
});

router.post("/products/:productId/scan", (req, res) => {
  const { productId } = req.params;
  const { anon_token: anonToken } = req.body || {};

  if (typeof anonToken !== "string" || !ANON_TOKEN_RE.test(anonToken)) {
    return res.status(400).json({ success: false, message: "anon_token invalide ou manquant" });
  }

  const product = getProduct.get(productId);
  if (!product) {
    return res.status(404).json({ success: false, message: "Produit inconnu" });
  }

  const { firstScan, scanCount, firstScannedAt } = recordScan(anonToken, product.id);

  res.json({
    success: true,
    first_scan: firstScan,
    scan_count: scanCount,
    first_scanned_at: firstScannedAt,
    product: { public_id: product.public_id, name: product.name },
    ...(firstScan ? {} : { message: "Product already scanned by this anonymous visitor" }),
  });
});

export default router;
