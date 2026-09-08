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
import { uid, today } from "../../lib/core";

// ---- Les « autres équipements » (saisie libre) ----
export const reprisesAutres = (lignesReprises) => (lignesReprises || [])
  .filter((l) => l.categorie === "Autres équipements")
  .map((l) => ({ id: uid(), nom: l.article, prix: String(l.pu), qte: String(l.qte), hors_boutique: !!l.hors_boutique }));
export const nouvelAutre = () => ({ id: uid(), nom: "", prix: "", qte: "1" });
export const totalAutres = (autres) => autres.reduce((s, a) => s + Number(a.prix || 0) * Number(a.qte || 1), 0);
export const lignesAutres = (autres) => autres.filter((a) => a.nom).map((a) => ({
  categorie: "Autres équipements", article: a.nom, qte: Number(a.qte || 1),
  pu: Number(a.prix || 0), total: Number(a.prix || 0) * Number(a.qte || 1), hors_boutique: !!a.hors_boutique,
}));
export const panierAutres = (autres) => autres.filter((a) => a.nom.trim() && a.prix).map((a) => ({
  produit_id: null, article: a.nom.trim(), qte: Number(a.qte || 1), pu: Number(a.prix), hors_boutique: !!a.hors_boutique,
}));

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
});

// ---- Le devis complet. `typeDevis` absent = devis solaire (comme avant :
// un devis sans type rouvre dans Solaire). `complement` = champs propres au
// volet placés après le type (le domaine, pour Autre).
export function construireDevis({ profile, boutique, typeDevis, complement = {}, besoins, panierMetier, lignesMetier, autres, reglages, horodatage }) {
  const h = horodatage || { id: uid(), date: today(), heure: new Date().toTimeString().slice(0, 5) };
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
