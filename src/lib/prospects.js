// ============================================================
// lib/prospects.js — UN prospect devient client : UNE règle (point A8 du
// relevé des doublons, Timo : « lance tout », 08/09/2026).
//
// Avant, deux chemins écrivaient des fiches différentes : l'encaissement
// (Ventes.jsx) posait `vente_id` mais pas `client_user_id` ni `maj_le` ;
// « Convertir en client » (Prospects.jsx) posait `client_user_id` mais pas
// `vente_id`. Un prospect converti n'avait donc pas la même fiche selon le
// chemin. Ici : les mêmes champs, chacun renseigné dès qu'on le connaît.
// Fichier PUR : le banc l'exerce.
// ============================================================
import { today } from "./core";

export const STATUT_CLIENT_ACQUIS = "Client acquis";

// Le prospect tel qu'il est une fois acquis. `vente_id` : la vente qui l'a
// fait client (encaissement) ; `client_user_id` : son compte client. On ne
// retire jamais un lien déjà posé : un prospect converti puis encaissé
// garde son compte ET reçoit sa vente.
export const prospectAcquis = (prospect, { vente_id, client_user_id } = {}) => ({
  ...prospect,
  converti: true,
  statut: STATUT_CLIENT_ACQUIS,
  date_conversion: prospect.date_conversion || today(),
  maj_le: today(),
  ...(vente_id ? { vente_id } : {}),
  ...(client_user_id ? { client_user_id } : {}),
});

// ============================================================
// 🤖 LA DEMANDE DE DEVIS VENUE DE L'ASSISTANT WHATSAPP (Timo, 24/09/2026 :
// « comment reprendre ce devis ? » → « 1 et 2 »)
//
// L'assistant crée une fiche au nom « Assistant BMI TOGO » — qui n'est
// PERSONNE : aucun commercial ne la voyait dans sa liste, et « Convertir »
// (réservé à l'administrateur ou au commercial rattaché) n'était possible
// qu'à l'administrateur. « 🙋 Prendre en charge » : le premier qui clique
// devient le commercial de la fiche, comme s'il l'avait créée — ensuite
// tout est comme d'habitude. Une demande ne se prend qu'UNE fois.
//
// ⚠ LE COUPLE : `securite-32` laisse passer ce seul changement de
// commercial (une demande de l'assistant, pas encore prise, prise POUR
// SOI) ; sans lui la base refuserait et tout le lot resterait coincé.
// `SOURCE_ASSISTANT` est le mot que l'assistant écrit (lib/assistantWhatsapp.js)
// et que le SQL lit : le banc compare les trois.
// ============================================================
export const SOURCE_ASSISTANT = "assistant_whatsapp";
export const estDemandeAssistant = (p) => !!p && p.source === SOURCE_ASSISTANT && !p.pris_le && !p.converti;
export const critiquePriseEnCharge = (p, profile) => {
  if (!p || p.source !== SOURCE_ASSISTANT) return "Cette fiche n'est pas une demande de l'assistant : elle a déjà un commercial.";
  if (p.pris_le) return `Cette demande a déjà été prise en charge par ${p.commercial || "quelqu'un"}.`;
  if (!profile?.nom) return "Compte sans nom : impossible de prendre en charge.";
  return null;
};
export const prendreEnCharge = (p, profile) => ({
  ...p, commercial: profile.nom, pris_le: today(), pris_par_id: profile.id ?? null, maj_le: today(),
});
// Le devis préparé depuis la fiche : le prospect garde le compte et le
// devis, SANS être marqué client (il n'a pas encore dit oui — c'est
// « Convertir » qui le fait, ou l'encaissement).
export const prospectAvecDevis = (p, { client_user_id, devis_id } = {}) => ({
  ...p,
  ...(client_user_id ? { client_user_id } : {}),
  ...(devis_id ? { devis_id } : {}),
  devis_prepare_le: today(), maj_le: today(),
});
