// ============================================================
// lib/relanceAutoDevis.js — LA RELANCE AUTOMATIQUE D'UN DEVIS À 8 JOURS
//
// Timo, 26/09/2026 : « après 8 jours sans validation, une relance
// automatique avec informations d'expiration après 15 jours » → « texte
// ok, une seule relance, lance ». Elle va avec l'option « b » du même jour :
// le devis reste validable après 15 jours, mais l'offre est expirée et les
// prix sont à confirmer. La relance le DIT au client avant que ça arrive.
//
// Règle pure (aucun réseau, aucune base) : le serveur de la tournée de 7 h
// (api/rappels-du-matin.js) l'importe telle quelle, le banc aussi — d'où
// les imports écrits avec `.js`.
//
// ⚠ UNE SEULE RELANCE, JAMAIS DEUX. Deux traces l'empêchent, une suffit :
//   • `relance_auto_le` sur le devis ;
//   • une ligne du fil 📲 WhatsApp portant ce modèle et ce devis — une ligne
//     de message ne se réécrit jamais, alors qu'un téléphone resté hors
//     ligne pourrait renvoyer une vieille copie de la fiche du client.
// ⚠ ELLE NE PART PAS : en formation (le devis ou le compte), à un compte
// bloqué, sans numéro, sur un devis qui n'est plus ⏳ Proposé, supprimé,
// déjà relancé à la main (`relance_le`), ou au-delà des 15 jours (l'offre
// est expirée : annoncer « valable jusqu'au » une date passée serait faux).
// ============================================================
import { joursEntre, finOffre } from "./rappels.js";
import { estSupprime } from "./corbeille.js";
import { VALIDITE_OFFRE_JOURS } from "./constants.js";
import { envoiRelanceExpiration, ligneEnvoiModele, numeroWhatsApp } from "./whatsappModeles.js";
import { cleConversation, CANAL_WA, construireEntete } from "./whatsappConversations.js";
import { estCompteFormation } from "./espace.js";
import { fmt, dFR } from "./core.js";

export const JOUR_RELANCE_AUTO = 8;
export const MODELE_RELANCE_AUTO = "relance_devis_expiration";
// Qui « écrit » la ligne du fil : personne — la tournée du matin.
export const AUTEUR_RELANCE_AUTO = { id: "relance-auto-bmi", nom: "Relance automatique BMI" };

// Le devis, seul : est-il à relancer aujourd'hui ?
export function devisARelancerAuto(devis, aujourdhui) {
  if (!devis || estSupprime(devis)) return false;
  if ((devis.statut || "propose") !== "propose") return false;
  if (devis.formation === true) return false;
  if (devis.relance_le || devis.relance_auto_le) return false;
  if (!finOffre(devis)) return false;
  const j = joursEntre(devis.date, aujourdhui);
  return j >= JOUR_RELANCE_AUTO && j <= VALIDITE_OFFRE_JOURS;
}

// Les devis déjà relancés automatiquement, lus dans le fil (preuve qui ne
// se réécrit pas).
export const devisDejaRelancesAuto = (messages) =>
  new Set((messages || []).filter((m) => m && m.canal === CANAL_WA && m.wa_modele === MODELE_RELANCE_AUTO && m.devis_id).map((m) => m.devis_id));

// La liste du jour : { compte, devis, tel, envoi } par devis à relancer.
// ⚠ LE MUR : un compte de formation ne reçoit jamais rien, même si le
// devis n'a pas de marque (devis ancien).
export function relancesAutoDuJour(db, aujourdhui) {
  const deja = devisDejaRelancesAuto(db?.messages);
  const sortie = [];
  (db?.users || []).forEach((u) => {
    if (!u || u.role !== "client" || u.actif === false) return;
    if (estCompteFormation(db, u)) return;
    const tel = numeroWhatsApp(u.tel);
    if (!tel) return;
    (u.devis || []).forEach((d) => {
      if (!devisARelancerAuto(d, aujourdhui) || deja.has(d.id)) return;
      sortie.push({ compte: u, devis: d, tel, envoi: envoiRelanceExpiration({ devis: d, compte: u, fin: finOffre(d), fmt, dFR }) });
    });
  });
  return sortie;
}

// Ce qui s'écrit APRÈS l'envoi réussi (jamais avant) : la ligne du fil,
// sa fiche légère (sans toucher au propriétaire : la relance ne s'approprie
// rien), et la marque sur le devis.
export function ligneRelanceAuto({ id, tel, compte, devis, variables, ts }) {
  const cle = cleConversation(tel);
  const texte = ligneEnvoiModele(MODELE_RELANCE_AUTO, variables);
  if (!cle || !texte) return null;
  return {
    id, date: String(ts).slice(0, 10), ts,
    de_id: AUTEUR_RELANCE_AUTO.id, de_nom: AUTEUR_RELANCE_AUTO.nom, lu_par: [],
    canal: CANAL_WA, wa_tel: cle, wa_numero: tel, wa_nom: compte?.nom_base || compte?.nom || "",
    texte, wa_modele: MODELE_RELANCE_AUTO, devis_id: devis?.id,
  };
}
export const enteteApresRelance = ({ tel, compte, ts, entete }) =>
  construireEntete({
    cle: cleConversation(tel), tel, nom: compte?.nom_base || compte?.nom || "",
    proprietaire_id: entete?.proprietaire_id || "", proprietaire_nom: entete?.proprietaire_nom || "", derniere: ts,
  });
export const compteApresRelance = (compte, devisId, ts) => ({
  ...compte,
  devis: (compte?.devis || []).map((d) => (d.id === devisId ? { ...d, relance_auto_le: String(ts).slice(0, 10) } : d)),
});
