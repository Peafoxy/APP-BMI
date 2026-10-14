// ============ LA MESURE DE L'ÉCART AVEC L'HEURE DU SERVEUR (14/10/2026) ============
// La règle vit dans lib/horloge.js ; ce fichier est le SEUL à aller la
// mesurer sur le réseau (comme src/push.js pour les notifications).
//
// Comment : on demande au serveur un tout petit fichier (version.json, jamais
// gardé par le téléphone), et on lit la DATE qu'il pose sur sa réponse. Le
// serveur a répondu au milieu de l'aller-retour : l'écart, c'est la différence
// entre sa date et l'horloge de l'appareil à ce moment-là.
//
// ⚠ Hors connexion, le DERNIER écart mesuré (gardé sur l'appareil) reste
// appliqué : une horloge fausse ne redevient pas juste quand le réseau tombe.
// Un appareil jamais mesuré écrit avec sa propre horloge — c'est le seul cas.

import { poserEcartHorloge, ecartDepuisReponse, ecartHorloge } from "./lib/horloge";

export const CLE_ECART_HORLOGE = "bmi_ecart_horloge";
const INTERVALLE_MS = 10 * 60 * 1000;

// Le dernier écart connu sur cet appareil, appliqué dès le chargement :
// avant même la première mesure, rien ne s'écrit avec l'horloge brute.
try {
  const v = JSON.parse(localStorage.getItem(CLE_ECART_HORLOGE) || "null");
  if (v && Number.isFinite(v.ecart)) poserEcartHorloge(v.ecart);
} catch { /* navigation privée : on mesurera */ }

const abonnes = new Set();
export const ecouterEcartHorloge = (fn) => { abonnes.add(fn); return () => abonnes.delete(fn); };

export async function mesurerHorloge() {
  try {
    const envoi = Date.now();
    const r = await fetch(`${import.meta.env.BASE_URL}version.json?horloge=${envoi}`, { cache: "no-store" });
    const reception = Date.now();
    const ecart = ecartDepuisReponse({ dateServeur: r.headers.get("date"), age: r.headers.get("age"), envoi, reception });
    if (ecart === null) return null;
    const avant = ecartHorloge();
    const pose = poserEcartHorloge(ecart);
    try { localStorage.setItem(CLE_ECART_HORLOGE, JSON.stringify({ ecart: pose, le: new Date(reception).toISOString() })); } catch { /* rien */ }
    if (pose !== avant) abonnes.forEach((fn) => { try { fn(pose); } catch { /* rien */ } });
    return pose;
  } catch {
    // Pas de réseau : le dernier écart connu reste en place.
    return null;
  }
}

let surveille = false;
// À l'ouverture, toutes les 10 minutes, au retour du réseau et au réveil de
// l'appareil (une horloge peut être corrigée pendant que l'application dort).
export function surveillerHorloge() {
  if (surveille) return;
  surveille = true;
  mesurerHorloge();
  setInterval(mesurerHorloge, INTERVALLE_MS);
  window.addEventListener("online", mesurerHorloge);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") mesurerHorloge(); });
}
