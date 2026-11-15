// ============================================================
// lib/rappelProforma.js — ⌛ LE RAPPEL D'EXPIRATION D'UNE PROFORMA
//
// Timo, 15/11/2026 : « Je veux juste un seul message à relancer entre 13ème
// et 14ème jour pour informer le client que son proforma expire » (après
// « informer les clients qui ont demandé un proforma qu'après 15ème jour,
// le proforma devient caduc et que les prix sont à confirmer »).
//
// Règle pure (aucun réseau, aucune base) : la tournée de 7 h
// (api/rappels-du-matin.js) l'importe telle quelle, le banc aussi — d'où
// les imports écrits avec `.js`.
//
// • Les 15 jours comptent depuis la date de la proforma, ou depuis sa
//   dernière MODIFICATION (comme son PDF : « valable 15 jours à compter du »).
// • Le message part le 13e jour ; le 14e rattrape une tournée manquée. Après,
//   plus rien : on n'annonce pas « valable jusqu'au » la veille au soir.
// • UN SEUL message par version de la proforma : la marque
//   `rappel_expiration = { le, pour }` sur la proforma (`pour` = le jour d'où
//   courent les 15 jours — une modification rouvre le rappel), et la ligne du
//   fil 📲 WhatsApp (elle ne se réécrit jamais).
// • IL NE PART PAS : proforma déjà encaissée, boutique de formation, sans
//   numéro, client qui a dit STOP (la tournée l'écarte).
// ⚠ Rien n'est bloqué : une proforma de plus de 15 jours se vend toujours.
// ============================================================
import { joursEntre } from "./rappels.js";
import { boutiqueEstFormation } from "./espace.js";
import { VALIDITE_OFFRE_JOURS } from "./constants.js";
import { envoiRappelProforma, ligneEnvoiModele, numeroWhatsApp, finDeValidite } from "./whatsappModeles.js";
import { cleConversation, CANAL_WA, construireEntete } from "./whatsappConversations.js";
import { fmt, dFR } from "./core.js";

export const JOUR_RAPPEL_PROFORMA = 13;
export const DERNIER_JOUR_RAPPEL_PROFORMA = 14;
export const MODELE_RAPPEL_PROFORMA = "rappel_proforma_expiration";
export const AUTEUR_RAPPEL_PROFORMA = { id: "rappel-proforma-bmi", nom: "Rappel automatique BMI" };

// Le jour d'où courent les 15 jours : la modification, sinon la proforma.
export const debutValiditeProforma = (pf) => String((pf && (pf.modifie_le || pf.date)) || "").slice(0, 10);
export const finProforma = (pf) => finDeValidite(debutValiditeProforma(pf), VALIDITE_OFFRE_JOURS);

// La proforma, seule : son rappel part-il aujourd'hui ?
export function proformaARappeler(pf, aujourdhui) {
  if (!pf || pf.formation === true) return false;
  const debut = debutValiditeProforma(pf);
  if (!debut || !finProforma(pf)) return false;
  if (pf.rappel_expiration && pf.rappel_expiration.pour === debut) return false;
  const j = joursEntre(debut, aujourdhui);
  return j >= JOUR_RAPPEL_PROFORMA && j <= DERNIER_JOUR_RAPPEL_PROFORMA;
}

// Les rappels déjà partis, lus dans le fil : « proforma|jour de départ ».
const cleRappel = (id, debut) => `${id}|${debut}`;
export const rappelsProformaDejaPartis = (messages) =>
  new Set((messages || []).filter((m) => m && m.canal === CANAL_WA && m.wa_modele === MODELE_RAPPEL_PROFORMA && m.proforma_id)
    .map((m) => cleRappel(m.proforma_id, m.proforma_debut || "")));

// La liste du jour : { proforma, tel, envoi }.
// ⚠ LE MUR : jamais une proforma d'une boutique de formation.
export function rappelsProformaDuJour(db, aujourdhui) {
  const deja = rappelsProformaDejaPartis(db?.messages);
  const encaissees = new Set((db?.ventes || []).filter((v) => v && v.proforma_id).map((v) => v.proforma_id));
  const sortie = [];
  (db?.proformas || []).forEach((pf) => {
    if (!proformaARappeler(pf, aujourdhui)) return;
    if (encaissees.has(pf.id)) return;
    if (boutiqueEstFormation(db || {}, pf.boutique)) return;
    if (deja.has(cleRappel(pf.id, debutValiditeProforma(pf)))) return;
    const tel = numeroWhatsApp(pf.tel);
    if (!tel) return;
    const envoi = envoiRappelProforma({ proforma: pf, fin: finProforma(pf), fmt, dFR });
    if (!envoi) return;
    sortie.push({ proforma: pf, tel, envoi });
  });
  return sortie;
}

// Ce qui s'écrit APRÈS l'envoi réussi (jamais avant).
export function ligneRappelProforma({ id, tel, proforma, variables, ts }) {
  const cle = cleConversation(tel);
  const texte = ligneEnvoiModele(MODELE_RAPPEL_PROFORMA, variables);
  if (!cle || !texte) return null;
  return {
    id, date: String(ts).slice(0, 10), ts,
    de_id: AUTEUR_RAPPEL_PROFORMA.id, de_nom: AUTEUR_RAPPEL_PROFORMA.nom, lu_par: [],
    canal: CANAL_WA, wa_tel: cle, wa_numero: tel, wa_nom: proforma?.client || "",
    texte, wa_modele: MODELE_RAPPEL_PROFORMA, proforma_id: proforma?.id, proforma_debut: debutValiditeProforma(proforma),
  };
}
// La fiche légère : la conversation remonte, son propriétaire ne change pas.
export const enteteApresRappelProforma = ({ tel, proforma, ts, entete }) =>
  construireEntete({
    cle: cleConversation(tel), tel, nom: proforma?.client || "",
    proprietaire_id: entete?.proprietaire_id || "", proprietaire_nom: entete?.proprietaire_nom || "", derniere: ts, entete,
  });
export const proformaApresRappel = (pf, jour) =>
  ({ ...pf, rappel_expiration: { le: String(jour).slice(0, 10), pour: debutValiditeProforma(pf) } });

// Sous la proforma, à l'écran : « 🤖 Client prévenu le … ».
export const phraseRappelProforma = (pf) => {
  const r = pf && pf.rappel_expiration;
  if (!r || !r.le || r.pour !== debutValiditeProforma(pf)) return "";
  return `🤖 Client prévenu de l'expiration le ${dFR(r.le)}`;
};
