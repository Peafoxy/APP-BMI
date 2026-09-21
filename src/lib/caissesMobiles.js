// ============================================================
// lib/caissesMobiles.js — LE SOLDE DES COMPTES FLOOZ ET MIXX/T-MONEY
//
// Timo (21/09/2026), après avoir encaissé 160 000 F par Mixx et payé 40 000 F
// de commission au même moyen : « avec le moyen de paiement mix ou flooz, le
// fond à verser est 0 F… mais l'apporteur a pris son argent. Comment savoir
// que sur T-Money il reste 120 mil et non 160 mil… et que l'administrateur
// aussi, sans sortir sa calculatrice, ait tout sous ses yeux. »
//
// ⚠ C'ÉTAIT UN TROU, pas un réglage. L'application suivait QUATRE endroits où
// l'argent dort — le tiroir de chaque boutique (espèces seulement), Chez le
// DG, la BANQUE, Chez le comptable. Flooz et Mixx n'avaient RIEN : une vente
// encaissée par Mixx comptait dans la recette, le chiffre d'affaires et le
// résultat ; une dépense payée par Flooz comptait comme charge ; mais aucun
// écran ne donnait le SOLDE. Et « Fonds à verser » ne pourra jamais répondre :
// par construction il ne compte que les billets (`sortDuTiroir`).
//
// Décision « 1b » : CHAQUE BOUTIQUE A SON NUMÉRO. Le solde se lit donc
// boutique par boutique — on passe la LISTE des boutiques à regarder, jamais
// `db` en entier (une fonction pure qui reçoit une table entière et la
// PARCOURT est un passage de mur en puissance : leçon payée deux fois le
// 18/09). Les deux numéros vivent sur la fiche de la boutique
// (`numero_flooz`, `numero_mixx`), comme la liste des banques — rien à coller.
//
// UNE règle, pure, et RIEN N'EST ÉCRIT : le solde se LIT dans ce qui existe
// déjà, exactement comme les trois caisses centrales.
//   • ENTRE : les ventes et les règlements de dettes encaissés avec ce moyen.
//   • SORT  : les dépenses payées avec ce moyen, et les versements partis de
//     ce compte (Timo : « si on a des pastilles mix/flooz, le versement se
//     fera comment ? » — le même geste, avec une case « d'où part l'argent »).
//
// ⚠ CE QUE ÇA NE FAIT PAS, et il faut le dire : l'application ne parle ni à
// Flooz ni à Moov. Le solde affiché découle des SAISIES, pas du solde lu sur
// le téléphone. S'ils diffèrent, c'est qu'un mouvement n'a pas été saisi —
// exactement comme l'écart de la clôture pour les billets.
// ============================================================
import { MOYENS_MOBILES, mobileParMoyen } from "./constants.js";
import { estVersement, estRejete, libelleDestination, DEST_TIROIR } from "./versements.js";
import { estEnAttente, estRejetee, payeAvecCaisse } from "./validationDepenses.js";
import { totalVente, numeroRecu } from "./core.js";
// ⚠ La fabrique de bilan est écrite UNE fois (lib/caissesCentrales.js) : deux
// copies finiraient par compter différemment.
import { bilanCaisse } from "./caissesCentrales.js";

export { MOYENS_MOBILES };
// Les noms de caisse (« Flooz », « Mixx/T-Money ») : ce sont eux qui servent
// de pastille dans le tableau de bord.
export const CAISSES_MOBILES = MOYENS_MOBILES.map((m) => m.caisse);

// Une dépense compte-t-elle ? La même règle que partout : ni en attente du
// DG, ni rejetée (son montant est déjà à 0), montant > 0.
const compte = (d) => !estEnAttente(d) && !estRejetee(d) && Number(d.montant || 0) > 0;
const jour = (x) => String(x || "").slice(0, 10);
// Ce que le client a réellement remis : la vente, plus les frais qui partent
// avec elle (même calcul que le tiroir, lib/versements.js).
const montantEncaisse = (v) => totalVente(v) + Number(v.frais_installation || 0) + Number(v.frais_transport || 0);

// Le numéro du compte réglé sur la fiche d'une boutique, ou "".
export const numeroMobile = (boutiques, boutique, moyen) => {
  const m = mobileParMoyen(moyen);
  if (!m) return "";
  const b = (boutiques || []).find((x) => x.nom === boutique);
  return String(b?.[m.champ] || "").trim();
};

// Le bilan d'un compte mobile sur les boutiques données.
// ⚠ `nomsBoutiques` est la LISTE déjà filtrée par l'espace regardé — une
// boutique, pour lire un compte ; toutes celles de l'espace, pour le relevé
// de l'administrateur.
export function mouvementsMobile(db, moyen, nomsBoutiques) {
  const dans = (b) => (nomsBoutiques || []).includes(b);
  const entrees = [];
  const sorties = [];

  (db?.ventes || []).forEach((v) => {
    if (!dans(v.boutique) || v.paiement !== moyen) return;
    entrees.push({ id: v.id, sens: "entree", date: jour(v.date), heure: v.heure, montant: montantEncaisse(v), boutique: v.boutique, par: v.par,
      libelle: `Vente ${numeroRecu(v)}${v.client ? ` — ${v.client}` : ""} (par ${v.par || "?"})` });
  });

  (db?.dettes || []).forEach((d) => {
    if (!dans(d.boutique)) return;
    (d.paiements || []).forEach((p, i) => {
      if (p.paiement !== moyen) return;
      entrees.push({ id: `${d.id}-p${i}`, sens: "entree", date: jour(p.date), montant: Number(p.montant || 0), boutique: d.boutique, par: p.par,
        libelle: `Règlement de dette${d.client ? ` — ${d.client}` : ""}${p.par ? ` (par ${p.par})` : ""}` });
    });
  });

  (db?.depenses || []).forEach((x) => {
    if (!dans(x.boutique) || x.paiement !== moyen || !payeAvecCaisse(x) || !compte(x)) return;
    // Un versement parti de ce compte est une SORTIE du compte : l'argent est
    // allé chez le DG, à la banque, ou au guichet. Un versement REJETÉ est
    // ramené à 0 : il ne passe donc pas `compte()` — « jamais versé ».
    if (estVersement(x) && !estRejete(x)) {
      sorties.push({ id: x.id, sens: "sortie", date: jour(x.date), heure: x.heure, montant: Number(x.montant), boutique: x.boutique, par: x.par,
        libelle: `Versement de ${x.boutique} → ${libelleDestination(x.versement)}${x.versement.destination === DEST_TIROIR ? "" : ` (par ${x.par})`}` });
      return;
    }
    sorties.push({ id: x.id, sens: "sortie", date: jour(x.date), heure: x.heure, montant: Number(x.montant), boutique: x.boutique, par: x.par,
      libelle: `${x.categorie}${x.description ? ` — ${x.description}` : ""} (${x.boutique}, par ${x.par})` });
  });

  return bilanCaisse(entrees, sorties);
}

// Le solde des DEUX comptes d'une boutique, pour les carrés de 🔒 Caisse.
// Rend une ligne par compte : son libellé, son numéro réglé, son solde.
export const soldesMobiles = (db, boutique) => MOYENS_MOBILES.map((m) => {
  const b = mouvementsMobile(db, m.moyen, [boutique]);
  return { ...m, solde: b.solde, entrees: b.totalEntrees, sorties: b.totalSorties, numero: numeroMobile(db?.boutiques, boutique, m.moyen), mouvements: b.mouvements.length };
});

// La phrase sous le carré : le numéro du compte, ou l'endroit où le régler.
export const phraseNumeroMobile = (numero) => (numero
  ? `n° ${numero}`
  : "numéro non réglé (⚙ Paramètres → Boutiques → 📱 Comptes mobiles)");
