// ============ L'HEURE DU SERVEUR, JAMAIS CELLE DE L'APPAREIL (14/10/2026) ============
// Timo, capture des ventes de SEVERIN et ERIC : « ces ventes ont considéré
// l'horloge de l'ordinateur… l'application doit utiliser l'heure du serveur ».
// La date et l'heure écrites venaient de l'horloge de l'appareil (lue en heure
// de Lomé, GMT+0) : un PC réglé sur le mauvais pays MAIS qui affiche la bonne
// heure a, pour le reste du monde, une heure d'avance ou de retard.
//
// La règle : l'appareil MESURE son écart avec le serveur (src/horloge.js, la
// date que le serveur pose sur sa réponse) et toute date, toute heure que
// l'application écrit passe par `maintenant()`, qui retire cet écart. Hors
// connexion, le dernier écart mesuré sur l'appareil reste appliqué.
//
// ⚠ AUCUN IMPORT : lu aussi par le serveur (via lib/core.js), où l'écart reste
// à 0 — l'heure du serveur EST la bonne.

let ecartMs = 0;

// En dessous de 2 secondes, ce n'est pas un écart : c'est la précision de la
// mesure (la date du serveur est donnée à la seconde près).
export const ECART_NEGLIGEABLE_MS = 2000;
// Au-delà de 5 minutes, l'avertissement s'affiche (décision Timo, 14/10/2026).
export const SEUIL_AVERTISSEMENT_HORLOGE_MS = 5 * 60 * 1000;
// Une mesure dont l'aller-retour dépasse 10 s n'est pas assez précise.
export const ALLER_RETOUR_MAX_MS = 10000;

export const ecartHorloge = () => ecartMs;
export const poserEcartHorloge = (ms) => {
  const n = Math.round(Number(ms));
  ecartMs = Number.isFinite(n) && Math.abs(n) >= ECART_NEGLIGEABLE_MS ? n : 0;
  return ecartMs;
};

// L'instant présent, corrigé de l'écart de l'appareil.
export const maintenantMs = () => Date.now() + ecartMs;
export const maintenant = () => new Date(maintenantMs());
export const maintenantISO = () => maintenant().toISOString();

// L'écart déduit d'une réponse du serveur. `dateServeur` = l'en-tête « Date »
// (à la seconde près), `age` = l'en-tête « Age » (une réponse gardée par le
// relais du serveur porte la date où elle a été faite, plus son âge),
// `envoi` / `reception` = l'horloge de l'appareil avant et après. Le serveur a
// répondu au milieu de l'aller-retour. Rend null quand on ne peut rien dire.
export function ecartDepuisReponse({ dateServeur, age, envoi, reception }) {
  const t = Date.parse(dateServeur || "");
  if (!Number.isFinite(t)) return null;
  const e = Number(envoi), r = Number(reception);
  if (!Number.isFinite(e) || !Number.isFinite(r) || r < e || r - e > ALLER_RETOUR_MAX_MS) return null;
  const a = Math.max(0, Number(age) || 0);
  // La date est tronquée à la seconde : l'instant réel est en moyenne 0,5 s plus tard.
  const serveur = t + a * 1000 + 500;
  return Math.round(serveur - (e + r) / 2);
}

export const horlogeAAvertir = (ms) => Math.abs(Number(ms) || 0) > SEUIL_AVERTISSEMENT_HORLOGE_MS;

// « 58 min », « 2 h 05 », « 3 jours » — l'écart dit en mots.
export function dureeEcart(ms) {
  const min = Math.round(Math.abs(Number(ms) || 0) / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h ${String(min % 60).padStart(2, "0")}`;
  return `${Math.round(h / 24)} jours`;
}

// La phrase de l'avertissement : ce que fait l'application, ce qu'il reste à faire.
export function phraseEcartHorloge(ms) {
  const sens = ms > 0 ? "de retard" : "d'avance";
  return `L'horloge de cet appareil a ${dureeEcart(ms)} ${sens}. L'application écrit quand même l'heure juste (celle du serveur), mais réglez l'horloge de l'appareil : date, heure et fuseau horaire « Lomé » (GMT).`;
}
