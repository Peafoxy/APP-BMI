// ============================================================
// lib/transfertsStock.js — LE TRANSFERT DE STOCK ENTRE BOUTIQUES SE VALIDE
// PAR LA BOUTIQUE QUI REÇOIT
//
// Timo (14/09/2026), mot pour mot : « Lorsqu'un gérant ou admin transfère
// vers une autre boutique, le gérant de la boutique de réception doit
// valider dans Transfert. Bien mentionné transfert de STOCK, différent de
// transfert de vente. Tant que cette validation n'est pas faite, l'article
// ne bouge pas. »
//
// Donc, pour le ⇄ Transfert de 📦 Stocks :
//   1. l'envoi crée une fiche « transfert de stock en attente », rangée
//      dans les `demandes` de la boutique qui REÇOIT (comme une demande de
//      transfert, mais de type `transfert_stock`) — le stock ne bouge pas ;
//   2. dans 🔁 Transfert (ou 📦 Stocks, admin / magasinier), la boutique qui
//      reçoit VALIDE (magasinier, gérant, admin) : à cet instant seulement,
//      les deux ajustements sont écrits (− chez l'envoyeur, + chez le
//      receveur), avec un numéro TRF-… ; ou REFUSE avec un motif : rien ne
//      bouge ;
//   3. l'envoyeur peut ANNULER tant que ce n'est pas validé.
// ⚠ Comme l'article reste vendable chez l'envoyeur en attendant, la
// validation revérifie le stock : s'il a été vendu entre-temps, elle est
// refusée et le dit.
// Rien à coller dans Supabase : le champ `demandes` d'une boutique est libre
// pour tous les rôles (securite-8), et l'ajustement de validation suit la
// règle des mouvements de stock (magasinier, gérant, admin).
// ============================================================
import { uid, today, heureCourte } from "./core";
import { demandesDe, stockActuel, boutiquesVisibles } from "./calculs";

export const TYPE_TRANSFERT_STOCK = "transfert_stock";
export const STATUT_ATTENTE = "en_attente";
export const STATUT_VALIDE = "valide";
export const STATUT_REFUSE = "refuse";
export const STATUT_ANNULE = "annule";

const estTransfertStock = (d) => d && d.type === TYPE_TRANSFERT_STOCK;
const boutiqueNommee = (db, nom) => (db.boutiques || []).find((b) => b.nom === nom);
const majDemande = (db, boutique, id, champs) => (db.boutiques || []).map((b) => (b.nom === boutique
  ? { ...b, demandes: demandesDe(b).map((x) => (x.id === id ? { ...x, ...champs } : x)) }
  : b));

// La fiche d'un envoi. `de` = boutique qui envoie, `vers` = qui reçoit.
export function nouveauTransfertStock({ de, vers, produit, qte, profile, date = today() }) {
  return {
    id: uid(), type: TYPE_TRANSFERT_STOCK, de, vers, date,
    heure: heureCourte(),
    par: profile?.nom || "?", par_id: profile?.id || null,
    lignes: [{ produit_id: produit.id, nom: produit.nom, qte: Number(qte) }],
    statut: STATUT_ATTENTE,
  };
}

// Ce que l'envoi peut refuser AVANT d'écrire (quantité, stock).
export function critiqueEnvoi({ de, vers, qte, dispo }) {
  const q = Number(qte);
  if (!de || !vers || de === vers) return "Choisissez une autre boutique.";
  if (!Number.isFinite(q) || q <= 0) return "Indiquez une quantité.";
  if (q > Number(dispo || 0)) return `Stock insuffisant : il reste ${dispo}.`;
  return "";
}

// Pose la fiche chez la boutique qui reçoit. Le stock ne bouge pas.
export function envoyerTransfertStock(db, transfert) {
  return {
    ...db,
    boutiques: (db.boutiques || []).map((b) => (b.nom === transfert.vers ? { ...b, demandes: [...demandesDe(b), transfert] } : b)),
  };
}

// Les transferts que CETTE boutique doit valider (elle reçoit).
export const transfertsStockAValider = (db, boutique) =>
  demandesDe(boutiqueNommee(db, boutique) || {}).filter((d) => estTransfertStock(d) && d.statut === STATUT_ATTENTE);

// Les transferts que CETTE boutique a envoyés et qui attendent encore.
export const transfertsStockEnvoyes = (db, boutique) =>
  (db.boutiques || []).flatMap((b) => demandesDe(b).filter((d) => estTransfertStock(d) && d.de === boutique && d.statut === STATUT_ATTENTE));

// L'historique (validés, refusés, annulés) vu par la boutique qui reçoit.
export const historiqueTransfertsStock = (db, boutique, n = 10) =>
  demandesDe(boutiqueNommee(db, boutique) || {}).filter((d) => estTransfertStock(d) && d.statut !== STATUT_ATTENTE).slice(-n).reverse();

// Le compte pour le badge de l'onglet : ma boutique (gérant), ou toutes les
// boutiques visibles (admin, qui n'en a aucune).
export function compterTransfertsStockAValider(db, profile) {
  if (profile?.boutique) return transfertsStockAValider(db, profile.boutique).length;
  return boutiquesVisibles(db, profile, db.boutiques || []).reduce((s, b) => s + transfertsStockAValider(db, b.nom).length, 0);
}

// Ce qui empêche de valider MAINTENANT (le stock a pu bouger entre-temps).
export function critiqueValidation(db, transfert) {
  if (!transfert || transfert.statut !== STATUT_ATTENTE) return "Ce transfert n'est plus en attente.";
  for (const l of transfert.lignes || []) {
    const p = (db.produits || []).find((x) => x.id === l.produit_id);
    if (!p) return `L'article « ${l.nom} » n'existe plus chez ${transfert.de}.`;
    const dispo = stockActuel(db, p);
    if (dispo < Number(l.qte)) return `Stock insuffisant chez ${transfert.de} : il ne reste que ${dispo} « ${l.nom} » (il a peut-être été vendu entre-temps). Demandez à ${transfert.de} de refaire le transfert.`;
  }
  return "";
}

// La validation : c'est ICI que l'article bouge.
export function validerTransfertStock(db, boutique, transfert, profile, date = today()) {
  const refus = critiqueValidation(db, transfert);
  if (refus) return { erreur: refus };
  const ref = uid();
  const numero = `TRF-${String(date).replace(/-/g, "")}-${ref.slice(0, 4).toUpperCase()}`;
  let produits = db.produits || [];
  const ajusts = [];
  for (const l of transfert.lignes) {
    const p = produits.find((x) => x.id === l.produit_id);
    let cible = produits.find((x) => x.boutique === boutique && x.nom.trim().toLowerCase() === p.nom.trim().toLowerCase());
    if (!cible) {
      cible = { id: uid(), boutique, nom: p.nom, categorie: p.categorie, initial: 0, entrees: 0, seuil: p.seuil, prix_achat: p.prix_achat, prix_vente: p.prix_vente, code: p.code || "", tension: p.tension || "" };
      produits = [...produits, cible];
    }
    const q = Number(l.qte);
    ajusts.push({ id: uid(), date, produit_id: p.id, boutique: transfert.de, qte: -q, motif: `Transfert ${numero} → ${boutique}`, par: profile.nom, ref, type: "transfert" });
    ajusts.push({ id: uid(), date, produit_id: cible.id, boutique, qte: q, motif: `Transfert ${numero} ← ${transfert.de}`, par: profile.nom, ref, type: "transfert" });
  }
  const resume = transfert.lignes.map((l) => `${l.qte}× ${l.nom}`).join(", ");
  return {
    db: {
      ...db,
      produits,
      ajustements: [...ajusts, ...(db.ajustements || [])],
      boutiques: majDemande(db, boutique, transfert.id, { statut: STATUT_VALIDE, numero_bon: numero, traite_par: profile.nom, date_traitement: date }),
    },
    journal: `Transfert de stock ${numero} validé par ${profile.nom} : ${transfert.de} → ${boutique} (${resume})`,
  };
}

export function refuserTransfertStock(db, boutique, transfert, profile, motif, date = today()) {
  if (!transfert || transfert.statut !== STATUT_ATTENTE) return { erreur: "Ce transfert n'est plus en attente." };
  const m = String(motif || "").trim();
  if (!m) return { erreur: "Indiquez pourquoi vous refusez." };
  return {
    db: { ...db, boutiques: majDemande(db, boutique, transfert.id, { statut: STATUT_REFUSE, motif: m, traite_par: profile.nom, date_traitement: date }) },
    journal: `Transfert de stock ${transfert.de} → ${boutique} REFUSÉ par ${profile.nom} : ${m}`,
  };
}

// L'envoyeur retire son envoi tant que personne ne l'a validé.
export function annulerTransfertStock(db, transfert, profile, date = today()) {
  if (!transfert || transfert.statut !== STATUT_ATTENTE) return { erreur: "Ce transfert n'est plus en attente." };
  return {
    db: { ...db, boutiques: majDemande(db, transfert.vers, transfert.id, { statut: STATUT_ANNULE, traite_par: profile.nom, date_traitement: date }) },
    journal: `Transfert de stock ${transfert.de} → ${transfert.vers} annulé par ${profile.nom} avant validation`,
  };
}

export const libelleLignes = (t) => (t?.lignes || []).map((l) => `${l.qte}× ${l.nom}`).join(", ");
