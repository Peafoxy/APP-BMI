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
import { PAIEMENTS, CATEGORIE_REMBOURSEMENT } from "./constants";

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

// "" si la reprise est possible, sinon le motif du refus.
export function critiqueReprise(db, vente, { produit_id, qte, motif, moyen }) {
  if (!vente) return "Vente introuvable.";
  const chantier = (db.clients_installes || []).find((c) => c.vente_id === vente.id);
  if (chantier) return `Cette vente a créé le chantier de ${chantier.nom} ${chantier.prenom || ""}. Traitez d'abord le chantier (🔧 Clients installés).`;
  if (vente.commission_payee) return `La commission de cette vente a déjà été payée${vente.commercial ? ` à ${vente.commercial}` : ""}. Annulez d'abord le règlement de commission (👑 Équipe).`;
  const ligne = lignesReprenables(vente).find((l) => l.produit_id === produit_id);
  if (!ligne) return "Cet article ne figure pas sur cette vente, ou a déjà été entièrement repris.";
  const n = Math.floor(Number(qte || 0));
  if (!(n >= 1 && n <= ligne.restant)) return `Quantité invalide : il reste ${ligne.restant} exemplaire(s) de cet article à reprendre sur cette vente.`;
  if (!String(motif || "").trim()) return "Indiquez pourquoi le client ne prend pas l'article.";
  if (!MOYENS_REMBOURSEMENT.includes(moyen)) return "Choisissez comment l'argent est rendu (espèces, mobile money, virement).";
  return "";
}

// Les écritures d'une reprise. Ne vérifie pas le droit : critiqueReprise
// d'abord. Renvoie { refus } ou { vente, ajustement, depense, dette,
// detteAvant, reprise, montant, rembourse, ref }.
export function construireReprise(db, vente, choix, profile, aujourdhui = today()) {
  const refus = critiqueReprise(db, vente, choix);
  if (refus) return { refus };
  const { produit_id, motif, moyen } = choix;
  const n = Math.floor(Number(choix.qte));
  const ligne = lignesReprenables(vente).find((l) => l.produit_id === produit_id);
  const montant = montantReprise(vente, ligne, n);
  const ref = "REP-" + uid().slice(0, 8).toUpperCase();
  const m = String(motif).trim();
  const qui = profile?.nom || "?";

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
    ? { ...nouvelleDepense(profile, { boutique: vente.boutique, categorie: CATEGORIE_REMBOURSEMENT, description: `Remboursement client — reprise ${ref} : ${n} × ${ligne.article} (reçu ${numeroRecu(vente)}${client})`, montant: rembourse, moyen, vente_id: vente.id, reprise_ref: ref }), date: aujourdhui }
    : null;
  const ajustement = {
    id: uid(), date: aujourdhui, produit_id, boutique: vente.boutique, qte: n,
    type: TYPE_REPRISE_CLIENT, ref, vente_id: vente.id, article: ligne.article,
    motif: `Reprise client (${ref}) — ${m}`, par: qui, autorise_par: qui,
  };
  const reprise = { id: ref, ref, date: aujourdhui, produit_id, article: ligne.article, qte: n, montant, rembourse, moyen: rembourse > 0 ? moyen : "", motif: m, par: qui, depense_id: depense ? depense.id : null, dette_id: dette ? dette.id : null };
  return {
    vente: { ...vente, reprises: [...(vente.reprises || []), reprise] },
    ajustement, depense, dette, detteAvant, reprise, montant, rembourse, ref,
    journal: `↩ Reprise ${ref} : ${n} × ${ligne.article} repris par le client (reçu ${numeroRecu(vente)}${client}) — ${m}${dette ? ` — dette ramenée à ${dette.montant}` : ""}${rembourse > 0 ? ` — ${rembourse} rendu(s) (${moyen})` : ""} — par ${qui}`,
  };
}

// Applique une reprise construite à la base (pure : renvoie la nouvelle base).
export const appliquerReprise = (db, r) => ({
  ...db,
  ventes: (db.ventes || []).map((v) => (v.id === r.vente.id ? r.vente : v)),
  ajustements: [r.ajustement, ...(db.ajustements || [])],
  ...(r.depense ? { depenses: [r.depense, ...(db.depenses || [])] } : {}),
  ...(r.dette ? { dettes: (db.dettes || []).map((d) => (d.id === r.dette.id ? r.dette : d)) } : {}),
});
