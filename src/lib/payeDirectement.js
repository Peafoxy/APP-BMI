// ============================================================
// lib/payeDirectement.js — « PERSONNE — PAYÉ DIRECTEMENT » DIT À QUI
// (22/10/2026, capture Timo : « si on clique sur personne payé directement,
// on peut demander le nom et le numéro de la personne… et la personne reçoit
// aussi le message de réception des fonds » → « Ab, Bb, Cb, texte ok »,
// puis « Personne payé n'est pas choisi d'office… la case reste à choisir…
// sinon impossible d'enregistrer la dépense »).
//
// ⚠ « Argent remis à » n'a plus de choix d'office, hors chantier comme pour
// un chantier : on CHOISIT (`critiqueChoixRemis`). Le paiement du loyer garde
// son geste (le propriétaire est sur la fiche du local) : il ne passe pas ici.
// ⚠ « A b » : « Personne » exige le NOM de qui a reçu l'argent, le numéro est
// facultatif — sans numéro, aucun message ne part.
// ⚠ « B b » : le message part quand la dépense COMPTE (sous le seuil, ou
// validée par le DG) ; une dépense rejetée n'annonce rien. « C b » : ✏️
// Modifier peut ajouter ou corriger le nom et le numéro, et le message part
// si la personne n'en a jamais reçu (`avise_le`, une seule fois).
// Sans import : lue par les écrans et le banc telle quelle.
// ============================================================

export const NOM_PAYE_A_MAX = 80;
export const MOTIF_CHOIX_REMIS = "Choisissez à qui l'argent a été remis : un employé, ou « Personne — payé directement » (et le nom de celui qui l'a reçu).";
export const MOTIF_NOM_PAYE_A = "Indiquez le nom de la personne (ou de l'entreprise) qui a reçu l'argent — « Personne — payé directement ».";

const chiffres = (tel) => String(tel || "").replace(/\D/g, "");

// La case « Argent remis à » est exigée dans le formulaire (« la case reste à choisir »).
export const critiqueChoixRemis = (choix) => (String(choix || "").trim() ? null : MOTIF_CHOIX_REMIS);

// Le nom (exigé) et le numéro (facultatif, 8 chiffres au moins s'il est tapé).
export function critiquePayeA({ nom, tel } = {}, { nomExige = true } = {}) {
  const n = String(nom || "").trim();
  if (nomExige && !n) return MOTIF_NOM_PAYE_A;
  if (n.length > NOM_PAYE_A_MAX) return `Le nom tient en ${NOM_PAYE_A_MAX} caractères au plus.`;
  const c = chiffres(tel);
  if (c && c.length < 8) return "Le numéro WhatsApp est trop court (8 chiffres au moins). Laissez la case vide si la personne n'a pas de numéro.";
  if (c && !n) return "Un numéro sans nom : indiquez aussi le nom de la personne qui a reçu l'argent.";
  return null;
}

// Ce qui se range sur la dépense : `paye_a = { nom, tel }`, ou rien.
export function payeANormalise({ nom, tel } = {}) {
  const n = String(nom || "").trim().replace(/\s+/g, " ");
  if (!n) return null;
  return { nom: n, tel: chiffres(tel) ? String(tel).trim() : "" };
}

// ✏️ Modifier : le nom ou le numéro a-t-il changé ? (`payeA` undefined = on n'y touche pas)
export function changeDePayeA(d, payeA) {
  if (payeA === undefined) return false;
  const avant = d?.paye_a || null;
  return String(avant?.nom || "") !== String(payeA?.nom || "") || chiffres(avant?.tel) !== chiffres(payeA?.tel);
}
// La dépense corrigée garde la marque de l'avis si le NUMÉRO n'a pas changé
// (on ne renvoie pas le message à la même personne pour une faute de nom).
export function avecPayeA(d, payeA) {
  const { paye_a, ...reste } = d || {};
  if (!payeA) return reste;
  const memeNumero = chiffres(paye_a?.tel) && chiffres(paye_a?.tel) === chiffres(payeA.tel);
  return { ...reste, paye_a: { nom: payeA.nom, tel: payeA.tel, ...(memeNumero && paye_a?.avise_le ? { avise_le: paye_a.avise_le } : {}) } };
}
// Trou 6 du message : celui qui a saisi la dépense, et la caisse qui a payé.
export const remisParDe = (nom, caisse) => [String(nom || "").trim(), String(caisse || "").trim()].filter(Boolean).join(", ");
export const phrasePayeA = (p) => (p && p.nom ? `payé à ${p.nom}${chiffres(p.tel) ? ` (${p.tel})` : ""}` : "");

// « B b » + « C b » : le message part UNE fois, quand la dépense compte
// (`compte` = sous le seuil, ou validée — calculé par l'écran), jamais
// rejetée, jamais sans numéro, jamais en formation (`formation` = la
// boutique de la dépense).
export function avisFondsRemisAFaire(dep, { compte, rejetee = false, formation = false } = {}) {
  const p = dep?.paye_a;
  return !!(p && p.nom && chiffres(p.tel).length >= 8 && !p.avise_le && compte && !rejetee && !formation && Number(dep.montant) > 0);
}
export const marquerFondsRemisAnnonce = (dep, le) => ({ ...dep, paye_a: { ...(dep.paye_a || {}), avise_le: le } });
