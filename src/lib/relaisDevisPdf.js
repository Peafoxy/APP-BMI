// ============================================================
// lib/relaisDevisPdf.js — LE DEVIS REPART SANS PDF QUAND META REJETTE LE PDF (18/10/2026)
//
// Capture Timo (MANDA, 18:02) : `devis_pdf` accepté à l'envoi, puis ❌
// « header: Template does not contain title component, no parameters
// allowed » — le modèle avait perdu son en-tête Document chez YCloud.
// L'application avait cru le PDF parti : `devis_disponible` n'était jamais
// envoyé, le client ne recevait RIEN au sujet de son devis. Décision « a » :
// dès que Meta rejette un `devis_pdf`, le serveur (l'adresse d'arrivée, qui
// reçoit le ❌) envoie `devis_disponible`, UNE fois.
//
// ⚠ Le rejet arrive APRÈS l'envoi : l'écran ne peut pas le savoir, c'est le
// serveur qui relaie. ⚠ UNE fois : la marque `wa_relais_le` est posée sur la
// ligne du PDF AVANT l'envoi (une réservation) ; un refus du relais n'est pas
// retenté. ⚠ Rien n'est écrit dans le fil tant que WhatsApp n'a pas accepté.
// ⚠ Le mur : un devis de formation, ou à la corbeille, ne relaie rien.
// Lisible par le serveur : imports en `.js`.
// ============================================================
import { envoiDevisDisponible, ligneEnvoiModele } from "./whatsappModeles.js";
import { CANAL_WA, construireEntete } from "./whatsappConversations.js";

export const MODELE_PDF = "devis_pdf";
export const MODELE_RELAIS = "devis_disponible";
export const SUITE_LIGNE_RELAIS = " (le PDF n'a pas été accepté par WhatsApp : message envoyé sans PDF)";

// Le ❌ d'un `devis_pdf`, pas encore relayé, sur une ligne qui dit son devis.
export function relaisAFaire(ligne, nouveau) {
  const l = ligne || {};
  return l.wa_modele === MODELE_PDF
    && !!l.devis_id
    && !l.wa_relais_le
    && !!nouveau && nouveau.etat === "echec";
}

// Le devis à relayer : pas de formation, pas à la corbeille, et bien rangé
// chez ce client. Rend { modele, variables } ou null.
export function envoiRelais({ compte, devisId, fmt }) {
  const devis = ((compte && compte.devis) || []).find((d) => d && d.id === devisId);
  if (!devis || devis.formation || devis.supprime_le || (compte && compte.formation)) return null;
  const e = envoiDevisDisponible({ devis, compte, fmt });
  return e.modele === MODELE_RELAIS ? e : null;
}

// La ligne du fil, écrite APRÈS l'accord de WhatsApp : au nom de celui qui
// avait envoyé le PDF (c'est son devis qui repart), sans propriétaire.
export function ligneRelais({ id, ligne, variables, ts }) {
  const base = ligneEnvoiModele(MODELE_RELAIS, variables);
  if (!base || !ligne) return null;
  return {
    id, date: String(ts).slice(0, 10), ts,
    de_id: ligne.de_id || "", de_nom: ligne.de_nom || "", lu_par: [],
    canal: CANAL_WA, wa_tel: ligne.wa_tel, wa_numero: ligne.wa_numero, wa_nom: ligne.wa_nom || "",
    texte: `${base}${SUITE_LIGNE_RELAIS}`,
    wa_modele: MODELE_RELAIS, devis_id: ligne.devis_id, wa_relais_de: ligne.id || "",
  };
}

// La fiche légère suit, sans toucher au propriétaire.
export const enteteApresRelais = ({ ligne, ts, entete }) =>
  construireEntete({
    cle: ligne.wa_tel, tel: ligne.wa_numero || "", nom: ligne.wa_nom || "",
    proprietaire_id: (entete && entete.proprietaire_id) || "", proprietaire_nom: (entete && entete.proprietaire_nom) || "",
    derniere: ts, entete,
  });
