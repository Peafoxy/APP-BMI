// ============================================================
// lib/cloture.js — LA CLÔTURE DE CAISSE, ET LE BLOCAGE DES VENTES
//
// Décision Timo (09/09/2026) : « Un blocage est mieux… s'il y a des ventes
// un jour et la caisse n'a pas été clôturée, le lendemain, impossible de
// vendre tant que la caisse de la veille n'a pas été clôturée. »
//
// Règles PURES (le banc les exerce) :
//   • activiteDuJour : les chiffres d'une journée de caisse (fonds d'hier
//     soir, recette du jour, sorties justifiées, montant attendu dans le
//     tiroir) — LA règle que l'écran Caisse affiche, pour n'importe quel jour ;
//   • alerteSaisieRecette : le rappel quand on saisit la recette du jour à
//     la place du contenu du tiroir (écart 1 400, capture Timo 09/09/2026) ;
//   • joursAClôturer : les jours PASSÉS avec activité (une vente, ou un
//     encaissement en espèces) et sans clôture, depuis le début de la règle ;
//   • motifBlocageVente : le message qui interdit d'encaisser tant qu'il en
//     reste un.
// La règle ne regarde pas en arrière avant DEBUT_REGLE_CLOTURE : les jours
// d'avant la mise en place ne bloquent personne.
// ============================================================

import { CATEGORIE_VERSEMENT } from "./versements";

export const DEBUT_REGLE_CLOTURE = "2026-09-09";

// Le SOLDE d'espèces en caisse à la fin d'une journée : tout ce qui est
// entré en espèces jusqu'à ce jour inclus, moins tout ce qui est sorti
// (dépenses et versements). C'est ce que le vendeur doit trouver dans le
// tiroir en clôturant — pas le seul flux de la journée.
// ⚠ Capture Timo (09/09/2026) : « Espèces attendues −150 900 » — le
// versement de 202 299 comptait comme une dépense du jour, contre 51 400 de
// ventes ; il restait en réalité 50 000 en caisse.
export function soldeEspecesFinDeJour(db, boutique, date, totalVente) {
  const d0 = String(date);
  const entrees = (db.ventes || []).filter((v) => v.boutique === boutique && v.paiement === "Espèces" && String(v.date) <= d0)
    .reduce((s, v) => s + totalVente(v) + Number(v.frais_installation || 0) + Number(v.frais_transport || 0), 0)
    + (db.dettes || []).filter((d) => d.boutique === boutique)
      .reduce((s, d) => s + (d.paiements || []).filter((p) => (p.paiement || "Espèces") === "Espèces" && String(p.date) <= d0).reduce((t, p) => t + Number(p.montant || 0), 0), 0);
  const sorties = (db.depenses || []).filter((x) => x.boutique === boutique && x.paiement === "Espèces" && String(x.date) <= d0)
    .reduce((s, x) => s + Number(x.montant || 0), 0);
  return entrees - sorties;
}

// Les chiffres de caisse d'une journée, pour une boutique.
export function activiteDuJour(db, boutique, date, totalVente) {
  const d0 = String(date);
  const ventesDuJour = (db.ventes || []).filter((v) => v.boutique === boutique && String(v.date) === d0);
  const especesVentes = ventesDuJour.filter((v) => v.paiement === "Espèces")
    .reduce((s, v) => s + totalVente(v) + Number(v.frais_installation || 0) + Number(v.frais_transport || 0), 0);
  const sortiesDuJour = (db.depenses || []).filter((x) => x.boutique === boutique && String(x.date) === d0 && x.paiement === "Espèces");
  // Les versements de fonds sont montrés À PART des dépenses.
  const versementsDuJour = sortiesDuJour.filter((x) => x.categorie === CATEGORIE_VERSEMENT).reduce((s, x) => s + Number(x.montant || 0), 0);
  const especesDepenses = sortiesDuJour.filter((x) => x.categorie !== CATEGORIE_VERSEMENT).reduce((s, x) => s + Number(x.montant || 0), 0);
  const detailReglements = (db.dettes || []).filter((d) => d.boutique === boutique)
    .flatMap((d) => (d.paiements || [])
      .filter((p) => String(p.date) === d0)
      .map((p) => ({ ...p, client: d.client, motif: d.motif, numero: d.numero, detteId: d.id })))
    .sort((a, b) => (a.heure || "").localeCompare(b.heure || ""));
  const especesReglements = detailReglements.filter((p) => (p.paiement || "Espèces") === "Espèces").reduce((s, p) => s + Number(p.montant || 0), 0);
  // Timo (09/09/2026) : « Clôture de caisse, c'est journalier : recette du
  // jour théorique contre montant du tiroir » et « une dépense n'est pas un
  // manque… il ne devrait pas y avoir d'écart ». Donc la journée se lit en
  // quatre lignes : ce qu'il y avait hier soir + la recette du jour − les
  // sorties justifiées (dépenses, versements : déjà déduites, elles ne
  // créent JAMAIS d'écart) = ce que le tiroir doit contenir.
  const recetteDuJour = especesVentes + especesReglements;
  const sortiesJustifiees = especesDepenses + versementsDuJour;
  const fluxDuJour = recetteDuJour - sortiesJustifiees;
  const theorique = soldeEspecesFinDeJour(db, boutique, d0, totalVente);
  return {
    date: d0,
    nbVentes: ventesDuJour.length,
    especesVentes, especesReglements, especesDepenses, versementsDuJour, detailReglements,
    recetteDuJour, sortiesJustifiees,
    // Le flux de la journée, pour information…
    fluxDuJour,
    // …le fonds de caisse d'hier soir (le solde avant la journée)…
    fondsHier: theorique - fluxDuJour,
    // …et ce qu'on doit TROUVER dans le tiroir : le solde en caisse ce soir-là.
    theorique,
    // Une journée « active » demande une clôture : au moins une vente, ou un
    // encaissement en espèces.
    active: ventesDuJour.length > 0 || especesReglements > 0,
  };
}

// Le piège vu sur la capture de Timo (09/09/2026, écart 1 400) : il avait
// saisi la RECETTE du jour (51 400) à la place du contenu du tiroir
// (50 000). Quand le montant saisi est exactement la recette du jour alors
// que le tiroir doit contenir autre chose, on le dit — avant la clôture.
export function alerteSaisieRecette(compte, jour, fmt = (x) => String(x)) {
  if (compte === "" || compte === null || compte === undefined) return "";
  const c = Number(compte);
  if (!Number.isFinite(c) || jour.recetteDuJour !== c || jour.theorique === c) return "";
  return `⚠ ${fmt(c)} est la recette du jour, pas le contenu du tiroir. Le tiroir doit contenir le fonds d'hier soir (${fmt(jour.fondsHier)}) + la recette (${fmt(jour.recetteDuJour)}) − les sorties du jour (${fmt(jour.sortiesJustifiees)}) = ${fmt(jour.theorique)}. Comptez ce qu'il y a réellement dans le tiroir.`;
}

export const estCloturee = (db, boutique, date) => (db.clotures || []).some((c) => c.boutique === boutique && String(c.date) === String(date));

// Les jours PASSÉS (avant `aujourdhui`), actifs, sans clôture, du plus ancien
// au plus récent — depuis DEBUT_REGLE_CLOTURE.
export function joursAClôturer(db, boutique, aujourdhui, totalVente) {
  const jours = new Set();
  (db.ventes || []).forEach((v) => { if (v.boutique === boutique) jours.add(String(v.date)); });
  (db.dettes || []).forEach((d) => { if (d.boutique === boutique) (d.paiements || []).forEach((p) => { if ((p.paiement || "Espèces") === "Espèces") jours.add(String(p.date)); }); });
  return [...jours]
    .filter((j) => j >= DEBUT_REGLE_CLOTURE && j < String(aujourdhui) && !estCloturee(db, boutique, j))
    .filter((j) => activiteDuJour(db, boutique, j, totalVente).active)
    .sort();
}

// "" si l'on peut vendre ; sinon le message qui explique le blocage.
export function motifBlocageVente(db, boutique, aujourdhui, totalVente, dFR = (x) => x) {
  const jours = joursAClôturer(db, boutique, aujourdhui, totalVente);
  if (!jours.length) return "";
  const liste = jours.map(dFR).join(", ");
  return jours.length === 1
    ? `🔒 Vente impossible : la caisse de ${boutique} du ${liste} n'a pas été clôturée. Clôturez-la dans 🔒 Caisse, puis revenez vendre.`
    : `🔒 Vente impossible : la caisse de ${boutique} n'a pas été clôturée les ${liste}. Clôturez chaque jour dans 🔒 Caisse, puis revenez vendre.`;
}
