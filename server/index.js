import { createApp } from "./app.js";

const PORT = process.env.PORT || 4100;

createApp().listen(PORT, () => {
  console.log(`smartqonsumer-poc-qr-scan-checker listening on http://localhost:${PORT}`);
  console.log(`Try: http://localhost:${PORT}/p/PRODUCT_A`);
});
