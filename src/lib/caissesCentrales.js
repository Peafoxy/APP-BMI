// ============================================================
// lib/caissesCentrales.js — LES CAISSES « CHEZ LE DG », « BANQUE », « CHEZ LE COMPTABLE »
//
// Timo (12/09/2026) : « les dépenses de chez le DG et du comptable sont
// déduites d'où alors ? » — le comptable avait sa caisse, le DG et la banque
// n'en avaient pas : l'argent versé chez le DG disparaissait du suivi, et une
// dépense « payée avec de l'argent remis par le DG » ne diminuait aucun
// solde. Décision : « DG et banque sur le même modèle que le comptable ».
//
// Puis (même jour) : « ramener cet onglet DG/banque dans le tableau de bord,
// comme "Chez le comptable" s'y retrouve », et enfin « séparer chacun… avoir
// les onglets DG, BANQUE et COMPTABLE ». Donc : PAS d'onglet à part, TROIS
// pastilles du tableau de bord, trois caisses lues pareil.
//
// UNE règle, pure (le banc l'exerce). Rien n'est écrit : les trois caisses se
// LISENT dans ce qui existe déjà.
//   • Chez le DG — entrées : les versements « Chez le DG » VALIDÉS par le DG ;
//     sorties : les dépenses payées « avec de l'argent remis par le DG » qui
//     comptent (validées, ou sous le seuil), et les avances de frais que le
//     DG a remboursées lui-même.
//   • BANQUE — entrées : les versements « BANQUE » VALIDÉS (banque, bordereau) ;
//     sorties : les dépenses payées par virement bancaire qui comptent
//     (salaires virés, fournisseurs, CNSS…).
//   • Chez le comptable — entrées : les versements « Chez le comptable » que le
//     comptable a pointés « Encaissé » (l'entrée miroir, montant négatif) ;
//     sorties : les sorties de sa caisse qu'il a pointées « Remis ». Ce qui
//     n'est pas encore pointé est dit à part (à encaisser, à remettre).
// Les dépenses restent des CHARGES de la boutique qui les a faites : rien ne
// change pour le résultat, on suit seulement d'où l'argent est parti.
// Cloisonnement : on ne lit que les boutiques données (l'espace regardé).
// ============================================================
import { DEST_DG, DEST_BANQUE, DEST_COMPTABLE, estVersement, estRejete, libelleDestination } from "./versements";
import { dFR } from "./core";
import { PAYE_AVEC_DG, MOYEN_REMB_DG, estEnAttente, estRejetee, payeAvecCaisse } from "./validationDepenses";

export const CAISSE_DG = DEST_DG;
export const CAISSE_BANQUE = DEST_BANQUE;
export const CAISSE_COMPTABLE = DEST_COMPTABLE;
// Le libellé d'une pastille du tableau de bord : « DG », « BANQUE »,
// « COMPTABLE » pour les trois caisses (Timo), TERRAIN avec sa tente, une
// boutique par son nom.
export const libellePastille = (nom, nomTerrain) => (nom === CAISSE_DG ? "👤 DG" : nom === CAISSE_BANQUE ? "🏦 BANQUE" : nom === CAISSE_COMPTABLE ? "🧾 COMPTABLE" : nom === nomTerrain ? `🏕 ${nom}` : nom);

const parDateDesc = (a, b) => `${b.date} ${b.heure || ""}`.localeCompare(`${a.date} ${a.heure || ""}`);
const compte = (d) => !estEnAttente(d) && !estRejetee(d) && Number(d.montant || 0) > 0;

// Les versements validés vers une destination, depuis les boutiques données.
const entreesVersements = (db, destination, nomsBoutiques) => (db.depenses || [])
  .filter((d) => estVersement(d) && d.versement.destination === destination && !!d.versement_valide_le && !estRejete(d) && nomsBoutiques.includes(d.boutique))
  .map((d) => ({ id: d.id, sens: "entree", date: d.versement_valide_le, montant: Number(d.montant || 0), boutique: d.boutique, par: d.par,
    libelle: `Versement de ${d.boutique} (par ${d.par}) — validé le ${dFR(d.versement_valide_le)}${destination === DEST_BANQUE ? ` · ${libelleDestination(d.versement)}` : ""}` }));

export function mouvementsDG(db, nomsBoutiques) {
  const entrees = entreesVersements(db, DEST_DG, nomsBoutiques);
  const sorties = (db.depenses || []).flatMap((d) => {
    if (!nomsBoutiques.includes(d.boutique)) return [];
    const lignes = [];
    if (d.paye_avec === PAYE_AVEC_DG && compte(d)) {
      lignes.push({ id: d.id, sens: "sortie", date: d.date, montant: Number(d.montant), boutique: d.boutique, par: d.par, libelle: `${d.categorie}${d.description ? ` — ${d.description}` : ""} (${d.boutique}, par ${d.par})` });
    }
    if (d.remboursement?.moyen === MOYEN_REMB_DG && compte(d)) {
      lignes.push({ id: `${d.id}-remb`, sens: "sortie", date: d.remboursement.le, montant: Number(d.montant), boutique: d.boutique, par: d.remboursement.par, libelle: `Avance de frais remboursée à ${d.par} — ${d.description || d.categorie} (${d.boutique})` });
    }
    return lignes;
  });
  return bilan(entrees, sorties);
}

export function mouvementsBanque(db, nomsBoutiques) {
  const entrees = entreesVersements(db, DEST_BANQUE, nomsBoutiques);
  const sorties = (db.depenses || [])
    .filter((d) => nomsBoutiques.includes(d.boutique) && d.paiement === "Virement bancaire" && payeAvecCaisse(d) && !estVersement(d) && compte(d))
    .map((d) => ({ id: d.id, sens: "sortie", date: d.date, montant: Number(d.montant), boutique: d.boutique, par: d.par, libelle: `${d.categorie}${d.description ? ` — ${d.description}` : ""} (${d.boutique}, par ${d.par})` }));
  return bilan(entrees, sorties);
}

// La caisse du comptable : ce qu'il a réellement encaissé, ce qu'il a
// réellement remis (ses pointages), et ce qui attend encore son pointage.
export function mouvementsComptable(db) {
  const lignes = (db.depenses || []).filter((d) => d.boutique === DEST_COMPTABLE && !estRejete(d));
  const entrees = lignes.filter((d) => Number(d.montant || 0) < 0 && d.decaisse_le)
    .map((d) => ({ id: d.id, sens: "entree", date: d.decaisse_le, montant: -Number(d.montant), boutique: DEST_COMPTABLE, par: d.decaisse_par, libelle: `${d.description || "Versement reçu"} — encaissé le ${dFR(d.decaisse_le)} par ${d.decaisse_par}` }));
  const sorties = lignes.filter((d) => Number(d.montant || 0) > 0 && d.decaisse_le)
    .map((d) => ({ id: d.id, sens: "sortie", date: d.decaisse_le, montant: Number(d.montant), boutique: DEST_COMPTABLE, par: d.decaisse_par, libelle: `${d.description || d.categorie} — remis le ${dFR(d.decaisse_le)} par ${d.decaisse_par}` }));
  const aEncaisser = lignes.filter((d) => Number(d.montant || 0) < 0 && !d.decaisse_le).reduce((s, d) => s - Number(d.montant), 0);
  const aRemettre = lignes.filter((d) => Number(d.montant || 0) > 0 && !d.decaisse_le).reduce((s, d) => s + Number(d.montant), 0);
  return { ...bilan(entrees, sorties), aEncaisser, aRemettre };
}

// ---- LE RELEVÉ (Timo, 12/09/2026 : « Relevé… lance ») ----
// Comme le relevé de la banque : ce qu'il y avait au début de la période
// (tout ce qui s'est passé AVANT), ce qui est entré et sorti PENDANT, ce
// qu'il reste à la fin. `du` et `au` sont des dates AAAA-MM-JJ incluses.
// Pur : le banc l'exerce.
export function releve(bilan, du, au) {
  const d0 = String(du || "0000-01-01"), d1 = String(au || "9999-12-31");
  const avant = (m) => String(m.date) < d0;
  const dedans = (m) => String(m.date) >= d0 && String(m.date) <= d1;
  const somme = (liste) => liste.reduce((s, m) => s + m.montant, 0);
  const soldeDebut = somme(bilan.entrees.filter(avant)) - somme(bilan.sorties.filter(avant));
  const entrees = somme(bilan.entrees.filter(dedans));
  const sorties = somme(bilan.sorties.filter(dedans));
  return { du: d0, au: d1, soldeDebut, entrees, sorties, soldeFin: soldeDebut + entrees - sorties, mouvements: bilan.mouvements.filter(dedans) };
}

function bilan(entrees, sorties) {
  const totalEntrees = entrees.reduce((s, m) => s + m.montant, 0);
  const totalSorties = sorties.reduce((s, m) => s + m.montant, 0);
  return { entrees, sorties, totalEntrees, totalSorties, solde: totalEntrees - totalSorties, mouvements: [...entrees, ...sorties].sort(parDateDesc) };
}
