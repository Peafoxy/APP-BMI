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
