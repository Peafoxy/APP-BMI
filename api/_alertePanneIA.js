// ============================================================
// api/_alertePanneIA.js — PRÉVENIR L'ADMINISTRATEUR PRINCIPAL QUAND LE
// SERVICE D'IA REFUSE DE RÉPONDRE (22/10/2026, « b, lance »).
//
// La règle (quelle panne, une fois par jour, le texte) vit dans
// src/lib/panneIA.js. Ici : relire la fiche du principal, poser la marque
// du jour, envoyer la notification. Appelé par l'adresse d'arrivée
// (api/whatsapp-entrant.js) et par la relance (api/_relanceAssistant.js),
// là où l'appel au service d'IA échoue.
//
// ⚠ Ne lève JAMAIS : une alerte qui échoue ne doit pas empêcher le menu de
// répondre au client. Elle le dit au journal du serveur.
// ============================================================
import { motifPanneIA, alerteAEnvoyer, marqueAlerteIA, envoiPanneIA } from "../src/lib/panneIA.js";
import { estAdminPrincipalActif } from "../src/lib/espace.js";
import { configurerWebPush, envoyerAuxPersonnes } from "./_push.js";

// Ce que CETTE instance a déjà fait aujourd'hui : évite de relire la base à
// chaque message d'un client tant que la panne dure. La marque de la fiche
// reste la vraie barrière (une autre instance la lit).
const dejaFaitIci = new Set();

export async function signalerPanneIA(admin, erreur) {
  try {
    const motif = motifPanneIA(erreur);
    if (!motif) return { prevenu: false, pourquoi: "panne passagère : personne n'est dérangé" };
    const le = new Date().toISOString();
    const jour = le.slice(0, 10);
    if (dejaFaitIci.has(`${jour}|${motif}`)) return { prevenu: false, pourquoi: "déjà prévenu aujourd'hui" };
    const { data: us, error } = await admin.from("users").select("id, data");
    if (error) throw error;
    const principal = (us || []).map((l) => ({ ...(l.data || {}), id: l.id })).find(estAdminPrincipalActif);
    if (!principal) return { prevenu: false, pourquoi: "aucun administrateur principal actif" };
    // La fiche FRAÎCHE, juste avant d'écrire.
    const { data: frais } = await admin.from("users").select("id, data").eq("id", principal.id).maybeSingle();
    if (!frais || !alerteAEnvoyer(frais.data, motif, jour)) {
      dejaFaitIci.add(`${jour}|${motif}`);
      return { prevenu: false, pourquoi: "déjà prévenu aujourd'hui" };
    }
    // La marque D'ABORD : deux messages en même temps ne préviennent pas deux fois.
    const data = { ...frais.data, alerte_ia: marqueAlerteIA(motif, jour, le), updated_at: le };
    const { error: errM } = await admin.from("users").update({ data, updated_at: le }).eq("id", frais.id);
    if (errM) throw errM;
    dejaFaitIci.add(`${jour}|${motif}`);
    if (!configurerWebPush()) return { prevenu: false, pourquoi: "notifications non configurées sur le serveur" };
    await envoyerAuxPersonnes(admin, [envoiPanneIA(principal.id, motif)]);
    return { prevenu: true, motif };
  } catch (e) {
    console.error("[alerte panne IA] non envoyée —", e?.message || e);
    return { prevenu: false, pourquoi: "erreur" };
  }
}
