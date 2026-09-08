// ============================================================
// lib/contrat.js — LE CONTRAT ET LE PV, EN UN SEUL ENDROIT
//
// Points A1, A2, A11 et A12 du relevé des doublons (Timo : « lance tout »,
// 08/09/2026). Avant : le numéro de contrat était fabriqué à deux endroits
// (signature sur le téléphone du client, signature en boutique), le plan
// de règlement signé recopié quinze lignes dans ces deux chemins, le numéro
// de PV suivait une règle à part, et les quatre champs du lien de signature
// du PV étaient écrits deux fois. Ce fichier est PUR (aucun React) : le
// banc l'exerce tel quel.
// ============================================================
import { uid, today } from "./core";
import { PLAN_EN_ATTENTE } from "./reglement";

// CTR-année-8 caractères : attribué à la signature (ou à l'impression pour
// une signature papier), puis gardé tel quel — le papier et l'application
// portent le même numéro.
export const numeroContrat = () => `CTR-${new Date().getFullYear()}-${uid().slice(0, 8).toUpperCase()}`;

// PV-année-6 caractères de l'identifiant du chantier : le même chantier
// garde le même numéro de PV, même si le lien est renvoyé.
export const numeroPv = (chantier) => `PV-${today().slice(0, 4)}-${String(chantier?.id || "").slice(0, 6).toUpperCase()}`;

// Le plan de règlement tel qu'il est signé avec le contrat : seulement s'il
// restera un solde après l'acompte (sans solde, rien à promettre). Le
// caller a déjà passé le plan par critiquePlan(). Même objet, mot pour
// mot, que le client signe sur son téléphone ou en boutique.
export const planReglementSigne = (plan, solde) => (Number(solde || 0) > 0
  ? {
      type: plan.type,
      montant_mensuel: plan.type === "mensuel" ? Number(plan.montant_mensuel) : null,
      premiere_echeance: plan.type === "mensuel" ? plan.premiere_echeance : null,
      solde_engage: Number(solde),
      propose_le: today(),
      statut: PLAN_EN_ATTENTE,
    }
  : null);

// Les quatre champs posés sur le chantier quand le lien de signature du PV
// part (première fois ou renvoi).
export const champsLienPv = (jeton, numero) => ({
  contrat_jeton: jeton,
  contrat_jeton_le: new Date().toISOString(),
  contrat_numero: numero,
  contrat_statut: "attente_signature",
});
