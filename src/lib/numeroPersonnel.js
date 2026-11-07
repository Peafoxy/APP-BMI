// ============================================================
// lib/numeroPersonnel.js — PERSONNE N'ENVOIE DE SON PROPRE NUMÉRO, SAUF
// L'ADMINISTRATEUR (07/11/2026, « a + b, lance… pas seulement le lien… dans
// toute l'application, que personne ne puisse envoyer quoi que ce soit avec
// son numéro personnel, à part les administrateurs »).
//
// Trouvé ce jour-là : AGBEKO (technicien, chef du chantier de KOFFIVI MASSA)
// déclare les travaux terminés à 09:58 ; le numéro BMI ne peut pas envoyer
// depuis son téléphone (réseau du chantier), l'application ouvre WhatsApp sur
// SON téléphone avec le lien du PV — rien ne part. TIMO renvoie à 10:02, du
// numéro BMI : le client le lit.
//
// Depuis :
//   • un EMPLOYÉ qui n'est pas administrateur n'ouvre JAMAIS WhatsApp sur son
//     appareil pour écrire à quelqu'un (ni repli, ni bouton, ni lien) ;
//   • si le numéro BMI n'a pas pu envoyer faute de RÉSEAU (ou de session), le
//     message est GARDÉ sur l'appareil et repart tout seul du numéro BMI dès
//     que la connexion revient (« b ») — 24 h au plus ;
//   • s'il ne peut pas partir pour une autre raison (refus de WhatsApp,
//     modèle pas approuvé, numéro illisible…), ou si les 24 h passent,
//     LES ADMINISTRATEURS SONT PRÉVENUS par un message (« a »).
// Le client, lui, écrit de SON numéro (parrainage, 🔒 Mes données) : c'est
// lui qui parle, pas BMI — permis. L'administrateur garde le repli d'avant.
//
// Règles PURES, sans import (lues par le banc).
// ============================================================

// Qui peut ouvrir WhatsApp sur son propre appareil pour écrire.
// Sans compte connu (un banc, l'écran de connexion), rien ne change.
export const peutEcrireDeSonNumero = (profile) =>
  !profile || profile.role === "admin" || profile.role === "client";

export const MOTIF_NUMERO_PERSONNEL =
  "Seul l'administrateur peut écrire à un client de son propre numéro WhatsApp : tout part du numéro BMI.";

// Combien de temps un message gardé attend le réseau avant qu'on renonce.
export const HEURES_FILE_ENVOI = 24;

// Une entrée de la file : ce qu'il faut pour REFAIRE l'envoi (jamais un
// fichier : les PDF ne partent pas par ce chemin).
export const entreeFile = ({ id, tel, modele, variables, nom = "", ref = {}, motif = "", le, par = "" }) => ({
  id: String(id || ""), tel: String(tel || ""), modele: String(modele || ""),
  variables: Array.isArray(variables) ? variables.map((v) => String(v ?? "")) : [],
  nom: String(nom || ""), ref: ref && typeof ref === "object" ? { ...ref } : {},
  motif: String(motif || ""), le: String(le || ""), par: String(par || ""),
});

// Le même message (modèle + numéro + mots) n'entre qu'une fois dans la file.
const memeEnvoi = (a, b) => a.modele === b.modele
  && String(a.tel).replace(/\D/g, "").slice(-8) === String(b.tel).replace(/\D/g, "").slice(-8)
  && JSON.stringify(a.variables) === JSON.stringify(b.variables);

export const ajouterAFile = (file, entree) => {
  const liste = Array.isArray(file) ? file : [];
  return liste.some((x) => memeEnvoi(x, entree)) ? liste : [...liste, entree];
};

// Les entrées trop vieilles (on renonce, on prévient) et celles à réessayer.
export const trierFile = (file, maintenantMs, heures = HEURES_FILE_ENVOI) => {
  const limite = heures * 3600 * 1000;
  const expirees = []; const aRelancer = [];
  for (const e of Array.isArray(file) ? file : []) {
    const t = Date.parse(e.le);
    if (Number.isFinite(t) && maintenantMs - t > limite) expirees.push(e); else aRelancer.push(e);
  }
  return { expirees, aRelancer };
};

// Le message aux administrateurs (« a »). `quoi` = la phrase du modèle
// (« Lien de signature du PV envoyé à … ») sans le « 📲 Envoyé… » de tête.
export const texteAlerteAdmins = ({ quoi, client, tel, par, motif, expire = false }) =>
  `⚠ Message WhatsApp NON PARTI du numéro BMI${client ? ` — ${client}` : ""}${tel ? ` (${tel})` : ""}.\n\n` +
  `${quoi ? `Message : ${quoi}\n` : ""}` +
  `Geste fait par : ${par || "—"}.\n` +
  `${expire ? `Le réseau n'est pas revenu sur son appareil en ${HEURES_FILE_ENVOI} h : il n'est jamais parti.` : `Raison : ${motif || "inconnue"}.`}\n\n` +
  `Renvoyez-le depuis l'application (vous seul pouvez aussi l'envoyer de votre WhatsApp).`;

// Ce que voit l'employé (jamais « WhatsApp s'ouvre »).
export const texteEmployeGarde = (annonce) =>
  `${annonce ? `${annonce}\n\n` : ""}📶 Le message n'a pas pu partir du numéro BMI (pas de réseau). Il est GARDÉ sur cet appareil et repartira tout seul du numéro BMI dès que la connexion reviendra. Gardez l'application ouverte quand vous retrouvez du réseau.`;
export const texteEmployeAdmins = (motif, annonce) =>
  `${annonce ? `${annonce}\n\n` : ""}⚠ Le message n'a pas pu partir du numéro BMI${motif ? ` : ${motif}` : "."}\n\nL'administrateur est prévenu et le renverra. ${MOTIF_NUMERO_PERSONNEL}`;
