// ============================================================
// lib/devisSansSuite.js — 📁 CLASSER UN DEVIS SANS SUITE, ET LE ROUVRIR.
//
// Timo (26/09/2026), après « un devis expiré mais non supprimé peut saturer
// notre base ? » (non : 20 Mo sur 500, 22 devis) puis « est-il possible de
// conserver quelque trace de ce devis sinon devrait le supprimer ? » :
// deux voies proposées (a : classer sans suite, le devis reste entier ;
// b : supprimer mais garder un résumé) → « a, auteur admin et resp com,
// lance ».
//
// Ce que fait le classement :
//   - le devis RESTE ENTIER dans la fiche du client (lignes, besoins,
//     montants, relances, messages) : rien n'est effacé, rien ne part à la
//     corbeille ;
//   - il prend le statut `sans_suite` : il sort de la liste active de
//     📋 Tous les devis et se range sous « 📁 Sans suite » ;
//   - le client ne peut plus le valider (l'espace client ne propose
//     « valider » que sur un devis ⏳ Proposé), il n'est plus relancé ni à
//     la main ni par la tournée de 7 h, il ne porte plus la pastille
//     « offre expirée » (toutes ces règles regardent le statut « propose ») ;
//   - il se ROUVRE : il redevient ⏳ Proposé tel qu'il était. Le classement
//     d'avant reste lisible (`historique_sans_suite`, liste qui ne rétrécit
//     jamais).
//
// QUI (sa décision) : celui qui l'a établi, l'administrateur, le responsable
// commercial — les mêmes que « ✏️ Modifier et renvoyer ». La SUPPRESSION,
// elle, reste à l'administrateur principal (lib/corbeille.js) : elle sert
// aux vraies erreurs (devis en double, mauvais client).
//
// QUOI : un devis ⏳ Proposé seulement. Validé = contrat signé, payé =
// argent encaissé ; en modification, corrigé ou rejeté = le client a déjà
// parlé. Motif OBLIGATOIRE : un devis ne se range pas sans dire pourquoi.
//
// ⚠ Aucun déclencheur serveur ne garde ce geste (comme la suppression d'un
// devis) : c'est l'application qui décide. Rien à coller dans Supabase.
// Règles PURES : le banc les exerce.
// ============================================================
import { ROLES_MODIFIENT_TOUT_DEVIS } from "./comptesClients.js";

export const STATUT_SANS_SUITE = "sans_suite";

export const estSansSuite = (devis) => (devis?.statut || "") === STATUT_SANS_SUITE;

// L'auteur (par son identifiant, jamais son nom), l'administrateur, le
// responsable commercial.
export const peutClasserDevis = (devis, profile) => !!devis && !!profile
  && (ROLES_MODIFIENT_TOUT_DEVIS.includes(profile.role) || (!!devis.par_id && devis.par_id === profile.id));

// "" si le classement est permis ; sinon le motif, en français.
export function critiqueClassement(devis, profile, motif) {
  if (!devis) return "Devis introuvable.";
  if (devis.supprime_le) return "Ce devis est à la corbeille.";
  if (estSansSuite(devis)) return "Ce devis est déjà classé sans suite.";
  if ((devis.statut || "propose") !== "propose")
    return "Seul un devis ⏳ Proposé se classe sans suite : celui-ci ne l'est plus (validé, payé, en modification, corrigé ou rejeté).";
  if (!peutClasserDevis(devis, profile))
    return `🔒 Seul ${devis.par || "celui qui a établi ce devis"}, l'administrateur ou le responsable commercial peut le classer sans suite.`;
  if (motif !== undefined && !String(motif || "").trim())
    return "Le motif est obligatoire : un devis ne se range pas sans dire pourquoi.";
  return "";
}

export const classerSansSuite = (devis, profile, motif, date) => ({
  ...devis,
  statut: STATUT_SANS_SUITE,
  sans_suite: {
    le: date,
    par: profile?.nom || "",
    par_id: profile?.id || "",
    motif: String(motif || "").trim(),
  },
});

export function critiqueReouverture(devis, profile) {
  if (!devis) return "Devis introuvable.";
  if (!estSansSuite(devis)) return "Ce devis n'est pas classé sans suite.";
  if (!peutClasserDevis(devis, profile))
    return `🔒 Seul ${devis.par || "celui qui a établi ce devis"}, l'administrateur ou le responsable commercial peut le rouvrir.`;
  return "";
}

// Il redevient ⏳ Proposé tel qu'il était. Le classement passe dans
// l'historique, qui ne rétrécit jamais.
export function rouvrirDevis(devis, profile, date) {
  const { sans_suite, ...reste } = devis || {};
  return {
    ...reste,
    statut: "propose",
    historique_sans_suite: [
      ...(Array.isArray(devis?.historique_sans_suite) ? devis.historique_sans_suite : []),
      { ...(sans_suite || {}), rouvert_le: date, rouvert_par: profile?.nom || "", rouvert_par_id: profile?.id || "" },
    ],
  };
}

// Appliquer un de ces gestes au devis `devisId` de la fiche `clientId`.
export const avecDevis = (db, clientId, devisId, fn) => ({
  ...db,
  users: (db.users || []).map((u) => (u.id === clientId
    ? { ...u, devis: (u.devis || []).map((x) => (x.id === devisId ? fn(x) : x)) }
    : u)),
});

// La fiche FRAÎCHE (revérification dans le geste).
export const devisDans = (db, clientId, devisId) =>
  ((db.users || []).find((u) => u.id === clientId)?.devis || []).find((x) => x.id === devisId) || null;
