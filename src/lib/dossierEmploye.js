// ============================================================
// lib/dossierEmploye.js — LE DROIT D'ACCÈS D'UN EMPLOYÉ
//
// POURQUOI (Timo, 18/09/2026 : « et les employés dans cette histoire, leurs
// données ne sont-elles pas protégées… parmi les utilisateurs, le personnel
// n'y figure pas », puis « lance le dossier d'accès pour les employés »).
//
// Les trois premiers chantiers ne couvraient QUE les clients. Or un employé
// est un sujet de données exactement comme eux — et l'application en sait
// BIEN plus sur lui : son salaire, ses avances, son matricule CNSS, sa
// banque, ses notes, tout ce qu'il a enregistré.
//
// ⚠ MÊME FORME DE SORTIE que le dossier d'un client
// (`{ identite, sections, mentions }`) : le PDF (`genererDossierPersonnel`)
// et le CSV (`lignesCsvDossier`) sont réutilisés SANS UNE LIGNE DE PLUS.
// Deux documents, un seul dessinateur.
//
// ⚠⚠ CE QUI N'Y ENTRE JAMAIS — la même liste que pour un client
// (`CHAMPS_INTERDITS`) : mot de passe et son grain de sel, clés d'empreinte.
// Et le NUMÉRO DE COMPTE n'y figure QUE MASQUÉ (« …4321 ») : depuis le
// 19/09/2026 il vit dans la fiche de paie, et un document qui traîne sur un
// bureau n'a pas à le porter en entier. Quatre chiffres suffisent à
// l'intéressé pour vérifier qu'on détient le bon compte.
//
// ⚠ CE QUI NE S'EFFACE PAS, ET LE DOCUMENT LE DIT : la paie et les
// déclarations CNSS se conservent par obligation légale. Pour un employé,
// c'est le droit d'ACCÈS qui compte — pas celui d'effacer. Il n'y a donc
// AUCUN bouton d'effacement de ce côté, et ce n'est pas un oubli.
//
// Ce fichier n'importe que des règles PURES : le banc l'exerce tel quel.
// ============================================================
import { CHAMPS_INTERDITS } from "./dossierPersonnel.js";
import { compteMasque } from "./banques.js";

export { CHAMPS_INTERDITS };

const txt = (x) => String(x ?? "").trim();
const oui = (b) => (b ? "oui" : "non");

export const LIBELLE_ROLE = {
  vendeur: "Vendeur", gerant: "Gérant de boutique", magasinier: "Magasinier",
  commercial: "Commercial", technicien: "Technicien (à commission)",
  technicien_bmi: "Technicien BMI (salarié)", resp_commercial: "Responsable commercial",
  comptable: "Comptable", admin: "Administrateur",
};

// ---------------------------------------------------------------
// LE DOSSIER
// ---------------------------------------------------------------
// `employe` = sa fiche, fiche de PAIE recollée (l'administrateur la reçoit).
// `activite` = ce qu'il a fait, rassemblé par l'écran : { evaluations,
// ventes, depenses, chantiers, outils, messages }.
export function dossierEmploye(employe, activite = {}, { fmt = (x) => `${x} F`, dFR = (x) => String(x || "") } = {}) {
  const u = employe || {};
  const a = activite || {};

  const identite = [
    ["Nom", txt(u.nom_complet) || txt(u.nom)],
    // L'identifiant se dit : il en a besoin pour se connecter. Le mot de
    // passe, JAMAIS — voir CHAMPS_INTERDITS en tête de fichier.
    ["Identifiant de connexion", txt(u.nom)],
    ["Téléphone", txt(u.tel) || "non renseigné"],
    ["Rôle", LIBELLE_ROLE[u.role] || txt(u.role)],
    ["Boutique", txt(u.boutique) || "toutes"],
    ["Chef d'équipe", oui(u.chef_equipe)],
    ["Compte actif", u.actif === false ? "non (bloqué)" : "oui"],
    // ⚠ L'ANNÉE de naissance n'est JAMAIS demandée par l'application (ce
    // serait publier l'âge de chacun) : on ne peut donc pas l'écrire ici,
    // et le document le DIT plutôt que de laisser croire à un oubli.
    ["Anniversaire", txt(u.anniv) ? `${txt(u.anniv)} (jour et mois seulement — l'année n'est jamais demandée)` : "non renseigné"],
    ["Compte créé par", txt(u.cree_par) || "non noté"],
  ];

  const section = (titre, colonnes, lignes, vide, alignDroite = []) =>
    ({ titre, colonnes, lignes, vide, alignDroite });

  const sections = [
    section("Votre rémunération", ["Élément", "Valeur"], [
      ["Salaire de base", u.salaire_base === undefined ? "non renseigné" : fmt(u.salaire_base)],
      ["Taux d'avancement", u.taux_avancement ? `${u.taux_avancement} %` : "—"],
      ["Taux de commission", u.taux_commission ? `${u.taux_commission} %` : "—"],
      ["Taux d'équipe", u.taux_equipe ? `${u.taux_equipe} %` : "—"],
    ], "Aucune rémunération enregistrée.", [1]),

    section("Vos primes", ["Mois", "Motif", "Montant"],
      (u.primes || []).map((p) => [txt(p.mois), txt(p.motif), fmt(p.montant)]),
      "Aucune prime.", [2]),

    section("Vos avances sur salaire", ["Mois", "Motif", "Montant"],
      (u.avances || []).map((x) => [txt(x.mois), txt(x.motif), fmt(x.montant)]),
      "Aucune avance.", [2]),

    section("Vos virements reçus", ["Mois", "Date", "Montant", "État"],
      (u.virements || []).map((v) => [txt(v.mois), dFR(v.date), fmt(v.montant), v.statut === "accepte" ? "confirmé par vous" : "en attente de votre confirmation"]),
      "Aucun virement.", [2]),

    section("Vos crédits", ["Date", "Montant demandé", "État", "Déjà remboursé"],
      (u.credits || []).map((c) => [dFR(c.date), fmt(c.montant_demande ?? c.montant), txt(c.statut), fmt(c.rembourse || 0)]),
      "Aucun crédit.", [1, 3]),

    section("Votre déclaratif social (CNSS)", ["Élément", "Valeur"], [
      ["Assujetti CNSS", oui(u.cnss_assujetti)],
      ["Matricule employeur", txt(u.cnss_matricule) || "non renseigné"],
      ["Numéro d'assuré", txt(u.cnss_numero_assurance) || "non renseigné"],
      ["Date d'embauche", u.cnss_date_embauche ? dFR(u.cnss_date_embauche) : "non renseignée"],
      ["Date de sortie", u.cnss_date_sortie ? dFR(u.cnss_date_sortie) : "—"],
      ["Pièce d'identité", txt(u.piece_type) ? `${txt(u.piece_type)} n° ${txt(u.piece_num) || "non renseigné"}` : "non renseignée"],
    ], "Rien d'enregistré.", []),

    // ⚠ Le numéro NE SORT JAMAIS EN ENTIER, même vers son propriétaire :
    // un document qui traîne n'a pas à être une pièce bancaire.
    section("Votre banque", ["Élément", "Valeur"], [
      ["Banque", txt(u.banque) || "non renseignée"],
      ["Compte", compteDeLaFiche(u)],
    ], "Rien d'enregistré.", []),

    // ⚠ On donne la NOTE, jamais QUI l'a donnée : ce serait la donnée d'un
    // client, pas la sienne.
    section("Vos évaluations reçues", ["Date", "Note sur 5"],
      (a.evaluations || []).map((e) => [dFR(e.date), noteLisible(e)]),
      "Aucune évaluation.", [1]),

    section("Ce que vous avez enregistré", ["Nature", "Nombre"], [
      ["Ventes", String((a.ventes || []).length)],
      ["Dépenses saisies", String((a.depenses || []).length)],
      ["Chantiers où vous êtes intervenu", String((a.chantiers || []).length)],
    ], "Rien enregistré à votre nom.", [1]),

    section("Le matériel de travail que vous détenez", ["Outil", "N° gravé", "Depuis le", "Retour prévu"],
      (a.outils || []).map((o) => [txt(o.nom), txt(o.numero), dFR(o.depuis), dFR(o.retour_prevu)]),
      "Aucun outil sous votre nom."),

    section("Vos messages dans l'application", ["Nombre"],
      (a.messages || []).length ? [[String((a.messages || []).length)]] : [],
      "Aucun message.", [0]),
  ];

  const total = identite.length + sections.reduce((s, x) => s + x.lignes.length, 0);
  return { identite, sections, mentions: MENTIONS_DOSSIER_EMPLOYE, total };
}

// Le compte bancaire, toujours masqué — et on DIT qu'il l'est, sinon on
// laisserait croire qu'on ne détient que quatre chiffres.
export function compteDeLaFiche(u) {
  const c = txt(u?.compte_bancaire);
  if (!c) return "non renseigné";
  return `${compteMasque(c)} (seuls les 4 derniers chiffres sont écrits ici)`;
}

// Une note se lit sur 5. Une évaluation sans aucun critère rempli ne vaut
// pas « 0 » — elle vaut « non notée ».
export function noteLisible(e) {
  const vals = Object.entries(e || {})
    .filter(([k, v]) => k !== "date" && k !== "par_id" && k !== "id" && Number(v) > 0)
    .map(([, v]) => Number(v));
  if (!vals.length) return "non notée";
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1).replace(".", ",");
}

// ---------------------------------------------------------------
// CE QU'ON DIT À L'EMPLOYÉ, DANS LE DOCUMENT
// ---------------------------------------------------------------
// ⚠ Ce texte n'est PAS celui des clients : un employé ne peut pas faire
// effacer sa paie, et le lui laisser croire serait malhonnête.
export const MENTIONS_DOSSIER_EMPLOYE = [
  "Ce document rassemble les données que BMI TOGO conserve à votre sujet dans son logiciel de gestion, à la date indiquée ci-dessus.",
  "Elles servent à la gestion de votre emploi : votre rémunération, vos déclarations sociales, et le suivi de votre travail. Elles ne sont communiquées à aucun tiers sans votre accord, sauf obligation légale — notamment les déclarations à la CNSS.",
  "Conformément à la loi n° 2019-014 relative à la protection des données à caractère personnel en République Togolaise, vous disposez d'un droit d'accès et de rectification de vos données.",
  "En revanche, votre rémunération, vos déclarations sociales et les pièces comptables doivent être conservées par BMI TOGO pendant la durée prévue par la loi : elles ne peuvent pas être effacées à votre demande.",
  "Votre mot de passe ne figure pas dans ce document, et n'existe en clair nulle part dans notre logiciel. Votre numéro de compte bancaire n'y figure que par ses quatre derniers chiffres.",
  "Pour faire corriger une information, adressez-vous à la direction.",
];

export const nomDossierEmploye = (u) => `Dossier personnel - ${txt(u?.nom_complet) || txt(u?.nom) || "employe"}`;

// La trace au journal. Elle NOMME l'employé : on n'efface rien ici, il faut
// pouvoir dire à qui le dossier a été remis.
export const journalDossierEmploye = (u, profile, { format = "PDF" } = {}) =>
  `📄 Dossier personnel remis à un employé (${format}) — ${txt(u?.nom_complet) || txt(u?.nom)} : par ${txt(profile?.nom) || "?"}`;

// Un compte CLIENT n'a rien à faire ici : il a SON dossier, qui parle
// d'achats et de chantiers, pas de salaire.
export const critiqueDossierEmploye = (u) => {
  if (!u || !u.id) return "Choisissez un employé.";
  if (u.role === "client") return "Ce compte est un CLIENT : son dossier se remet depuis le bloc des clients, juste au-dessus.";
  return "";
};
