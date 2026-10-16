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
import { estSansAcces } from "./identiteClient.js";
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

// ---- ↻ UNE RELANCE NON REÇUE SE RETENTE UNE FOIS (16/10/2026, « les deux, lance ») ----
// Capture Timo : la relance du 8e jour à ONG, acceptée par WhatsApp puis NON
// REMISE (❌ 131049 : WhatsApp limite les messages commerciaux qu'une même
// personne reçoit). L'application la croyait faite et ne la retentait pas, et
// 📋 Tous les devis disait « 🤖 Relancé automatiquement ».
// Les essais d'un devis = ses lignes du fil (elles ne se réécrivent jamais ;
// seule leur coche bouge, posée par l'adresse d'arrivée).
export const MAX_ESSAIS_RELANCE_AUTO = 2;
export const essaisRelanceAuto = (messages, devisId) =>
  (messages || [])
    .filter((m) => m && m.canal === CANAL_WA && m.wa_modele === MODELE_RELANCE_AUTO && m.devis_id && m.devis_id === devisId)
    .sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));

// Retenter le lendemain ? Seulement si : UN seul essai, NON REÇU (❌ posé par
// WhatsApp — sans nouvelle, on ne retente pas), fait un jour AVANT
// aujourd'hui, ligne pas à la corbeille, et le devis toujours dans la fenêtre
// du 8e au 15e jour, ⏳ Proposé, jamais relancé à la main.
export function relanceAutoARetenter(devis, essais, aujourdhui) {
  if (!devis || estSupprime(devis)) return false;
  if ((devis.statut || "propose") !== "propose") return false;
  if (devis.formation === true || devis.relance_le) return false;
  if (!essais || !essais.length || essais.length >= MAX_ESSAIS_RELANCE_AUTO) return false;
  const e = essais[essais.length - 1];
  if (e.supprime_le || e.wa_statut?.etat !== "echec") return false;
  if (!(String(e.date || String(e.ts || "").slice(0, 10)) < String(aujourdhui))) return false;
  if (!finOffre(devis)) return false;
  const j = joursEntre(devis.date, aujourdhui);
  return j >= JOUR_RELANCE_AUTO && j <= VALIDITE_OFFRE_JOURS;
}

// Ce que 📋 Tous les devis dit de la relance automatique : la DERNIÈRE ligne
// décide. { echec, le, motif, limite, retentera } — `limite` quand WhatsApp
// a refusé pour le plafond des messages commerciaux.
export function etatRelanceAuto(messages, devis, aujourdhui) {
  const essais = essaisRelanceAuto(messages, devis?.id);
  if (!essais.length) return null;
  const d = essais[essais.length - 1];
  const echec = d.wa_statut?.etat === "echec";
  const motif = echec ? String(d.wa_statut?.motif || "") : "";
  return {
    echec, le: d.date || String(d.ts || "").slice(0, 10), motif, essais: essais.length,
    limite: echec && /limite les messages commerciaux/i.test(motif),
    // Le nouvel essai part à 7 h le LENDEMAIN de l'échec : vu depuis le jour
    // de l'échec, on regarde demain.
    retentera: echec && relanceAutoARetenter(devis, essais, lendemain(aujourdhui)),
  };
}
const lendemain = (jour) => {
  const t = new Date(`${jour}T00:00:00Z`);
  if (Number.isNaN(t.getTime())) return jour;
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
};

// La liste du jour : { compte, devis, tel, envoi } par devis à relancer.
// ⚠ LE MUR : un compte de formation ne reçoit jamais rien, même si le
// devis n'a pas de marque (devis ancien).
export function relancesAutoDuJour(db, aujourdhui) {
  const deja = devisDejaRelancesAuto(db?.messages);
  const sortie = [];
  (db?.users || []).forEach((u) => {
    if (!u || u.role !== "client" || u.actif === false) return;
    if (estCompteFormation(db, u)) return;
    // 🖨 Une fiche SANS ACCÈS (devis imprimé, 15/10/2026) : le message dit
    // « ouvrez votre espace », où il ne peut pas entrer. Jamais de relance.
    if (estSansAcces(u)) return;
    const tel = numeroWhatsApp(u.tel);
    if (!tel) return;
    (u.devis || []).forEach((d) => {
      // Premier essai : la règle d'origine. Déjà essayé : seul le second
      // essai d'une relance NON REÇUE (↻, 16/10/2026).
      const premier = !deja.has(d.id) && devisARelancerAuto(d, aujourdhui);
      const second = deja.has(d.id) && relanceAutoARetenter(d, essaisRelanceAuto(db?.messages, d.id), aujourdhui);
      if (!premier && !second) return;
      sortie.push({ compte: u, devis: d, tel, retente: second, envoi: envoiRelanceExpiration({ devis: d, compte: u, fin: finOffre(d), fmt, dFR }) });
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
    proprietaire_id: entete?.proprietaire_id || "", proprietaire_nom: entete?.proprietaire_nom || "", derniere: ts, entete,
  });
export const compteApresRelance = (compte, devisId, ts) => ({
  ...compte,
  devis: (compte?.devis || []).map((d) => (d.id === devisId ? { ...d, relance_auto_le: String(ts).slice(0, 10) } : d)),
});
