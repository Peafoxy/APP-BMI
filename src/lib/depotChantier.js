// ============================================================
// lib/depotChantier.js — 🏗 LE DÉPÔT CHANTIER : QUAND L'ARGENT D'UN
// CHANTIER DEVIENT UNE VENTE (Timo, 12/10/2026).
//
// Sa question, devant le tableau de bord : « L'encaissement d'un devis
// d'installation est-il une vente ? Si oui pourquoi dans l'onglet chantier il
// n'y a rien ? » Puis : « En réalité dépôt chantier correspond bien à la
// situation… le client vient faire un dépôt pour son chantier et ensuite les
// ventes viendront puiser dans ce dépôt » → « A oui, B oui et C b, et KLOMEGAN
// revient dépôt ».
//
//   • L'encaissement d'un devis « 🔧 Avec installation » est un DÉPÔT
//     (`estDepotChantier`, lib/core.js) : l'argent entre dans la caisse
//     🏗 DÉPÔT CHANTIER, le client reçoit un « REÇU DE DÉPÔT CHANTIER », mais
//     le chiffre d'affaires ne bouge pas.
//   • C b : chaque achat « 🏗 Chantier » DEVIENT UNE VENTE, au prix de la
//     boutique, dans la boutique d'où sort le matériel, le jour de la sortie.
//   • À la RÉCEPTION (PV signé, forcée ou automatique), ce qui reste du devis
//     devient la dernière vente, dans la boutique du devis : le matériel du
//     devis jamais puisé, puis les frais d'installation et le transport —
//     moins ce que le matériel a déjà mangé sur eux (la règle 5 du 11/10). Le
//     total des ventes est donc ce que le devis demandait au client.
//
// Ce qui NE change PAS : l'argent (caisse, versements, clôture), la dette, la
// commission (elle garde sa règle : réception ET solde), le matériel réservé.
//
// Règles PURES, lisibles par Node (imports en `.js`). ⚠ Les listes reçues
// sont DÉJÀ filtrées par l'appelant (le mur) : rien ici ne parcourt une base
// entière.
// ============================================================
import { totalVente, caVente, estDepotChantier } from "./core.js";

export { estDepotChantier };

export const LIBELLE_DEPOT = "🏗 Dépôt chantier";
export const TITRE_RECU_DEPOT = "REÇU DE DÉPÔT CHANTIER";
// Le « moyen de paiement » d'une vente puisée dans un dépôt : aucun argent
// n'entre ce jour-là, il est déjà dans la caisse du dépôt.
// (sans emoji : il s'écrit aussi dans les PDF, dont la police ne le connaît pas)
export const PAIEMENT_PUISE = "Puisé dans le dépôt chantier";
export const LIBELLE_RESTE_DEPOT = "Reste du dépôt chantier (matériel du devis non puisé)";

// ---- Les achats d'un chantier (déplacés ici depuis lib/achatsChantier.js,
// qui les réexporte : une seule définition) ----
export const achatsDe = (c) => (Array.isArray(c && c.achats_chantier) ? c.achats_chantier : []);
export const achatsActifs = (c) => achatsDe(c).filter((a) => !a.annule);
const brutLignes = (lignes) => (lignes || []).reduce((s, l) => s + Number(l.qte || 0) * Number(l.pu || 0) - Number(l.remise_ligne || 0), 0);
export const totalAchat = (a) => Math.max(0, Math.round(brutLignes(a && a.lignes) - Number((a && a.remise) || 0)));

const nomDuChantier = (c) => `${c && c.prenom ? `${c.prenom} ` : ""}${(c && c.nom) || ""}`.trim();
const estRecu = (c) => !!c && c.statut === "receptionne" && !!c.receptionne_le;
const fraisDe = (v) => Number(v?.frais_installation || 0) + Number(v?.frais_transport || 0);

// Un achat « 🏗 Chantier » sous la forme d'une vente : le chiffre d'affaires
// (caVente), le prix d'achat (coutDesVentes) et la quantité se lisent comme
// sur une vente ordinaire.
export const venteDeLAchat = (c, a) => ({
  id: a.id, numero: a.numero, boutique: a.boutique, date: a.date, heure: a.heure,
  client: nomDuChantier(c) || "Chantier", tel: c?.tel || "",
  articles: a.lignes || [], remise: Number(a.remise || 0),
  paiement: PAIEMENT_PUISE, achat_chantier: true, chantier_id: c?.id,
});

// Le reste du devis à la réception (null s'il n'y a rien).
export function venteDuReste(c, v) {
  if (!estRecu(c) || !estDepotChantier(v)) return null;
  const achats = achatsActifs(c);
  const puise = achats.reduce((s, a) => s + totalAchat(a), 0);
  // Un encaissement d'AVANT (marqué dépôt par un script) : le stock est déjà
  // sorti au paiement, aucun achat n'a puisé dedans — la vente entière devient
  // vente le jour de la réception, avec ses articles (donc leur prix d'achat).
  const ancien = !(v.articles || []).some((l) => l && l.au_chantier);
  if (ancien && achats.length === 0) {
    return { ...v, id: `reste-${v.id}`, date: c.receptionne_le, heure: "", caisse: undefined,
      paiement: PAIEMENT_PUISE, reste_depot: true, depot_chantier: false, vente_depot_id: v.id, chantier_id: c.id };
  }
  const reste = Math.max(0, caVente(v) - puise);
  // La règle 5 du 11/10 : ce que le matériel a pris au-delà de la part
  // matériel du devis est pris sur les frais (l'installation d'abord).
  const mange = Math.max(0, puise - Math.max(0, totalVente(v)));
  const fi = Math.max(0, Number(v.frais_installation || 0) - mange);
  const ft = Math.max(0, Number(v.frais_transport || 0) - Math.max(0, mange - Number(v.frais_installation || 0)));
  if (!(reste > 0) && !(fi > 0) && !(ft > 0)) return null;
  return {
    id: `reste-${v.id}`, numero: v.numero, boutique: v.boutique, date: c.receptionne_le, heure: "",
    client: v.client, tel: v.tel, commercial: v.commercial,
    articles: reste > 0 ? [{ article: LIBELLE_RESTE_DEPOT, qte: 1, pu: reste }] : [{ article: LIBELLE_RESTE_DEPOT, qte: 0, pu: 0 }],
    remise: 0, frais_installation: fi, frais_transport: ft,
    paiement: PAIEMENT_PUISE, reste_depot: true, vente_depot_id: v.id, chantier_id: c.id,
  };
}

// ---- CE QUI COMPTE COMME VENTE (le tableau de bord, 📈 Rentabilité,
// l'inventaire, le journal comptable) ----
// Les ventes ordinaires, puis les achats « 🏗 Chantier », puis le reste de
// chaque dépôt réceptionné. Les dépôts eux-mêmes n'y sont jamais.
export function ventesAuChiffre(ventes, chantiers) {
  const lv = Array.isArray(ventes) ? ventes : [];
  const lc = Array.isArray(chantiers) ? chantiers : [];
  const parId = new Map(lv.map((v) => [v.id, v]));
  const ordinaires = lv.filter((v) => !estDepotChantier(v));
  const achats = lc.flatMap((c) => achatsActifs(c).map((a) => venteDeLAchat(c, a)));
  const restes = lc.map((c) => venteDuReste(c, parId.get(c.vente_id))).filter(Boolean);
  return [...ordinaires, ...achats, ...restes];
}
// Ce qui n'est PAS une vente ordinaire (achats et restes) : le journal
// comptable les écrit comme le passage du dépôt à la vente.
export const passagesALaVente = (ventes, chantiers) => ventesAuChiffre(ventes, chantiers).filter((x) => x.achat_chantier || x.reste_depot);

// ---- Où en est chaque dépôt (la pastille 🏗 DÉPÔT CHANTIER) ----
export function etatDepot(v, c, dette) {
  const devis = Math.max(0, totalVente(v)) + fraisDe(v);
  const paye = dette ? Math.max(0, Number(dette.paye || 0))
    : /Crédit/i.test(String(v.paiement || "")) ? Math.max(0, Number(v.avance || 0)) : devis;
  const achats = c ? achatsActifs(c) : [];
  const puise = achats.reduce((s, a) => s + totalAchat(a), 0);
  const recu = estRecu(c);
  const r = recu ? venteDuReste(c, v) : null;
  const resteVendu = r ? Math.max(0, totalVente(r)) + fraisDe(r) : 0;
  return {
    id: v.id, numero: v.numero, client: v.client || "", date: v.date, boutique: v.boutique,
    chantier_id: c?.id || null, receptionne_le: recu ? c.receptionne_le : null,
    devis, paye, puise, resteVendu,
    // Ce qui dort encore dans la caisse pour ce chantier : rien une fois
    // réceptionné (tout est devenu vente ; ce qui manque est une dette).
    enDepot: recu ? 0 : Math.max(0, paye - puise),
    enAttente: Math.max(0, puise - paye),
  };
}
export function etatsDesDepots(ventes, chantiers, dettes) {
  const lc = Array.isArray(chantiers) ? chantiers : [];
  const ld = Array.isArray(dettes) ? dettes : [];
  return (Array.isArray(ventes) ? ventes : []).filter(estDepotChantier).map((v) => etatDepot(
    v, lc.find((c) => c.vente_id === v.id) || null, ld.find((d) => d.vente_id === v.id) || null,
  )).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
