// ============================================================
// lib/reprises.js — LA REPRISE D'UN ARTICLE PAR LE CLIENT
//
// Timo (10/09/2026) : « un article vendu, mais sur le champ le client ne
// veut plus le prendre » → « Reprise pour l'administrateur principal seul ».
//
// UNE règle, pure (le banc l'exerce). Ce que fait une reprise :
//   • la VENTE reste telle qu'elle a été encaissée : reçu, numéro, date,
//     total payé et caisse de ce jour-là ne bougent pas ; la reprise est
//     notée sur la vente (`reprises`), et le chiffre d'affaires comme la
//     commission en deviennent NETS (caVente, lib/core.js) ;
//   • l'ARTICLE revient au stock normal de la boutique (ajustement positif,
//     type `reprise_client`), prêt à être revendu — jamais au SAV ;
//   • l'ARGENT : vente payée → une sortie de caisse « Remboursement client »
//     du jour, du montant effectivement payé pour ces unités (prix net de
//     toutes les remises, au prorata) ; vente à crédit → la dette diminue
//     d'autant, et seul ce que le client avait versé AU-DELÀ du nouveau
//     montant lui est rendu.
//   • motif obligatoire ; refusée si la vente a créé un chantier ou si la
//     commission a déjà été payée (même règle que la suppression).
// Serveur : securite-13 (reprises = principal seul, jamais retirées ;
// ajustement reprise_client et dépense « Remboursement client » = principal).
// ============================================================
import { uid, today, lignesVente, numeroRecu, caLigneVenteBrut, qteReprise, nouvelleDepense } from "./core";
import { PAIEMENTS, CATEGORIE_REMBOURSEMENT, caisseDeVente } from "./constants";

export const TYPE_REPRISE_CLIENT = "reprise_client";
export { CATEGORIE_REMBOURSEMENT };
// On rend de l'argent : jamais « à crédit ».
export const MOYENS_REMBOURSEMENT = PAIEMENTS.filter((p) => p !== "Crédit (dette)");

// Les lignes qu'on peut encore reprendre : articles du stock de la boutique
// (jamais « hors boutique »), avec ce qu'il en reste après les reprises passées.
export const lignesReprenables = (vente) => lignesVente(vente)
  .filter((l) => !l.hors_boutique && l.produit_id)
  .map((l) => ({ ...l, restant: Math.max(0, Number(l.qte || 0) - qteReprise(vente, l.produit_id)) }))
  .filter((l) => l.restant > 0);

// Le montant payé par le client pour `n` unités de cette ligne : le prix net
// de toutes les remises (ligne, globale, rabais), au prorata.
export const montantReprise = (vente, ligne, n) => {
  const q = Number(ligne.qte || 0);
  if (!(q > 0)) return 0;
  return Math.round((caLigneVenteBrut(vente, ligne) * n) / q);
};

// Le moyen proposé d'office : celui de la vente, sinon les espèces.
export const moyenParDefaut = (vente) => (MOYENS_REMBOURSEMENT.includes(vente?.paiement) ? vente.paiement : "Espèces");

// ↩ PLUSIEURS ARTICLES EN UNE SEULE REPRISE (06/10/2026, Timo : « pourquoi
// on ne peut pas reprendre plusieurs articles en même temps » → « 1 oui,
// 2 oui » : UN motif, UN bon pour tous). Le geste porte `lignes` :
// [{ produit_id, qte }] — une ligne à 0 est ignorée. L'ancienne forme
// ({ produit_id, qte }) reste lue : c'est une liste d'une ligne.
// ⚠ SEULE LA SAISIE EST GROUPÉE, PAS LE STOCK : chaque article garde SON
// ajustement et SA ligne dans `reprises` (qteReprise, caVente, la commission
// et Rentabilité les lisent ligne par ligne, rien n'a bougé pour eux) ; elles
// partagent le même `ref`, c'est lui qui en fait UN bon. L'argent, lui, est
// UNE sortie de caisse (ou UNE baisse de la dette) pour le total.
export const lignesDuChoix = (choix) => {
  const brut = Array.isArray(choix?.lignes) ? choix.lignes : [{ produit_id: choix?.produit_id, qte: choix?.qte }];
  return brut
    .map((l) => ({ produit_id: l?.produit_id, qte: Math.floor(Number(l?.qte || 0)) }))
    .filter((l) => l.produit_id && l.qte !== 0);
};

// "" si la reprise est possible, sinon le motif du refus.
export function critiqueReprise(db, vente, choix) {
  if (!vente) return "Vente introuvable.";
  const chantier = (db.clients_installes || []).find((c) => c.vente_id === vente.id);
  if (chantier) return `Cette vente a créé le chantier de ${chantier.nom} ${chantier.prenom || ""}. Traitez d'abord le chantier (🔧 Clients installés).`;
  if (vente.commission_payee) return `La commission de cette vente a déjà été payée${vente.commercial ? ` à ${vente.commercial}` : ""}. Annulez d'abord le règlement de commission (👑 Équipe).`;
  const lignes = lignesDuChoix(choix);
  if (!lignes.length) return "Indiquez la quantité reprise d'au moins un article.";
  const vus = new Set();
  for (const l of lignes) {
    if (vus.has(l.produit_id)) return "Un même article apparaît deux fois : une seule quantité par article.";
    vus.add(l.produit_id);
    const ligne = lignesReprenables(vente).find((x) => x.produit_id === l.produit_id);
    if (!ligne) return "Cet article ne figure pas sur cette vente, ou a déjà été entièrement repris.";
    if (!(l.qte >= 1 && l.qte <= ligne.restant)) return `Quantité invalide pour « ${ligne.article} » : il en reste ${ligne.restant} à reprendre sur cette vente.`;
  }
  if (!String(choix?.motif || "").trim()) return "Indiquez pourquoi le client ne prend pas l'article.";
  if (!MOYENS_REMBOURSEMENT.includes(choix?.moyen)) return "Choisissez comment l'argent est rendu (espèces, mobile money, virement).";
  return "";
}

// La valeur reprise d'un choix (aperçu de l'écran ET geste : UNE formule).
export const montantDuChoix = (vente, choix) => lignesDuChoix(choix).reduce((s, l) => {
  const ligne = lignesReprenables(vente).find((x) => x.produit_id === l.produit_id);
  return ligne && l.qte >= 1 ? s + montantReprise(vente, ligne, Math.min(l.qte, ligne.restant)) : s;
}, 0);

// Les écritures d'une reprise. Ne vérifie pas le droit : critiqueReprise
// d'abord. Renvoie { refus } ou { vente, ajustements, ajustement, depense,
// dette, detteAvant, reprises, reprise, montant, rembourse, ref }.
export function construireReprise(db, vente, choix, profile, aujourdhui = today()) {
  const refus = critiqueReprise(db, vente, choix);
  if (refus) return { refus };
  const { motif, moyen } = choix;
  const lignes = lignesDuChoix(choix).map((l) => {
    const ligne = lignesReprenables(vente).find((x) => x.produit_id === l.produit_id);
    return { produit_id: l.produit_id, n: l.qte, article: ligne.article, montant: montantReprise(vente, ligne, l.qte) };
  });
  const montant = lignes.reduce((s, l) => s + l.montant, 0);
  const ref = "REP-" + uid().slice(0, 8).toUpperCase();
  const m = String(motif).trim();
  const qui = profile?.nom || "?";
  const quoi = lignes.map((l) => `${l.n} × ${l.article}`).join(", ");

  // L'argent : la dette de la vente d'abord, le reste est rendu.
  const detteAvant = (db.dettes || []).find((d) => d.vente_id === vente.id) || null;
  let dette = null, rembourse = montant;
  if (detteAvant) {
    const nouveauMontant = Math.max(0, Number(detteAvant.montant || 0) - montant);
    rembourse = Math.max(0, Number(detteAvant.paye || 0) - nouveauMontant);
    dette = { ...detteAvant, montant: nouveauMontant, reprises: [...(detteAvant.reprises || []), { ref, date: aujourdhui, montant, rembourse }] };
  }
  const client = vente.client ? ` — ${vente.client}` : "";
  // La dépense porte la date de la reprise (`aujourdhui`), pas celle de l'horloge :
  // la règle est pure, le banc la rejoue à date fixe (défaut vu le 11/09/2026).
  const depense = rembourse > 0
    ? { ...nouvelleDepense(profile, { boutique: caisseDeVente(vente), categorie: CATEGORIE_REMBOURSEMENT, description: `Remboursement client — reprise ${ref} : ${quoi} (reçu ${numeroRecu(vente)}${client})`, montant: rembourse, moyen, vente_id: vente.id, reprise_ref: ref }), date: aujourdhui }
    : null;
  const ajustements = lignes.map((l) => ({
    id: uid(), date: aujourdhui, produit_id: l.produit_id, boutique: vente.boutique, qte: l.n,
    type: TYPE_REPRISE_CLIENT, ref, vente_id: vente.id, article: l.article,
    motif: `Reprise client (${ref}) — ${m}`, par: qui, autorise_par: qui,
  }));
  // Ce qui est rendu se partage au prorata des valeurs (le dernier prend le
  // reste au franc près) : la somme des lignes redonne toujours le total.
  let resteARendre = rembourse;
  const reprises = lignes.map((l, i) => {
    const part = i === lignes.length - 1 ? resteARendre : (montant > 0 ? Math.round((rembourse * l.montant) / montant) : 0);
    resteARendre -= part;
    return {
      id: lignes.length > 1 ? `${ref}-${i + 1}` : ref, ref, date: aujourdhui, produit_id: l.produit_id, article: l.article, qte: l.n,
      montant: l.montant, rembourse: part, moyen: rembourse > 0 ? moyen : "", motif: m, par: qui,
      depense_id: depense ? depense.id : null, dette_id: dette ? dette.id : null,
    };
  });
  return {
    vente: { ...vente, reprises: [...(vente.reprises || []), ...reprises] },
    ajustements, ajustement: ajustements[0], depense, dette, detteAvant, reprises, reprise: reprises[0], montant, rembourse, ref,
    journal: `↩ Reprise ${ref} : ${quoi} repris par BMI (reçu ${numeroRecu(vente)}${client}) — ${m}${dette ? ` — dette ramenée à ${dette.montant}` : ""}${rembourse > 0 ? ` — ${rembourse} rendu(s) (${moyen})` : ""} — par ${qui}`,
  };
}

// Applique une reprise construite à la base (pure : renvoie la nouvelle base).
export const appliquerReprise = (db, r) => ({
  ...db,
  ventes: (db.ventes || []).map((v) => (v.id === r.vente.id ? r.vente : v)),
  ajustements: [...(r.ajustements || [r.ajustement]), ...(db.ajustements || [])],
  ...(r.depense ? { depenses: [r.depense, ...(db.depenses || [])] } : {}),
  ...(r.dette ? { dettes: (db.dettes || []).map((d) => (d.id === r.dette.id ? r.dette : d)) } : {}),
});
