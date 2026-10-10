// ============================================================
// lib/inventaireVentes.js — 📋 L'INVENTAIRE DES VENTES D'UNE BOUTIQUE
//
// Timo (10/10/2026) : « un onglet d'inventaire de vente… les ventes (tout
// moyen de paiement), les dépenses (toutes catégories), les recettes, les
// versements de chaque période et la caisse actuelle, les dettes » → « A a,
// B a, C a, D a, lance » : gérant et administrateur, « Aujourd'hui » d'office,
// le comptage LU dans les clôtures (jamais un second comptage), PDF + export.
//
// ⚠ UNE LECTURE, RIEN D'ÉCRIT. Et AUCUN CALCUL À PART : chaque chiffre vient
// de la règle que l'écran voisin affiche déjà —
//   • ventes et recettes : `ventesParMoyen` (la clôture du jour) ;
//   • tiroir et enveloppe : `deuxPoches` / `fondsAVerser` (🔒 Caisse) ;
//   • comptes mobiles : `soldesMobiles` (les carrés 📱) ;
//   • comptage : `activiteDuJour` + `clotureDe` (la clôture du jour) ;
//   • dettes : la liste de 📋 Dettes (`boutiqueDuDocument`) et le retard de
//     30 jours (lib/rappels.js).
// Deux calculs pour le même argent finiraient par donner deux chiffres.
//
// ⚠ DEUX MOTS, DEUX CHOSES : « VENDU » (l'activité, crédit compris, dans la
// boutique qui a vendu) et « RECETTES » (l'argent ENTRÉ dans la caisse de la
// boutique : ventes payées + règlements de dettes). Une vente issue d'un devis
// est vendue ici mais son argent va dans la caisse 🏗 CHANTIER : elle est dans
// les ventes, jamais dans les recettes de la boutique (`caisseDeVente`).
//
// ⚠ Le mur : on reçoit le NOM de la boutique regardée (déjà dans l'espace
// regardé) et on ne regarde que ses lignes — jamais une table parcourue pour
// autre chose. Les noms de boutiques sont uniques dans les deux espaces.
// ============================================================

import { ventesParMoyen, activiteDuJour, clotureDe, DEBUT_REGLE_CLOTURE } from "./cloture.js";
import { deuxPoches, fondsAVerser, versementsDe, validationVersement, estRejete, libelleDestination, montantEncaisseVente, SOURCE_ESPECES } from "./versements.js";
import { soldesMobiles } from "./caissesMobiles.js";
import { caisseDeVente, boutiqueDuDocument, CATEGORIES_HORS_CHARGES, CATEGORIE_VERSEMENT, CATEGORIE_FONDS_CAISSE, PAIEMENTS } from "./constants.js";
import { estEnAttente, estRejetee, montantOrigine, sortDuTiroir } from "./validationDepenses.js";
import { detteEnRetard, resteDette, joursDeDette } from "./rappels.js";

export const ROLES_INVENTAIRE = ["gerant", "admin"];
export const peutVoirInventaire = (profile) => ROLES_INVENTAIRE.includes(profile?.role);

const jour = (x) => String(x || "").slice(0, 10);
const somme = (l, f = (x) => x) => (l || []).reduce((s, x) => s + Number(f(x) || 0), 0);
const rang = (moyen) => { const i = PAIEMENTS.indexOf(moyen); return i < 0 ? PAIEMENTS.length : i; };
const parMoyen = (a, b) => rang(a.moyen) - rang(b.moyen) || String(a.moyen).localeCompare(String(b.moyen));
const veilleDe = (j) => {
  const d = new Date(`${j}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};
const lendemainDe = (j) => {
  const d = new Date(`${j}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const estReservation = (d) => d?.type === "prepaye";
// Ce qui n'est ni une charge ni un mouvement de tiroir à part : les sorties
// d'argent « pas des charges » (remboursement d'un client, d'une avance, un
// prêt au personnel). Les versements et le fonds de caisse ont leur section.
const AUTRES_SORTIES = CATEGORIES_HORS_CHARGES.filter((c) => c !== CATEGORIE_VERSEMENT && c !== CATEGORIE_FONDS_CAISSE);

// La période : [du, au] (le filtre commun) ou null = toute période.
export function bornesInventaire(bornes) {
  return { du: bornes?.[0] || "0000-01-01", au: bornes?.[1] || "9999-12-31" };
}

// Les dépenses rangées par catégorie : { categorie, nb, montant }, du plus
// gros au plus petit.
function parCategorie(liste, montant = (d) => Number(d.montant || 0)) {
  const par = {};
  liste.forEach((d) => {
    const c = d.categorie || "Sans catégorie";
    const l = (par[c] ||= { categorie: c, nb: 0, montant: 0 });
    l.nb += 1;
    l.montant += montant(d);
  });
  return Object.values(par).sort((a, b) => b.montant - a.montant || a.categorie.localeCompare(b.categorie));
}

export function inventaireVentes(db, boutique, totalVente, bornes, aujourdhui) {
  const { du, au } = bornesInventaire(bornes);
  const dans = (x) => { const j = jour(x); return j >= du && j <= au; };
  const fin = au < aujourdhui ? au : aujourdhui;

  // ---- 1. LES VENTES de la période (vendues dans CETTE boutique) ----
  const toutesVentes = (db?.ventes || []).filter((v) => v.boutique === boutique);
  const ventes = toutesVentes.filter((v) => dans(v.date));
  const vm = ventesParMoyen(ventes, [], totalVente);
  const versChantier = ventes.filter((v) => caisseDeVente(v) !== boutique);
  // Les reprises FAITES pendant la période (une reprise peut toucher une vente
  // plus ancienne : elle compte le jour où l'article est revenu).
  const reprises = toutesVentes.flatMap((v) => (Array.isArray(v.reprises) ? v.reprises : [])
    .filter((r) => dans(r.date)).map((r) => ({ ...r, vente: v.numero })));
  const montantReprises = somme(reprises, (r) => r.montant);
  const sectionVentes = {
    nb: ventes.length,
    lignes: vm.lignes.map((l) => ({ moyen: l.moyen, nb: l.nbVentes, montant: l.vendu })),
    total: vm.totalVendu,
    reprises: { nb: reprises.length, montant: montantReprises, rendu: somme(reprises, (r) => r.rembourse) },
    net: vm.totalVendu - montantReprises,
    chantier: { nb: versChantier.length, montant: somme(versChantier, (v) => montantEncaisseVente(v, totalVente)) },
  };

  // ---- 2. LES RECETTES : l'argent ENTRÉ dans la caisse de la boutique ----
  const ventesCaisse = (db?.ventes || []).filter((v) => caisseDeVente(v) === boutique && dans(v.date));
  const reglements = (db?.dettes || []).filter((d) => d.boutique === boutique)
    .flatMap((d) => (d.paiements || []).filter((p) => dans(p.date)));
  const rv = ventesParMoyen(ventesCaisse, [], totalVente);
  const rr = ventesParMoyen([], reglements, totalVente);
  const moyens = {};
  const ligneR = (moyen) => (moyens[moyen] ||= { moyen, ventes: 0, reglements: 0, total: 0 });
  rv.lignes.forEach((l) => { if (l.encaisse) { const x = ligneR(l.moyen); x.ventes += l.encaisse; x.total += l.encaisse; } });
  rr.lignes.forEach((l) => { if (l.encaisse) { const x = ligneR(l.moyen); x.reglements += l.encaisse; x.total += l.encaisse; } });
  const lignesRecettes = Object.values(moyens).sort(parMoyen);
  const sectionRecettes = {
    lignes: lignesRecettes,
    ventes: somme(lignesRecettes, (l) => l.ventes),
    reglements: somme(lignesRecettes, (l) => l.reglements),
    total: somme(lignesRecettes, (l) => l.total),
    especes: lignesRecettes.find((l) => l.moyen === "Espèces")?.total || 0,
  };

  // ---- 3. LES DÉPENSES de la période, par catégorie ----
  const depensesBq = (db?.depenses || []).filter((d) => d.boutique === boutique && dans(d.date));
  const charges = depensesBq.filter((d) => !CATEGORIES_HORS_CHARGES.includes(d.categorie));
  const comptees = charges.filter((d) => !estEnAttente(d) && !estRejetee(d));
  const enAttente = charges.filter(estEnAttente);
  const rejetees = charges.filter(estRejetee);
  const autres = depensesBq.filter((d) => AUTRES_SORTIES.includes(d.categorie) && !estEnAttente(d) && !estRejetee(d) && Number(d.montant || 0) !== 0);
  const sectionDepenses = {
    lignes: parCategorie(comptees),
    total: somme(comptees, (d) => d.montant),
    nb: comptees.length,
    // Ce qui est sorti du TIROIR (espèces, payé avec la caisse ou le fonds) ;
    // le reste a été payé ailleurs (avance personnelle, DG, comptable, Flooz…).
    duTiroir: somme(comptees.filter(sortDuTiroir), (d) => d.montant),
    enAttente: { nb: enAttente.length, montant: somme(enAttente, (d) => d.montant), lignes: parCategorie(enAttente) },
    rejetees: { nb: rejetees.length, montant: somme(rejetees, montantOrigine) },
    autres: { lignes: parCategorie(autres), total: somme(autres, (d) => d.montant) },
  };

  // ---- 4. LES VERSEMENTS de la période ----
  const versements = versementsDe(db, boutique).filter((d) => dans(d.date))
    .map((d) => {
      const rejete = estRejete(d);
      const valide = !rejete && !!validationVersement(db, d);
      return {
        id: d.id, date: jour(d.date), heure: d.versement?.heure || d.heure || "",
        montant: rejete ? Number(d.versement?.montant || 0) : Number(d.montant || 0),
        destination: libelleDestination(d.versement),
        source: d.versement?.source || SOURCE_ESPECES,
        aPart: !!d.versement?.origine,
        etat: rejete ? "rejete" : (valide ? "valide" : "attente"),
        par: d.par || "",
      };
    })
    .sort((a, b) => `${a.date} ${a.heure}`.localeCompare(`${b.date} ${b.heure}`));
  const vivants = versements.filter((v) => v.etat !== "rejete");
  const sectionVersements = {
    lignes: versements,
    total: somme(vivants, (v) => v.montant),
    valide: somme(vivants.filter((v) => v.etat === "valide"), (v) => v.montant),
    enAttente: somme(vivants.filter((v) => v.etat === "attente"), (v) => v.montant),
    rejetes: versements.length - vivants.length,
  };

  // ---- 5. LA CAISSE ----
  // Maintenant, quelle que soit la période : le carré « Fonds à verser » et
  // les carrés 📱 de 🔒 Caisse, au franc près.
  const f = fondsAVerser(db, boutique, totalVente);
  const mobiles = soldesMobiles(db, boutique)
    .filter((m) => m.mouvements > 0 || m.numero)
    .map((m) => ({ libelle: m.court, numero: m.numero, solde: m.solde }));
  // Et le tiroir PENDANT la période : la veille au soir, ce qui est entré et
  // sorti en espèces, le soir du dernier jour. Mêmes chiffres que la clôture.
  const periodeTiroir = du <= fin ? deuxPoches(db, boutique, totalVente, { du, au: fin }) : null;
  const tiroirDebut = du > "0000-01-01" ? deuxPoches(db, boutique, totalVente, { du: "", au: veilleDe(du) }).recette : 0;
  const t = periodeTiroir?.detail || { ventes: 0, reglements: 0, retraits: 0, rendu: 0, surRecette: 0, versements: 0, surFonds: 0 };
  const sectionCaisse = {
    tiroir: f.montant,
    enveloppe: f.resteFonds,
    fondsPlafond: f.fondsPlafond,
    fondsEntame: f.fondsEntame,
    dernierVersement: f.dernierVersement,
    mobiles,
    periode: {
      debut: tiroirDebut,
      entrees: t.ventes + t.reglements + t.retraits,
      renduEnveloppe: t.rendu,
      depenses: t.surRecette,
      versements: t.versements,
      depensesSurEnveloppe: t.surFonds,
      fin: periodeTiroir ? periodeTiroir.recette : tiroirDebut,
      jusquau: fin,
    },
  };

  // ---- 6. LES DETTES (la liste de 📋 Dettes de la boutique) ----
  const dettesBq = (db?.dettes || []).filter((d) => d.boutique === boutique || boutiqueDuDocument(d) === boutique);
  const dettes = dettesBq.filter((d) => !estReservation(d));
  const reservations = dettesBq.filter(estReservation);
  const creees = dettes.filter((d) => dans(d.date));
  const reglementsDettes = dettes.flatMap((d) => (d.paiements || []).filter((p) => dans(p.date)));
  const nonSoldees = dettes.filter((d) => resteDette(d) > 0);
  const enRetard = nonSoldees.filter((d) => detteEnRetard(d, aujourdhui))
    .map((d) => ({ id: d.id, client: d.client || "", numero: d.numero || "", date: jour(d.date), jours: joursDeDette(d, aujourdhui), reste: resteDette(d) }))
    .sort((a, b) => b.jours - a.jours);
  const chantierDette = nonSoldees.filter((d) => d.boutique !== boutique);
  const resaEnCours = reservations.filter((d) => resteDette(d) > 0);
  const sectionDettes = {
    creees: { nb: creees.length, montant: somme(creees, (d) => d.montant) },
    reglees: { nb: reglementsDettes.length, montant: somme(reglementsDettes, (p) => p.montant) },
    reste: { nb: nonSoldees.length, montant: somme(nonSoldees, resteDette) },
    retard: { nb: enRetard.length, montant: somme(enRetard, (d) => d.reste), lignes: enRetard },
    chantier: { nb: chantierDette.length, montant: somme(chantierDette, resteDette) },
    reservations: { nb: resaEnCours.length, montant: somme(resaEnCours, resteDette) },
  };

  // ---- 7. LE COMPTAGE : ce qui a été COMPTÉ aux clôtures du jour ----
  // ⚠ Décision « C a » : on LIT les clôtures, on ne recompte rien ici.
  const debutComptage = du > DEBUT_REGLE_CLOTURE ? du : DEBUT_REGLE_CLOTURE;
  const joursCandidats = new Set();
  (db?.ventes || []).forEach((v) => { if (caisseDeVente(v) === boutique) joursCandidats.add(jour(v.date)); });
  (db?.dettes || []).forEach((d) => { if (d.boutique === boutique) (d.paiements || []).forEach((p) => joursCandidats.add(jour(p.date))); });
  (db?.clotures || []).forEach((c) => { if (c.boutique === boutique) joursCandidats.add(jour(c.date)); });
  const lignesComptage = [...joursCandidats]
    .filter((j) => j >= debutComptage && j <= fin)
    .sort()
    .map((j) => {
      const act = activiteDuJour(db, boutique, j, totalVente);
      const c = clotureDe(db, boutique, j);
      if (!c && !act.active) return null;
      const compte = c ? Number(c.compte || 0) : null;
      return {
        date: j,
        attendu: act.theorique,
        compte,
        // L'écart se mesure sur ce que le tiroir DEVAIT contenir ce soir-là
        // d'après tout ce qui est enregistré aujourd'hui (une vente saisie
        // après la clôture fait bouger l'attendu : la clôture est à refaire).
        ecart: c ? compte - act.theorique : null,
        attenduALaCloture: c ? Number(c.theorique || 0) : null,
        bouge: !!c && Math.round(Number(c.theorique || 0)) !== Math.round(act.theorique),
        par: c?.par || "",
        statut: c ? "cloture" : (j === aujourdhui ? "aujourdhui" : "non_cloture"),
      };
    })
    .filter(Boolean);
  const clotures = lignesComptage.filter((l) => l.statut === "cloture");
  const sectionComptage = {
    lignes: lignesComptage,
    nbClotures: clotures.length,
    totalEcarts: somme(clotures, (l) => l.ecart),
    joursAvecEcart: clotures.filter((l) => Math.round(l.ecart) !== 0).length,
    nonClotures: lignesComptage.filter((l) => l.statut === "non_cloture").map((l) => l.date),
    aBouge: clotures.filter((l) => l.bouge).map((l) => l.date),
    debut: debutComptage,
  };

  return { boutique, du, au, aujourdhui, ventes: sectionVentes, recettes: sectionRecettes, depenses: sectionDepenses, versements: sectionVersements, caisse: sectionCaisse, dettes: sectionDettes, comptage: sectionComptage };
}

export const LIBELLE_ETAT_VERSEMENT = { valide: "✅ validé", attente: "⏳ en attente", rejete: "✖ rejeté" };

// Les lignes du fichier exporté (CSV) : une rubrique par bloc, dans l'ordre
// de l'écran — Rubrique, Libellé, Nombre, Montant.
export function lignesCsvInventaire(inv, dFR = (x) => x) {
  const L = [];
  const r = (rubrique, libelle, nb, montant) => L.push([rubrique, libelle, nb === null || nb === undefined ? "" : nb, montant === null || montant === undefined ? "" : Math.round(montant)]);
  inv.ventes.lignes.forEach((l) => r("Ventes", l.moyen, l.nb, l.montant));
  r("Ventes", "Total vendu", inv.ventes.nb, inv.ventes.total);
  if (inv.ventes.reprises.nb) r("Ventes", "Reprises faites dans la période", inv.ventes.reprises.nb, -inv.ventes.reprises.montant);
  r("Ventes", "Net", null, inv.ventes.net);
  if (inv.ventes.chantier.nb) r("Ventes", "dont devis encaissés dans la caisse CHANTIER", inv.ventes.chantier.nb, inv.ventes.chantier.montant);
  inv.recettes.lignes.forEach((l) => r("Recettes", `${l.moyen} (ventes ${Math.round(l.ventes)} + règlements ${Math.round(l.reglements)})`, null, l.total));
  r("Recettes", "Total des recettes", null, inv.recettes.total);
  inv.depenses.lignes.forEach((l) => r("Dépenses", l.categorie, l.nb, l.montant));
  r("Dépenses", "Total des dépenses comptées", inv.depenses.nb, inv.depenses.total);
  if (inv.depenses.enAttente.nb) r("Dépenses", "En attente du DG (non comptées)", inv.depenses.enAttente.nb, inv.depenses.enAttente.montant);
  inv.depenses.autres.lignes.forEach((l) => r("Autres sorties (pas des charges)", l.categorie, l.nb, l.montant));
  inv.versements.lignes.forEach((v) => r("Versements", `${dFR(v.date)} ${v.heure} -> ${v.destination} (${v.etat === "valide" ? "validé" : v.etat === "attente" ? "en attente" : "rejeté"})`, null, v.montant));
  r("Versements", "Total versé (rejetés exclus)", null, inv.versements.total);
  r("Caisse actuelle", "Tiroir (fonds à verser)", null, inv.caisse.tiroir);
  if (inv.caisse.fondsPlafond) r("Caisse actuelle", "Enveloppe du fonds de caisse", null, inv.caisse.enveloppe);
  inv.caisse.mobiles.forEach((m) => r("Caisse actuelle", `Solde ${m.libelle}${m.numero ? ` (${m.numero})` : ""}`, null, m.solde));
  r("Tiroir pendant la période", "La veille au soir", null, inv.caisse.periode.debut);
  r("Tiroir pendant la période", "Entrées en espèces", null, inv.caisse.periode.entrees);
  if (inv.caisse.periode.renduEnveloppe) r("Tiroir pendant la période", "Rendu à l'enveloppe", null, -inv.caisse.periode.renduEnveloppe);
  r("Tiroir pendant la période", "Dépenses payées par le tiroir", null, -inv.caisse.periode.depenses);
  r("Tiroir pendant la période", "Versements", null, -inv.caisse.periode.versements);
  r("Tiroir pendant la période", `Le soir du ${dFR(inv.caisse.periode.jusquau)}`, null, inv.caisse.periode.fin);
  r("Dettes", "Créées dans la période", inv.dettes.creees.nb, inv.dettes.creees.montant);
  r("Dettes", "Règlements reçus dans la période", inv.dettes.reglees.nb, inv.dettes.reglees.montant);
  r("Dettes", "Reste total à recouvrer", inv.dettes.reste.nb, inv.dettes.reste.montant);
  r("Dettes", "En retard (plus de 30 jours)", inv.dettes.retard.nb, inv.dettes.retard.montant);
  if (inv.dettes.reservations.nb) r("Dettes", "Réservations en cours (reste)", inv.dettes.reservations.nb, inv.dettes.reservations.montant);
  inv.comptage.lignes.forEach((l) => r("Comptage", `${dFR(l.date)} — attendu ${Math.round(l.attendu)}${l.statut === "cloture" ? `, compté ${Math.round(l.compte)}` : (l.statut === "aujourdhui" ? ", pas encore clôturé" : ", NON CLÔTURÉ")}`, null, l.statut === "cloture" ? l.ecart : ""));
  r("Comptage", "Total des écarts", inv.comptage.nbClotures, inv.comptage.totalEcarts);
  return L;
}

// Le jour qui suit (pour le banc et l'écran : « du lendemain »).
export { lendemainDe };
