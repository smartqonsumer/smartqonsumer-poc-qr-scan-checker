import { getOrCreateAnonymousToken } from "./token.js";

const anonToken = getOrCreateAnonymousToken();
document.getElementById("token").textContent = anonToken;

const res = await fetch(`/api/debug/anon/${encodeURIComponent(anonToken)}`);

if (!res.ok) {
  document.getElementById("total").textContent =
    "Debug indisponible (production ?)";
} else {
  const data = await res.json();
  const rows = document.getElementById("rows");

  for (const scan of data.products_scanned) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${scan.name} (${scan.public_id})</td>
      <td>${new Date(scan.first_scanned_at).toLocaleString("fr-FR")}</td>
      <td>${new Date(scan.last_scanned_at).toLocaleString("fr-FR")}</td>
      <td>${scan.scan_count}</td>
    `;
    rows.appendChild(tr);
  }

  document.getElementById("total").textContent =
    `${data.products_scanned.length} produit(s) scanné(s), ${data.total_scans} scan(s) au total.`;
}
