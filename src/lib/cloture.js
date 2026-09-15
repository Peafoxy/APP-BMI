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

import { CATEGORIE_VERSEMENT, estFondsCaisseRemis, deuxPoches, etatFondsCaisse } from "./versements.js";
// Timo (12/09/2026) : une dépense en attente de validation ne compte pas dans
// le tiroir ; une avance personnelle ou l'argent du DG n'en sortent jamais.
import { compteDansLaCaisse } from "./validationDepenses.js";

export const DEBUT_REGLE_CLOTURE = "2026-09-09";

// Le SOLDE d'espèces en caisse à la fin d'une journée : tout ce qui est
// entré en espèces jusqu'à ce jour inclus, moins tout ce qui est sorti
// (dépenses et versements). C'est ce que le vendeur doit trouver dans le
// tiroir en clôturant — pas le seul flux de la journée.
// ⚠ Capture Timo (09/09/2026) : « Espèces attendues −150 900 » — le
// versement de 202 299 comptait comme une dépense du jour, contre 51 400 de
// ventes ; il restait en réalité 50 000 en caisse.
// La veille d'un jour, pour lire le tiroir tel qu'il était hier soir.
const veilleDe = (d) => {
  const t = new Date(`${String(d).slice(0, 10)}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
};

// Ce qu'il doit y avoir dans le TIROIR à la fin d'une journée.
// ⚠ Timo (15/09/2026, réponse B) : le fonds de caisse est gardé À PART, dans
// une enveloppe — il n'est PAS dans le tiroir et n'entre dans aucun total de
// caisse. Le tiroir, c'est la RECETTE : ventes et règlements en espèces,
// moins ce qu'elle a payé et ce qui a été versé (lib/versements.js,
// `deuxPoches`). Avant, le fonds y était compté : la clôture du 14/09 à
// DEMAKPOE attendait 50 000 F de trop.
export const soldeEspecesFinDeJour = (db, boutique, date, totalVente) =>
  deuxPoches(db, boutique, totalVente, { du: "", au: String(date).slice(0, 10) }).recette;

// Les chiffres de caisse d'une journée, pour une boutique.
export function activiteDuJour(db, boutique, date, totalVente) {
  const d0 = String(date).slice(0, 10);
  const ventesDuJour = (db.ventes || []).filter((v) => v.boutique === boutique && String(v.date).slice(0, 10) === d0);
  // Les deux poches : ce qui s'est passé CE JOUR, et où en est le tiroir ce
  // soir-là et la veille au soir.
  const jour = deuxPoches(db, boutique, totalVente, { du: d0, au: d0 });
  const finDuJour = deuxPoches(db, boutique, totalVente, { du: "", au: d0 });
  const theorique = finDuJour.recette;
  const fondsHier = deuxPoches(db, boutique, totalVente, { du: "", au: veilleDe(d0) }).recette;
  const especesVentes = jour.detail.ventes;
  const especesReglements = jour.detail.reglements;
  // Les dépenses du jour : ce que le TIROIR a payé, et ce qu'on a dû prendre
  // dans l'enveloppe parce que le tiroir ne suffisait pas (« que si pas de
  // vente et il faut une dépense »). Seule la première touche la clôture.
  const especesDepenses = jour.detail.surRecette;
  const depensesSurFonds = jour.detail.surFonds;
  const versementsDuJour = jour.detail.versements;
  // Le fonds remis par le DG ce jour-là va dans l'ENVELOPPE, jamais dans le
  // tiroir : il est dit à part, il n'entre dans aucun calcul de clôture.
  const fondsRemisDuJour = jour.detail.remises;
  // Ce que les recettes du jour ont RENDU à l'enveloppe entamée (« fonds de
  // caisse entamé, les ventes viennent rembourser ») : cet argent est sorti
  // du tiroir pour retourner dans l'enveloppe.
  const rembourseAuFonds = jour.detail.rendu;
  const detailReglements = (db.dettes || []).filter((d) => d.boutique === boutique)
    .flatMap((d) => (d.paiements || [])
      .filter((p) => String(p.date).slice(0, 10) === d0)
      .map((p) => ({ ...p, client: d.client, motif: d.motif, numero: d.numero, detteId: d.id })))
    .sort((a, b) => (a.heure || "").localeCompare(b.heure || ""));
  // Timo (11/09/2026) : « que ce soit l'admin, le gérant ou le vendeur qui a
  // vendu, c'est la même caisse » — UNE clôture, mais la recette du jour se
  // lit aussi PAR PERSONNE : ventes (tout moyen), espèces encaissées (ventes
  // + règlements de dettes), autres moyens. Du plus gros encaisseur au plus petit.
  const parPersonne = {};
  const ligneDe = (nom) => (parPersonne[nom] ||= { nom, nbVentes: 0, especes: 0, autresMoyens: 0, encaissements: 0 });
  ventesDuJour.forEach((v) => {
    const l = ligneDe(v.par || "?");
    const montant = totalVente(v) + Number(v.frais_installation || 0) + Number(v.frais_transport || 0);
    l.nbVentes += 1;
    if (v.paiement === "Espèces") l.especes += montant; else l.autresMoyens += montant;
  });
  detailReglements.forEach((p) => {
    const l = ligneDe(p.par || "?");
    if ((p.paiement || "Espèces") === "Espèces") { l.especes += Number(p.montant || 0); l.encaissements += Number(p.montant || 0); }
    else l.autresMoyens += Number(p.montant || 0);
  });
  const recetteParPersonne = Object.values(parPersonne).sort((a, b) => b.especes - a.especes || b.nbVentes - a.nbVentes || a.nom.localeCompare(b.nom));
  // Timo (09/09/2026) : « Clôture de caisse, c'est journalier : recette du
  // jour théorique contre montant du tiroir » et « une dépense n'est pas un
  // manque… il ne devrait pas y avoir d'écart ». La journée se lit donc :
  // ce qu'il y avait hier soir dans le tiroir + la recette du jour − ce qui
  // en est sorti (dépenses payées par le tiroir, versements, et ce qui est
  // retourné dans l'enveloppe) = ce que le tiroir doit contenir.
  const recetteDuJour = especesVentes + especesReglements;
  const sortiesJustifiees = especesDepenses + versementsDuJour;
  const fluxDuJour = recetteDuJour - rembourseAuFonds - sortiesJustifiees;
  // L'état de l'enveloppe ce soir-là, montré À PART.
  const etatFonds = etatFondsCaisse(finDuJour.fonds, finDuJour.plafond);
  return {
    date: d0,
    nbVentes: ventesDuJour.length,
    especesVentes, especesReglements, especesDepenses, versementsDuJour, fondsRemisDuJour, depensesSurFonds, rembourseAuFonds, detailReglements,
    recetteDuJour, sortiesJustifiees, recetteParPersonne,
    // L'enveloppe (jamais additionnée au tiroir).
    fondsPlafond: finDuJour.plafond, fondsReste: etatFonds.reste, fondsEntame: etatFonds.entame, fondsIntact: etatFonds.intact,
    // Le flux de la journée, pour information…
    fluxDuJour,
    // …ce qu'il y avait dans le tiroir hier soir…
    fondsHier,
    // …et ce qu'on doit TROUVER dans le tiroir : la recette, ce soir-là.
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
  return `⚠ ${fmt(c)} est la recette du jour, pas le contenu du tiroir. Le tiroir doit contenir le fonds d'hier soir (${fmt(jour.fondsHier)}) + la recette (${fmt(jour.recetteDuJour)})${jour.rembourseAuFonds > 0 ? ` − ce qui est retourné dans le fonds de caisse (${fmt(jour.rembourseAuFonds)})` : ""} − les sorties du jour (${fmt(jour.sortiesJustifiees)}) = ${fmt(jour.theorique)}. Comptez ce qu'il y a réellement dans le tiroir.`;
}

export const estCloturee = (db, boutique, date) => (db.clotures || []).some((c) => c.boutique === boutique && String(c.date) === String(date));
// La clôture d'un jour, la plus récente si le jour a été reclôturé.
export const clotureDe = (db, boutique, date) => (db.clotures || [])
  .filter((c) => c.boutique === boutique && String(c.date) === String(date))
  .sort((a, b) => String(b.cloture_le || "").localeCompare(String(a.cloture_le || "")))[0] || null;

// ⚠ Trouvé avec Timo le 11/09/2026, en remontant un « 880 000 » qu'il ne
// comprenait pas : la clôture du 10/09 disait 410 000, alors que le tiroir
// contenait 635 000. Une vente de 225 000 avait été encaissée à 17h10, APRÈS
// la clôture faite plus tôt dans l'après-midi. L'écart affiché était 0 : tout
// semblait réglé, et personne ne pouvait le savoir.
//
// Le SOLDE, lui, reste juste (le fonds d'hier soir est recalculé, jamais lu
// dans la clôture). C'est la CLÔTURE qui devient une photo périmée.
//
// Décision Timo (option « b ») : on ne bloque PAS la vente — refuser un client
// à 17h10 parce que la caisse a été fermée à 16h serait pire. On DIT la
// vérité : la clôture est signalée dépassée, avec le montant recalculé, et se
// reclôture après recomptage.
export function clotureDepassee(db, boutique, date, totalVente) {
  const c = clotureDe(db, boutique, date);
  if (!c) return null;
  const attenduMaintenant = activiteDuJour(db, boutique, date, totalVente).theorique;
  const bouge = Math.round(attenduMaintenant) - Math.round(Number(c.theorique || 0));
  if (bouge === 0) return null;
  return {
    cloture: c, date: String(date),
    attenduALaCloture: Number(c.theorique || 0),
    attenduMaintenant,
    compte: Number(c.compte || 0),
    bouge,
    ecartMaintenant: Number(c.compte || 0) - attenduMaintenant,
  };
}

// Toutes les journées clôturées dont la caisse a bougé ensuite, de la plus
// récente à la plus ancienne. On ne remonte pas avant DEBUT_REGLE_CLOTURE.
export function cloturesDepassees(db, boutique, totalVente) {
  const jours = [...new Set((db.clotures || [])
    .filter((c) => c.boutique === boutique && String(c.date) >= DEBUT_REGLE_CLOTURE)
    .map((c) => String(c.date)))];
  return jours.map((j) => clotureDepassee(db, boutique, j, totalVente)).filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// Le message montré au vendeur, dans SES mots.
export function messageClotureDepassee(d, fmt = (x) => String(x), dFR = (x) => x) {
  if (!d) return "";
  return `⚠ La caisse du ${dFR(d.date)} a bougé APRÈS la clôture : ${d.bouge > 0 ? "+" : ""}${fmt(d.bouge)}. `
    + `À la clôture, on attendait ${fmt(d.attenduALaCloture)} et ${d.cloture.par || "le vendeur"} a compté ${fmt(d.compte)}. `
    + `Aujourd'hui le tiroir devrait contenir ${fmt(d.attenduMaintenant)} pour ce jour-là — écart ${fmt(d.ecartMaintenant)}. `
    + `Recomptez et reclôturez cette journée.`;
}

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
