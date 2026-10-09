const startBtn = document.getElementById("start-btn");
const rescanBtn = document.getElementById("rescan-btn");
const cameraSelect = document.getElementById("camera-select");
const resultBox = document.getElementById("result");

const html5QrCode = new Html5Qrcode("reader");
let redirectTimer = null;
let handledThisSession = false; // évite les appels concurrents (le callback tire à chaque frame décodée)

function showResult(html) {
  resultBox.style.display = "block";
  resultBox.innerHTML = html;
}

// On ne redirige automatiquement que si le QR encode bien une URL produit de ce
// même serveur (/p/{productId}) : on évite de naviguer en aveugle vers un QR
// arbitraire.
function isOwnProductUrl(text) {
  try {
    const url = new URL(text);
    return url.origin === window.location.origin && /^\/p\/[^/]+$/.test(url.pathname);
  } catch {
    return false;
  }
}

async function onScanSuccess(decodedText) {
  // html5-qrcode rappelle ce callback à CHAQUE frame où le QR est encore détecté
  // (donc plusieurs fois par seconde tant que le téléphone reste face à la caméra).
  // Sans ce garde-fou, plusieurs appels concurrents à stop() se percutent, l'un
  // d'eux lève une erreur, et la suite (affichage + redirection) ne s'exécute
  // jamais — symptôme : "le scan a l'air détecté mais rien ne se passe après".
  if (handledThisSession) return;
  handledThisSession = true;

  clearTimeout(redirectTimer);

  try {
    await html5QrCode.stop();
  } catch (err) {
    console.warn("Arrêt caméra : ", err);
  }

  startBtn.style.display = "none";
  rescanBtn.style.display = "block";

  if (isOwnProductUrl(decodedText)) {
    showResult(`
      <div><span>✅ QR reconnu comme URL produit de ce POC</span></div>
      <code style="display:block; margin:6px 0;">${decodedText}</code>
      <div class="message" style="margin:8px 0 0;">
        Redirection dans 1 seconde vers la page produit — c'est là que l'anon_token
        <strong>de ce navigateur (ordinateur)</strong> sera envoyé au backend pour
        vérifier le verrou.
      </div>
      <a href="${decodedText}" class="action-btn" style="display:block; text-align:center; text-decoration:none; margin-top:12px;">
        Continuer maintenant →
      </a>
    `);
    redirectTimer = setTimeout(() => {
      window.location.href = decodedText;
    }, 1000);
  } else {
    showResult(`
      <div><span>⚠️ QR détecté mais non reconnu par ce POC</span></div>
      <code style="display:block; margin:6px 0;">${decodedText}</code>
      <div class="message">Ce n'est pas une URL /p/{productId} de ce serveur, pas de redirection automatique.</div>
    `);
  }
}

async function populateCameras() {
  const cameras = await Html5Qrcode.getCameras();

  if (cameras.length > 1) {
    cameraSelect.style.display = "block";
    cameraSelect.innerHTML = cameras
      .map((cam) => `<option value="${cam.id}">${cam.label || cam.id}</option>`)
      .join("");
  }

  return cameras;
}

async function startScanning() {
  startBtn.disabled = true;
  resultBox.style.display = "none";

  try {
    const cameras = await populateCameras();
    if (cameras.length === 0) {
      showResult(`<div class="message">Aucune caméra détectée.</div>`);
      return;
    }

    const cameraId = cameraSelect.style.display === "block" ? cameraSelect.value : cameras[0].id;

    await html5QrCode.start(
      cameraId,
      { fps: 10, qrbox: 250 },
      onScanSuccess,
      () => {} // pas de QR détecté sur cette frame : rien à faire
    );

    startBtn.style.display = "none";
  } catch (err) {
    showResult(`<div class="message">Impossible d'accéder à la caméra : ${err.message || err}</div>`);
  } finally {
    startBtn.disabled = false;
  }
}

startBtn.addEventListener("click", startScanning);
rescanBtn.addEventListener("click", () => {
  handledThisSession = false;
  rescanBtn.style.display = "none";
  startBtn.style.display = "block";
  resultBox.style.display = "none";
  startScanning();
});
