// ============================================================
// lib/achatsChantier.js — 🏗 LA CAISSE CHANTIER, ÉTAPE 2 : LE MATÉRIEL
// QUI PART AU CHANTIER (Timo, 11/10/2026, « A a, B b, C oui, D comme
// aujourd'hui, E oui », puis « 1 à 5 ok, F tout seul, G oui », puis « H : la
// case sur le devis + oui »).
//
// Un devis coché « 🔧 Avec installation » ne sort PAS le stock quand le client
// paie : la vente garde son chiffre d'affaires, ses commissions, son apporteur
// et son parrain, mais ses lignes portent `au_chantier` (le stock ne bouge
// pas, leur prix d'achat ne compte pas). Le matériel sort plus tard, quand la
// gérante fait, d'après la liste des techniciens, une vente avec la case
// « 🏗 Chantier » cochée : c'est un ACHAT POUR LE CHANTIER.
//   1. il sort le stock (ajustements `sortie_chantier`) et compte son prix
//      d'achat, mais il n'est PAS une vente : ni chiffre d'affaires, ni
//      commission, ni tiroir, ni clôture (rien n'est écrit dans db.ventes) ;
//   2. il est « 🏗 Payé par le chantier » : il se déduit de ce que le client a
//      payé pour son devis — aucun argent ne change de caisse ;
//   3. ce que le client n'a pas encore payé reste « ⏳ en attente du
//      chantier », sans dette : le prochain versement du client le règle
//      d'abord, TOUT SEUL (F), et le gérant en est informé ;
//   4. aucun WhatsApp, aucune question « vente sans numéro » : le document
//      s'intitule « FACTURE D'ACHAT POUR LE CHANTIER … », il reste interne ;
//   5. au-delà de la part MATÉRIEL du devis, un avertissement (jamais un
//      refus) : le surplus mange les frais d'installation.
// Prix de la boutique, remises comme au comptoir (B b) ; lié au chantier (C).
// Le gérant et l'administrateur seulement (un mouvement de stock : le serveur
// réserve déjà les ajustements au magasinier, au gérant, à l'administrateur).
// Les devis d'avant ne portent pas la case : rien ne change pour eux (E), et
// un devis de matériel seul reste comme aujourd'hui (D, H2).
// Règles PURES : aucun écran, aucune base entière parcourue — les listes
// reçues sont déjà filtrées par l'espace regardé (le mur).
// ============================================================
import { uid, today, heureCourte, totalVente, lignesVente, fmt } from "./core";

export const TYPE_SORTIE_CHANTIER = "sortie_chantier";
export const TYPE_RETOUR_CHANTIER = "retour_chantier";
export const ROLES_ACHAT_CHANTIER = ["gerant", "admin"];
export const PAIEMENT_CHANTIER = "🏗 Payé par le chantier";
export const TITRE_FACTURE_ACHAT = "FACTURE D'ACHAT POUR LE CHANTIER";

export const peutAcheterPourChantier = (profile) => ROLES_ACHAT_CHANTIER.includes(profile && profile.role);

// ---- H : la case « 🔧 Avec installation » du devis ----
// Cochée d'office dès qu'il y a des frais d'installation ; celui qui établit
// le devis la coche pour une installation offerte, ou la décoche. Une pose
// seule n'a pas de matériel. `choix` null = d'office.
export const avecInstallationDuDevis = ({ poseSeule, fraisInstallation, choix }) =>
  !poseSeule && (choix === true || choix === false ? choix : Number(fraisInstallation || 0) > 0);
// Le devis enregistré : seulement s'il porte la case (les devis d'avant non).
export const stockAuChantier = (devis) => !!(devis && devis.avec_installation === true && !devis.pose_seule);
// Une ligne de vente sort-elle du stock ? Non si elle est déjà sortie
// (🛠 travaux) ou si elle attend le chantier.
export const ligneSortDuStock = (l) => !!l && !l.deja_sorti && !l.au_chantier;

// ---- Les achats d'un chantier ----
export const achatsDe = (c) => (Array.isArray(c && c.achats_chantier) ? c.achats_chantier : []);
export const achatsActifs = (c) => achatsDe(c).filter((a) => !a.annule);
const brutLignes = (lignes) => (lignes || []).reduce((s, l) => s + Number(l.qte || 0) * Number(l.pu || 0) - Number(l.remise_ligne || 0), 0);
export const totalAchat = (a) => Math.max(0, Math.round(brutLignes(a && a.lignes) - Number((a && a.remise) || 0)));
const cleTemps = (a) => `${a.date || ""} ${a.heure || ""} ${a.id || ""}`;

// G : les chantiers proposés dans la case — la liste reçue (espace regardé),
// nés d'un devis coché « Avec installation » (`stock_au_chantier`), pas encore
// réceptionnés, jamais des 🛠 travaux, jamais à la corbeille.
export const chantierOuvertAuxAchats = (c) => !!c && c.stock_au_chantier === true && !c.travaux
  && c.statut !== "receptionne" && !c.supprime_le;
export const chantiersPourAchat = (chantiers) => (chantiers || []).filter(chantierOuvertAuxAchats)
  .slice().sort((a, b) => `${a.nom || ""} ${a.prenom || ""}`.localeCompare(`${b.nom || ""} ${b.prenom || ""}`, "fr", { sensitivity: "base" }));
export const nomChantier = (c) => `${c && c.prenom ? `${c.prenom} ` : ""}${(c && c.nom) || "?"}`.trim();

// ---- L'argent du chantier : ce que le client a payé pour son devis ----
// Comptant : tout (articles + frais). À crédit : ce que SA dette a reçu.
export const payeParLeClient = (vente, dette) => {
  if (dette) return Math.max(0, Number(dette.paye || 0));
  if (!vente) return 0;
  if (/Crédit/i.test(String(vente.paiement || ""))) return Math.max(0, Number(vente.avance || 0));
  return Math.max(0, totalVente(vente) + Number(vente.frais_installation || 0) + Number(vente.frais_transport || 0));
};
// La part MATÉRIEL du devis : ses articles, remise déduite (sans les frais).
export const partMaterielDuDevis = (vente) => (vente ? Math.max(0, totalVente(vente)) : 0);

// Les achats actifs couverts dans l'ordre du temps : les premiers d'abord.
export function couvertureAchats(achats, paye) {
  let reste = Math.max(0, Number(paye || 0));
  const parId = new Map();
  (achats || []).filter((a) => !a.annule).slice().sort((x, y) => cleTemps(x).localeCompare(cleTemps(y))).forEach((a) => {
    const t = totalAchat(a);
    const couvert = Math.min(t, reste);
    reste -= couvert;
    parId.set(a.id, { total: t, couvert, enAttente: t - couvert });
  });
  return parId;
}

export function argentDuChantier({ chantier, vente, dette }) {
  const paye = payeParLeClient(vente, dette);
  const materiel = partMaterielDuDevis(vente);
  const achete = achatsActifs(chantier).reduce((s, a) => s + totalAchat(a), 0);
  return {
    paye, materiel, achete,
    couvert: Math.min(achete, paye),
    enAttente: Math.max(0, achete - paye),
    disponible: Math.max(0, paye - achete),
    depasseMateriel: achete > materiel,
    couverture: couvertureAchats(achatsDe(chantier), paye),
  };
}

// 5 : l'avertissement, jamais un refus.
export const avertissementMateriel = (argent, totalNouvel = 0) => {
  const apres = argent.achete + Number(totalNouvel || 0);
  if (!(apres > argent.materiel)) return "";
  return `⚠ Le matériel acheté pour ce chantier (${fmt(apres)}) dépasse la part matériel du devis (${fmt(argent.materiel)}) de ${fmt(apres - argent.materiel)} : ce surplus est pris sur les frais d'installation.`;
};

// ---- L'achat : la règle, puis la fabrique ----
export function critiqueAchatChantier({ profile, chantier, panier }) {
  if (!peutAcheterPourChantier(profile)) return "🔒 Un achat pour un chantier est réservé au gérant et à l'administrateur.";
  if (!chantier) return "Choisissez le chantier.";
  if (!chantierOuvertAuxAchats(chantier)) return `Le chantier de ${nomChantier(chantier)} ne reçoit plus d'achat (réceptionné, ou devis sans installation).`;
  if (!(panier || []).length) return "Le panier est vide : ajoutez au moins un article.";
  const libres = (panier || []).filter((l) => !l.produit_id || l.hors_boutique);
  if (libres.length) return `Un achat pour un chantier ne prend que des articles du stock (${libres.map((l) => l.article).join(", ")}).`;
  if ((panier || []).some((l) => !(Number(l.qte) > 0))) return "Chaque article doit avoir une quantité supérieure à zéro.";
  return null;
}

export function construireAchatChantier({ chantier, panier, remise = 0, remisePct = 0, boutique, profile, numero, date = today(), heure = heureCourte(), produits = [] }) {
  const id = uid();
  const prixAchat = new Map((produits || []).map((p) => [p.id, Number(p.prix_achat || 0)]));
  const lignes = (panier || []).map((l) => ({
    produit_id: l.produit_id, article: l.article, qte: Number(l.qte), pu: Number(l.pu || 0),
    remise_ligne: Number(l.remise_ligne || 0), pu_achat: prixAchat.get(l.produit_id) || 0,
  }));
  const nom = nomChantier(chantier);
  const ajustements = lignes.map((l) => ({
    id: uid(), date, boutique, produit_id: l.produit_id, nom: l.article, qte: -l.qte,
    type: TYPE_SORTIE_CHANTIER, chantier_id: chantier.id, achat_chantier_id: id,
    motif: `Achat pour le chantier ${nom} (${numero})`, par: profile.nom,
  }));
  const achat = {
    id, numero, date, heure, boutique, lignes, remise: Number(remise || 0), remise_pct: Number(remisePct || 0),
    paiement: PAIEMENT_CHANTIER, par: profile.nom, par_id: profile.id, ajustements: ajustements.map((a) => a.id),
  };
  return {
    achat, ajustements,
    fiche: { ...chantier, achats_chantier: [...achatsDe(chantier), achat] },
    journal: `🏗 Achat ${numero} pour le chantier ${nom} (${fmt(totalAchat(achat))}) — ${boutique} — payé par le chantier`,
  };
}

// ---- Annuler un achat (erreur de saisie) : l'administrateur, avant la
// réception, motif obligatoire. Le stock revient (ajustements positifs) ;
// rien n'est effacé : l'achat garde sa trace, marqué annulé.
export function critiqueAnnulationAchat({ profile, chantier, achat, motif }) {
  if (!profile || profile.role !== "admin") return "🔒 Annuler un achat pour un chantier est réservé à l'administrateur.";
  if (!achat) return "Achat introuvable.";
  if (achat.annule) return "Cet achat est déjà annulé.";
  if (chantier && chantier.statut === "receptionne") return "Le chantier est réceptionné : on n'annule plus ses achats.";
  if (!String(motif || "").trim()) return "Le motif est obligatoire.";
  return null;
}
export function annulerAchatChantier({ chantier, achatId, motif, profile, date = today() }) {
  const achat = achatsDe(chantier).find((a) => a.id === achatId);
  const ajustements = (achat ? achat.lignes : []).map((l) => ({
    id: uid(), date, boutique: achat.boutique, produit_id: l.produit_id, nom: l.article, qte: Number(l.qte),
    type: TYPE_RETOUR_CHANTIER, chantier_id: chantier.id, achat_chantier_id: achat.id,
    motif: `Annulation de l'achat ${achat.numero} (chantier ${nomChantier(chantier)}) — ${String(motif).trim()}`, par: profile.nom,
  }));
  return {
    ajustements,
    fiche: { ...chantier, achats_chantier: achatsDe(chantier).map((a) => (a.id === achatId ? { ...a, annule: { le: date, par: profile.nom, motif: String(motif).trim() } } : a)) },
    journal: `🏗 Achat ${achat ? achat.numero : "?"} pour le chantier ${nomChantier(chantier)} ANNULÉ par ${profile.nom} — ${String(motif).trim()} (le stock revient)`,
  };
}

// ---- Le coût (point 1) : les achats sous la forme d'une vente, pour la
// fabrique du prix d'achat (coutDesVentes) — jamais pour le chiffre
// d'affaires. Reçoit les chantiers déjà filtrés.
export const achatsCommeVentes = (chantiers) => (chantiers || []).flatMap((c) => achatsActifs(c).map((a) => ({
  id: a.id, numero: a.numero, boutique: a.boutique, date: a.date, articles: a.lignes, remise: a.remise, achat_chantier: true,
})));

// La vente d'un chantier, sa dette (listes reçues).
export const venteDuChantier = (chantier, ventes) => (chantier && chantier.vente_id ? (ventes || []).find((v) => v.id === chantier.vente_id) || null : null);
export const detteDuChantier = (chantier, dettes) => (chantier && chantier.vente_id ? (dettes || []).find((d) => d.vente_id === chantier.vente_id) || null : null);

// ---- F : le versement qui règle un achat en attente — pour informer le
// gérant de la boutique de l'achat. Rend les achats dont l'attente a baissé.
export function achatsReglesParUnVersement(chantier, payeAvant, payeApres) {
  if (!(Number(payeApres) > Number(payeAvant))) return [];
  const avant = couvertureAchats(achatsDe(chantier), payeAvant);
  const apres = couvertureAchats(achatsDe(chantier), payeApres);
  return achatsActifs(chantier).map((a) => {
    const x = avant.get(a.id), y = apres.get(a.id);
    return x && y && y.enAttente < x.enAttente ? { achat: a, enAttenteAvant: x.enAttente, enAttente: y.enAttente } : null;
  }).filter(Boolean);
}

// Le résumé d'un achat, une ligne.
export const resumeAchat = (a) => (a.lignes || []).map((l) => `${l.qte}× ${l.article}`).join(", ");
// Les lignes d'une vente de devis marquées « au chantier ».
export const lignesAuChantier = (vente) => lignesVente(vente).filter((l) => l.au_chantier);
