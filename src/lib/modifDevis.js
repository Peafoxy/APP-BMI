// ============================================================
// lib/modifDevis.js — MODIFIER UN DEVIS DÉJÀ SIGNÉ
//
// Décision Timo (11/09/2026), après « celui qui a proposé le devis peut
// avoir la possibilité de modifier le devis ? » :
//
//   « S'il a déjà signé, impossible de modifier… En ce moment l'utilisateur
//     va faire une demande de modification auprès du client… Le client valide
//     la demande avant que le devis ne soit modifiable. »
//   « Validé seul. Mais dès qu'on renvoie ce devis après modification, le
//     client ouvre, il voit et il peut accepter ou non. Pas proposé…
//     Après 3 aller-retour, le devis devient caduc. »
//   Puis : A — il RE-SIGNE ; B — s'il refuse, le devis est REJETÉ ;
//          C — le plan de règlement REDEVIENT À VALIDER.
//
// Le parcours, en un coup d'œil :
//   ✅ Validé
//     → « Demander une modification » (motif obligatoire)   ⏳ demande en attente
//     → le client ACCEPTE                                    le devis s'ouvre
//     → le vendeur corrige et renvoie                        🔄 Corrigé
//     → le client ACCEPTE et RE-SIGNE   → ✅ Validé, plan de règlement à revalider
//       ou REFUSE                       → ❌ Rejeté, l'affaire s'arrête
//
// 💰 Payé n'entre JAMAIS là-dedans (l'argent est encaissé : c'est la vente
// qu'on corrige, par une reprise, pas le devis).
//
// Règles PURES : le banc les exerce, aucun accès à l'écran.
// ============================================================
import { today, fmt, nouveauMessage } from "./core";
import { PLAN_EN_ATTENTE } from "./reglement";
import { ROLES_MODIFIENT_TOUT_DEVIS } from "./comptesClients";

// « Après 3 aller-retour, le devis devient caduc » : au-delà, plus aucune
// demande n'est acceptée — il faut établir un nouveau devis.
export const MAX_CYCLES_MODIF = 3;
export const STATUT_CORRIGE = "corrige";

export const demandeModifEnCours = (d) => d?.demande_bmi?.statut === "attente";
export const demandeModifAcceptee = (d) => d?.demande_bmi?.statut === "acceptee";
export const devisCorrige = (d) => (d?.statut || "propose") === STATUT_CORRIGE;
export const cyclesModif = (d) => Number(d?.cycles_modif || 0);

// Le chantier né de ce devis, et la dette qu'il a pu créer (pose seule).
export const chantierDuDevis = (db, devis) => (db?.clients_installes || []).find((c) => c.devis_id === devis?.id) || null;
export function detteDuDevis(db, devis) {
  const ch = chantierDuDevis(db, devis);
  return ch?.dette_id ? (db?.dettes || []).find((x) => x.id === ch.dette_id) || null : null;
}
const dejaVerse = (dette) => (dette?.paiements || []).reduce((s, p) => s + Number(p.montant || 0), 0);

// "" si la demande est permise ; sinon le motif, en français.
export function motifRefusDemandeModif(db, devis, profile) {
  if (!devis) return "Devis introuvable.";
  const statut = devis.statut || "propose";
  if (statut !== "valide")
    return statut === "paye"
      ? "🔒 Ce devis est payé : la vente est encaissée. Passez par une reprise dans 💰 Ventes."
      : "🔒 Une demande de modification ne se fait que sur un devis validé.";
  if (!(ROLES_MODIFIENT_TOUT_DEVIS.includes(profile?.role) || (!!devis.par_id && devis.par_id === profile?.id)))
    return `🔒 Seul ${devis.par || "celui qui a établi ce devis"}, l'administrateur ou le responsable commercial peut demander une modification.`;
  if (demandeModifEnCours(devis)) return "⏳ Une demande est déjà partie : le client doit d'abord répondre.";
  if (demandeModifAcceptee(devis)) return "✅ Le client a accepté : le devis est ouvert, corrigez-le et renvoyez-le.";
  if (cyclesModif(devis) >= MAX_CYCLES_MODIF)
    return `⛔ Ce devis a déjà fait ${MAX_CYCLES_MODIF} aller-retour : il n'est plus modifiable. Établissez un nouveau devis.`;
  // ⚠ Règle que j'ai proposée et que Timo a validée : travaux livrés, on ne
  // renégocie plus le prix par l'application.
  const ch = chantierDuDevis(db, devis);
  if (ch && ch.statut === "receptionne")
    return "🔒 Le chantier est réceptionné : les travaux sont livrés, le prix ne se renégocie plus ici.";
  // De l'argent déjà reçu sur ce devis (pose seule réglée en partie) : on ne
  // touche plus au montant, sinon la dette et le devis se contrediraient.
  const dette = detteDuDevis(db, devis);
  if (dejaVerse(dette) > 0)
    return `🔒 Le client a déjà versé ${fmt(dejaVerse(dette))} sur ce devis : son montant ne se modifie plus.`;
  return "";
}
export const peutDemanderModif = (db, devis, profile) => motifRefusDemandeModif(db, devis, profile) === "";

const majDevis = (db, clientId, devisId, champs) => db.users.map((u) => (u.id === clientId
  ? { ...u, devis: (u.devis || []).map((x) => (x.id === devisId ? { ...x, ...champs } : x)) }
  : u));

// 1. BMI demande au client la permission de modifier son devis signé.
export function poserDemandeModif(db, client, devis, profile, motif, date = today()) {
  const refus = motifRefusDemandeModif(db, devis, profile);
  if (refus) return { erreur: refus };
  if (!String(motif || "").trim()) return { erreur: "Dites au client POURQUOI vous voulez modifier son devis." };
  const demande = {
    motif: String(motif).trim(), par: profile?.nom || "", par_id: profile?.id || "",
    le: date, statut: "attente",
  };
  const message = nouveauMessage(profile, { a_id: client.id, devis_id: devis.id,
    texte: `✏️ DEMANDE DE MODIFICATION du devis de ${fmt(devis.total)} — motif : ${demande.motif}` });
  return {
    db: { ...db, messages: [message, ...(db.messages || [])],
      users: majDevis(db, client.id, devis.id, { demande_bmi: demande, vu_par: [] }) },
    journal: `Demande de modification envoyée au client ${client.nom} — devis de ${fmt(devis.total)} (${demande.motif})`,
  };
}

// 2. Le client répond à la demande. Refus : rien ne bouge, le devis reste
// validé tel qu'il a été signé.
export function repondreDemandeModif(db, client, devis, accepte, date = today()) {
  if (!demandeModifEnCours(devis)) return { erreur: "Cette demande n'est plus en attente." };
  const demande = { ...devis.demande_bmi, statut: accepte ? "acceptee" : "refusee", repondu_le: date };
  const message = nouveauMessage(client, { a_id: devis.demande_bmi.par_id, devis_id: devis.id,
    texte: accepte
      ? `✅ Le client ACCEPTE que le devis de ${fmt(devis.total)} soit modifié. Corrigez-le et renvoyez-le.`
      : `❌ Le client REFUSE la modification du devis de ${fmt(devis.total)} : il reste tel qu'il a été signé.` });
  return {
    db: { ...db, messages: [message, ...(db.messages || [])],
      users: majDevis(db, client.id, devis.id, { demande_bmi: demande }) },
    journal: accepte
      ? `Le client ${client.nom} ACCEPTE la modification de son devis de ${fmt(devis.total)}`
      : `Le client ${client.nom} REFUSE la modification de son devis de ${fmt(devis.total)} — il reste signé tel quel`,
  };
}

// 3. Le devis corrigé repart chez le client : il n'est PAS « proposé » (Timo),
// il attend son accord. On garde la signature d'avant et on compte le tour.
export function marquerDevisCorrige(ancien, devis, date = today()) {
  if (!demandeModifAcceptee(ancien)) return devis;
  return {
    ...devis,
    statut: STATUT_CORRIGE,
    corrige_le: date,
    cycles_modif: cyclesModif(ancien) + 1,
    demande_bmi: { ...ancien.demande_bmi, statut: "corrigee" },
    // L'historique ne rétrécit jamais : chaque tour garde son avant/après et
    // la signature qui ne vaut plus.
    historique_modif: [...(ancien.historique_modif || []), {
      le: date, motif: ancien.demande_bmi?.motif || "", par: ancien.demande_bmi?.par || "",
      total_avant: Number(ancien.total || 0), total_apres: Number(devis.total || 0),
      contrat_signature: ancien.contrat_signature || "", contrat_date_signature: ancien.contrat_date_signature || "",
    }],
    // Ce qui portait sur l'ancien montant ne vaut plus tant qu'il n'a pas re-signé.
    contrat_signature: "", contrat_date_signature: "",
    vu_par: [],
  };
}

// 4a. Le client ACCEPTE le devis corrigé : il RE-SIGNE (décision A). Le contrat
// garde son numéro ; le plan de règlement redevient à valider (décision C) ;
// la dette d'une pose seule suit le nouveau montant (rien n'a été versé, la
// demande l'aurait refusée).
export function accepterDevisCorrige(db, clientId, devisId, { signature, plan, date = today(), acteur } = {}) {
  const client = (db.users || []).find((u) => u.id === clientId);
  const devis = client ? (client.devis || []).find((x) => x.id === devisId) : null;
  if (!devis) return { erreur: "Ce devis n'existe plus." };
  if (!devisCorrige(devis)) return { erreur: "Ce devis n'attend pas votre accord." };
  if (!signature) return { erreur: "Merci de signer dans le cadre prévu avant de continuer." };
  // Décision Timo (C) : « le plan de règlement redevient à valider ». Le
  // client peut en reproposer un (le montant a changé) ; sinon l'ancien
  // repart en attente de VOTRE décision. Jamais accepté d'office.
  const planSource = plan || devis.plan_reglement;
  const planRevalide = planSource
    ? { ...planSource, statut: PLAN_EN_ATTENTE, decide_le: "", decide_par: "", motif_rejet: "" }
    : planSource;
  const ch = chantierDuDevis(db, devis);
  const dette = detteDuDevis(db, devis);
  return {
    db: {
      ...db,
      users: majDevis(db, clientId, devisId, {
        statut: "valide", contrat_signature: signature, contrat_date_signature: date,
        accepte_corrige_le: date, plan_reglement: planRevalide, demande_bmi: null,
      }),
      dettes: dette ? (db.dettes || []).map((x) => (x.id === dette.id ? { ...x, montant: Number(devis.total || 0) } : x)) : db.dettes,
      clients_installes: ch && ch.pose_seule
        ? (db.clients_installes || []).map((c) => (c.id === ch.id ? { ...c, frais_installation: Number(devis.total || 0) } : c))
        : db.clients_installes,
      messages: [nouveauMessage(client, { a_id: devis.par_id, devis_id: devis.id,
        texte: `✅ Le client ACCEPTE le devis corrigé (${fmt(devis.total)}) et l'a re-signé.${planRevalide ? " Le plan de règlement est à revalider." : ""}` }), ...(db.messages || [])],
    },
    journal: `Devis corrigé ${fmt(devis.total)} ACCEPTÉ et re-signé par ${acteur?.nom || client.nom}${planRevalide ? " — plan de règlement à revalider" : ""}`,
  };
}

// 4b. Le client REFUSE le devis corrigé : le devis est REJETÉ (décision B de
// Timo), l'affaire s'arrête. Il faudra un nouveau devis.
export function refuserDevisCorrige(db, clientId, devisId, { motif, date = today(), acteur } = {}) {
  const client = (db.users || []).find((u) => u.id === clientId);
  const devis = client ? (client.devis || []).find((x) => x.id === devisId) : null;
  if (!devis) return { erreur: "Ce devis n'existe plus." };
  if (!devisCorrige(devis)) return { erreur: "Ce devis n'attend pas votre réponse." };
  if (!String(motif || "").trim()) return { erreur: "Merci d'indiquer pourquoi vous refusez." };
  return {
    db: {
      ...db,
      users: majDevis(db, clientId, devisId, {
        statut: "rejete", motif_rejet: String(motif).trim(), rejete_le: date, demande_bmi: null, vu_par: [],
      }),
      messages: [nouveauMessage(client, { a_id: devis.par_id, devis_id: devis.id,
        texte: `❌ Le client REFUSE le devis corrigé (${fmt(devis.total)}) — motif : ${String(motif).trim()}` }), ...(db.messages || [])],
    },
    journal: `Devis corrigé ${fmt(devis.total)} REFUSÉ par ${acteur?.nom || client.nom} — ${String(motif).trim()}`,
  };
}
