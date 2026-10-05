// ============================================================
// lib/affectation.js — LE LIEU D'AFFECTATION D'UN EMPLOYÉ
//
// Timo (05/10/2026) : « pour tous les employés, ajouter dans leur fiche le
// lieu d'affectation, à écrire par l'administrateur », puis « exclusivement
// pour les employés qui ne sont rattachés à aucune boutique » → « Lance,
// texte libre, la boutique l'emporte ».
//
// ⚠ LA BOUTIQUE DONNE DES DROITS (caisse, ventes, notifications) ; le lieu
// d'affectation n'en donne AUCUN : il dit seulement où la personne travaille
// (« Siège Lomé », « Chantiers Kara »). Il ne se saisit que sur un employé
// SANS boutique, et la boutique l'emporte toujours : si elle arrive, l'ancien
// lieu reste rangé sans s'afficher, et revient s'il la perd.
//
// Sans import : lu par le banc et par lib/dossierEmploye.js.
// ============================================================

export const AFFECTATION_MAX = 80;

const txt = (x) => String(x ?? "").trim();

// Un employé (jamais un client) qui n'est rattaché à aucune boutique.
export const peutAvoirAffectation = (u) => !!u && txt(u.role) !== "" && u.role !== "client" && !txt(u.boutique);

// Ce qui s'écrit comme affectation : la boutique d'abord, sinon le lieu saisi.
export const affectationDe = (u) => (u ? txt(u.boutique) || (u.role !== "client" ? txt(u.affectation) : "") : "");

// Refus revérifié DANS le geste ; "" = accepté (vide = effacer).
export function critiqueAffectation(u, texte) {
  if (!u || u.role === "client") return "Un client n'a pas de lieu d'affectation.";
  if (txt(u.boutique)) return `${u.nom || "Cet employé"} est rattaché à la boutique ${txt(u.boutique)} : c'est elle, son affectation.`;
  if (txt(texte).length > AFFECTATION_MAX) return `${AFFECTATION_MAX} caractères au plus.`;
  return "";
}
