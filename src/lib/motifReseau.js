// ============================================================
// lib/motifReseau.js — UNE CONNEXION COUPÉE SE DIT EN FRANÇAIS (18/10/2026)
//
// Capture Timo : « 📎 Le PDF n'est pas parti : Serveur injoignable : Failed
// to fetch ». « Failed to fetch » est le mot du navigateur quand la connexion
// tombe avant la réponse du serveur : de l'anglais, à l'écran, pour une
// vendeuse de Lomé. Règle du 01/10/2026 : une panne de réseau se dit en
// français, le détail part dans la console.
// Sans import (lu par src/supabaseClient.js).
// ============================================================
export const MOTIF_RESEAU = "La connexion au serveur a été coupée (réseau faible ou interrompu). Réessayez dans un instant.";

// La phrase pour l'écran ; le mot du navigateur pour la console.
export function motifReseau(e, phrase = MOTIF_RESEAU) {
  try { console.error("[réseau] serveur injoignable :", e?.message || e); } catch { /* console absente */ }
  return phrase;
}
