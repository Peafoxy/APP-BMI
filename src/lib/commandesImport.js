// ============================================================
// lib/commandesImport.js — LES COMMANDES À L'ÉTRANGER (Alibaba…)
//
// Timo, 10/11/2026 : « Comment gérer les commandes que je passe sur alibaba
// avec les fournisseurs » → la commande porte ses articles et son étape, ses
// paiements en dollars (acompte ET solde : « les 2 manières de payer »), ses
// frais (« plusieurs » intervenants : fret, transitaire, douane…), et à la
// réception le PRIX DE REVIENT RENDU LOMÉ de chaque article.
// Ses choix : 1b (gérant + administrateur), 2a (les frais au prorata de la
// VALEUR), 3a (un paiement > 5 000 F passe par le DG — c'est une dépense
// ordinaire), 4b (le nouveau prix d'achat = la MOYENNE entre l'ancien stock
// et l'arrivée) ; et pour un article dont il connaît déjà le prix : « a » —
// c'est le prix rendu Lomé, gardé tel quel, AUCUN frais ne s'y ajoute.
//
// La commande vit sur la fiche du FOURNISSEUR (`commandes_import`) : la table
// des fournisseurs est déjà réservée au gérant et à l'administrateur
// (securite-4) — rien à coller. Paiements et frais sont des DÉPENSES
// ordinaires (validation du DG, tiroir, « Payé avec ») qui portent
// `commande_import` ; la commande ne garde que leur id et le montant.
//
// Module PUR, sans aucun import.
// ============================================================

export const ETAPES_COMMANDE = [
  ["commandee", "📝 Commandée"],
  ["expediee", "🚢 Expédiée"],
  ["douane", "🏛 En douane"],
  ["recue", "✅ Reçue"],
];
export const libelleEtape = (e) => (ETAPES_COMMANDE.find(([k]) => k === e) || ["", "📝 Commandée"])[1];
// L'étape qui suit (null après « en douane » : la réception est un geste à part).
export const etapeSuivante = (e) => ({ commandee: "expediee", expediee: "douane" }[e || "commandee"] || null);

export const MODE_CALCUL = "calcul";
export const MODE_CONNU = "connu";

// Les sortes de frais proposées (« ✏️ Autre… » se tape).
export const SORTES_FRAIS = ["Fret (transport international)", "Transitaire", "Douane", "Manutention / port", "Transport jusqu'au magasin"];

const sans = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
export const nombreSaisi = (v) => {
  if (v === "" || v === null || v === undefined) return NaN;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const arrondi = (n) => Math.round(Number(n) || 0);
const centimes = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const fmtDevise = (n) => `${centimes(n).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} $`;

// ---- LA MONNAIE DE LA COMMANDE (11/11/2026, « Lance a et b ») ----
// Timo : « en franc cfa… plus besoin de calculer le taux, l'application
// connaît et utilise déjà le cfa ». « a » : une commande se passe en dollars
// (d'office — toute commande d'avant), en yuans ou en FRANCS CFA ; en francs,
// aucun taux, jamais (le taux vaut 1). « b » : une commande en $ ou en ¥ payée
// en francs ne demande plus le taux, mais les DEUX chiffres du reçu — les
// francs sortis et ce que le fournisseur a reçu ; le taux se calcule.
export const DEVISES_COMMANDE = [["dollars", "Dollars ($)"], ["yuan", "Yuans (¥)"], ["cfa", "Francs CFA (F)"]];
export const deviseDe = (c) => (c?.devise === "cfa" || c?.devise === "yuan" ? c.devise : "dollars");
export const estCfa = (c) => deviseDe(c) === "cfa";
export const symboleDe = (c) => ({ dollars: "$", yuan: "¥", cfa: "F" })[deviseDe(c)];
export const motDevise = (c) => ({ dollars: "dollars", yuan: "yuans", cfa: "francs" })[deviseDe(c)];
export const fmtCmd = (c, n) => `${centimes(n).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${symboleDe(c)}`;
// « b » : le taux se lit sur le reçu — francs sortis ÷ ce que le fournisseur a reçu.
export const tauxDuRecu = (francs, recu) => (Number(recu) > 0 ? Math.round((Number(francs) / Number(recu)) * 100) / 100 : 0);

// Toutes les commandes d'une liste de fournisseurs (déjà filtrée par l'espace).
export const commandesDe = (fournisseurs) => (fournisseurs || []).flatMap((fo) =>
  (fo?.commandes_import || []).map((c) => ({ ...c, fournisseur_id: fo.id, fournisseur_nom: fo.nom })));
export const estEnCours = (c) => !!c && !c.annulee && c.etape !== "recue";

// IMP-2026-0001 : le plus grand déjà donné + 1, sur TOUS les fournisseurs reçus.
export function prochainNumeroCommande(fournisseurs, annee) {
  const pref = `IMP-${annee}-`;
  let max = 0;
  for (const c of commandesDe(fournisseurs)) {
    const s = String(c.numero || "");
    if (s.startsWith(pref)) max = Math.max(max, Number(s.slice(pref.length)) || 0);
  }
  return `${pref}${String(max + 1).padStart(4, "0")}`;
}

// ---- LES LIGNES ----
export function critiqueLigne(l, mot = "dollars") {
  if (!String(l?.nom || "").trim()) return "Indiquez l'article.";
  const q = nombreSaisi(l.qte);
  if (!(q > 0) || !Number.isInteger(q)) return `« ${l.nom} » : la quantité doit être un nombre entier positif.`;
  const pu = nombreSaisi(l.pu);
  if (!(pu >= 0)) return `« ${l.nom} » : indiquez le prix unitaire en ${mot} (0 si offert).`;
  if (l.mode === MODE_CONNU) {
    const p = nombreSaisi(l.prix_connu);
    if (!(p > 0)) return `« ${l.nom} » : indiquez le prix rendu Lomé que vous connaissez (en francs).`;
  }
  return "";
}
export function critiqueCommande({ lieu, lignes, devise, frais_envoi }) {
  if (!lieu) return "Choisissez où la marchandise sera reçue (boutique ou magasin).";
  if (String(frais_envoi ?? "").trim() !== "" && !(nombreSaisi(frais_envoi) >= 0)) return `Frais d'envoi du fournisseur : indiquez un montant en ${motDevise({ devise })} (vide ou 0 s'il n'y en a pas).`;
  if (!(lignes || []).length) return "Ajoutez au moins un article à la commande.";
  for (const l of lignes) { const r = critiqueLigne(l, motDevise({ devise })); if (r) return r; }
  const vus = new Set();
  for (const l of lignes) {
    const k = l.produit_id || sans(l.nom);
    if (vus.has(k)) return `« ${l.nom} » est deux fois dans la commande : mettez la quantité totale sur une seule ligne.`;
    vus.add(k);
  }
  return "";
}
export const ligneRangee = (l) => ({
  id: l.id, produit_id: l.produit_id || null, nom: String(l.nom).trim(),
  qte: nombreSaisi(l.qte), pu: centimes(nombreSaisi(l.pu)),
  mode: l.mode === MODE_CONNU ? MODE_CONNU : MODE_CALCUL,
  ...(l.mode === MODE_CONNU ? { prix_connu: arrondi(nombreSaisi(l.prix_connu)) } : {}),
});
export const totalArticles = (c) => centimes((c?.lignes || []).reduce((s, l) => s + Number(l.qte || 0) * Number(l.pu || 0), 0));
// 📦 LES FRAIS D'ENVOI DU FOURNISSEUR (12/11/2026, « a ») : ce que le
// fournisseur facture avec la marchandise pour l'envoyer jusqu'à l'agent en
// Chine — dans la monnaie de la commande, payé AU FOURNISSEUR (donc dans le
// total et le reste à payer), réparti dans le prix de revient comme les frais.
export const fraisEnvoiDe = (c) => { const n = nombreSaisi(c?.frais_envoi); return n > 0 ? centimes(n) : 0; };
export const fraisEnvoiRange = (v) => fraisEnvoiDe({ frais_envoi: v });
export const totalDevise = (c) => centimes(totalArticles(c) + fraisEnvoiDe(c));

// ---- LES DÉPENSES LIÉES (paiements et frais) ----
// Une dépense compte si elle existe et n'est pas rejetée ; en attente du DG,
// elle est dite à part (elle ne compte pas encore).
const etatDepense = (depenses, id) => {
  const d = (depenses || []).find((x) => x.id === id);
  if (!d) return "absente";
  if (d.validation?.statut === "rejetee") return "rejetee";
  if (d.validation?.statut === "attente") return "attente";
  return "compte";
};
export const etatDeLaDepense = etatDepense;

export function etatPaiements(c, depenses) {
  const total = totalDevise(c);
  let payeDevise = 0, payeF = 0, attenteDevise = 0, attenteF = 0;
  for (const p of c?.paiements || []) {
    const e = etatDepense(depenses, p.depense_id);
    if (e === "compte") { payeDevise += Number(p.montant_devise || 0); payeF += Number(p.montant_f || 0); }
    else if (e === "attente") { attenteDevise += Number(p.montant_devise || 0); attenteF += Number(p.montant_f || 0); }
  }
  payeDevise = centimes(payeDevise); attenteDevise = centimes(attenteDevise);
  return {
    total, payeDevise, payeF: arrondi(payeF), attenteDevise, attenteF: arrondi(attenteF),
    resteDevise: Math.max(0, centimes(total - payeDevise - attenteDevise)),
    tauxMoyen: payeDevise > 0 ? payeF / payeDevise : 0,
  };
}
export function etatFrais(c, depenses) {
  let total = 0, attente = 0;
  for (const f of c?.frais || []) {
    const e = etatDepense(depenses, f.depense_id);
    if (e === "compte") total += Number(f.montant || 0);
    else if (e === "attente") attente += Number(f.montant || 0);
  }
  return { total: arrondi(total), attente: arrondi(attente) };
}

// `montant_f` : les francs sortis de la caisse ; `montant_devise` : ce que le
// fournisseur a reçu, dans la monnaie de la commande (en francs : le même).
export function critiquePaiement(c, { montant_devise, montant_f }, depenses) {
  if (!c || c.annulee) return "Cette commande n'existe plus.";
  if (c.etape === "recue") return "Cette commande est déjà reçue : un paiement au fournisseur après la réception se saisit dans 📤 Dépenses.";
  const f = nombreSaisi(montant_f);
  if (!(f > 0)) return "Indiquez le montant sorti de la caisse, en francs.";
  const m = estCfa(c) ? f : nombreSaisi(montant_devise);
  if (!(m > 0)) return `Indiquez le montant reçu par le fournisseur, en ${motDevise(c)} (il est sur le reçu du transfert).`;
  const e = etatPaiements(c, depenses);
  if (m > e.resteDevise + 0.009) return `Le montant dépasse ce qui reste à payer sur cette commande : ${fmtCmd(c, e.resteDevise)}.`;
  return "";
}
export function critiqueFrais(c, { sorte, montant }) {
  if (!c || c.annulee) return "Cette commande n'existe plus.";
  if (c.etape === "recue") return "Cette commande est déjà reçue : ses prix de revient sont calculés. Un frais arrivé après se saisit dans 📤 Dépenses.";
  if (!String(sorte || "").trim()) return "Indiquez de quel frais il s'agit (fret, transitaire, douane…).";
  if (!(nombreSaisi(montant) > 0)) return "Indiquez le montant du frais en francs.";
  return "";
}

// ---- LA RÉCEPTION : LE PRIX DE REVIENT RENDU LOMÉ ----
// `qtes` : { ligne_id → quantité reçue } ; `tauxReste` : le taux pour la part
// pas encore payée (exigé seulement s'il en reste une).
// Le taux des articles « à calculer » = ce qui a VRAIMENT été payé en francs,
// plus le reste au taux du jour, divisé par le total en dollars.
export function tauxDeLaCommande(c, depenses, tauxReste) {
  if (estCfa(c)) return 1; // « a » : en francs, aucun taux
  const e = etatPaiements(c, depenses);
  if (!(e.total > 0)) return 0;
  const reste = centimes(e.total - e.payeDevise);
  if (reste > 0.009 && !(Number(tauxReste) > 0)) return NaN;
  return (e.payeF + (reste > 0 ? reste * Number(tauxReste) : 0)) / e.total;
}
export const resteAPayerAuTaux = (c, depenses) => { if (estCfa(c)) return false; const e = etatPaiements(c, depenses); return centimes(e.total - e.payeDevise) > 0.009; };

export function calculerCouts(c, depenses, { qtes = {}, tauxReste } = {}) {
  const taux = tauxDeLaCommande(c, depenses, tauxReste);
  // Les frais d'envoi du fournisseur, convertis au taux de la commande,
  // s'ajoutent aux frais répartis.
  const envoiF = fraisEnvoiDe(c) > 0 && Number.isFinite(taux) ? arrondi(fraisEnvoiDe(c) * taux) : 0;
  const frais = arrondi(etatFrais(c, depenses).total + envoiF);
  const lignes = (c?.lignes || []).map((l) => {
    const q = Math.max(0, Math.round(Number(qtes[l.id] ?? l.qte) || 0));
    return { ligne_id: l.id, produit_id: l.produit_id || null, nom: l.nom, mode: l.mode, qte: q, pu: Number(l.pu || 0),
      valeur: l.mode === MODE_CONNU ? 0 : q * Number(l.pu || 0) * (Number.isFinite(taux) ? taux : 0) };
  });
  const aCalculer = lignes.filter((l) => l.mode !== MODE_CONNU && l.qte > 0);
  const baseValeur = aCalculer.reduce((s, l) => s + l.valeur, 0);
  const baseQte = aCalculer.reduce((s, l) => s + l.qte, 0);
  const sorties = lignes.map((l) => {
    const ligne = (c.lignes || []).find((x) => x.id === l.ligne_id) || {};
    if (l.mode === MODE_CONNU) return { ...l, part_frais: 0, cout: arrondi(ligne.prix_connu) };
    if (l.qte <= 0) return { ...l, part_frais: 0, cout: 0 };
    // « 2a » : au prorata de la valeur ; une commande à 0 $ (tout offert) se
    // partage à la quantité, sinon les frais se perdraient.
    const part = baseValeur > 0 ? frais * (l.valeur / baseValeur) : (baseQte > 0 ? frais * (l.qte / baseQte) : 0);
    return { ...l, part_frais: arrondi(part), cout: arrondi((l.valeur + part) / l.qte) };
  });
  return { taux, frais, envoiF, lignes: sorties, fraisPerdus: frais > 0 && aCalculer.length === 0 };
}

// « 4b » : la moyenne entre ce qu'il reste en stock (à l'ancien prix) et ce
// qui arrive (au prix de revient). Rien en stock, ou aucun ancien prix : le
// nouveau prix tel quel.
export function prixMoyen(stockAvant, ancienPrix, qteRecue, cout) {
  const s = Math.max(0, Number(stockAvant) || 0);
  const a = Number(ancienPrix) || 0;
  const q = Number(qteRecue) || 0;
  if (q <= 0) return arrondi(a);
  if (s <= 0 || a <= 0) return arrondi(cout);
  return arrondi((s * a + q * Number(cout || 0)) / (s + q));
}

export function critiqueReception(c, depenses, { qtes = {}, tauxReste } = {}) {
  if (!c || c.annulee) return "Cette commande n'existe plus.";
  if (c.etape === "recue") return "Cette commande est déjà reçue.";
  const total = (c.lignes || []).reduce((s, l) => s + Math.max(0, Math.round(Number(qtes[l.id] ?? l.qte) || 0)), 0);
  if (total <= 0) return "Aucun article reçu : indiquez au moins une quantité.";
  for (const l of c.lignes || []) {
    const q = Number(qtes[l.id] ?? l.qte);
    if (!Number.isFinite(q) || q < 0 || !Number.isInteger(q)) return `« ${l.nom} » : la quantité reçue doit être un nombre entier (0 si rien n'est arrivé).`;
  }
  if (Number.isNaN(tauxDeLaCommande(c, depenses, tauxReste))) return `Une partie de la commande n'est pas encore payée : indiquez le taux du jour (francs pour 1 ${symboleDe(c)}) pour la calculer.`;
  const attente = etatPaiements(c, depenses).attenteDevise > 0 || etatFrais(c, depenses).attente > 0;
  if (attente) return "Un paiement ou un frais de cette commande attend encore la validation du DG : le prix de revient ne peut pas être calculé avant sa décision.";
  return "";
}

// La commande, une fois ses prix appliqués à la fiche des articles (l'administrateur).
export const prixAAppliquer = (c) => !!c?.reception && !c.reception.prix_appliques_le;

// ---- ✏️ MODIFIER UNE COMMANDE (11/11/2026, « A a ») ----
// Tout sauf le fournisseur : articles, quantités, prix en dollars, mode,
// lieu, note — tant qu'elle n'est ni reçue ni annulée. Le nouveau total ne
// descend jamais sous ce qui est déjà payé (ou attend le DG).
export function critiqueModification(c, { lieu, lignes, devise, frais_envoi }, depenses) {
  if (!c || c.annulee) return "Cette commande n'existe plus.";
  if (c.etape === "recue") return "Cette commande est déjà reçue : ses prix de revient sont calculés, elle ne se modifie plus.";
  const dv = devise ? deviseDe({ devise }) : deviseDe(c);
  if (dv !== deviseDe(c) && (c.paiements || []).length) return "Cette commande porte déjà des paiements : sa monnaie ne change plus. Retirez d'abord ses paiements.";
  const refus = critiqueCommande({ lieu, lignes, devise: dv, frais_envoi });
  if (refus) return refus;
  const e = etatPaiements(c, depenses);
  const deja = centimes(e.payeDevise + e.attenteDevise);
  const nouveau = totalDevise({ lignes: lignes.map(ligneRangee), frais_envoi });
  const cv = { devise: dv };
  if (nouveau + 0.009 < deja) return `Le nouveau total (${fmtCmd(cv, nouveau)}) est plus bas que ce qui est déjà payé sur cette commande (${fmtCmd(cv, deja)}). Retirez d'abord un paiement.`;
  return "";
}

// ---- 🔗 RATTACHER DES DÉPENSES DÉJÀ PAYÉES (11/11/2026, « B a, C, D a ») ----
// Une dépense déjà saisie dans 📤 Dépenses devient un paiement ou un frais de
// la commande : rien n'est dépensé deux fois, la dépense reçoit seulement la
// marque `commande_import` (`rattachee`). « B a » : seules les catégories
// « Commande en Chine » et « Achat marchandises » sont proposées.
export const CATEGORIES_RATTACHABLES = ["Commande en Chine", "Achat marchandises"];
// `noms` : les caisses de l'espace REGARDÉ (le mur) — jamais toute la table.
export const depensesRattachables = (depenses, noms) => {
  const permis = new Set(noms || []);
  return (depenses || [])
    .filter((d) => CATEGORIES_RATTACHABLES.includes(d.categorie) && !d.commande_import && permis.has(d.boutique)
      && d.validation?.statut !== "rejetee" && Number(d.montant || 0) > 0)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
};

// « C » : le montant d'un paiement se dit en dollars, en francs (avec le taux
// F / $) ou en yuans (avec le taux ¥ / $). Rend { md, taux } — `taux` en F / $,
// celui de la commande — ou { refus }.
export const DEVISES_SAISIE = [["dollars", "En dollars ($)"], ["cfa", "En francs CFA (avec le taux F / $)"], ["yuan", "En yuans (¥, avec le taux ¥ / $)"]];
export function dollarsDepuis({ devise, montant, taux, francs }) {
  const f = Number(francs || 0);
  if (!(f > 0)) return { refus: "Cette dépense n'a pas de montant." };
  const m = nombreSaisi(montant);
  const t = nombreSaisi(taux);
  let md;
  if (devise === "dollars") {
    if (!(m > 0)) return { refus: "Indiquez le montant en dollars." };
    md = m;
  } else if (devise === "cfa") {
    if (!(t > 0)) return { refus: "Indiquez le taux du jour (combien de francs pour 1 dollar)." };
    md = f / t;
  } else if (devise === "yuan") {
    if (!(m > 0)) return { refus: "Indiquez le montant en yuans." };
    if (!(t > 0)) return { refus: "Indiquez le taux (combien de yuans pour 1 dollar)." };
    md = m / t;
  } else return { refus: "Choisissez la monnaie." };
  md = centimes(md);
  if (!(md > 0)) return { refus: "Le montant en dollars est nul." };
  return { md, taux: Math.round((f / md) * 100) / 100 };
}

// Le contrôle d'un lot de rattachements : la commande ouverte, chaque dépense
// encore libre, et les paiements ne dépassant jamais ce qui reste à payer.
export function critiqueRattachement(c, choix, depenses) {
  if (!c || c.annulee) return "Cette commande n'existe plus.";
  if (c.etape === "recue") return "Cette commande est déjà reçue : ses prix de revient sont calculés, plus rien ne s'y rattache.";
  if (!(choix || []).length) return "Choisissez au moins une dépense.";
  for (const x of choix) {
    const d = (depenses || []).find((y) => y.id === x.depense_id);
    if (!d || d.commande_import || d.validation?.statut === "rejetee") return "Une des dépenses choisies n'est plus libre : rouvrez la liste.";
    if (x.type === "frais" && !String(x.sorte || "").trim()) return "Indiquez de quel frais il s'agit.";
  }
  const e = etatPaiements(c, depenses);
  const ajout = centimes((choix || []).filter((x) => x.type === "paiement").reduce((s, x) => s + Number(x.md || 0), 0));
  if (ajout > e.resteDevise + 0.009) return `Ces paiements (${fmtCmd(c, ajout)}) dépassent ce qui reste à payer sur la commande : ${fmtCmd(c, e.resteDevise)}.`;
  return "";
}
