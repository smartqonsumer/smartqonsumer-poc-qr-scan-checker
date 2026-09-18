import { Router } from "express";
import { db } from "../db.js";

const router = Router();

const getVisitor = db.prepare(`SELECT * FROM anonymous_visitors WHERE anon_token = ?`);
const getScans = db.prepare(`
  SELECT p.public_id, p.name, s.first_scanned_at, s.last_scanned_at, s.scan_count
  FROM product_scans s
  JOIN products p ON p.id = s.product_id
  WHERE s.anon_token = ?
  ORDER BY s.first_scanned_at ASC
`);

// Accessible uniquement en dev, cf. server/app.js (monté seulement si NODE_ENV !== "production").
router.get("/anon/:anonToken", (req, res) => {
  const { anonToken } = req.params;
  const visitor = getVisitor.get(anonToken);
  const scans = getScans.all(anonToken);

  res.json({
    anon_token: anonToken,
    visitor: visitor || null,
    products_scanned: scans,
    total_scans: scans.reduce((sum, s) => sum + s.scan_count, 0),
  });
});

export default router;
