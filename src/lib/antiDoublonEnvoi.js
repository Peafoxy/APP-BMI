// ============================================================
// lib/antiDoublonEnvoi.js — LE MÊME MESSAGE NE PART PAS DEUX FOIS (18/10/2026)
//
// Timo : « lorsqu'on appuie envoi WhatsApp, il faut empêcher d'appuyer
// encore… sinon on envoie plusieurs messages simultanément » → « les deux,
// lance » : (1) le bouton se grise « ⏳ Envoi en cours… » (components/ui.jsx,
// BoutonEnvoi / BoutonRond `envoi`) ; (2) CE filet, dans `envoyerModele`
// (src/whatsapp.js) : le MÊME message — même modèle, même numéro, mêmes mots
// dans les trous — est refusé tant qu'il part, et pendant UNE MINUTE après
// être parti. Le bouton protège l'écran qu'on regarde ; le filet protège tout
// le reste (deux boutons qui envoient la même chose, une fenêtre de question
// reposée par un second appui, un écran remonté pendant l'envoi).
//
// ⚠ Un envoi REFUSÉ par WhatsApp ou coupé par le réseau ne bloque RIEN : on
// doit pouvoir réessayer tout de suite (la phrase de la coupure le dit). Après
// une coupure, l'écran dit déjà « regardez le WhatsApp du téléphone BMI ».
// ⚠ Un message DIFFÉRENT (autre modèle, autre client, autres montants) part
// toujours : on ne bloque que la copie.
// Sans import (lu par le banc tel quel).
// ============================================================
export const DELAI_ANTI_DOUBLON_MS = 60000;
export const ATTENTE_MAX_EN_COURS_MS = 120000;

export const MOTIF_DOUBLON_EN_COURS = "Ce message est déjà en train de partir à ce client : attendez la fin de l'envoi.";
export const MOTIF_DOUBLON_PARTI = "Ce message vient déjà de partir à ce client, il y a moins d'une minute : il n'est pas renvoyé.";

const huitChiffres = (tel) => String(tel || "").replace(/\D/g, "").slice(-8);

// La clé d'un envoi : modèle + 8 derniers chiffres du numéro + les trous.
// Un fichier joint compte par son nom et sa taille (jamais ses octets).
export function cleEnvoi({ modele, tel, variables, fichier } = {}) {
  const f = fichier ? `${fichier.nom || ""}#${String(fichier.donnees || "").length}` : "";
  return [String(modele || ""), huitChiffres(tel), JSON.stringify(Array.isArray(variables) ? variables : []), f].join("|");
}

// Le registre : { [cle]: { etat: "en_cours" | "parti", le: ms } }.
export function creerRegistre() { return new Map(); }

// Le motif du refus, ou "" si l'envoi peut partir.
export function critiqueDoublon(registre, cle, maintenant) {
  const e = registre && registre.get(cle);
  if (!e) return "";
  // Un envoi resté « en cours » plus de 2 minutes (appel jamais revenu) ne
  // bloque plus : on ne coince personne pour toujours.
  if (e.etat === "en_cours") return maintenant - e.le < ATTENTE_MAX_EN_COURS_MS ? MOTIF_DOUBLON_EN_COURS : "";
  if (e.etat === "parti" && maintenant - e.le < DELAI_ANTI_DOUBLON_MS) return MOTIF_DOUBLON_PARTI;
  return "";
}

export function marquerEnCours(registre, cle, maintenant) { registre.set(cle, { etat: "en_cours", le: maintenant }); }
export function marquerParti(registre, cle, maintenant) { registre.set(cle, { etat: "parti", le: maintenant }); }
// Refusé ou coupé : on oublie, on peut réessayer.
export function oublierEnvoi(registre, cle) { registre.delete(cle); }

// Le registre ne grandit pas sans fin : ce qui est parti depuis plus d'une
// minute ne sert plus à rien.
export function nettoyerRegistre(registre, maintenant) {
  for (const [cle, e] of registre) {
    if (e.etat === "parti" && maintenant - e.le >= DELAI_ANTI_DOUBLON_MS) registre.delete(cle);
  }
}
