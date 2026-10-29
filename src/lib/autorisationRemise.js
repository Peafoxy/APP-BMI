// ============================================================
// lib/autorisationRemise.js — LA REMISE PONCTUELLE AUTORISÉE À DISTANCE
//
// Timo (29/10/2026) : « Il faut vraiment qu'on donne la possibilité
// ponctuelle à un gérant ou vendeur d'appliquer une remise à un client »
// → « A a » (la demande part de la vente, un administrateur l'accorde ou
// la refuse à distance), puis « 1 tout admin ».
//
// LE PARCOURS :
//   • au-delà de la limite de remise (⚙ Paramètres, 3 % d'office), le
//     vendeur ou le gérant ne se voit plus seulement refuser : il DEMANDE
//     (motif obligatoire). La demande se range sur la fiche de SA boutique,
//     dans `demandes_remise` — JAMAIS dans `demandes` (ravitaillements et
//     transferts : vingt endroits les lisent comme tels) ;
//   • TOUT administrateur de l'espace est prévenu (notification) et
//     ACCORDE ou REFUSE (motif) dans 💰 Ventes. L'accord s'écrit dans
//     `remises_autorisees`, un champ de la boutique que SEUL un
//     administrateur peut écrire (la base le garde déjà : securite-26) ;
//   • l'accord vaut pour CETTE vente seulement : le même panier (mêmes
//     articles, quantités, prix, remises de ligne — `panierNormalise`), le
//     même pourcentage, le même client (8 derniers chiffres du numéro), et
//     une seule fois. Un article de plus, une quantité ou un prix changé →
//     il faut redemander ;
//   • la vente porte `remise_autorisee` (qui, quand, pourquoi) : la trace.
//
// ⚠ LE COUPLE : securite-44 (la base accepte la remise d'une vente qui cite
// un accord rangé dans `remises_autorisees` de sa boutique, même panier,
// même %, même client, jamais deux fois ; et laisse le vendeur écrire
// `demandes_remise`). Sans lui, l'écran laisse passer et la base refuse.
// ============================================================
import { uid, today, heureCourte } from "./core";
import { panierNormalise, remiseExigeAdmin, remiseLigneExigeAdmin } from "./calculs";

export const STATUT_ATTENTE_REMISE = "en_attente";
export const STATUT_ACCORDEE = "accordee";
export const STATUT_REFUSEE_REMISE = "refusee";
export const STATUT_UTILISEE = "utilisee";
export const STATUT_ANNULEE_REMISE = "annulee";

export const demandesRemiseDe = (b) => (b && b.demandes_remise) || [];
export const remisesAutoriseesDe = (b) => (b && b.remises_autorisees) || [];

const huitChiffres = (tel) => String(tel || "").replace(/\D/g, "").slice(-8);

// Ce qu'on compare : la forme du panier (celle de la base), le %, le client.
const lignesDuPanier = (panier) => (panier || []).map((l) => ({
  produit_id: l.produit_id || null,
  article: l.article || l.nom || "Article",
  qte: Number(l.qte || 0),
  pu: Number(l.pu || 0),
  remise_ligne: Number(l.remise_ligne || 0),
}));

export const memeOffre = (a, { panier, remisePct, tel }) => !!a
  && Number(a.remise_pct || 0) === Number(remisePct || 0)
  && huitChiffres(a.tel) === huitChiffres(tel)
  && JSON.stringify(panierNormalise(a.lignes)) === JSON.stringify(panierNormalise(panier));

// La remise du panier sort-elle de ce que le rôle peut accorder seul ?
export const besoinAutorisation = ({ panier, remisePct, plafond, role }) => role !== "admin"
  && (remiseExigeAdmin(remisePct, plafond) || (panier || []).some((l) => remiseLigneExigeAdmin(l, plafond)));

// Un accord est-il déjà consommé par une vente ?
const dejaUtilise = (ventes, id) => (ventes || []).some((v) => v.remise_autorisee?.id === id);

// L'accord VALABLE pour ce panier, dans cette boutique : jamais un déjà utilisé.
export const autorisationPour = (ficheBoutique, ventes, offre) => remisesAutoriseesDe(ficheBoutique)
  .find((a) => memeOffre(a, offre) && !dejaUtilise(ventes, a.id)) || null;

// La demande de ce panier qui attend encore, ou la dernière refusée.
export const demandeDeLOffre = (ficheBoutique, offre, statut) => [...demandesRemiseDe(ficheBoutique)]
  .reverse().find((d) => d.statut === statut && memeOffre(d, offre)) || null;

export const critiqueDemandeRemise = ({ motif, panier, lignes }) => {
  if (!(lignes || panier || []).length) return "Le panier est vide.";
  if (!String(motif || "").trim()) return "Le motif est obligatoire : l'administrateur doit savoir pourquoi accorder cette remise.";
  return "";
};

export const construireDemandeRemise = ({ profile, boutique, panier, remisePct, remise, remiseMode, brut, client, tel, motif }) => ({
  id: uid(),
  date: today(),
  heure: heureCourte(),
  boutique,
  par: profile.nom,
  par_id: profile.id,
  role: profile.role,
  client: client || "Client non renseigné",
  tel: tel || "",
  lignes: lignesDuPanier(panier),
  sous_total: Math.round(Number(brut || 0)),
  remise_pct: Number(remisePct || 0),
  remise_montant: Math.round(Number(remise || 0)),
  ...(remiseMode ? { remise_mode: remiseMode } : {}),
  motif: String(motif || "").trim(),
  statut: STATUT_ATTENTE_REMISE,
});

const majDemande = (b, id, champs) => ({ ...b, demandes_remise: demandesRemiseDe(b).map((d) => (d.id === id ? { ...d, ...champs } : d)) });
const surBoutique = (boutiques, nom, f) => (boutiques || []).map((b) => (b.nom === nom ? f(b) : b));

export const poserDemandeRemise = (boutiques, demande) =>
  surBoutique(boutiques, demande.boutique, (b) => ({ ...b, demandes_remise: [...demandesRemiseDe(b), demande] }));

// Seul un administrateur décide (revérifié DANS le geste, et par la base).
export const critiqueDecisionRemise = ({ profile, demande, motif, refus }) => {
  if (profile?.role !== "admin") return "Seul un administrateur accorde ou refuse une remise.";
  if (!demande) return "Cette demande n'existe plus.";
  if (demande.statut !== STATUT_ATTENTE_REMISE) return "Cette demande a déjà reçu une réponse.";
  if (refus && !String(motif || "").trim()) return "Le motif du refus est obligatoire.";
  return "";
};

export const accorderRemise = (boutiques, demande, profile) => {
  const accord = {
    id: demande.id,
    date: today(), heure: heureCourte(),
    par: profile.nom, par_id: profile.id,
    demande_par: demande.par, demande_par_id: demande.par_id,
    client: demande.client, tel: demande.tel,
    lignes: demande.lignes, remise_pct: demande.remise_pct,
    motif: demande.motif,
  };
  return surBoutique(boutiques, demande.boutique, (b) => ({
    ...majDemande(b, demande.id, { statut: STATUT_ACCORDEE, decide_par: profile.nom, decide_par_id: profile.id, decide_le: today(), decide_heure: heureCourte() }),
    remises_autorisees: [...remisesAutoriseesDe(b), accord],
  }));
};

export const refuserRemise = (boutiques, demande, profile, motif) => surBoutique(boutiques, demande.boutique, (b) =>
  majDemande(b, demande.id, { statut: STATUT_REFUSEE_REMISE, decide_par: profile.nom, decide_par_id: profile.id, decide_le: today(), decide_heure: heureCourte(), motif_refus: String(motif || "").trim() }));

export const annulerDemandeRemise = (boutiques, demande) => surBoutique(boutiques, demande.boutique, (b) =>
  majDemande(b, demande.id, { statut: STATUT_ANNULEE_REMISE }));

// La trace posée sur la vente, et la demande marquée « utilisée ».
export const traceSurLaVente = (accord) => ({
  id: accord.id, par: accord.par, par_id: accord.par_id, le: accord.date, heure: accord.heure, motif: accord.motif,
});
export const marquerUtilisee = (boutiques, boutique, id, venteId) => surBoutique(boutiques, boutique, (b) =>
  majDemande(b, id, { statut: STATUT_UTILISEE, vente_id: venteId, utilisee_le: today() }));

// Les demandes qui attendent un administrateur, sur les boutiques DÉJÀ
// filtrées par l'espace (le mur : jamais `db.boutiques` en entier).
export const demandesAAutoriser = (boutiquesVisibles) => (boutiquesVisibles || [])
  .flatMap((b) => demandesRemiseDe(b).filter((d) => d.statut === STATUT_ATTENTE_REMISE).map((d) => ({ ...d, boutique: d.boutique || b.nom })));

// Les demandes d'une personne dans une boutique, les plus récentes d'abord.
export const mesDemandesRemise = (ficheBoutique, profile, n = 5) => demandesRemiseDe(ficheBoutique)
  .filter((d) => d.par_id === profile.id && d.statut !== STATUT_ANNULEE_REMISE)
  .slice(-n).reverse();

export const LIBELLE_STATUT_REMISE = {
  [STATUT_ATTENTE_REMISE]: "⏳ En attente d'un administrateur",
  [STATUT_ACCORDEE]: "✅ Accordée",
  [STATUT_REFUSEE_REMISE]: "✖ Refusée",
  [STATUT_UTILISEE]: "🧾 Utilisée",
};
