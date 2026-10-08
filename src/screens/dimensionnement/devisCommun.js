// ============================================================
// dimensionnement/devisCommun.js — LA fin du parcours d'un devis, commune
// aux trois volets (☀️ Solaire, 🚪 Garage, 📦 Autre).
//
// Chaque volet calcule SON besoin et SES lignes de métier (rails et
// batteries, porte et kit, liste d'articles). Tout ce qui vient après était
// recopié trois fois : les autres équipements, la pose seule, la remise,
// l'installation, le transport, l'acompte, la mise en forme du devis.
// Une correction faite dans un volet et oubliée dans les deux autres donnait
// trois devis qui ne calculaient plus pareil (relevé des doublons du
// 05/09/2026, point A3/A4 — Timo : « Lance », 07/09/2026).
//
// Ce fichier est PUR (aucun React) : le banc fabrique le même devis avec
// l'ancienne écriture et celle-ci, et vérifie qu'ils sont identiques.
// ============================================================
import { uid, today, heureCourte } from "../../lib/core";
import { apporteurDuFormulaire } from "../../lib/apporteurDevis";
import { CATEGORIE_CF_VISITE, estLigneCfVisite, lignesCfVisite, critiqueCompletion, nombreSaisi } from "../../lib/devisCfVisite";

// ---- Les « autres équipements » (saisie libre) ----
// 📋 Une ligne « cf. visite » (Timo, 08/10/2026 : « mettez cf visite… après
// c'est à compléter et non modifié ») est un autre équipement SANS PRIX : un
// nom, une quantité facultative. Elle ne compte dans aucun total, n'entre
// jamais dans le panier, et revient telle quelle à la reprise d'un devis ou
// d'un brouillon (lib/devisCfVisite.js).
export const reprisesAutres = (lignesReprises) => (lignesReprises || [])
  .filter((l) => l.categorie === "Autres équipements" || estLigneCfVisite(l))
  .map((l) => (estLigneCfVisite(l)
    ? { id: uid(), nom: l.article, prix: "", qte: l.qte ? String(l.qte) : "", cf_visite: true }
    : { id: uid(), nom: l.article, prix: String(l.pu), qte: String(l.qte), hors_boutique: !!l.hors_boutique, produit_id: l.produit_id || null }));
export const nouvelAutre = () => ({ id: uid(), nom: "", prix: "", qte: "1" });
export const nouvelAutreCfVisite = () => ({ id: uid(), nom: "", prix: "", qte: "", cf_visite: true });
export const totalAutres = (autres) => autres.filter((a) => !a.cf_visite).reduce((s, a) => s + Number(a.prix || 0) * Number(a.qte || 1), 0);
export const autresACompleter = (autres) => (autres || []).some((a) => a.cf_visite && String(a.nom || "").trim());
export const lignesAutres = (autres) => autres.filter((a) => a.nom).map((a) => (a.cf_visite
  ? { categorie: CATEGORIE_CF_VISITE, article: a.nom, qte: Number(a.qte) > 0 ? Number(a.qte) : null, pu: 0, total: 0, cf_visite: true }
  : {
    categorie: "Autres équipements", article: a.nom, qte: Number(a.qte || 1),
    pu: Number(a.prix || 0), total: Number(a.prix || 0) * Number(a.qte || 1), hors_boutique: !!a.hors_boutique,
    ...(a.produit_id ? { produit_id: a.produit_id } : {}),
  }));
export const panierAutres = (autres) => autres.filter((a) => !a.cf_visite && a.nom.trim() && a.prix).map((a) => ({
  produit_id: a.produit_id || null, article: a.nom.trim(), qte: Number(a.qte || 1), pu: Number(a.prix), hors_boutique: !!a.hors_boutique,
}));

// Un « autre équipement » se choisit d'abord dans le stock de la boutique
// (demande Timo, 08/09/2026) : le nom tapé ou choisi qui correspond à un
// article du stock LIE la ligne à cet article (prix du stock pré-rempli,
// sortie de stock à l'encaissement, HB décochée). Un nom qui ne correspond
// à rien reste une saisie libre : aucun article ne sortira du stock, et la
// case HB (hors boutique) se coche d'elle-même — on peut la décocher après.
const memeNom = (a, b) => String(a || "").trim().toLowerCase().replace(/\s+/g, " ") === String(b || "").trim().toLowerCase().replace(/\s+/g, " ");
export const articleDuStock = (nom, produits) => (nom && String(nom).trim() ? (produits || []).find((p) => memeNom(p.nom, nom)) || null : null);
export const lierAutreAuStock = (autre, nom, produits) => {
  const p = articleDuStock(nom, produits);
  if (p) return { ...autre, nom: p.nom, produit_id: p.id, prix: String(Number(p.prix_vente || 0)), hors_boutique: false };
  return { ...autre, nom, produit_id: null, ...(String(nom || "").trim() ? { hors_boutique: true } : {}) };
};

// ---- Les totaux : la remise ne porte QUE sur les articles ; installation
// et transport se calculent sur le montant plein. « Pose seule » remplace
// le pourcentage d'installation par un montant fixe, saisi pour ce chantier.
export const calculerTotaux = ({ totalArticles, pctRemise, pctInstall, pctTransport, poseSeule, montantPoseFixe, pctAcompte }) => {
  const remise = Math.round((totalArticles * Number(pctRemise || 0)) / 100);
  const fraisInstallationPct = Math.round((totalArticles * Number(pctInstall || 0)) / 100);
  const fraisTransport = Math.round((totalArticles * Number(pctTransport || 0)) / 100);
  const fraisInstallation = poseSeule ? Number(montantPoseFixe || 0) : fraisInstallationPct;
  const totalDevis = totalArticles - remise + fraisInstallation + fraisTransport;
  const montantAcompte = Math.round((totalDevis * Number(pctAcompte || 100)) / 100);
  return { remise, fraisInstallation, fraisTransport, totalDevis, montantAcompte };
};

// ---- Les trois lignes de fin (installation, transport, remise en négatif) ----
export const lignesFrais = (r) => [
  ...(r.fraisInstallation > 0 ? [{ categorie: "Installation", article: r.poseSeule ? "Frais de pose (matériel du client)" : `Frais d'installation (${r.pctInstall} %)`, qte: 1, pu: r.fraisInstallation, total: r.fraisInstallation }] : []),
  ...(r.fraisTransport > 0 ? [{ categorie: "Transport", article: `Transport / livraison (${r.pctTransport} %)`, qte: 1, pu: r.fraisTransport, total: r.fraisTransport }] : []),
  ...(r.remise > 0 ? [{ categorie: "Remise", article: `Remise (${r.pctRemise} %)`, qte: 1, pu: -r.remise, total: -r.remise }] : []),
];

// ⚠ 29/09/2026 (Timo : « un devis de forage dans les brouillons… dès qu'il
// est repris, il ajoute automatiquement une ligne de frais d'installation »).
// Les trois lignes ci-dessus sont RANGÉES dans `devis.lignes`, à côté des
// articles. Le volet « Autre » reprenait toute ligne qui n'était pas
// « Autres équipements » : la ligne de frais revenait comme un ARTICLE, et
// le pourcentage (lui aussi repris) la recomptait par-dessus — frais en
// double, calculés sur eux-mêmes. UNE règle pour les reconnaître, écrite ICI,
// à côté de ce qui les fabrique : catégorie ET début du libellé (un article
// du stock rangé dans une catégorie « Installation » ne doit pas disparaître).
export const estLigneFrais = (l) => {
  const a = String((l && l.article) || "");
  const c = l && l.categorie;
  return (c === "Installation" && (a.startsWith("Frais d'installation (") || a === "Frais de pose (matériel du client)"))
    || (c === "Transport" && a.startsWith("Transport / livraison ("))
    || (c === "Remise" && a.startsWith("Remise ("));
};

// ---- 📝 La ligne « NB » d'un devis (Timo, 08/10/2026, « 1a, 2b, 3a ») ----
// Un texte TAPÉ à la main sur chaque devis (facultatif), 300 caractères au
// plus (cinq lignes au plus sur le PDF), écrit dans la place blanche à
// GAUCHE du TOTAL (capture Timo, le même jour). Les retours à la ligne deviennent des espaces : c'est le
// PDF qui coupe les lignes, à sa largeur.
export const NB_DEVIS_MAX = 300;
export const nettoyerNb = (texte) => String(texte ?? "").replace(/\s+/g, " ").trim().slice(0, NB_DEVIS_MAX);

// ---- Les champs enregistrés sur le devis, dans cet ordre ----
export const champsReglages = (r) => ({
  total: r.totalDevis,
  pose_seule: r.poseSeule,
  frais_installation: r.fraisInstallation,
  pct_installation: r.poseSeule ? null : Number(r.pctInstall || 0),
  frais_transport: r.fraisTransport,
  pct_transport: Number(r.pctTransport || 0),
  remise: r.remise,
  pct_remise: Number(r.pctRemise || 0),
  pct_acompte: Number(r.pctAcompte || 100),
  montant_acompte: r.montantAcompte,
  delai_installation: String(r.delaiInstallation || "").trim(),
  nb: nettoyerNb(r.nb),
  // 🤝 L'apporteur externe nommé dans le devis (29/09/2026) : il suit le
  // devis jusqu'à l'encaissement (💰 Ventes) ou la dette de pose.
  apporteur_externe: apporteurDuFormulaire(r.apporteur),
});

// ---- Le devis complet. `typeDevis` absent = devis solaire (comme avant :
// un devis sans type rouvre dans Solaire). `complement` = champs propres au
// volet placés après le type (le domaine, pour Autre).
export function construireDevis({ profile, boutique, typeDevis, complement = {}, besoins, panierMetier, lignesMetier, autres, reglages, horodatage }) {
  const h = horodatage || { id: uid(), date: today(), heure: heureCourte() };
  return {
    id: h.id,
    date: h.date,
    heure: h.heure,
    par: profile.nom,
    par_id: profile.id,
    par_role: profile.role,           // décide si une commission sera due
    statut: "propose",                // propose → valide → paye
    panier: [...panierMetier, ...panierAutres(autres)],   // ce que le vendeur encaissera
    boutique,
    ...(typeDevis ? { type_devis: typeDevis } : {}),
    ...complement,
    besoins,
    lignes: [...lignesMetier, ...lignesAutres(autres), ...lignesFrais(reglages)],
    ...champsReglages(reglages),
  };
}

// ---- Les brouillons de devis (📝 Mes brouillons, demande Timo 08/09/2026) ----
// Rangés dans la fiche de leur auteur : personnels, synchronisés, sans SQL.
export const brouillonsDe = (u) => (Array.isArray(u?.brouillons_devis) ? u.brouillons_devis : []);
export const ajouterBrouillon = (db, profileId, brouillon) => ({
  ...db,
  users: (db.users || []).map((u) => (u.id === profileId
    ? { ...u, brouillons_devis: [brouillon, ...brouillonsDe(u).filter((b) => b.id !== brouillon.id)] }
    : u)),
});
export const retirerBrouillon = (db, profileId, id) => ({
  ...db,
  users: (db.users || []).map((u) => (u.id === profileId && brouillonsDe(u).some((b) => b.id === id)
    ? { ...u, brouillons_devis: brouillonsDe(u).filter((b) => b.id !== id) }
    : u)),
});

// ---- 📝 Un brouillon SANS client, et 📨 un brouillon CONFIÉ (Timo, 05/10/2026 :
// « enregistrer un brouillon soit toujours possible… brouillon sans client,
// continuer ? Si oui, il s'enregistre mais avec obligatoirement un nom » ;
// « permettre qu'un utilisateur puisse envoyer son brouillon à un autre…
// pour qu'il délègue » → « 1 déplacé, 2 celui qui envoie »).
// Le NOM d'un brouillon : le client s'il y en a un, sinon le nom donné.
export const nomDuBrouillon = (b) => b?.client?.nom || b?.nom || "?";
export const brouillonSansClient = (b) => !b?.client?.id && !b?.client?.nom;
// 08/10/2026 (Timo : « quand on reprend un brouillon, le nom sous lequel il
// était enregistré devrait revenir automatiquement dans nouveau client, avec
// possibilité de modifier ») : la reprise d'un brouillon SANS compte ouvre
// « ➕ Nouveau client » avec ce nom ; il reste modifiable, et on peut toujours
// choisir un compte existant dans la liste.
export const nomRepris = (r) => (r?.client?.id ? "" : String(r?.client?.nom || r?.brouillon_nom || "").trim());
export const clientDeLaReprise = (r) => (r?.client?.id ? r.client.id : nomRepris(r) ? "__nouveau__" : "");
export const critiqueNomBrouillon = (nom) =>
  String(nom || "").trim() ? "" : "Tapez le nom du client (ex. « WIYAO ») : le brouillon se range sous ce nom.";
// À qui confier : les personnes de la LISTE reçue (déjà filtrée par l'espace
// regardé — jamais db.users), actives, qui ont l'onglet Dimensionnement, sans
// le pouvoir retiré, jamais un client, jamais soi-même.
export function destinatairesBrouillon(personnes, profile, ongletsRole) {
  return (personnes || []).filter((u) => u && u.id !== profile.id && u.role !== "client" && u.actif !== false
    && (ongletsRole[u.role] || []).includes("dimensionnement")
    && !(u.droits_off || []).includes("dimensionnement"))
    .sort((a, b) => String(a.nom || "").localeCompare(String(b.nom || ""), "fr", { sensitivity: "base" }));
}
// Le brouillon QUITTE la fiche de celui qui confie et ARRIVE chez l'autre
// (déplacé, jamais copié : deux copies partiraient deux fois au client). Il
// garde tout ; il porte qui l'a confié, et le devis garde « préparé par ».
// Refusé si le brouillon n'est plus chez celui qui confie (déjà confié,
// envoyé ou supprimé depuis un autre appareil), ou si le destinataire manque.
export function confierBrouillon(db, deId, aId, brouillonId, { par, le }) {
  const de = (db.users || []).find((u) => u.id === deId);
  const a = (db.users || []).find((u) => u.id === aId);
  const b = brouillonsDe(de).find((x) => x.id === brouillonId);
  if (!b) return { erreur: "Ce brouillon n'est plus dans vos brouillons (déjà confié, envoyé ou supprimé)." };
  if (!a || a.id === deId) return { erreur: "Choisissez la personne à qui confier ce brouillon." };
  const prepare = b.devis?.prepare_par || par;
  const confie = { ...b, confie: { par, par_id: deId, le }, devis: { ...(b.devis || {}), prepare_par: prepare } };
  const db2 = retirerBrouillon(db, deId, brouillonId);
  return { db: ajouterBrouillon(db2, aId, confie), brouillon: confie, destinataire: a };
}

// ============ ✍️ COMPLÉTER UN DEVIS APRÈS LA VISITE (Timo, 08/10/2026) ============
// « Après c'est à compléter et non modifié » : chaque ligne cf. visite reçoit
// un article, une quantité et un prix (ou « sans objet »), des lignes
// découvertes à la visite peuvent s'ajouter — et TOUT LE RESTE NE BOUGE PAS :
// les lignes déjà chiffrées restent intactes, les pourcentages négociés
// (remise, installation, transport, acompte) aussi ; seuls les montants qui
// en découlent se recalculent (calculerTotaux, lignesFrais — les règles des
// trois volets, jamais une copie). Le devis garde son id, sa date, son statut
// ⏳ Proposé. La trace dit « complété », jamais « modifié » : aucun champ de
// modification n'est touché.
// `reponses[i]` répond à la i-ème ligne cf. visite : { nom, qte, prix,
// produit_id?, hors_boutique?, sans_objet? } ; `ajouts` : mêmes champs.
// Rend { devis } ou { erreur }.
export function completerDevis(devis, { reponses = [], ajouts = [], produits = [], par, par_id, le }) {
  const refus = critiqueCompletion(devis, { reponses, ajouts });
  if (refus) return { erreur: refus };
  const cf = lignesCfVisite(devis);
  // Une ligne saisie : liée au stock si son nom y correspond exactement
  // (la règle des autres équipements), sinon libre et HB.
  const versLigne = (r) => {
    const lie = r.produit_id ? { ...r } : lierAutreAuStock({ hors_boutique: !!r.hors_boutique }, r.nom, produits);
    const qte = nombreSaisi(r.qte), pu = nombreSaisi(r.prix);
    return {
      categorie: "Autres équipements", article: String(lie.nom || r.nom).trim(), qte, pu, total: pu * qte,
      hors_boutique: !!lie.hors_boutique, ...(lie.produit_id ? { produit_id: lie.produit_id } : {}), complete_apres_visite: true,
    };
  };
  const chiffrees = reponses.filter((r) => r && !r.sans_objet).map(versLigne);
  const ajoutees = ajouts.filter((a) => String(a.nom || "").trim()).map(versLigne);
  const nouvelles = [...chiffrees, ...ajoutees];
  // Les lignes d'articles d'avant, intactes (ni frais, ni cf. visite).
  const articles = (devis.lignes || []).filter((l) => !estLigneFrais(l) && !estLigneCfVisite(l));
  const totalArticles = [...articles, ...nouvelles].reduce((s, l) => s + Number(l.total || 0), 0);
  const poseSeule = !!devis.pose_seule;
  const reglages = {
    pctRemise: devis.pct_remise ?? 0, pctInstall: devis.pct_installation ?? 0, pctTransport: devis.pct_transport ?? 0,
    poseSeule, montantPoseFixe: poseSeule ? devis.frais_installation : 0, pctAcompte: devis.pct_acompte ?? 100,
  };
  const t = calculerTotaux({ totalArticles, ...reglages });
  const r = { ...reglages, ...t };
  const historique = {
    le, par, par_id,
    total_avant: Number(devis.total || 0), total_apres: t.totalDevis,
    elements: (() => { let k = 0; return cf.map((l, i) => {
      if (reponses[i]?.sans_objet) return { article: l.article, devient: "sans objet" };
      const c = chiffrees[k++];
      return { article: l.article, devient: `${c.article} × ${c.qte}` };
    }); })(),
    ajouts: ajoutees.map((l) => l.article),
  };
  return {
    devis: {
      ...devis,
      lignes: [...articles, ...nouvelles, ...lignesFrais(r)],
      panier: [...(devis.panier || []), ...nouvelles.map((l) => ({ produit_id: l.produit_id || null, article: l.article, qte: l.qte, pu: l.pu, hors_boutique: !!l.hors_boutique }))],
      total: t.totalDevis,
      frais_installation: t.fraisInstallation,
      frais_transport: t.fraisTransport,
      remise: t.remise,
      montant_acompte: t.montantAcompte,
      complete_le: le, complete_par: par, complete_par_id: par_id,
      historique_completion: [...(Array.isArray(devis.historique_completion) ? devis.historique_completion : []), historique],
    },
  };
}
