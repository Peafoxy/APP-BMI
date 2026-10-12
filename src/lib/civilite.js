// ============================================================
// lib/civilite.js — LE SEXE D'UN COMPTE, ET CE QUE LES DOCUMENTS EN FONT
// (12/10/2026, « ajouter le sexe sur la fiche pour que l'application
// l'utilise » → « Ab, Ba, Ca, lance »)
//   • « A b » : employés ET clients ;
//   • « B a » : l'administrateur seul le saisit ou le change (👥 Utilisateurs) ;
//   • « C a » : le serveur le garde aussi (securite-38).
// Champ `sexe` sur la fiche : "H" (homme) ou "F" (femme), vide = pas saisi.
// ⚠ VIDE, ON N'INVENTE RIEN : les documents gardent « M./Mme », « employé(e) ».
//
// Sans import : lu partout, Node compris.
// ============================================================

export const SEXES = [
  { code: "H", libelle: "Homme" },
  { code: "F", libelle: "Femme" },
];

// "H", "F" ou "" (jamais une autre valeur).
export const sexeDe = (u) => (u?.sexe === "H" || u?.sexe === "F" ? u.sexe : "");

export const libelleSexe = (u) => (SEXES.find((s) => s.code === sexeDe(u)) || {}).libelle || "";

// « M. », « Mme », ou la forme neutre choisie par le document.
export const civilite = (u, neutre = "M./Mme") => (sexeDe(u) === "H" ? "M." : sexeDe(u) === "F" ? "Mme" : neutre);

// L'accord d'un mot : accorde(u, "employé", "employée", "employé(e)").
export const accorde = (u, masculin, feminin, neutre) => (sexeDe(u) === "H" ? masculin : sexeDe(u) === "F" ? feminin : neutre);

// "" = accepté (vide = effacer).
export const critiqueSexe = (v) => (v === "" || v === "H" || v === "F" ? "" : "Choisissez Homme ou Femme.");
