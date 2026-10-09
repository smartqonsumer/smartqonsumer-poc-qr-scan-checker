const PRODUCTS = ["PRODUCT_A", "PRODUCT_B", "GTIN123456"];

const picker = document.getElementById("picker");
const img = document.getElementById("qr-img");
const urlLabel = document.getElementById("qr-url");

function render(productId) {
  // Le QR est généré côté serveur : /api/qr/:productId encode l'URL produit
  // basée sur le host utilisé pour joindre le serveur (LAN IP depuis le mobile).
  img.src = `/api/qr/${productId}?t=${Date.now()}`;
  urlLabel.textContent = `${window.location.origin}/p/${productId}`;

  for (const btn of picker.querySelectorAll("button")) {
    btn.classList.toggle("active", btn.dataset.productId === productId);
  }
}

for (const productId of PRODUCTS) {
  const btn = document.createElement("button");
  btn.textContent = productId;
  btn.dataset.productId = productId;
  btn.addEventListener("click", () => render(productId));
  picker.appendChild(btn);
}

render(PRODUCTS[0]);
