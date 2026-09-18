# smartqonsumer-poc-qr-scan-checker

POC : scan de QR Code produit avec suivi anonyme (token en `localStorage`) et verrouillage
d'une seule validation métier par `(anon_token, product_id)`, garanti par une contrainte
UNIQUE en base — pas seulement par le frontend.

## Stack

Node.js 22 (ESM) · Express · SQLite (`better-sqlite3`) · HTML/CSS/JS vanilla (pas de framework).

## Lancer le POC

```bash
npm install
npm start          # http://localhost:4100
```

Produits de démo pré-créés : `PRODUCT_A`, `PRODUCT_B`, `GTIN123456`.

Ouvrir : `http://localhost:4100/p/PRODUCT_A`

- 1er accès → un `anon_token` (UUID) est généré et stocké dans `localStorage` → "Produit
  enregistré avec succès."
- Rechargement / nouvel onglet → même token → "Vous avez déjà scanné ce produit."
- `http://localhost:4100/p/PRODUCT_B` avec le même token → accepté (nouveau produit).

Page de debug (dev uniquement, désactivée si `NODE_ENV=production`) :
`http://localhost:4100/debug.html`

## Tests

```bash
npm test
```

Couvre les cas du cahier des charges : premier scan accepté, rescan refusé, produit
différent accepté, rejeu du même token (reload/nouvel onglet), deux requêtes concurrentes
sur le même couple `(anon_token, product_id)` → une seule validation, nouveau token après
suppression du localStorage, contrainte UNIQUE en base, et `attachAnonymousHistoryToUser`.

## Modèle de données

- `anonymous_visitors(id, anon_token UNIQUE, created_at, last_seen_at, user_id NULL)`
- `products(id, public_id UNIQUE, name)`
- `product_scans(id, anon_token, product_id, first_scanned_at, last_scanned_at, scan_count,
  UNIQUE(anon_token, product_id))`
- `repeat_scan_events(id, anon_token, product_id, occurred_at)` — événement technique,
  ne compte pas comme un nouveau scan métier.

## API

`POST /api/products/{productId}/scan`

```json
{ "anon_token": "uuid" }
```

Réponse (premier scan) :

```json
{ "success": true, "first_scan": true, "scan_count": 1, "product": {...}, "first_scanned_at": "..." }
```

Réponse (déjà scanné) :

```json
{ "success": true, "first_scan": false, "scan_count": 2, "message": "Product already scanned by this anonymous visitor", ... }
```

Le verrouillage se fait via `INSERT ... ON CONFLICT (anon_token, product_id) DO NOTHING`
dans une transaction : la contrainte UNIQUE est l'autorité finale, même en cas de requêtes
simultanées.

## Rattachement futur à un compte

`server/lib/attachAnonymousHistory.js` expose `attachAnonymousHistoryToUser(anonToken,
userId)`, qui marque `anonymous_visitors.user_id`. L'historique de `product_scans` reste
joignable via `anon_token`, sans migration de données nécessaire — suffisant pour le POC.

## Limites volontaires

Contournable en supprimant le `localStorage`, changeant de navigateur/navigation privée,
ou d'appareil. Acceptable pour ce POC : l'objectif est de démontrer le mécanisme, pas
d'empêcher la fraude.
