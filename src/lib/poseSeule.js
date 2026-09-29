// ============================================================
// lib/poseSeule.js — LE RÈGLEMENT D'UNE « POSE SEULE » : 70 %, PUIS 30 % (29/09/2026)
//
// L'article 4 du contrat de pose le dit : « 70 % avant le début des travaux,
// les 30 % restants à la signature du procès-verbal… ou dans les 3 jours qui
// suivent au plus tard ». L'application ne le faisait pas respecter : la
// dette de pose naissait dans la caisse TERRAIN, personne en boutique ne la
// voyait, et l'installation se programmait sans un franc versé.
// Timo (option « c ») : « oui, le gérant aussi pour les 30 %, lance » — puis
// « on ne bloque pas le PV, et l'application fait respecter les 3 jours : un
// rappel au client et à l'administrateur si le solde n'est pas payé 3 jours
// après la signature ».
//
//   • les 70 % se voient dans 🧾 Commandes de la boutique du devis (gérant,
//     vendeur, admin) ET sur le chantier (le chef sur le terrain) : le premier
//     qui encaisse ferme pour tout le monde — c'est UNE dette ;
//   • programmer l'installation est REFUSÉ tant que les 70 % ne sont pas
//     versés (`critiqueProgrammationPose`) ;
//   • le PV n'est PAS bloqué ; 3 jours après la signature, si le solde reste
//     dû, la tournée de 7 h écrit au client (modèle `rappel_solde_pose`, le texte de Timo) et
//     prévient l'administrateur — UNE fois (`rappel_solde_le` sur la dette).
//
// ⚠ Une dette de pose d'AVANT la règle n'a pas `acompte_attendu` : elle
// n'est jamais bloquée (on ne change pas un contrat déjà en cours) et ne
// s'affiche pas dans 🧾 Commandes (elle ne dit pas de quelle boutique elle
// vient). Le rappel des 3 jours, lui, vaut pour toute pose seule.
//
// Règle pure, lue par le serveur : imports écrits avec `.js`.
// ============================================================
import { estSupprime } from "./corbeille.js";
import { envoiRappelSoldePose, numeroWhatsApp, ligneEnvoiModele } from "./whatsappModeles.js";
import { cleConversation, CANAL_WA, construireEntete } from "./whatsappConversations.js";
import { chantierDeFormation } from "./rappelEntretien.js";
import { joursEntre } from "./rappels.js";

export const ACOMPTE_POSE_PCT = 70;
export const DELAI_SOLDE_POSE_JOURS = 3;
// Au-delà, on ne réveille plus un client : une tournée manquée rattrape
// pendant une semaine, pas des mois après.
export const JOURS_MAX_RAPPEL_SOLDE = 10;
export const MODELE_RAPPEL_SOLDE = "rappel_solde_pose";

export const acomptePose = (total) => Math.round(Number(total || 0) * ACOMPTE_POSE_PCT / 100);
const reste = (d) => Math.max(0, Number(d?.montant || 0) - Number(d?.paye || 0));

// Ce que la dette de pose dit d'elle-même.
//   acompte      : les 70 % (0 pour une dette d'avant la règle) ;
//   resteAcompte : ce qui manque pour les atteindre ;
//   etape        : "acompte" (les 70 % d'abord), "solde" (les 30 %), "solde_ok".
export function etatPose(dette) {
  if (!dette) return null;
  const acompte = Number(dette.acompte_attendu || 0);
  const paye = Number(dette.paye || 0);
  const resteAcompte = Math.max(0, acompte - paye);
  const r = reste(dette);
  const etape = r <= 0 ? "solde_ok" : resteAcompte > 0 ? "acompte" : "solde";
  return { acompte, paye, resteAcompte, reste: r, etape };
}

export const libelleEncaissementPose = (dette) => {
  const e = etatPose(dette);
  if (!e || e.etape === "solde_ok") return "";
  return e.etape === "acompte" ? `Encaisser l'acompte (${ACOMPTE_POSE_PCT} %)` : `Encaisser le solde (${100 - ACOMPTE_POSE_PCT} %)`;
};

// Programmer l'installation : refusé tant que les 70 % ne sont pas versés.
// Rend "" (permis) ou le motif. ⚠ À revérifier DANS le geste, sur la dette
// FRAÎCHE : le client a peut-être payé en boutique entre-temps.
export function critiqueProgrammationPose(chantier, dette, fmt = (n) => `${n} F`) {
  if (!chantier || !chantier.pose_seule) return "";
  const e = etatPose(dette);
  if (!e || !e.acompte || e.resteAcompte <= 0) return "";
  return `L'installation ne se programme qu'une fois l'acompte de ${ACOMPTE_POSE_PCT} % versé (article 4 du contrat de pose).\n\n`
    + `Acompte attendu : ${fmt(e.acompte)} — déjà versé : ${fmt(e.paye)} — reste : ${fmt(e.resteAcompte)}.\n\n`
    + `Il s'encaisse dans 🧾 Commandes de la boutique, ou ici sur le chantier.`;
}

// Les poses à encaisser d'une boutique (🧾 Commandes) : la dette porte la
// boutique du devis (`boutique_pose`). ⚠ Reçoit des listes DÉJÀ filtrées par
// l'espace regardé, jamais la base entière.
export function posesAEncaisser(dettes, chantiers, boutique) {
  const parDette = new Map((chantiers || []).filter((c) => c && c.pose_seule && c.dette_id && !estSupprime(c)).map((c) => [c.dette_id, c]));
  return (dettes || [])
    .filter((d) => d && d.pose_seule && d.boutique_pose === boutique && reste(d) > 0 && parDette.has(d.id))
    .map((d) => ({ dette: d, chantier: parDette.get(d.id), etat: etatPose(d) }));
}

// ---- Le solde en retard, 3 jours après la signature du PV ----
// Le jour « en retard » : strictement plus de 3 jours après `receptionne_le`
// (le contrat laisse « les 3 jours qui suivent »), et dans la fenêtre.
// DEUX marques, parce que ce sont deux gestes : `rappel_solde_le` (le
// message au client, posé seulement quand WhatsApp l'a accepté — refusé, on
// retente le lendemain) et `rappel_solde_admin_le` (la notification à
// l'administrateur, une fois).
export function soldeEnRetard(chantier, dette, aujourdhui) {
  if (!chantier || !chantier.pose_seule || estSupprime(chantier)) return false;
  if (chantier.statut !== "receptionne" || !chantier.receptionne_le) return false;
  if (!dette || reste(dette) <= 0) return false;
  if (dette.rappel_solde_le && dette.rappel_solde_admin_le) return false;
  const j = joursEntre(chantier.receptionne_le, aujourdhui);
  return j > DELAI_SOLDE_POSE_JOURS && j <= JOURS_MAX_RAPPEL_SOLDE;
}

// La liste du jour, pour le serveur :
//   { chantier, dette, compte, tel, envoi, client, admin }
//   client : le message au client est à envoyer (numéro connu, pas encore parti) ;
//   admin  : la notification à l'administrateur est à faire.
// ⚠ LE MUR : jamais un chantier de formation. Un compte bloqué ou sans
// numéro n'a pas de message, mais l'administrateur est prévenu quand même.
export function soldesPoseDuJour(db, aujourdhui, { fmt, dFR }) {
  const sortie = [];
  (db?.clients_installes || []).forEach((c) => {
    const dette = c?.dette_id ? (db.dettes || []).find((d) => d && d.id === c.dette_id) : null;
    if (!soldeEnRetard(c, dette, aujourdhui)) return;
    const compte = c.user_id ? (db.users || []).find((u) => u && u.id === c.user_id) : null;
    if (chantierDeFormation(db, c, compte)) return;
    const bloque = !!(compte && compte.actif === false);
    const tel = bloque ? "" : numeroWhatsApp((compte && compte.tel) || dette.tel || c.tel);
    const client = !!tel && !dette.rappel_solde_le;
    const admin = !dette.rappel_solde_admin_le;
    if (!client && !admin) return;
    sortie.push({ chantier: c, dette, compte, tel, client, admin,
      envoi: client ? envoiRappelSoldePose({ dette, compte, chantier: c, fmt, dFR }) : null });
  });
  return sortie;
}

// La phrase de la notification à l'administrateur.
export const texteAlerteSolde = (r, { fmt, dFR }) =>
  `${r.dette.client || "Le client"} n'a pas réglé le solde de sa pose : ${fmt(reste(r.dette))} dus depuis la signature du PV le ${dFR(r.chantier.receptionne_le)} (délai de ${DELAI_SOLDE_POSE_JOURS} jours dépassé).`
  + (r.client ? " Un rappel WhatsApp lui est envoyé." : r.tel ? "" : " Aucun message ne peut lui partir (numéro absent ou compte bloqué).");

export const detteApresRappelSolde = (d, jour, { client = false, admin = false } = {}) => ({
  ...d,
  ...(client ? { rappel_solde_le: String(jour).slice(0, 10) } : {}),
  ...(admin ? { rappel_solde_admin_le: String(jour).slice(0, 10) } : {}),
});

// La ligne du fil 📲 WhatsApp, écrite APRÈS l'envoi réussi (jamais avant).
export const AUTEUR_RAPPEL_SOLDE = { id: "rappel-solde-bmi", nom: "Rappel automatique BMI" };
export function ligneRappelSolde({ id, tel, compte, dette, variables, ts }) {
  const cle = cleConversation(tel);
  const texte = ligneEnvoiModele(MODELE_RAPPEL_SOLDE, variables);
  if (!cle || !texte) return null;
  return {
    id, date: String(ts).slice(0, 10), ts,
    de_id: AUTEUR_RAPPEL_SOLDE.id, de_nom: AUTEUR_RAPPEL_SOLDE.nom, lu_par: [],
    canal: CANAL_WA, wa_tel: cle, wa_numero: tel, wa_nom: compte?.nom_base || compte?.nom || dette?.client || "client",
    texte, wa_modele: MODELE_RAPPEL_SOLDE, dette_id: dette.id,
  };
}
export const enteteApresRappelSolde = ({ tel, compte, dette, ts, entete }) =>
  construireEntete({
    cle: cleConversation(tel), tel, nom: compte?.nom_base || compte?.nom || dette?.client || "client",
    proprietaire_id: entete?.proprietaire_id || "", proprietaire_nom: entete?.proprietaire_nom || "", derniere: ts,
  });

// Qui encaisse une pose : le chef de CE chantier (sur le terrain), ou en
// boutique le vendeur, le GÉRANT (Timo, 29/09/2026 : « le gérant aussi »),
// le responsable commercial, l'administrateur. Revérifié DANS le geste.
export const ROLES_ENCAISSEMENT_POSE = ["vendeur", "gerant", "resp_commercial", "admin"];
export const peutEncaisserPose = (chantier, profile) =>
  !!profile && ((chantier?.equipe || []).some((e) => e && e.chef && e.user_id === profile.id)
    || ROLES_ENCAISSEMENT_POSE.includes(profile.role));
