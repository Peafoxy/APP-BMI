// ============================================================
// lib/caissesDG.js — LES CAISSES « CHEZ LE DG » ET « BANQUE »
//
// Timo (12/09/2026) : « les dépenses de chez le DG et du comptable sont
// déduites d'où alors ? » — le comptable avait sa caisse, le DG et la banque
// n'en avaient pas : l'argent versé chez le DG disparaissait du suivi, et une
// dépense « payée avec de l'argent remis par le DG » ne diminuait aucun
// solde. Décision : « DG et banque sur le même modèle que le comptable ».
//
// UNE règle, pure (le banc l'exerce). Rien n'est écrit : les deux caisses se
// LISENT dans ce qui existe déjà.
//   • Chez le DG — entrées : les versements « Chez le DG » VALIDÉS par le DG ;
//     sorties : les dépenses payées « avec de l'argent remis par le DG » qui
//     comptent (validées, ou sous le seuil), et les avances de frais que le
//     DG a remboursées lui-même.
//   • BANQUE — entrées : les versements « BANQUE » VALIDÉS (banque, bordereau) ;
//     sorties : les dépenses payées par virement bancaire qui comptent
//     (salaires virés, fournisseurs, CNSS…).
// Les dépenses restent des CHARGES de la boutique qui les a faites : rien ne
// change pour le résultat, on suit seulement d'où l'argent est parti.
// Cloisonnement : on ne lit que les boutiques données (l'espace regardé).
// ============================================================
import { DEST_DG, DEST_BANQUE, estVersement, estRejete, libelleDestination } from "./versements";
import { PAYE_AVEC_DG, MOYEN_REMB_DG, estEnAttente, estRejetee, payeAvecCaisse } from "./validationDepenses";

export const CAISSE_DG = DEST_DG;
export const CAISSE_BANQUE = DEST_BANQUE;

const parDateDesc = (a, b) => `${b.date} ${b.heure || ""}`.localeCompare(`${a.date} ${a.heure || ""}`);
const compte = (d) => !estEnAttente(d) && !estRejetee(d) && Number(d.montant || 0) > 0;

// Les versements validés vers une destination, depuis les boutiques données.
const entreesVersements = (db, destination, nomsBoutiques) => (db.depenses || [])
  .filter((d) => estVersement(d) && d.versement.destination === destination && !!d.versement_valide_le && !estRejete(d) && nomsBoutiques.includes(d.boutique))
  .map((d) => ({ id: d.id, sens: "entree", date: d.versement_valide_le, montant: Number(d.montant || 0), boutique: d.boutique, par: d.par,
    libelle: `Versement de ${d.boutique} (par ${d.par}) — validé le ${d.versement_valide_le}${destination === DEST_BANQUE ? ` · ${libelleDestination(d.versement)}` : ""}` }));

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

function bilan(entrees, sorties) {
  const totalEntrees = entrees.reduce((s, m) => s + m.montant, 0);
  const totalSorties = sorties.reduce((s, m) => s + m.montant, 0);
  return { entrees, sorties, totalEntrees, totalSorties, solde: totalEntrees - totalSorties, mouvements: [...entrees, ...sorties].sort(parDateDesc) };
}
