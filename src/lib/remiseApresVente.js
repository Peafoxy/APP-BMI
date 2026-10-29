// ============================================================
// lib/remiseApresVente.js — UNE REMISE APRÈS L'ENCAISSEMENT
//
// Timo (29/10/2026) : « Je veux que ça soit une fonctionnalité » (une
// remise sur une vente DÉJÀ encaissée), puis « 1 admin + gérant, 2 oui,
// 3 ok, 4 oui, 5 oui, lance ».
//
// C'EST LA MÊME MÉCANIQUE QU'UNE REPRISE (lib/reprises.js), SANS ARTICLE :
//   • la VENTE reste telle qu'elle a été encaissée (reçu, numéro, date,
//     total payé, caisse de ce jour-là ne bougent jamais) ; la remise est
//     notée sur la vente (`remises_apres_vente`), et le chiffre d'affaires
//     comme la commission en deviennent NETS (caVente, caLigneVente —
//     lib/core.js, par `montantRemiseApresVente`) ;
//   • AUCUN article ne revient au stock : rien n'est rendu physiquement ;
//   • l'ARGENT : dette pas soldée → elle DIMINUE d'autant (et ce qui avait
//     déjà été versé au-delà du nouveau montant est rendu) ; dette soldée
//     ou vente comptant → une sortie de caisse « Remboursement client »
//     (du jour, hors charges) rend le montant.
// (1) Qui : le gérant et l'administrateur. (2) Aucun plafond en % : la
// seule limite est ce qui reste réellement dû/payé sur la vente (jamais
// plus que `caVente(vente)` au moment du geste). Motif obligatoire ;
// refusée si la vente a créé un chantier ou si la commission a déjà été
// payée — mêmes refus qu'une reprise (une commission versée ne se retouche
// pas en silence). (5) Un message WhatsApp part AUTOMATIQUEMENT du numéro
// BMI (lib/whatsappModeles.js, `remise_apres_vente`).
// Serveur : securite-43 (même couple qu'une reprise — securite-13).
// ============================================================
import { uid, today, numeroRecu, nouvelleDepense, caVente, remisesApresVenteDe } from "./core";
import { CATEGORIE_REMBOURSEMENT, caisseDeVente } from "./constants";
import { MOYENS_REMBOURSEMENT } from "./reprises";

export const ROLES_REMISE_APRES_VENTE = ["gerant", "admin"];
export { MOYENS_REMBOURSEMENT };

// Ce qu'il reste à offrir en remise sur cette vente (net des reprises et des
// remises après-vente déjà posées) — jamais plus que ça.
export const plafondRemiseApresVente = (v) => Math.max(0, caVente(v));

// "" si la remise est possible, sinon le motif du refus.
export function critiqueRemiseApresVente(db, vente, { montant, motif, moyen } = {}) {
  if (!vente) return "Vente introuvable.";
  const chantier = (db.clients_installes || []).find((c) => c.vente_id === vente.id);
  if (chantier) return `Cette vente a créé le chantier de ${chantier.nom} ${chantier.prenom || ""}. Traitez d'abord le chantier (🔧 Clients installés).`;
  if (vente.commission_payee) return `La commission de cette vente a déjà été payée${vente.commercial ? ` à ${vente.commercial}` : ""}. Annulez d'abord le règlement de commission (👑 Équipe).`;
  const m = Math.round(Number(montant || 0));
  const plafond = plafondRemiseApresVente(vente);
  if (!(m >= 1)) return "Indiquez le montant de la remise.";
  if (m > plafond) return `La remise ne peut pas dépasser ${plafond} F — c'est tout ce qui reste sur cette vente (net des reprises et remises déjà accordées).`;
  if (!String(motif || "").trim()) return "Indiquez le motif de cette remise.";
  if (!MOYENS_REMBOURSEMENT.includes(moyen)) return "Choisissez comment l'argent est rendu, si un remboursement est dû (espèces, mobile money, virement).";
  return "";
}

// Les écritures d'une remise après-vente. Ne vérifie pas le droit :
// critiqueRemiseApresVente d'abord. Renvoie { refus } ou { vente, depense,
// dette, detteAvant, entree, montant, rembourse, ref, journal }.
export function construireRemiseApresVente(db, vente, { montant, motif, moyen }, profile, aujourdhui = today()) {
  const refus = critiqueRemiseApresVente(db, vente, { montant, motif, moyen });
  if (refus) return { refus };
  const m = Math.round(Number(montant));
  const mot = String(motif).trim();
  const ref = "RAV-" + uid().slice(0, 8).toUpperCase();
  const qui = profile?.nom || "?";
  const client = vente.client ? ` — ${vente.client}` : "";

  // L'argent : la dette de la vente d'abord, le reste est rendu — même
  // marche qu'une reprise (lib/reprises.js, construireReprise).
  const detteAvant = (db.dettes || []).find((d) => d.vente_id === vente.id) || null;
  let dette = null, rembourse = m;
  if (detteAvant) {
    const nouveauMontant = Math.max(0, Number(detteAvant.montant || 0) - m);
    rembourse = Math.max(0, Number(detteAvant.paye || 0) - nouveauMontant);
    dette = { ...detteAvant, montant: nouveauMontant, remises_apres_vente: [...(detteAvant.remises_apres_vente || []), { ref, date: aujourdhui, montant: m, rembourse }] };
  }
  const depense = rembourse > 0
    ? { ...nouvelleDepense(profile, { boutique: caisseDeVente(vente), categorie: CATEGORIE_REMBOURSEMENT, description: `Argent rendu au client — remise après-vente sur la vente ${numeroRecu(vente)}${client} : ${mot} (${ref})`, montant: rembourse, moyen, vente_id: vente.id, remise_apres_vente_ref: ref }), date: aujourdhui }
    : null;
  const entree = {
    id: ref, ref, date: aujourdhui, montant: m, rembourse, moyen: rembourse > 0 ? moyen : "", motif: mot, par: qui,
    depense_id: depense ? depense.id : null, dette_id: dette ? dette.id : null,
  };
  return {
    vente: { ...vente, remises_apres_vente: [...remisesApresVenteDe(vente), entree] },
    depense, dette, detteAvant, entree, montant: m, rembourse, ref,
    journal: `✏️ Remise après-vente ${ref} de ${m} F sur la vente (reçu ${numeroRecu(vente)}${client}) — ${mot}${dette ? ` — dette ramenée à ${dette.montant}` : ""}${rembourse > 0 ? ` — ${rembourse} rendu(s) (${moyen})` : ""} — par ${qui}`,
  };
}

// Applique une remise après-vente construite à la base (pure).
export const appliquerRemiseApresVente = (db, r) => ({
  ...db,
  ventes: (db.ventes || []).map((v) => (v.id === r.vente.id ? r.vente : v)),
  ...(r.depense ? { depenses: [r.depense, ...(db.depenses || [])] } : {}),
  ...(r.dette ? { dettes: (db.dettes || []).map((d) => (d.id === r.dette.id ? r.dette : d)) } : {}),
});
