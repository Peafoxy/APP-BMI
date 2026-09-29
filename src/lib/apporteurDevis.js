// ============================================================
// lib/apporteurDevis.js — 🤝 L'APPORTEUR EXTERNE NOMMÉ DANS LE DEVIS
// (Timo, 29/09/2026 : « a, tous ceux qui établissent un devis, lance… Mais
// fixer un pourcentage de 3 % par défaut non modifiable… Pour modifier,
// l'initiateur enregistre comme brouillon, l'admin principal change le
// pourcentage et lui il reprend pour envoyer au client »).
//
// Avant, l'apporteur externe ne se déclarait qu'à l'ENCAISSEMENT, dans
// 💰 Ventes : le devis n'en gardait aucune trace, et une pose seule (qui ne
// passe jamais par 💰 Ventes) ne pouvait pas en avoir du tout.
//
// Règles pures, SANS IMPORT (lisibles par Node, comme lib/banques.js).
//   • Tous ceux qui établissent un devis peuvent nommer l'apporteur.
//   • Son pourcentage est 3 % d'office et ne se change PAS — sauf par
//     l'administrateur principal, sur le devis qu'il établit lui-même ou sur
//     le BROUILLON d'un autre (la marque `taux_fixe_par` le dit).
//   • La commission se calcule sur les ARTICLES (remise déduite) — comme à
//     l'encaissement depuis toujours, jamais sur les frais d'installation ni
//     de transport ; pour une POSE SEULE, sur le montant de la pose.
// ============================================================

export const TAUX_APPORTEUR_DEFAUT = 3;

// L'état du formulaire dans un volet (et dans 💰 Ventes).
export const apporteurVide = () => ({ actif: false, nom: "", tel: "", taux: String(TAUX_APPORTEUR_DEFAUT), taux_fixe_par: null, taux_fixe_le: null });

// Le taux se change par l'administrateur PRINCIPAL seul. Ce fichier n'importe
// rien : c'est l'écran qui dit s'il l'est (`estAdminPrincipal(db, profile)`,
// qui connaît aussi le repli « premier administrateur créé »).

// Ce qui s'enregistre sur le devis : rien si la case n'est pas cochée ou si
// le nom manque (le refus, lui, est dit par critiqueApporteur).
export const apporteurDuFormulaire = (a) => {
  if (!a || !a.actif || !String(a.nom || "").trim()) return null;
  const taux = Number(a.taux);
  return {
    nom: String(a.nom).trim(),
    tel: String(a.tel || "").trim(),
    taux: Number.isFinite(taux) ? taux : TAUX_APPORTEUR_DEFAUT,
    ...(a.taux_fixe_par ? { taux_fixe_par: a.taux_fixe_par, taux_fixe_le: a.taux_fixe_le || null } : {}),
  };
};

// Relire un devis (ou un brouillon) repris : la case se recoche avec ce qui
// avait été enregistré, marque du principal comprise.
export const apporteurDepuisDevis = (devis) => {
  const a = devis && devis.apporteur_externe;
  if (!a || !a.nom) return apporteurVide();
  return {
    actif: true, nom: a.nom, tel: a.tel || "",
    taux: String(Number.isFinite(Number(a.taux)) ? Number(a.taux) : TAUX_APPORTEUR_DEFAUT),
    taux_fixe_par: a.taux_fixe_par || null, taux_fixe_le: a.taux_fixe_le || null,
  };
};

// ⚠ Le refus, revérifié DANS le geste (envoi, brouillon, encaissement).
// Un taux autre que 3 % n'est accepté que s'il a été posé par le principal
// (lui-même, ou sa marque sur le brouillon repris). `tauxAttendu` : le taux
// que le devis porte déjà (à l'encaissement, on ne change pas ce que le
// devis a fixé).
export function critiqueApporteur(a, { principal = false, tauxAttendu } = {}) {
  if (!a || !a.actif) return "";
  if (!String(a.nom || "").trim()) return "Indiquez le nom de l'apporteur externe, ou décochez la case.";
  const taux = Number(a.taux);
  if (!Number.isFinite(taux) || taux < 0 || taux > 100) return "Le pourcentage de l'apporteur doit être entre 0 et 100.";
  if (principal) return "";
  const permis = tauxAttendu !== undefined && tauxAttendu !== null ? Number(tauxAttendu) : TAUX_APPORTEUR_DEFAUT;
  if (taux === permis) return "";
  if (a.taux_fixe_par && tauxAttendu === undefined) return "";
  return `🔒 Le pourcentage de l'apporteur externe est fixé à ${permis} %. Seul l'administrateur principal peut le changer : enregistrez un brouillon, il y fixera le pourcentage, puis reprenez-le pour l'envoyer.`;
}

// La base de la commission, lue sur un devis enregistré.
export const baseApporteurDevis = (d) => {
  if (!d) return 0;
  if (d.pose_seule) return Math.max(0, Number(d.frais_installation || 0));
  return Math.max(0, Number(d.total || 0) - Number(d.frais_installation || 0) - Number(d.frais_transport || 0));
};
// … et pendant la saisie, avec les totaux du volet.
export const baseApporteurSaisie = ({ poseSeule, totalArticles, remise, fraisInstallation }) =>
  Math.max(0, poseSeule ? Number(fraisInstallation || 0) : Number(totalArticles || 0) - Number(remise || 0));

export const commissionApporteur = (base, taux) => Math.round((Number(base || 0) * Number(taux || 0)) / 100);

// 🔧 La pose seule : l'apporteur est posé sur la DETTE de pose (il n'y a pas
// de vente). Bloqué jusqu'à la réception ET au solde, comme sur une vente.
export const apporteurPourDettePose = (d) => {
  const a = d && d.apporteur_externe;
  if (!a || !a.nom) return null;
  return {
    nom: a.nom, tel: a.tel || "", taux: Number(a.taux || 0),
    montant: commissionApporteur(baseApporteurDevis(d), a.taux),
    payee: false, depuis_devis: d.id,
  };
};

// L'administrateur principal fixe le taux dans le brouillon d'un autre.
export const fixerTauxBrouillon = (brouillon, taux, profile, quand) => ({
  ...brouillon,
  devis: {
    ...brouillon.devis,
    apporteur_externe: {
      ...(brouillon.devis && brouillon.devis.apporteur_externe),
      taux: Number(taux),
      taux_fixe_par: profile && profile.nom, taux_fixe_le: quand,
    },
  },
});

export const brouillonsAvecApporteur = (liste) => (liste || []).filter((b) => b && b.devis && b.devis.apporteur_externe && b.devis.apporteur_externe.nom);
