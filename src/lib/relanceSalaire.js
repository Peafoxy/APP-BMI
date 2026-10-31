// ============================================================
// lib/relanceSalaire.js — RELANCER UN SALAIRE PAYÉ QUE L'EMPLOYÉ N'A PAS
// CONFIRMÉ REÇU (31/10/2026)
//
// Timo : « Relance de confirmation salaire » → « a et b » :
//  a) un bouton 📲 Relancer sur un paiement « ⏳ à confirmer » de 💵 Salaires
//     (administrateur, une question avant, le numéro BMI, repli sur
//     l'ouverture WhatsApp avec le même texte) ;
//  b) la tournée de 7 h relance d'elle-même, UNE fois, au 3e jour sans
//     confirmation : une notification sur le téléphone de l'employé et le
//     même WhatsApp (modèle `rappel_confirmation_salaire`).
//
// ⚠ UNE FOIS : la marque `relance_auto = { le, notif_le, whatsapp_le }` sur
// le virement (fiche de PAIE, écrite par le serveur), plus un filet qui ne
// se réécrit jamais : la ligne du fil 📲 WhatsApp (modèle + virement_id).
// La notification part une fois ; le WhatsApp se retente le lendemain s'il
// a été refusé (modèle pas encore approuvé…), tant qu'on est dans la fenêtre.
// ⚠ LA FENÊTRE : du 3e au 10e jour après le paiement. Sans elle, le premier
// matin relancerait tous les vieux paiements jamais confirmés (leçon de la
// demande d'avis Google). Un paiement plus vieux se relance au bouton.
// ⚠ LE MUR : jamais un compte de formation, un client, un compte inactif ou
// bloqué.
//
// Règle pure, lue par le serveur : imports écrits avec `.js`.
// ============================================================
import { envoiRappelConfirmationSalaire, ligneEnvoiModele, ligneMasquee, numeroWhatsApp } from "./whatsappModeles.js";
import { cleConversation, CANAL_WA, construireEntete } from "./whatsappConversations.js";
import { estCompteFormation } from "./espace.js";
import { moisEnClair } from "./loyer.js";

export const MODELE_RELANCE_SALAIRE = "rappel_confirmation_salaire";
export const JOURS_AVANT_RELANCE_SALAIRE = 3;
export const JOURS_FENETRE_RELANCE_SALAIRE = 10;
export const AUTEUR_RELANCE_SALAIRE = { id: "relance-salaire-bmi", nom: "Relance automatique BMI" };

const jourMs = (iso) => Date.parse(`${String(iso || "").slice(0, 10)}T00:00:00Z`);
export const joursDepuis = (dateIso, aujourdhui) => {
  const a = jourMs(dateIso), b = jourMs(aujourdhui);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86400000) : -1;
};

export const virementAConfirmer = (v) => !!v && v.statut !== "accepte" && Number(v.montant) > 0;
export const virementsAConfirmer = (u) => (u?.virements || []).filter(virementAConfirmer);

// Le mois du salaire en lettres (« octobre 2026 »).
export const moisDuVirement = (v) => moisEnClair([v?.mois]) || "ce mois";

// L'envoi WhatsApp de la relance, UNE fabrique pour le bouton et la tournée.
export const envoiRelanceSalaire = (u, v, { fmt, dFR } = {}) => envoiRappelConfirmationSalaire({
  employe: u?.nom_complet || u?.nom, tel: u?.tel, mois: moisDuVirement(v), date: v?.date_envoi, montant: v?.montant, fmt, dFR,
});

const dejaEnvoyesAuFil = (messages) => new Set((messages || [])
  .filter((m) => m && m.canal === CANAL_WA && m.wa_modele === MODELE_RELANCE_SALAIRE && m.virement_id)
  .map((m) => m.virement_id));

const employeReel = (db, u) => u && u.role && u.role !== "client" && u.actif !== false && !u.bloque && !estCompteFormation(db, u);

// La relance du jour (tournée de 7 h). `db.users` porte la fiche de PAIE
// recollée (fusionnerPaie). Rend [{ employe, virement, tel, envoi, notifier, whatsapp }].
export function relancesSalaireDuJour(db, aujourdhui, { fmt, dFR } = {}) {
  const fil = dejaEnvoyesAuFil(db?.messages);
  const sortie = [];
  (db?.users || []).forEach((u) => {
    if (!employeReel(db, u)) return;
    virementsAConfirmer(u).forEach((v) => {
      const age = joursDepuis(v.date_envoi, aujourdhui);
      if (age < JOURS_AVANT_RELANCE_SALAIRE || age > JOURS_FENETRE_RELANCE_SALAIRE) return;
      const marque = v.relance_auto || {};
      const tel = numeroWhatsApp(u.tel);
      const envoi = tel ? envoiRelanceSalaire(u, v, { fmt, dFR }) : null;
      const notifier = !marque.notif_le;
      const whatsapp = !!envoi && !marque.whatsapp_le && !fil.has(v.id);
      if (!notifier && !whatsapp) return;
      sortie.push({ employe: u, virement: v, tel, envoi, notifier, whatsapp });
    });
  });
  return sortie;
}

// La notification à l'employé (liste B : pour information).
export const notificationRelanceSalaire = (u, v, { fmt, dFR } = {}) => {
  const f = typeof fmt === "function" ? fmt : (n) => `${n} F`;
  const d = typeof dFR === "function" ? dFR : (x) => String(x || "");
  return {
    destinataires: [u.id],
    titre: "💵 Confirmez la réception de votre salaire",
    texte: `${f(v.montant)} pour ${moisDuVirement(v)}, payé le ${d(v.date_envoi)}. Ouvrez 💵 Mon salaire et confirmez la réception.`,
    ecran: "salaire", tag: `relance-salaire:${v.id}`,
  };
};

// La marque posée sur le virement APRÈS la tournée (jamais avant).
export function virementApresRelance(v, { le, notif = false, whatsapp = false }) {
  const avant = v?.relance_auto || {};
  return {
    ...v,
    relance_auto: {
      ...avant,
      le: avant.le || le,
      ...(notif ? { notif_le: le } : {}),
      ...(whatsapp ? { whatsapp_le: le } : {}),
    },
  };
}
// Sur la fiche de paie relue : seul CE virement change.
export const paieApresRelance = (paie, virementId, quoi) => ({
  ...paie,
  virements: (paie?.virements || []).map((v) => (v && v.id === virementId ? virementApresRelance(v, quoi) : v)),
});

// La ligne du fil 📲 WhatsApp (serveur), PRIVÉE : le détail se recompose
// depuis le virement pour l'administrateur principal.
export function ligneRelanceSalaire({ id, tel, employe, virement, variables, ts }) {
  const cle = cleConversation(tel);
  if (!cle || !ligneEnvoiModele(MODELE_RELANCE_SALAIRE, variables)) return null;
  return {
    id, date: String(ts).slice(0, 10), ts,
    de_id: AUTEUR_RELANCE_SALAIRE.id, de_nom: AUTEUR_RELANCE_SALAIRE.nom, lu_par: [],
    canal: CANAL_WA, wa_tel: cle, wa_numero: tel, wa_nom: employe?.nom_complet || employe?.nom || "",
    texte: ligneMasquee(MODELE_RELANCE_SALAIRE), wa_modele: MODELE_RELANCE_SALAIRE, wa_prive: true,
    salaire_user_id: employe?.id, virement_id: virement?.id,
  };
}
export const enteteApresRelanceSalaire = ({ tel, employe, ts, entete }) =>
  construireEntete({
    cle: cleConversation(tel), tel, nom: employe?.nom_complet || employe?.nom || "",
    proprietaire_id: entete?.proprietaire_id || "", proprietaire_nom: entete?.proprietaire_nom || "", derniere: ts, entete,
  });

// Ce que l'écran 💵 Salaires écrit sous un paiement relancé.
export function phraseRelances(v, dFR) {
  const d = typeof dFR === "function" ? dFR : (x) => String(x || "");
  const morceaux = [];
  if (v?.relance_auto?.le) morceaux.push(`relancé automatiquement le ${d(v.relance_auto.le)}`);
  (v?.relances_main || []).forEach((r) => morceaux.push(`relancé le ${d(r.le)}${r.par ? ` par ${r.par}` : ""}`));
  return morceaux.length ? `📲 ${morceaux.join(" · ")}` : "";
}
