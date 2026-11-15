// 🆕 UN PROSPECT OU UN CLIENT VIENT D'ÊTRE ENREGISTRÉ : QUI PRÉVENIR, ET DE QUOI
// (Timo, 15/11/2026 : « à chaque prospect créé ou nouveau client créé, il faut
// envoyer un message WhatsApp au chef d'équipe, au responsable commercial et
// aux administrateurs » → « A a, B a, C b, texte ok »).
//
//   A a — le chef ⭐ de CELUI QUI ENREGISTRE (son parrain), pas tous les chefs ;
//   B a — tous les administrateurs de l'espace ;
//   C b — un client : 🙋 Créer un client et « Convertir » d'un prospect seulement ;
//   D   — un prospect posé par l'assistant WhatsApp n'envoie rien ici.
//
// Règle pure : elle reçoit `db` et rend des personnes de l'espace de la FICHE
// (les briques de lib/espace.js — le mur). Jamais celui qui enregistre, jamais
// un compte désactivé, bloqué ou sans numéro ; un même numéro une seule fois.
import { idsChefDe, idsParRole, idsAdmins, personnesDeLEspace } from "./espace.js";

const huit = (tel) => String(tel || "").replace(/\D/g, "").slice(-8);

export function destinatairesNouveauContact(db, auteur, formation) {
  const espace = !!formation;
  const ids = [...new Set([
    ...idsChefDe(db, auteur || {}),
    ...idsParRole(db, espace, ["resp_commercial"]),
    ...idsAdmins(db, espace),
  ])].filter((id) => id !== (auteur && auteur.id));
  const personnes = [...personnesDeLEspace(db, espace), ...(db.users || [])];
  const vus = new Set(), out = [];
  for (const id of ids) {
    const u = personnes.find((x) => x.id === id);
    if (!u || u.role === "client" || u.actif === false || u.bloque) continue;
    const cle = huit(u.tel);
    if (cle.length < 8 || vus.has(cle)) continue;
    vus.add(cle);
    out.push(u);
  }
  return out;
}

// Ce que dit le trou « Détail ».
export const detailProspect = (p) => [p && p.projet, p && p.localisation].map((x) => String(x || "").trim()).filter(Boolean).join(", ");
export const DETAIL_CLIENT_CREE = "compte client créé";
export const DETAIL_CLIENT_CONVERTI = "prospect converti en client";

// Les mots du message, relus sur la fiche (l'envoi ET le détail privé de
// 📲 WhatsApp y passent). `ref` = { contact_type, contact_id }.
export function contactDepuisRef(db, ref) {
  if (!ref) return null;
  if (ref.contact_type === "prospect") {
    const p = (db.prospects || []).find((x) => x.id === ref.contact_id);
    return p ? { type: "prospect", nom: p.nom, telContact: p.tel, par: p.commercial, detail: detailProspect(p) } : null;
  }
  if (ref.contact_type === "client") {
    const u = (db.users || []).find((x) => x.id === ref.contact_id);
    if (!u) return null;
    const converti = (db.prospects || []).some((x) => x.client_user_id === u.id && x.date_conversion);
    return { type: "client", nom: u.nom_base || u.nom, telContact: u.tel, par: u.cree_par, detail: converti ? DETAIL_CLIENT_CONVERTI : DETAIL_CLIENT_CREE };
  }
  return null;
}
