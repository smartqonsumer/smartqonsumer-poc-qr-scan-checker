import { db } from "../db.js";

/**
 * Rattache l'historique de scans anonymes d'un anon_token à un compte utilisateur.
 * Ne migre pas les lignes : on marque simplement le visiteur anonyme comme
 * appartenant à user_id, ce qui suffit pour joindre product_scans via anon_token.
 */
export function attachAnonymousHistoryToUser(anonToken, userId) {
  const result = db
    .prepare(`UPDATE anonymous_visitors SET user_id = ? WHERE anon_token = ?`)
    .run(userId, anonToken);

  return { attached: result.changes > 0 };
}
