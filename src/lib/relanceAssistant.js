// ============================================================
// lib/relanceAssistant.js — 🤖 L'ASSISTANT RELANCE LE CLIENT QUI S'EST TU (17/10/2026)
//
// Timo : « 20 h après la dernière discussion avec le client, il peut relancer
// pour savoir si le client en est où avec la demande faite plus haut », puis
// « 4 a, le reste ok, lance ». Ce n'est PAS un modèle de Meta : tant que le
// client a écrit depuis moins de 24 h, BMI peut lui écrire librement (la
// fenêtre, lib/whatsappConversations.js). La relance part donc ENTRE la 20e
// heure et la fermeture de la fenêtre — jamais après : Meta la refuserait.
//
// LES RÈGLES (dites à Timo, acceptées) :
//   • UNE seule relance par demande : après elle, l'assistant ne revient pas
//     tant que le client n'a pas réécrit ;
//   • elle part seulement si L'ASSISTANT (IA) a été le dernier à parler ;
//   • il se tait comme d'habitude : conversation confiée à une personne, un
//     EMPLOYÉ qui a écrit dans les dernières 24 h, un conseiller demandé ;
//   • « 4 a » : une demande de devis ENREGISTRÉE ne se relance pas (un
//     commercial s'en occupe) — l'assistant passe alors à l'étape conseiller,
//     donc la même règle la couvre ;
//   • « 5 » : en mode 🔢 menu à chiffres, aucune relance (le menu ne sait pas
//     résumer une demande) — et sans service d'IA configuré, pas non plus.
//
// ⚠ Ce fichier ne reçoit JAMAIS `db` : des LISTES de messages, déjà lues par
// le serveur (api/_relanceAssistant.js). Il ne connaît pas le réseau.
// ⚠ Il est lu par le serveur tel quel : ses imports portent `.js`.
// ============================================================
import { estLigneAssistant, ETAPE_CONSEILLER, SIGNATURE_BMI, ligneAssistant, renduActif } from "./assistantWhatsapp.js";
import { estMessageWa } from "./whatsappConversations.js";
import { messagesPourIA, ETAPE_IA, garderReponse } from "./assistantIA.js";

export const HEURES_AVANT_RELANCE = 20;
// La fenêtre de Meta se ferme 24 h après le dernier message du client ; on
// garde un quart d'heure de marge (un envoi à 23 h 59 pourrait arriver trop tard).
export const HEURES_FENETRE_RELANCE = 24;
export const MINUTES_MARGE_FENETRE = 15;
const MS_H = 3600 * 1000;

const tsDe = (m) => Date.parse(String(m?.ts || ""));
const estSysteme = (m) => !m || m.wa_systeme || m.canal === "whatsapp_entete";

// La marque d'un cycle : les chiffres de l'heure du dernier message du
// client. Elle sert à « réserver » la relance sur la fiche légère pendant
// qu'on l'écrit (deux arrivées en même temps ne relancent pas deux fois).
export const marqueRelance = (entrant) => String(entrant?.ts || "").replace(/\D/g, "").slice(0, 17);

// ---- FAUT-IL RELANCER CETTE CONVERSATION, MAINTENANT ? ----
// `fil` : la conversation, du plus ancien au plus récent. Rend
//   { relancer: true, depuis, marque, derniere } ou { relancer: false, pourquoi }.
export function relanceAFaire({ fil, maintenant, proprietaireId = "" } = {}) {
  const liste = (Array.isArray(fil) ? fil : []).filter((m) => m && m.canal !== "whatsapp_entete");
  // 🤖 Rendue à l'assistant (21/10/2026) : les personnes qui avaient écrit
  // AVANT la marque ne le font plus taire, et une conversation confiée parle.
  const rendu = renduActif(liste);
  if (proprietaireId && !rendu) return { relancer: false, pourquoi: "conversation confiée à une personne" };
  let i = liste.length - 1;
  while (i >= 0 && !liste[i].wa_entrant) i--;
  if (i < 0) return { relancer: false, pourquoi: "le client n'a jamais écrit" };
  const entrant = liste[i];
  const t = Date.parse(String(maintenant || ""));
  const age = t - tsDe(entrant);
  if (!Number.isFinite(age)) return { relancer: false, pourquoi: "heure illisible" };
  if (age < HEURES_AVANT_RELANCE * MS_H) return { relancer: false, pourquoi: "moins de 20 h depuis le dernier message du client" };
  if (age > HEURES_FENETRE_RELANCE * MS_H - MINUTES_MARGE_FENETRE * 60000) return { relancer: false, pourquoi: "la fenêtre de 24 h est (presque) fermée" };
  // Un EMPLOYÉ (réponse libre, modèle parti de l'application) a écrit dans
  // les dernières 24 h : la conversation est entre humains.
  const employeRecent = liste.some((m) => !m.wa_entrant && !estSysteme(m) && !estLigneAssistant(m) && t - tsDe(m) < HEURES_FENETRE_RELANCE * MS_H);
  if (employeRecent && !rendu) return { relancer: false, pourquoi: "un employé a écrit dans les dernières 24 h" };
  const apres = liste.slice(i + 1).filter((m) => !estSysteme(m));
  if (!apres.length) return { relancer: false, pourquoi: "l'assistant n'a pas répondu au dernier message" };
  if (apres.some((m) => !estLigneAssistant(m))) return { relancer: false, pourquoi: "un employé a écrit après le client" };
  if (apres.some((m) => m.wa_assistant.relance)) return { relancer: false, pourquoi: "déjà relancé : une seule relance par demande" };
  if (apres.some((m) => m.wa_assistant.etape === ETAPE_CONSEILLER)) return { relancer: false, pourquoi: "un conseiller a été demandé, ou la demande de devis est enregistrée" };
  const derniere = apres[apres.length - 1];
  if (!derniere.wa_assistant.ia) return { relancer: false, pourquoi: "assistant à menu : il ne relance pas" };
  return { relancer: true, depuis: String(entrant.ts || ""), marque: marqueRelance(entrant), derniere };
}

// ---- LES CONVERSATIONS À RELANCER, parmi des messages déjà lus ----
// `messages` : les lignes RÉCENTES (le serveur ne lit que les dernières 25 h :
// tout ce qui décide d'une relance s'y trouve). Le propriétaire, lui, se relit
// sur le fil ENTIER avant d'envoyer (il peut avoir été posé avant). Les plus
// anciennes d'abord : celles dont la fenêtre se ferme le plus tôt.
export function conversationsARelancer(messages, maintenant) {
  const parCle = new Map();
  for (const m of Array.isArray(messages) ? messages : []) {
    if (!estMessageWa(m) || !m.wa_tel) continue;
    if (!parCle.has(m.wa_tel)) parCle.set(m.wa_tel, []);
    parCle.get(m.wa_tel).push(m);
  }
  const res = [];
  for (const [cle, lignes] of parCle) {
    const fil = lignes.sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));
    const d = relanceAFaire({ fil, maintenant });
    if (d.relancer) res.push({ cle, depuis: d.depuis, marque: d.marque });
  }
  return res.sort((a, b) => a.depuis.localeCompare(b.depuis));
}

// ---- CE QU'ON DEMANDE À L'IA ----
// La relance s'ajoute à la consigne habituelle (mêmes interdits : aucun prix
// inventé, aucune dette) ; une note INTERNE, à la place du client, demande la
// relance — l'IA voit toute la conversation, donc ce que le client voulait.
export const CONSIGNE_RELANCE = `LA RELANCE : le client ne t'a plus répondu depuis environ ${HEURES_AVANT_RELANCE} heures. Tu lui écris UNE relance courte (3 à 5 lignes), aimable, sans insister : tu peux dire bonjour ; rappelle en une phrase ce qu'il avait demandé ; demande-lui où il en est ; propose la suite utile (une estimation, une demande de devis, ou un conseiller s'il le souhaite). Ne cite AUCUN montant en francs, n'appelle aucun outil, ne pose qu'une question.`;
export const NOTE_RELANCE = "[Message interne de BMI TOGO, pas du client] Le client n'a pas répondu depuis environ 20 heures. Écris maintenant la relance, selon la consigne « LA RELANCE ».";
export const consigneRelance = (consigneDeBase) => `${String(consigneDeBase || "")}\n\n${CONSIGNE_RELANCE}`;
// La conversation telle qu'elle est, et la note interne en dernier (le
// service attend un dernier message « user »).
export const messagesPourRelance = (fil) =>
  messagesPourIA([...(Array.isArray(fil) ? fil : []), { canal: "whatsapp", wa_entrant: true, texte: NOTE_RELANCE }]);

// Si l'IA ne répond pas, ou si sa phrase est jetée par le juge : une phrase
// fixe, qui ne dit rien de faux. La relance part quand même — c'est elle qui
// a été demandée.
export const TEXTE_RELANCE_FIXE = `Bonjour, je reviens vers vous au sujet de votre demande d'hier. Où en êtes-vous ? Je reste à votre disposition pour vous renseigner ou préparer votre demande de devis.\n\n👤 Écrivez « conseiller » pour parler à un membre de notre équipe.\n\n${SIGNATURE_BMI}`;
// Le texte qui part : celui de l'IA s'il passe le juge (SANS montant permis :
// aucun outil n'a parlé), sinon la phrase fixe.
export function texteDeRelance(texteIA) {
  const juge = garderReponse(texteIA, { prixConnus: [] });
  return juge.ok ? { texte: String(texteIA).trim(), ia: true, motif: "" } : { texte: TEXTE_RELANCE_FIXE, ia: false, motif: juge.motif };
}

// La ligne écrite dans le fil APRÈS l'envoi : une ligne de l'assistant,
// marquée `relance` (c'est elle qui empêche une seconde relance), qui garde
// la mémoire de la précédente (l'estimation donnée, par exemple).
export const ligneRelance = ({ cle, tel, nom, texte, ts, memoire = null, ia = false }) => {
  const l = ligneAssistant({ cle, tel, nom, texte, etape: ETAPE_IA, ts, memoire, ia });
  return { ...l, wa_assistant: { ...l.wa_assistant, relance: true } };
};
