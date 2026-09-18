// ============================================================
// lib/dossierPersonnel.js — LE DROIT D'ACCÈS : TOUT CE QU'ON A SUR LUI
//
// POURQUOI (Timo, 18/09/2026, après le droit à l'effacement : « lance le
// point 2 »). L'article 18 de nos contrats promet au client un **droit
// d'accès** avant même le droit de suppression. Jusqu'ici, répondre à
// « qu'est-ce que vous avez sur moi ? » demandait d'ouvrir cinq écrans, de
// recopier à la main, et d'espérer n'avoir rien oublié. Une réponse
// incomplète n'est pas une réponse.
//
// UN BOUTON, UN DOCUMENT. Le dossier est assemblé UNE fois, ici, et rendu
// de deux façons : un PDF à remettre ou à imprimer (src/pdf.js), et un CSV
// pour celui qui veut ses données dans un tableur (lib/export.js). Les deux
// lisent la MÊME structure — sinon les deux finiraient par se contredire.
//
// ⚠⚠ CE QUI N'Y ENTRE JAMAIS — et c'est le point le plus important :
//   • SON MOT DE PASSE. L'application sait le RECALCULER (motDePasseConnu) :
//     c'est justement pour ça qu'il faut l'écrire ici. Un dossier d'accès
//     qui se promène ne doit pas être une clé.
//   • LE JETON de signature du PV (`contrat_jeton`) : même raison, c'est une
//     clé d'accès à son espace.
//   • Les données de QUELQU'UN D'AUTRE : le dossier vient de `dossierClient`
//     (lib/effacementClient.js), déjà filtré par l'espace regardé.
//
// ⚠ Le document lui-même est un concentré de données personnelles : il se
// remet AU CLIENT, en main propre ou sur SON numéro. L'écran le dit.
//
// Ce fichier n'importe que des règles PURES : le banc l'exerce tel quel.
// ============================================================
import { estEfface } from "./effacementClient.js";

// Les champs qui ne sortent JAMAIS, quelle que soit la table d'où ils
// viennent. Le banc vérifie que le document ne les contient pas.
export const CHAMPS_INTERDITS = [
  "pwd", "pwd_hash", "pwd_hash2", "pwd_salt", "mdp_variante", "mdp_longueur",
  "contrat_jeton", "contrat_jeton_le", "empreintes",
];

const txt = (x) => String(x ?? "").trim();
const lignesArticles = (v) => (v?.articles || v?.panier || v?.lignes || [])
  .map((l) => `${l.qte || l.quantite || 1} × ${txt(l.nom || l.article)}`).join(", ");

// ---------------------------------------------------------------
// LE DOSSIER, EN SECTIONS
// ---------------------------------------------------------------
// `dossier` vient de dossierClient (lib/effacementClient.js) : mêmes données,
// même mur, même façon de reconnaître le client. Une seule source.
export function dossierPersonnel(dossier, { fmt = (x) => `${x} F`, dFR = (x) => String(x || "") } = {}) {
  const d = dossier || {};
  const c = d.compte || null;

  const identite = [
    ["Nom", txt(c?.nom_base || d.cible?.nom)],
    ["Numéro de téléphone", txt(c?.tel || d.cible?.tel) || "non renseigné"],
    // ⚠ L'identifiant se dit (le client en a besoin pour se connecter) ;
    // le mot de passe, JAMAIS — voir CHAMPS_INTERDITS en tête de fichier.
    ["Identifiant de connexion", c ? txt(c.nom) : "aucun compte en ligne"],
    ["Compte créé par", c ? txt(c.cree_par) || "non noté" : "—"],
    ["Compte actif", c ? (c.actif === false ? "non (bloqué)" : "oui") : "—"],
  ];

  const section = (titre, colonnes, lignes, vide, alignDroite = []) =>
    ({ titre, colonnes, lignes, vide, alignDroite });

  const sections = [
    section("Vos achats", ["Date", "N° de reçu", "Boutique", "Articles", "Total"],
      (d.ventes || []).map((v) => [dFR(v.date), txt(v.numero), txt(v.boutique), lignesArticles(v), fmt(v.total ?? v.montant ?? 0)]),
      "Aucun achat enregistré.", [4]),

    section("Vos dettes et règlements", ["Date", "N°", "Motif", "Montant", "Déjà versé", "Reste"],
      (d.dettes || []).map((t) => [dFR(t.date), txt(t.numero), txt(t.motif), fmt(t.montant || 0), fmt(t.paye || 0),
        fmt(Math.max(0, Number(t.montant || 0) - Number(t.paye || 0)))]),
      "Aucune dette enregistrée.", [3, 4, 5]),

    section("Vos offres de prix (proformas)", ["Date", "N°", "Boutique", "Articles"],
      (d.proformas || []).map((p) => [dFR(p.date), txt(p.numero), txt(p.boutique), lignesArticles(p)]),
      "Aucune proforma."),

    section("Vos commandes", ["Date", "Boutique", "Articles", "Statut"],
      (d.commandes || []).map((o) => [dFR(o.date), txt(o.boutique), lignesArticles(o), txt(o.statut)]),
      "Aucune commande."),

    section("Vos devis", ["Date", "Type", "Statut", "Montant"],
      (c?.devis || []).map((v) => [dFR(v.date), txt(v.type || v.volet), txt(v.statut), fmt(v.total || v.montant || 0)]),
      "Aucun devis.", [3]),

    section("Vos installations et chantiers",
      ["Date", "Type", "Adresse", "Garantie", "Matériel posé", "Statut"],
      (d.chantiers || []).map((x) => [
        dFR(x.date_installation || x.date), txt(x.type_installation),
        txt(x.adresse_contrat || x.localisation) || "non renseignée",
        x.garantie_mois ? `${x.garantie_mois} mois` : "—",
        (x.materiel || []).map((m) => `${m.qte || 1} × ${txt(m.nom)}`).join(", "),
        txt(x.statut),
      ]),
      "Aucune installation."),

    section("Vos messages avec nous", ["Date", "Sens", "Message"],
      (d.messages || []).map((m) => [dFR(m.date),
        m.de_id === c?.id ? "vous → BMI" : "BMI → vous", txt(m.texte)]),
      "Aucun message."),

    section("Votre fiche de prospection", ["Date", "Catégorie", "Localisation", "Intérêt", "Statut"],
      (d.prospects || []).map((p) => [dFR(p.date), txt(p.categorie), txt(p.localisation), txt(p.interet), txt(p.statut)]),
      "Aucune fiche de prospection."),
  ];

  return { identite, sections, mentions: MENTIONS_DOSSIER, total: d.total || 0 };
}

// ---------------------------------------------------------------
// CE QU'ON DIT AU CLIENT, DANS LE DOCUMENT
// ---------------------------------------------------------------
// ⚠ Ce texte reprend l'article 18 des contrats mot pour mot dans son fond :
// s'il change là-bas, il change ici. Ne rien promettre de plus que le
// contrat — et rien de moins.
export const MENTIONS_DOSSIER = [
  "Ce document rassemble toutes les données que BMI TOGO conserve à votre sujet dans son logiciel de gestion, à la date indiquée ci-dessus.",
  "Ces données sont utilisées exclusivement dans le cadre de nos contrats et de notre relation commerciale. Elles ne sont communiquées à aucun tiers sans votre accord, sauf obligation légale.",
  "Conformément à la loi n° 2019-014 relative à la protection des données à caractère personnel en République Togolaise, vous disposez d'un droit d'accès, de rectification et, dans les conditions prévues par la loi, de suppression de vos données.",
  "Pour exercer ces droits, adressez-vous à BMI TOGO. Certaines pièces — factures, reçus, contrats — doivent être conservées par obligation comptable et ne peuvent pas être détruites : votre nom peut en revanche en être retiré.",
  "Votre mot de passe ne figure pas dans ce document, et ne figure nulle part en clair dans notre logiciel.",
];

// ---------------------------------------------------------------
// LE NOM DU FICHIER, ET LA TRACE
// ---------------------------------------------------------------
export const nomDossierPersonnel = (cible) => `Dossier personnel - ${txt(cible?.nom) || "client"}`;

// La ligne du journal. Contrairement à celle de l'effacement, elle NOMME le
// client : on n'efface rien ici, et il faut pouvoir prouver à qui le dossier
// a été remis — c'est la trace de la demande honorée.
export const journalDossier = (dossier, profile, { format = "PDF" } = {}) =>
  `📄 Dossier personnel remis (${format}) — ${txt(dossier?.cible?.nom)}`
  + `${dossier?.cible?.tel ? ` (${txt(dossier.cible.tel)})` : ""} : `
  + `${dossier?.total || 0} enregistrement(s) — par ${txt(profile?.nom) || "?"}`;

// Un client déjà effacé n'a plus de dossier à recevoir : il n'y a plus
// personne derrière la référence.
export const critiqueDossier = (dossier) => {
  const d = dossier || {};
  if (estEfface(d.cible?.nom)) return "Ce client a déjà été effacé : il ne reste derrière cette référence aucune donnée personnelle à lui remettre.";
  if (!d.total) return "Aucune donnée trouvée pour ce client dans l'espace que vous regardez.";
  return "";
};

// ---------------------------------------------------------------
// LE CSV : les mêmes sections, mises à plat pour un tableur
// ---------------------------------------------------------------
// Un seul fichier, les sections les unes sous les autres, séparées par une
// ligne vide et titrées — c'est ce qui se lit le mieux dans Excel.
export function lignesCsvDossier(vue) {
  const v = vue || {};
  const out = [];
  out.push(["VOTRE IDENTITÉ", "", "", "", "", ""]);
  (v.identite || []).forEach(([l, x]) => out.push([l, x, "", "", "", ""]));
  for (const s of v.sections || []) {
    out.push(["", "", "", "", "", ""]);
    out.push([s.titre.toUpperCase(), "", "", "", "", ""]);
    out.push(s.colonnes);
    if (!s.lignes.length) out.push([s.vide, "", "", "", "", ""]);
    else s.lignes.forEach((l) => out.push(l));
  }
  out.push(["", "", "", "", "", ""]);
  out.push(["VOS DROITS", "", "", "", "", ""]);
  (v.mentions || []).forEach((m) => out.push([m, "", "", "", "", ""]));
  return out;
}
