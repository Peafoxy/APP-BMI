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
//
// ⚠ 15/10/2026 : la mesure PRINCIPALE est désormais la base elle-même, à
// chaque synchronisation (mesurerParLaBase, appelée par src/sync.js) ; le
// petit fichier n'est plus qu'un secours.

import { poserEcartHorloge, ecartDepuisReponse, ecartDepuisHeureServeur, baseRecente } from "./lib/horloge";

// ⚠ « _v2 » depuis le 15/10/2026 : l'écart gardé par la première version était
// FAUX (l'âge du fichier ajouté, voir lib/horloge.js) — un nouveau nom le laisse
// de côté au chargement, au lieu de le réappliquer jusqu'à la première mesure.
export const CLE_ECART_HORLOGE = "bmi_ecart_horloge_v2";
const INTERVALLE_MS = 10 * 60 * 1000;

// Le dernier écart connu sur cet appareil, appliqué dès le chargement :
// avant même la première mesure, rien ne s'écrit avec l'horloge brute.
try {
  const v = JSON.parse(localStorage.getItem(CLE_ECART_HORLOGE) || "null");
  if (v && Number.isFinite(v.ecart)) poserEcartHorloge(v.ecart);
} catch { /* navigation privée : on mesurera */ }
try { localStorage.removeItem("bmi_ecart_horloge"); } catch { /* rien */ }

// Le dernier moment où la BASE a donné l'heure (mesurerParLaBase).
let derniereMesureBase = NaN;
// La fonction heure_serveur() n'existe pas encore sur la base (le SQL
// supabase/heure-serveur-1.sql pas collé) : on ne la redemande plus jusqu'au
// prochain chargement — le petit fichier prend le relais.
let baseSansHeure = false;

function garder(ecart, reception) {
  const pose = poserEcartHorloge(ecart);
  try { localStorage.setItem(CLE_ECART_HORLOGE, JSON.stringify({ ecart: pose, le: new Date(reception).toISOString() })); } catch { /* rien */ }
  return pose;
}

// ⚠ 15/10/2026 : à CHAQUE synchronisation (toutes les 20 secondes), la base
// dit l'heure elle-même — src/sync.js appelle ceci avec SON client. Aucun
// relais, aucune copie gardée : c'est la meilleure source. Ne lève jamais.
export async function mesurerParLaBase(client) {
  if (baseSansHeure || !client) return null;
  try {
    const envoi = Date.now();
    const { data, error } = await client.rpc("heure_serveur");
    const reception = Date.now();
    if (error) {
      // Fonction absente (PGRST202 / 42883) : le SQL n'est pas collé.
      if (error.code === "PGRST202" || error.code === "42883" || /heure_serveur/.test(error.message || "")) baseSansHeure = true;
      return null;
    }
    const ecart = ecartDepuisHeureServeur({ heure: data, envoi, reception });
    if (ecart === null) return null;
    derniereMesureBase = reception;
    return garder(ecart, reception);
  } catch {
    return null;
  }
}

// La mesure de SECOURS : le petit fichier, tant que la base ne donne pas
// l'heure (SQL pas encore collé, base injoignable).
export async function mesurerHorloge() {
  if (baseRecente(derniereMesureBase, Date.now())) return null;
  try {
    const envoi = Date.now();
    const r = await fetch(`${import.meta.env.BASE_URL}version.json?horloge=${envoi}`, { cache: "no-store" });
    const reception = Date.now();
    const ecart = ecartDepuisReponse({ dateServeur: r.headers.get("date"), envoi, reception });
    if (ecart === null) return null;
    return garder(ecart, reception);
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
