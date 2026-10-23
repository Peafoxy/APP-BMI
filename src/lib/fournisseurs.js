// ============================================================
// lib/fournisseurs.js — MODIFIER LA FICHE D'UN FOURNISSEUR
//
// Timo, 23/10/2026 : « Rendre modifiable la fiche d'un fournisseur et ajouter
// le nom du commercial ou du représentant sur la fiche » → « a oui, b oui,
// c non (modifiable par l'administrateur principal seul) ».
//   a) le représentant porte son NOM et son NUMÉRO ;
//   b) un changement de nom suit les ARTICLES qui portaient l'ancien nom
//      (un article retient son fournisseur par le nom) ;
//   c) le dû et le réglé se corrigent aussi — l'administrateur PRINCIPAL seul.
//
// Module PUR, sans aucun import (même règle que lib/banques.js).
// ============================================================

const cle = (t) => String(t ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export const memeNomFournisseur = (a, b) => !!cle(a) && cle(a) === cle(b);

// Les champs de la fiche, dans l'ordre où le journal les raconte.
// [clé, libellé, genre] — « argent » = réservé au principal.
export const CHAMPS_FOURNISSEUR = [
  ["nom", "nom", "texte"],
  ["tel", "téléphone", "texte"],
  ["adresse", "adresse", "texte"],
  ["site_web", "site web", "texte"],
  ["produits", "produits", "texte"],
  ["representant", "représentant", "texte"],
  ["representant_tel", "numéro du représentant", "texte"],
  ["doit", "dû", "argent"],
  ["paye", "réglé", "argent"],
];

const nombre = (v) => {
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

// La saisie d'un formulaire (des textes) → les valeurs à ranger.
export function valeursSaisies(saisie = {}) {
  const v = {};
  for (const [k, , genre] of CHAMPS_FOURNISSEUR) {
    v[k] = genre === "argent" ? nombre(saisie[k]) : String(saisie[k] ?? "").trim();
  }
  return v;
}

// Ce qui change, champ par champ. Le dû et le réglé se comparent en nombres.
export function changementsFournisseur(avant = {}, saisie = {}) {
  const v = valeursSaisies(saisie);
  const out = [];
  for (const [k, libelle, genre] of CHAMPS_FOURNISSEUR) {
    const a = genre === "argent" ? Number(avant[k] || 0) : String(avant[k] ?? "").trim();
    if (a !== v[k]) out.push({ cle: k, libelle, avant: a, apres: v[k], argent: genre === "argent" });
  }
  return out;
}

// Refus, ou "". `autres` = les AUTRES fournisseurs du même espace ;
// `principal` = la personne est l'administrateur principal.
export function critiqueModifFournisseur(avant, saisie, { autres = [], principal = false } = {}) {
  if (!avant) return "Ce fournisseur n'existe plus.";
  const v = valeursSaisies(saisie);
  if (!v.nom) return "Le nom du fournisseur ne peut pas être vide.";
  const pris = (autres || []).find((x) => x && x.id !== avant.id && memeNomFournisseur(x.nom, v.nom));
  if (pris) return `Un autre fournisseur s'appelle déjà « ${pris.nom} ». Deux fiches du même nom se mélangeraient sur les articles du stock.`;
  if (Number.isNaN(v.doit) || Number.isNaN(v.paye)) return "Le dû et le réglé doivent être des nombres.";
  if (v.doit < 0 || v.paye < 0) return "Le dû et le réglé ne peuvent pas être négatifs.";
  const argent = changementsFournisseur(avant, saisie).filter((c) => c.argent);
  if (argent.length && !principal) return "Corriger le dû ou le réglé d'un fournisseur : réservé à l'administrateur PRINCIPAL.";
  return "";
}

// La fiche modifiée : tout ce qui n'est pas un champ de la fiche reste
// (id, espace…). Le dû et le réglé ne bougent que pour le principal.
export function fournisseurModifie(avant, saisie, { principal = false } = {}) {
  const v = valeursSaisies(saisie);
  const apres = { ...avant };
  for (const [k, , genre] of CHAMPS_FOURNISSEUR) {
    if (genre === "argent") { if (principal) apres[k] = v[k]; }
    else apres[k] = v[k];
  }
  return apres;
}

// « b » : les articles qui suivent un changement de nom. `nomsBoutiques` =
// les boutiques de l'espace REGARDÉ (le mur) — jamais tout le stock.
export function articlesQuiSuivent(produits, ancienNom, nomsBoutiques) {
  const dans = new Set(nomsBoutiques || []);
  return (produits || []).filter((p) => p && dans.has(p.boutique) && memeNomFournisseur(p.fournisseur, ancienNom));
}

export function produitsRenommes(produits, ids, nouveauNom) {
  const set = new Set(ids || []);
  return (produits || []).map((p) => (set.has(p.id) ? { ...p, fournisseur: nouveauNom } : p));
}

// La ligne du journal : « téléphone : A → B · dû : 0 → 50 000 ».
export function phraseChangements(changements, fmtArgent = (n) => String(n)) {
  return (changements || []).map((c) => {
    const f = (x) => (c.argent ? fmtArgent(x) : (x === "" ? "—" : x));
    return `${c.libelle} : ${f(c.avant)} → ${f(c.apres)}`;
  }).join(" · ");
}
