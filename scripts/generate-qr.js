import QRCode from "qrcode";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const host = process.argv[2];
const productIds = process.argv.slice(3);

if (!host || productIds.length === 0) {
  console.error("Usage: node scripts/generate-qr.js <host:port> <productId> [productId...]");
  process.exit(1);
}

const outDir = path.join(__dirname, "..", "data", "qr");

for (const productId of productIds) {
  const url = `http://${host}/p/${productId}`;
  const outFile = path.join(outDir, `${productId}.png`);
  await QRCode.toFile(outFile, url, { width: 400, margin: 2 });
  console.log(`${productId} -> ${url}\n  saved to ${outFile}`);
}
