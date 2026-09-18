import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import scanRouter from "./routes/scan.js";
import debugRouter from "./routes/debug.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(PUBLIC_DIR));

  app.use("/api", scanRouter);

  if (process.env.NODE_ENV !== "production") {
    app.use("/api/debug", debugRouter);
  }

  // Le QR code pointe vers /p/{productId} : on sert toujours la même page,
  // qui lit le productId dans l'URL côté client.
  app.get("/p/:productId", (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "product.html"));
  });

  return app;
}
