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
// (à la seconde près), `envoi` / `reception` = l'horloge de l'appareil avant et
// après. Le serveur a répondu au milieu de l'aller-retour. Rend null quand on
// ne peut rien dire.
//
// ⚠⚠ L'EN-TÊTE « Age » NE S'AJOUTE JAMAIS (15/10/2026, capture Timo : « nous
// sommes à 12h19, pourquoi les heures sur les reçus sont à 15h ? »). Le relais
// de Vercel pose sur une réponse gardée la date d'AUJOURD'HUI dans « Date », et
// dans « Age » le temps depuis qu'il la garde (des heures après un envoi). La
// première version ajoutait les deux : l'application avançait de l'âge du
// fichier. Le paramètre `age` est encore reçu (un appel d'avant ne casse pas),
// il n'est plus lu.
export function ecartDepuisReponse({ dateServeur, envoi, reception }) {
  const t = Date.parse(dateServeur || "");
  if (!Number.isFinite(t)) return null;
  const e = Number(envoi), r = Number(reception);
  if (!Number.isFinite(e) || !Number.isFinite(r) || r < e || r - e > ALLER_RETOUR_MAX_MS) return null;
  // La date est tronquée à la seconde : l'instant réel est en moyenne 0,5 s plus tard.
  const serveur = t + 500;
  return Math.round(serveur - (e + r) / 2);
}
