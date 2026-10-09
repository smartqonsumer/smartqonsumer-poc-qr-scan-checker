import { getOrCreateAnonymousToken } from "./token.js";

const card = document.getElementById("card");
const techDetails = document.getElementById("tech-details");

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
    <span class="badge success">Premier scan — déverrouillé</span>
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
    <div class="status-icon">🔒</div>
    <span class="badge warn">Verrouillé — déjà comptabilisé</span>
    <h1>${data.product.name}</h1>
    <p class="message">Vous avez déjà scanné ce produit. Aucun nouveau bénéfice n'est accordé.</p>
    <div class="meta">
      <div><span>Premier scan le</span><span>${formatDate(data.first_scanned_at)}</span></div>
      <div><span>Rescans techniques</span><span>${data.scan_count - 1}</span></div>
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

function renderTechDetails({ anonToken, productId, data }) {
  techDetails.innerHTML = `
    <div><span>anon_token</span></div>
    <code style="display:block; margin:4px 0 12px; word-break:break-all;">${anonToken}</code>
    <div><span>product_id scanné</span><span><code>${productId}</code></span></div>
    <div><span>Verdict backend</span><span>${data.first_scan ? "first_scan: true" : "first_scan: false"}</span></div>
    <div><span>scan_count (technique)</span><span>${data.scan_count}</span></div>
    <p class="message" style="margin-top:12px;">
      <strong>Ce n'est pas un cookie.</strong> <code>anon_token</code> est un UUID généré par
      <code>crypto.randomUUID()</code> et stocké uniquement dans le
      <code>localStorage</code> de ce navigateur (clé <code>sq_anon_token</code>).
      Il ne contient aucune donnée personnelle, n'est jamais partagé entre navigateurs/appareils,
      et survit aux rechargements de page — mais pas à un effacement du localStorage.
    </p>
    <p class="message" style="margin-top:8px;">
      C'est ce couple <code>(anon_token, product_id)</code> que le backend vérifie contre la
      base pour décider <code>first_scan: true/false</code> — jamais une simple vérification
      côté navigateur.
    </p>
  `;
}

async function main() {
  const productId = productIdFromPath();
  const anonToken = getOrCreateAnonymousToken();

  document.getElementById("reset-token-btn").addEventListener("click", () => {
    localStorage.removeItem("sq_anon_token");
    window.location.reload();
  });

  document.getElementById("reset-all-btn").addEventListener("click", async () => {
    await fetch("/api/debug/reset", { method: "POST" });
    localStorage.removeItem("sq_anon_token");
    window.location.reload();
  });

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

    renderTechDetails({ anonToken, productId, data });
  } catch (err) {
    renderError("Impossible de contacter le serveur.");
  }
}

main();
