import { getOrCreateAnonymousToken } from "./token.js";

const card = document.getElementById("card");

function productIdFromPath() {
  // /p/{productId}
  const parts = window.location.pathname.split("/").filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1]);
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR");
}

function renderFirstScan(data) {
  card.innerHTML = `
    <div class="status-icon">✅</div>
    <span class="badge success">Premier scan</span>
    <h1>Produit enregistré avec succès</h1>
    <p class="message">Votre interaction avec ce produit a bien été prise en compte.</p>
    <div class="meta">
      <div><span>Produit</span><span>${data.product.name}</span></div>
      <div><span>Identifiant</span><span><code>${data.product.public_id}</code></span></div>
    </div>
  `;
}

function renderAlreadyScanned(data) {
  card.innerHTML = `
    <div class="status-icon">ℹ️</div>
    <span class="badge warn">Déjà scanné</span>
    <h1>${data.product.name}</h1>
    <p class="message">Vous avez déjà scanné ce produit.</p>
    <div class="meta">
      <div><span>Premier scan le</span><span>${formatDate(data.first_scanned_at)}</span></div>
    </div>
  `;
}

function renderError(message) {
  card.innerHTML = `
    <div class="status-icon">⚠️</div>
    <h1>Oups</h1>
    <p class="message">${message}</p>
  `;
}

async function main() {
  const productId = productIdFromPath();
  const anonToken = getOrCreateAnonymousToken();

  try {
    const res = await fetch(`/api/products/${encodeURIComponent(productId)}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anon_token: anonToken,
        timestamp: new Date().toISOString(),
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      renderError(data.message || "Produit introuvable.");
      return;
    }

    if (data.first_scan) {
      renderFirstScan(data);
    } else {
      renderAlreadyScanned(data);
    }
  } catch (err) {
    renderError("Impossible de contacter le serveur.");
  }
}

main();
