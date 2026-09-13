// ============================================================
// lib/travaux.js — 🛠 TRAVAUX À CRÉDIT : les prestations hors devis
//
// Timo (13/09/2026) : « des chantiers qu'on exécute et au fur et à mesure on
// fait des dépenses qui doivent être additionnées… câble, tuyau et autres
// s'additionnent aux articles sortis de la boutique, sauf qu'eux sont des
// articles HB… il y aura la ligne de frais de prestation, en pourcentage ou
// à taper librement… les articles sortis sont facturés au prix de la
// boutique… manger, carburant font partie de la prestation ». Nom choisi
// par lui : « Travaux à crédit ». « Le jour où le client finit de payer, le
// travail à crédit quitte l'onglet pour rester dans Clients installés » —
// option A : une TRACE (pas de PV, pas de réception, pas de commission).
//
// Une fiche de travaux est une ligne de `clients_installes` marquée
// `travaux: true` (statut fixe "travaux") : elle vit dans l'onglet tant
// qu'elle n'est pas soldée, puis dans 🏠 Clients installés. Rien à coller
// dans Supabase.
//   • articles de la boutique : le stock baisse TOUT DE SUITE (ajustement
//     négatif `sortie_travaux`), facturés au prix de la boutique, coût = prix
//     d'achat ; retirer la ligne remet le stock (ajustement `retour_travaux`) ;
//   • articles HB (achetés dehors) : pas de stock, prix payé et prix facturé ;
//   • frais de prestation : % de TOUS les articles, ou montant libre ; ils
//     couvrent carburant et nourriture (dépenses rattachées, chantier 1) ;
//   • facturer = envoyer le panier à 💰 Ventes (lignes de stock marquées
//     `deja_sorti`, HB marquées `hors_boutique`, prestation en ligne libre) ;
//     le reçu ou la dette revient sur la fiche (vente_id / dette_id).
// ============================================================
import { uid, today, fmt, totalVente } from "./core";
import { stockActuel, resteAPayer, travauxSolde } from "./calculs";
import { dansLEspaceRegarde, totalDepensesChantier } from "./depensesChantier";

export const STATUT_TRAVAUX = "travaux";
export const TYPE_SORTIE_TRAVAUX = "sortie_travaux";
export const TYPE_RETOUR_TRAVAUX = "retour_travaux";
export const LIGNE_PRESTATION = "Frais de prestation";
export const ROLES_FICHE = ["gerant", "admin"];               // ouvrir, décrire, prestation, HB
export const ROLES_ARTICLES = ["magasinier", "gerant", "admin"]; // sortir un article du stock
export const ROLES_FACTURER = ["vendeur", "gerant", "admin"];  // envoyer au panier de 💰 Ventes

export const estTravaux = (c) => !!c?.travaux;

// Les fiches de travaux de l'espace regardé, non soldées (l'onglet).
export const travauxEnCours = (db, profile) => (db.clients_installes || [])
  .filter((c) => estTravaux(c) && dansLEspaceRegarde(db, profile, c) && !travauxSolde(db, c))
  .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

export const critiqueFiche = ({ nom, boutique }) => {
  if (!String(nom || "").trim()) return "Le nom du client est obligatoire.";
  if (!boutique) return "Choisissez la boutique qui suit ces travaux.";
  return null;
};

export const nouveauTravail = (profile, { nom, prenom, tel, lieu, boutique, description }, aujourdhui = today()) => ({
  id: uid(),
  travaux: true,
  statut: STATUT_TRAVAUX,
  nom: String(nom || "").trim().toUpperCase(),
  prenom: String(prenom || "").trim(),
  tel: String(tel || "").trim(),
  adresse: String(lieu || "").trim(),
  boutique,
  description: String(description || "").trim(),
  type_installation: "Travaux",
  date: aujourdhui,
  par: profile.nom,
  articles_travaux: [],
  prestation: { mode: "pct", valeur: 0 },
});

// ---- Les articles ----
export const critiqueArticleStock = (db, produit, qte) => {
  if (!produit) return "Choisissez un article du stock.";
  const q = Number(qte);
  if (!(q > 0)) return "La quantité doit être supérieure à zéro.";
  const dispo = stockActuel(db, produit);
  if (q > dispo) return `Stock insuffisant pour « ${produit.nom} » : ${dispo} disponible(s).`;
  return null;
};

// Sortir un article de la boutique pour ces travaux : la ligne sur la fiche
// ET l'ajustement négatif qui fait baisser le stock tout de suite.
export const ajouterArticleStock = (db, profile, c, produit, qte, aujourdhui = today()) => {
  const refus = critiqueArticleStock(db, produit, qte);
  if (refus) return { refus };
  const q = Number(qte);
  const ajustement = {
    id: uid(), date: aujourdhui, boutique: c.boutique, produit_id: produit.id, nom: produit.nom,
    qte: -q, type: TYPE_SORTIE_TRAVAUX, travaux_id: c.id,
    motif: `Sortie travaux — ${c.prenom || ""} ${c.nom}`.trim(), par: profile.nom,
  };
  const ligne = { id: uid(), produit_id: produit.id, nom: produit.nom, qte: q, pu_vente: Number(produit.prix_vente || 0), pu_achat: Number(produit.prix_achat || 0), hb: false, ajustement_id: ajustement.id, date: aujourdhui, par: profile.nom };
  return {
    fiche: { ...c, articles_travaux: [...(c.articles_travaux || []), ligne] },
    ajustement,
    journal: `Travaux ${c.nom} : ${q} × ${produit.nom} sorti(s) du stock de ${c.boutique}`,
  };
};

export const critiqueArticleHB = ({ nom, qte, pu_vente }) => {
  if (!String(nom || "").trim()) return "Le nom de l'article HB est obligatoire.";
  if (!(Number(qte) > 0)) return "La quantité doit être supérieure à zéro.";
  if (!(Number(pu_vente) >= 0)) return "Indiquez le prix facturé au client.";
  return null;
};

export const ajouterArticleHB = (profile, c, { nom, qte, pu_achat, pu_vente }, aujourdhui = today()) => {
  const refus = critiqueArticleHB({ nom, qte, pu_vente });
  if (refus) return { refus };
  const ligne = { id: uid(), produit_id: null, nom: String(nom).trim(), qte: Number(qte), pu_vente: Number(pu_vente || 0), pu_achat: Number(pu_achat || 0), hb: true, date: aujourdhui, par: profile.nom };
  return { fiche: { ...c, articles_travaux: [...(c.articles_travaux || []), ligne] }, journal: `Travaux ${c.nom} : article HB ${ligne.qte} × ${ligne.nom}` };
};

// Retirer une ligne : un article de stock REVIENT en stock (ajustement
// positif, on n'efface jamais l'ajustement de sortie).
export const retirerArticle = (profile, c, ligneId, aujourdhui = today()) => {
  const ligne = (c.articles_travaux || []).find((l) => l.id === ligneId);
  if (!ligne) return { refus: "Ligne introuvable." };
  if (c.vente_id) return { refus: "Ces travaux sont déjà facturés : on ne retire plus d'article." };
  const fiche = { ...c, articles_travaux: (c.articles_travaux || []).filter((l) => l.id !== ligneId) };
  const ajustement = ligne.hb ? null : {
    id: uid(), date: aujourdhui, boutique: c.boutique, produit_id: ligne.produit_id, nom: ligne.nom,
    qte: Number(ligne.qte), type: TYPE_RETOUR_TRAVAUX, travaux_id: c.id, motif: `Retour travaux — ${c.prenom || ""} ${c.nom}`.trim(), par: profile.nom,
  };
  return { fiche, ajustement, journal: `Travaux ${c.nom} : ${ligne.qte} × ${ligne.nom} retiré(s)${ajustement ? " (retour en stock)" : ""}` };
};

// ---- Les montants ----
export const totalArticles = (c) => (c.articles_travaux || []).reduce((s, l) => s + Number(l.qte || 0) * Number(l.pu_vente || 0), 0);
export const coutArticles = (c) => (c.articles_travaux || []).reduce((s, l) => s + Number(l.qte || 0) * Number(l.pu_achat || 0), 0);
export const critiquePrestation = ({ mode, valeur }) => {
  if (!["pct", "montant"].includes(mode)) return "Choisissez : pourcentage ou montant.";
  const v = Number(valeur);
  if (!(v >= 0)) return "La valeur doit être un nombre positif ou nul.";
  if (mode === "pct" && v > 100) return "Un pourcentage ne dépasse pas 100.";
  return null;
};
export const montantPrestation = (c) => {
  const p = c.prestation || { mode: "pct", valeur: 0 };
  return p.mode === "montant" ? Math.round(Number(p.valeur || 0)) : Math.round((totalArticles(c) * Number(p.valeur || 0)) / 100);
};
export const totalAFacturer = (c) => totalArticles(c) + montantPrestation(c);
export const coutTravaux = (db, c) => coutArticles(c) + totalDepensesChantier(db, c.id);
export const factureDe = (db, c) => (c.vente_id ? (db.ventes || []).find((v) => v.id === c.vente_id) || null : null);
export const detteDe = (db, c) => (c.dette_id ? (db.dettes || []).find((d) => d.id === c.dette_id) || null : null);
export const factureMontant = (db, c) => { const v = factureDe(db, c); return v ? totalVente(v) : 0; };
export const encaisse = (db, c) => {
  const v = factureDe(db, c); if (!v) return 0;
  const d = detteDe(db, c);
  return d ? Number(d.paye || 0) : totalVente(v);
};
export const resteDu = (db, c) => { const d = detteDe(db, c); return d ? resteAPayer(d) : 0; };
export const margeTravaux = (db, c) => factureMontant(db, c) - coutTravaux(db, c);

// ---- Facturer ----
export const critiqueFacturation = (c) => {
  if (c.vente_id) return "Ces travaux sont déjà facturés.";
  if (!(c.articles_travaux || []).length && montantPrestation(c) <= 0) return "Rien à facturer : ajoutez des articles ou des frais de prestation.";
  if (totalAFacturer(c) <= 0) return "Le total à facturer est nul.";
  return null;
};
// Le panier tel que 💰 Ventes l'attend. Les articles de stock sont DÉJÀ
// sortis (deja_sorti : le stock ne rebaisse pas), les HB ne touchent pas le
// stock ni le chiffre d'affaires de la boutique, la prestation est une
// ligne libre (elle compte dans le chiffre d'affaires).
export const panierPourFacture = (c) => {
  const lignes = (c.articles_travaux || []).map((l) => (l.hb
    ? { produit_id: null, article: l.nom, qte: Number(l.qte), pu: Number(l.pu_vente || 0), hors_boutique: true, travaux_ligne_id: l.id }
    : { produit_id: l.produit_id, article: l.nom, qte: Number(l.qte), pu: Number(l.pu_vente || 0), deja_sorti: true, travaux_ligne_id: l.id }));
  const prestation = montantPrestation(c);
  if (prestation > 0) lignes.push({ produit_id: null, article: LIGNE_PRESTATION, qte: 1, pu: prestation, prestation: true });
  return lignes;
};
export const preRempliPourFacture = (c) => ({
  boutique: c.boutique, panier: panierPourFacture(c), travauxId: c.id,
  client: `${c.prenom || ""} ${c.nom}`.trim(), tel: c.tel || "",
});
// La vente (et la dette) reviennent sur la fiche.
export const lierFacture = (c, vente, dette, aujourdhui = today()) => ({
  ...c, vente_id: vente.id, dette_id: dette ? dette.id : null, facture_le: aujourdhui, facture_numero: vente.numero,
});

export const resumeTravaux = (db, c) => `${fmt(totalAFacturer(c))} à facturer · coût ${fmt(coutTravaux(db, c))}`;

// ---- Supprimer (Timo, 13/09/2026) : « tant qu'il n'y a pas d'article rattaché
// aux travaux, donner la possibilité à l'admin principal de supprimer les
// travaux… mais les dépenses liées resteront dans Dépenses pour traçabilité ».
// La fiche part à la corbeille (30 jours, restaurable) ; les dépenses gardent
// chantier_id / chantier_nom et restent visibles dans 📤 Dépenses.
export const ROLES_SUPPRESSION = ["admin"]; // et PRINCIPAL seulement (refuserSaufAdminPrincipal dans le geste)
export const critiqueSuppression = (c) => {
  if (!c) return "Fiche introuvable.";
  if ((c.articles_travaux || []).length > 0) return "Des articles sont rattachés à ces travaux : retirez-les d'abord (ils reviennent en stock), puis supprimez.";
  if (c.vente_id) return "Ces travaux sont déjà facturés : on ne les supprime pas.";
  return null;
};

// ---- L'équipe (Timo, 13/09/2026) : « sur la fiche aussi, donner la possibilité
// de choisir un technicien comme responsable d'équipe, comme dans Clients
// installés ». Même forme d'équipe que les chantiers de devis (le serveur la
// réserve à l'administrateur / au responsable commercial) : membres cochés,
// un chef ⭐, parts à 0 (aucune répartition de frais sur des travaux).
export const ROLES_EQUIPE = ["admin"];
export const critiqueEquipe = (ids, chefId) => {
  if (!(ids || []).length) return "Cochez au moins un technicien.";
  if (!chefId || !ids.includes(chefId)) return "Désignez le responsable d'équipe parmi les techniciens cochés.";
  return null;
};
export const composerEquipe = (techniciens, ids, chefId) => (ids || []).map((id) => {
  const u = (techniciens || []).find((t) => t.id === id);
  return { user_id: id, nom: u ? (u.nom_complet || u.nom) : "?", chef: id === chefId, pct: 0, montant: 0, paye: false };
});
export const chefTravaux = (c) => (c?.equipe || []).find((e) => e.chef) || null;
export const libelleEquipe = (c) => (c?.equipe || []).map((e) => `${e.chef ? "⭐ " : ""}${e.nom}`).join(", ");
