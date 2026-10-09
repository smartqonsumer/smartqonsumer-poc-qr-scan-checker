import { Router } from "express";
import QRCode from "qrcode";

const router = Router();

// Génère le QR côté serveur (image PNG) plutôt que via une lib JS chargée en CDN
// côté client : évite toute dépendance fragile à un bundle navigateur externe.
router.get("/qr/:productId", async (req, res) => {
  const { productId } = req.params;
  const url = `${req.protocol}://${req.get("host")}/p/${encodeURIComponent(productId)}`;

  try {
    const png = await QRCode.toBuffer(url, { width: 320, margin: 2 });
    res.type("png").send(png);
  } catch (err) {
    res.status(500).json({ success: false, message: "QR generation failed" });
  }
});

export default router;
