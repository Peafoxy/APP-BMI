// ============================================================
// lib/whatsappConversations.js — LES RÉPONSES DU CLIENT, DANS L'APPLICATION
//
// Timo, 20/09/2026 : « il faut donner la possibilité à un commercial de
// discuter avec ses clients quand eux ils répondent au message depuis
// WhatsApp… le personnel lui répond depuis l'application BMI et les
// réponses vont directement dans l'espace du personnel qui a écrit… sauf
// le personnel qui peut voir toutes les discussions… mais un technicien
// commission ou un commercial n'a pas droit de voir les conversations
// qu'il n'a pas engagées. »
//
// Ses trois décisions, mot pour mot :
//   1. voient TOUT  → « tous les salariés à BMI » (SALARIES + l'administrateur) ;
//   2. un client qui écrit le PREMIER → « c », le bloc Support, « donc
//      visible par tout le personnel BMI » ;
//   3. un commercial absent → « a », l'administrateur réattribue, avec la trace.
//
// ⚠⚠ CE FILTRE EST CELUI DE L'APPLICATION, PAS DU SERVEUR. La table des
// messages n'est pas cloisonnée par personne (comme les dépenses d'un
// technicien, comme la table des comptes) : la conversation ne s'AFFICHE
// pas chez qui n'y a pas droit, mais sa copie locale la contient. C'est dit
// à Timo, ce n'est pas caché. Fermer cette porte pour de bon demanderait
// une politique de plus côté Supabase — à sa demande.
//
// ⚠ Ce fichier n'importe que `identiteClient.js` (qui n'importe rien) et
// `constants.js` : il est lu par l'application ET par la fonction serveur
// api/whatsapp-entrant.js, donc ses imports portent leur « .js ».
// ============================================================
import { numeroComparable } from "./identiteClient.js";
import { SALARIES } from "./constants.js";

export const CANAL_WA = "whatsapp";

// ---------------------------------------------------------------
// LA CLÉ D'UNE CONVERSATION : LE NUMÉRO, PAS LE COMPTE
// ---------------------------------------------------------------
// ⚠ Un client peut répondre sans avoir de compte BMI — c'est même le cas
// ordinaire d'un prospect. La conversation est donc rangée sous son NUMÉRO
// (les 8 derniers chiffres, la même règle que partout : « +228 90 11 22 33 »
// et « 90112233 » sont le même homme), jamais sous un identifiant de compte
// qui peut ne pas exister.
export const cleConversation = (tel) => numeroComparable(tel);

export const estMessageWa = (m) => !!m && m.canal === CANAL_WA;

// Les messages d'UNE conversation, du plus ancien au plus récent.
export const filDeLaConversation = (messages, cle) =>
  (Array.isArray(messages) ? messages : [])
    .filter((m) => estMessageWa(m) && m.wa_tel === cle)
    .sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));

// ---------------------------------------------------------------
// ⏳ LA FENÊTRE DE 24 HEURES — LA RÈGLE DE META, PAS LA NÔTRE
// ---------------------------------------------------------------
// Après le DERNIER message du client, on lui répond librement pendant 24 h.
// Passé ce délai, WhatsApp refuse tout ce qui n'est pas un modèle approuvé.
// ⚠ Seul un message ENTRANT rouvre la fenêtre : nos propres réponses ne la
// prolongent pas d'une minute. L'écran doit le DIRE — sinon le vendeur tape
// un message qui ne partira jamais, et ne comprend pas pourquoi.
export const HEURES_FENETRE = 24;
const MS_H = 3600 * 1000;

export const dernierEntrant = (fil) => {
  const entrants = (fil || []).filter((m) => m.wa_entrant);
  return entrants.length ? entrants[entrants.length - 1] : null;
};

export function fenetre(fil, maintenant = new Date().toISOString()) {
  const dernier = dernierEntrant(fil);
  if (!dernier) return { ouverte: false, resteMinutes: 0, jamais: true };
  const debut = Date.parse(dernier.ts || "");
  const t = Date.parse(maintenant);
  if (!Number.isFinite(debut) || !Number.isFinite(t)) return { ouverte: false, resteMinutes: 0, jamais: true };
  const reste = debut + HEURES_FENETRE * MS_H - t;
  return { ouverte: reste > 0, resteMinutes: reste > 0 ? Math.floor(reste / 60000) : 0, jamais: false };
}

// « Il reste 3 h 20 pour répondre » / « Fermée : … ». Une phrase, deux
// endroits (le bandeau et le refus) — jamais deux textes à maintenir.
export function libelleFenetre(f) {
  if (!f || f.jamais) return "Ce client ne vous a pas encore écrit : seul un modèle approuvé peut partir.";
  if (!f.ouverte) return "Plus de 24 h depuis son dernier message : WhatsApp n'accepte plus qu'un modèle approuvé.";
  const h = Math.floor(f.resteMinutes / 60), m = f.resteMinutes % 60;
  return h > 0 ? `Il reste ${h} h ${String(m).padStart(2, "0")} pour répondre librement.` : `Il reste ${m} min pour répondre librement.`;
}

// ---------------------------------------------------------------
// À QUI EST LA CONVERSATION
// ---------------------------------------------------------------
// Le propriétaire est posé sur les messages ; on lit le DERNIER qui en
// porte un, pour qu'une réattribution (décision « a ») prenne effet sans
// réécrire l'histoire — un message ne se modifie jamais après coup.
export function proprietaireDe(fil) {
  for (let i = (fil || []).length - 1; i >= 0; i--) {
    const p = fil[i]?.proprietaire_id;
    if (p) return { id: p, nom: fil[i].proprietaire_nom || "" };
  }
  return { id: "", nom: "" };
}

// ---------------------------------------------------------------
// QUI VOIT QUOI — les trois décisions de Timo
// ---------------------------------------------------------------
// ⚠ `SALARIES` ne contient PAS l'administrateur (c'est une liste de paie) :
// on l'ajoute ici, la direction voit forcément tout. Et elle ne contient
// ni le technicien à COMMISSION ni le commercial — c'est exactement ce
// qu'il a demandé.
export const voitToutesLesConversations = (profile) =>
  !!profile && profile.role !== "client" && (profile.role === "admin" || SALARIES.includes(profile.role));

export function peutVoirConversation(profile, conv) {
  if (!profile || profile.role === "client") return false;
  if (voitToutesLesConversations(profile)) return true;
  // Décision « c » : une conversation que personne n'a engagée est du
  // SUPPORT — tout le personnel BMI la voit, et peut donc y répondre.
  if (!conv?.proprietaire_id) return true;
  return conv.proprietaire_id === profile.id;
}

// Décision « a » : seul l'administrateur redonne une conversation.
export const peutReattribuer = (profile) => profile?.role === "admin";

// ---------------------------------------------------------------
// LA LISTE DES CONVERSATIONS VISIBLES
// ---------------------------------------------------------------
// Rend, de la plus récente à la plus ancienne :
//   { cle, tel, nom, proprietaire_id, proprietaire_nom, fil, fenetre, derniere, nonLus }
export function conversationsWa(messages, profile, maintenant = new Date().toISOString()) {
  const parCle = new Map();
  (Array.isArray(messages) ? messages : []).forEach((m) => {
    if (!estMessageWa(m) || !m.wa_tel) return;
    if (!parCle.has(m.wa_tel)) parCle.set(m.wa_tel, []);
    parCle.get(m.wa_tel).push(m);
  });
  const sorties = [];
  parCle.forEach((liste, cle) => {
    const fil = liste.sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));
    const prop = proprietaireDe(fil);
    if (!peutVoirConversation(profile, { proprietaire_id: prop.id })) return;
    const dernier = fil[fil.length - 1] || {};
    sorties.push({
      cle,
      tel: fil.find((m) => m.wa_numero)?.wa_numero || cle,
      nom: [...fil].reverse().find((m) => m.wa_nom)?.wa_nom || "",
      proprietaire_id: prop.id,
      proprietaire_nom: prop.nom,
      fil,
      fenetre: fenetre(fil, maintenant),
      derniere: String(dernier.ts || ""),
      nonLus: fil.filter((m) => m.wa_entrant && !(m.lu_par || []).includes(profile?.id)).length,
    });
  });
  return sorties.sort((a, b) => b.derniere.localeCompare(a.derniere));
}

// ---------------------------------------------------------------
// LE REFUS D'UNE RÉPONSE — revérifié DANS le geste
// ---------------------------------------------------------------
export function critiqueReponse({ profile, conv, texte, enLigne = true, maintenant } = {}) {
  if (!conv) return "Choisissez d'abord une conversation.";
  if (!peutVoirConversation(profile, conv)) return "Cette conversation ne vous appartient pas.";
  if (!String(texte || "").trim()) return "Écrivez d'abord votre message.";
  if (!enLigne) return "Pas de connexion : le message ne peut pas partir du numéro BMI.";
  const f = conv.fenetre || fenetre(conv.fil, maintenant);
  if (!f.ouverte) return libelleFenetre(f);
  return "";
}
