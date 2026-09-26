// ============================================================
// lib/demandeAvis.js — LA DEMANDE D'AVIS GOOGLE APRÈS LA RÉCEPTION (26/09/2026)
//
// Timo, après la comparaison avec les autres logiciels : « 6 » — puis le
// lien de la fiche Google de BMI, « 10 jours » après la réception, et SON
// texte (modèle `demande_avis`, trois trous : client, installation, lien).
//
// La tournée de 7 h (api/rappels-du-matin.js) regarde chaque chantier
// RÉCEPTIONNÉ (PV signé, forcé, ou réception automatique) : à partir du
// 10e jour après `receptionne_le`, le numéro BMI envoie la demande. UNE
// SEULE FOIS PAR CHANTIER, pour toujours : la marque `avis_demande_le` sur
// le chantier, et la ligne du fil 📲 WhatsApp (modèle + chantier) qui ne se
// réécrit jamais. Refusée par WhatsApp (modèle pas encore approuvé…), on
// retente le lendemain.
// ⚠ UNE FENÊTRE, PAS UN BALAYAGE : jusqu'au 40e jour seulement. Sans elle, le
// premier matin enverrait la demande à TOUS les chantiers réceptionnés
// depuis des mois — des clients qu'on ne dérange plus pour ça.
// ⚠ LE MUR : jamais un chantier de formation (même règle que le rappel
// d'entretien), jamais un compte bloqué, jamais sans numéro, jamais des
// 🛠 travaux à crédit (ils n'ont pas de réception), jamais la corbeille.
// ⚠ Le lien vit dans ⚙ Paramètres (administrateur principal, champ
// `avis_google` sur une boutique RÉELLE) ; d'office celui donné par Timo.
// Coupé = rien ne part.
//
// Règle pure, lue par le serveur : imports écrits avec `.js`.
// ============================================================
import { joursEntre } from "./rappels.js";
import { estSupprime } from "./corbeille.js";
import { envoiDemandeAvis, ligneEnvoiModele, numeroWhatsApp } from "./whatsappModeles.js";
import { cleConversation, CANAL_WA, construireEntete } from "./whatsappConversations.js";
import { chantierDeFormation } from "./rappelEntretien.js";

export const JOURS_APRES_RECEPTION = 10;
export const JOURS_MAX_DEMANDE_AVIS = 40;
export const MODELE_DEMANDE_AVIS = "demande_avis";
export const AUTEUR_DEMANDE_AVIS = { id: "demande-avis-bmi", nom: "Demande d'avis automatique BMI" };
// Le lien donné par Timo le 26/09/2026.
export const LIEN_AVIS_GOOGLE_DEFAUT = "https://share.google/7LY5N6ctSmah0mlYY";

// Le réglage : `avis_google = { lien, coupe }`, lu sur une boutique RÉELLE.
// Rien de réglé → le lien d'office. Coupé → null (rien ne part).
export function lienAvisGoogle(boutiques) {
  const b = (boutiques || []).find((x) => x && !x.formation && x.avis_google);
  if (!b) return LIEN_AVIS_GOOGLE_DEFAUT;
  if (b.avis_google.coupe) return null;
  return String(b.avis_google.lien || "").trim() || LIEN_AVIS_GOOGLE_DEFAUT;
}
export const critiqueLienAvis = (lien) => {
  const l = String(lien || "").trim();
  if (!l) return "";
  if (!/^https:\/\/\S+$/.test(l)) return "Le lien doit commencer par https:// et ne contenir aucun espace (copiez-le depuis votre fiche Google).";
  return "";
};
export const poserAvisGoogle = (boutiques, reglage) =>
  (boutiques || []).map((b) => (b && !b.formation ? { ...b, avis_google: reglage } : b));

// Le chantier, seul : sa demande d'avis part-elle aujourd'hui ?
export function avisADemander(c, aujourdhui) {
  if (!c || estSupprime(c) || c.travaux) return false;
  if (c.statut !== "receptionne" || !c.receptionne_le) return false;
  if (c.avis_demande_le) return false;
  const j = joursEntre(c.receptionne_le, aujourdhui);
  return j >= JOURS_APRES_RECEPTION && j <= JOURS_MAX_DEMANDE_AVIS;
}

const dejaDemandes = (messages) => new Set((messages || [])
  .filter((m) => m && m.canal === CANAL_WA && m.wa_modele === MODELE_DEMANDE_AVIS && m.chantier_id)
  .map((m) => m.chantier_id));

// La liste du jour : { chantier, compte, tel, envoi }.
export function demandesAvisDuJour(db, aujourdhui) {
  const lien = lienAvisGoogle(db?.boutiques);
  if (!lien) return [];
  const deja = dejaDemandes(db?.messages);
  const sortie = [];
  (db?.clients_installes || []).forEach((c) => {
    if (!avisADemander(c, aujourdhui) || deja.has(c.id)) return;
    const compte = c.user_id ? (db.users || []).find((u) => u && u.id === c.user_id) : null;
    if (chantierDeFormation(db, c, compte)) return;
    if (compte && compte.actif === false) return;
    const tel = numeroWhatsApp((compte && compte.tel) || c.tel);
    if (!tel) return;
    sortie.push({ chantier: c, compte, tel, envoi: envoiDemandeAvis({ chantier: c, compte, lien }) });
  });
  return sortie;
}

const nomDuChantier = (c) => `${c?.prenom || ""} ${c?.nom || ""}`.trim() || "client";

// Ce qui s'écrit APRÈS l'envoi réussi (jamais avant).
export function ligneDemandeAvis({ id, tel, compte, chantier, variables, ts }) {
  const cle = cleConversation(tel);
  const texte = ligneEnvoiModele(MODELE_DEMANDE_AVIS, variables);
  if (!cle || !texte) return null;
  return {
    id, date: String(ts).slice(0, 10), ts,
    de_id: AUTEUR_DEMANDE_AVIS.id, de_nom: AUTEUR_DEMANDE_AVIS.nom, lu_par: [],
    canal: CANAL_WA, wa_tel: cle, wa_numero: tel, wa_nom: compte?.nom_base || compte?.nom || nomDuChantier(chantier),
    texte, wa_modele: MODELE_DEMANDE_AVIS, chantier_id: chantier.id,
  };
}
export const enteteApresAvis = ({ tel, compte, chantier, ts, entete }) =>
  construireEntete({
    cle: cleConversation(tel), tel, nom: compte?.nom_base || compte?.nom || nomDuChantier(chantier),
    proprietaire_id: entete?.proprietaire_id || "", proprietaire_nom: entete?.proprietaire_nom || "", derniere: ts,
  });
export const chantierApresAvis = (c, jour) => ({ ...c, avis_demande_le: String(jour).slice(0, 10) });
