// ============================================================
// lib/activiteProspection.js — SUIVRE LES COMMERCIAUX QUI PROSPECTENT
// (Timo, 15/11/2026 : « un responsable a-t-il tout ce qu'il faut pour suivre
// son équipe sur le terrain ?… je parle des commerciaux qui prospectent »
// → « Lance 1, 2 et 3 »).
//
//   1. 🧲 Prospects : la colonne « Commercial » pour TOUS ceux qui voient
//      toute l'équipe (pas seulement l'administrateur) ;
//   2. une liste « 👥 Commercial » qui filtre la liste ET les quatre chiffres ;
//   3. 👑 Mon équipe : l'ACTIVITÉ de la période, par personne.
//
// Rien n'est écrit : tout est RELU dans ce qui existe déjà (la fiche du
// prospect et ses contacts notés, les visites de 📅 Rendez-vous, les devis).
// Fichier PUR, SANS import. ⚠ LE MUR : ces fonctions reçoivent des listes
// DÉJÀ filtrées par l'espace regardé — jamais `db` en entier.
// ============================================================

const texte = (v) => String(v == null ? "" : v).trim();

// Les noms qui portent au moins un prospect, par ordre alphabétique français.
export const commerciauxDesProspects = (prospects) =>
  [...new Set((prospects || []).map((p) => texte(p && p.commercial)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));

// Les prospects d'UN commercial ; sans nom choisi, toute la liste.
export const prospectsDuCommercial = (prospects, nom) =>
  (texte(nom) ? (prospects || []).filter((p) => texte(p && p.commercial) === texte(nom)) : (prospects || []));

export const prospectActif = (p) => !!p && !p.converti && !p.archive;
// LA règle de « 🔔 À relancer » de l'écran : la date de relance est arrivée.
export const prospectARelancer = (p, aujourdhui) => prospectActif(p) && !!p.relance && p.relance <= aujourdhui;

const dansLaPeriode = (date, debut, fin) => !!date && String(date).slice(0, 10) >= debut && String(date).slice(0, 10) <= fin;
const estDe = (ligne, personne) => (ligne && ligne.par_id ? ligne.par_id === personne.id : texte(ligne && ligne.par) === texte(personne.nom));

// L'activité d'UNE personne. `devis` = les devis de l'espace, à plat ;
// `rendezVous` = ceux que l'écran a le droit de voir ; `estDormant` = LA
// règle des dormants (calculs.js), passée par l'écran.
export function activiteProspection({ personne, prospects, rendezVous, devis, debut, fin, aujourdhui, estDormant }) {
  const siens = prospectsDuCommercial(prospects, personne.nom);
  const actifs = siens.filter(prospectActif);
  return {
    personne,
    // Sur la période :
    enregistres: siens.filter((p) => dansLaPeriode(p.date, debut, fin)).length,
    contacts: siens.reduce((n, p) => n + (p.contacts || []).filter((c) => c && texte(c.par) === texte(personne.nom) && dansLaPeriode(c.date, debut, fin)).length, 0),
    visites: (rendezVous || []).filter((r) => r && r.visite && r.statut === "fait" && dansLaPeriode(r.date, debut, fin)
      && (r.participants || []).includes(personne.id)).length,
    devis: (devis || []).filter((d) => d && estDe(d, personne) && dansLaPeriode(d.date, debut, fin)).length,
    acquis: siens.filter((p) => p.converti && dansLaPeriode(p.date_conversion, debut, fin)).length,
    // Aujourd'hui, quelle que soit la période (ce sont des alertes) :
    actifs: actifs.length,
    aRelancer: actifs.filter((p) => prospectARelancer(p, aujourdhui)).length,
    dormants: estDormant ? siens.filter(estDormant).length : 0,
  };
}

const ROLES_PROSPECTION = ["commercial", "resp_commercial"];
const aQuelqueChose = (a) => a.enregistres + a.contacts + a.visites + a.devis + a.acquis + a.actifs > 0;

// Le tableau de 👑 Mon équipe : les commerciaux, plus toute autre personne
// qui a un prospect ou une activité de prospection. Du plus actif au moins
// actif sur la période (prospects enregistrés, puis contacts, puis le nom).
export function activitesDeLEquipe({ personnes, ...reste }) {
  return (personnes || [])
    .filter((u) => u && u.actif !== false && u.role !== "client")
    .map((u) => activiteProspection({ personne: u, ...reste }))
    .filter((a) => ROLES_PROSPECTION.includes(a.personne.role) || aQuelqueChose(a))
    .sort((a, b) => (b.enregistres - a.enregistres) || (b.contacts - a.contacts)
      || texte(a.personne.nom).localeCompare(texte(b.personne.nom), "fr", { sensitivity: "base" }));
}
