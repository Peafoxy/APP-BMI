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
import { numeroComparable, cleIdentifiant } from "./identiteClient.js";

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
// ... ET QUAND LE FIL NE DIT ENCORE RIEN : LE DERNIER DEVIS PARTI
// ---------------------------------------------------------------
// C'est ce qui répond à sa demande mot pour mot : « les réponses vont
// directement dans l'espace du personnel qui a écrit ». Le personnel qui a
// écrit, c'est celui dont la trace `envoi_whatsapp` est posée sur le devis
// (étape 1, 19/09/2026).
//
// ⚠⚠ LE DÉFAUT DU 20/09/2026, TROUVÉ SUR UNE CAPTURE DE TIMO : la trace
// portait le NOM de l'envoyeur (`par`) et PAS son identifiant (`par_id`),
// pendant que la fonction serveur, elle, ne regardait QUE `par_id`. Le
// filtre vidait donc la liste à tous les coups : AUCUNE conversation ne
// trouvait jamais son propriétaire, toutes tombaient au support — ce qui
// vide sa demande de sa substance. `traceEnvoi` écrit maintenant les deux.
// ⚠ Et le contrôle du banc ne protégeait pas : il vérifiait que le serveur
// LISAIT `par_id`, jamais que quelqu'un l'ÉCRIVAIT. Un contrôle qui ne
// regarde qu'un bout d'un couple rassure sans protéger.
//
// ⚠ LE REPLI PAR LE NOM est là pour les devis partis AVANT le correctif
// (celui d'ESSO, 18:08 le 20/09/2026) : sans lui, ces conversations-là
// resteraient au support pour toujours. Mais il ne devine JAMAIS entre
// deux homonymes (l'histoire des deux ESSO, le matin même) : attribuer la
// conversation au mauvais employé serait pire que le support, où tout le
// personnel la voit.
export function proprietaireDepuisDevis(client, employes = []) {
  const devis = (client?.devis || [])
    .filter((d) => d && d.envoi_whatsapp && d.envoi_whatsapp.le)
    .slice()
    .sort((a, b) => String(a.envoi_whatsapp.le || "").localeCompare(String(b.envoi_whatsapp.le || "")));
  for (let i = devis.length - 1; i >= 0; i--) {
    const t = devis[i].envoi_whatsapp;
    if (t.par_id) return { id: t.par_id, nom: t.par || "" };
    const nom = cleIdentifiant(t.par);
    if (!nom) continue;
    const memes = (employes || []).filter(
      (u) => u && u.role !== "client" && cleIdentifiant(u.nom) === nom
    );
    if (memes.length === 1) return { id: memes[0].id, nom: memes[0].nom || t.par || "" };
  }
  return { id: "", nom: "" };
}

// ---------------------------------------------------------------
// QUI VOIT QUOI — les décisions de Timo
// ---------------------------------------------------------------
// ⚠⚠ LA LISTE EST ÉCRITE EN TOUTES LETTRES, elle ne se DÉDUIT plus de
// `SALARIES` (20/09/2026, décision « 2a »). Le 20/09 au matin, la règle
// était « tous les salariés » — donc le COMPTABLE, qui en est un. Je lui
// avais dit le jour même (« si ce n'était pas votre intention, un mot et
// je l'en retire ») ; il a répondu de le retirer.
//   → le comptable garde 💬 Messages et n'a plus 📲 WhatsApp du tout.
// Déduire la liste d'une liste de PAIE, c'était faire dépendre « qui lit
// les clients » de « qui est sur le bulletin de salaire » : deux choses
// qui n'ont aucune raison de rester d'accord. Elle est donc nommée ici.
//
// ⚠ LE COUPLE : cette liste et `supabase/securite-27-conversations-whatsapp.sql`
// doivent dire la MÊME chose — l'application filtre l'AFFICHAGE, la base
// filtre ce qui DESCEND sur le téléphone. Le banc compare les deux côtés.
export const ROLES_TOUTES_CONVERSATIONS = [
  "admin", "vendeur", "gerant", "magasinier", "technicien_bmi", "resp_commercial",
];

// Qui a le droit d'ouvrir 📲 WhatsApp, quelle que soit la conversation.
// ⚠ Le CLIENT est au bout du fil : c'est de lui qu'on parle.
// ⚠ Le COMPTABLE est en dehors depuis le 20/09/2026 (sa décision).
export const aAccesWhatsapp = (profile) =>
  !!profile && profile.role !== "client" && profile.role !== "comptable";

export const voitToutesLesConversations = (profile) =>
  aAccesWhatsapp(profile) && ROLES_TOUTES_CONVERSATIONS.includes(profile.role);

export function peutVoirConversation(profile, conv) {
  if (!aAccesWhatsapp(profile)) return false;
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

// ---------------------------------------------------------------
// 📷 CE QUE LE CLIENT ENVOIE QUI N'EST PAS DU TEXTE (20/09/2026)
// ---------------------------------------------------------------
// Décision « 3a » de Timo. Jusqu'ici une photo, une note vocale ou un
// document étaient REFUSÉS À L'ENTRÉE (« message sans texte ») : le client
// envoyait la photo de son compteur, personne ne la voyait, et personne ne
// savait même qu'elle existait. Un fil qui perd des messages en silence est
// pire qu'un fil vide.
//
// ⚠ ON NE GARDE PAS L'IMAGE : on garde le LIEN que WhatsApp donne, et
// c'est la fonction serveur qui va la chercher avec la clé YCloud quand
// quelqu'un l'ouvre (`api/whatsapp-media.js`). Rien de secret ne descend
// dans le navigateur, et rien n'est stocké chez nous.
// ⚠⚠ CONSÉQUENCE À DIRE, PAS À CACHER : WhatsApp efface ses fichiers au
// bout de 30 JOURS. Passé ce délai la photo n'existe plus nulle part, et
// l'écran le DIT au lieu d'afficher un cadre vide. La garder pour toujours
// demanderait un espace de stockage — à sa demande, pas de moi-même.
export const TYPES_MEDIA = ["image", "video", "audio", "voice", "sticker", "document"];

// Rend { type, lien, media_id, mime, nom, legende } — ou null si le message
// ne porte aucun fichier. ⚠ On lit le TYPE annoncé d'abord, et on ne se
// rabat sur la recherche d'une clé connue que s'il ne dit rien : un jour
// YCloud ajoutera un type, et on ne veut pas le prendre pour un autre.
export function lireMedia(m) {
  const objet = m && typeof m === "object" ? m : {};
  const annonce = String(objet.type || "").toLowerCase();
  const type = TYPES_MEDIA.includes(annonce)
    ? annonce
    : TYPES_MEDIA.find((t) => objet[t] && typeof objet[t] === "object") || "";
  if (!type) return null;
  const bloc = objet[type] && typeof objet[type] === "object" ? objet[type] : {};
  const lien = String(bloc.link || bloc.url || "");
  const media_id = String(bloc.id || "");
  if (!lien && !media_id) return null;
  return {
    type,
    lien,
    media_id,
    mime: String(bloc.mime_type || bloc.mimeType || ""),
    nom: String(bloc.filename || bloc.fileName || ""),
    legende: String(bloc.caption || ""),
  };
}

// Ce qu'on écrit quand il n'y a pas un mot de texte : une notification
// vide ne dit rien, et une ligne vide dans le fil non plus.
export function libelleMedia(media) {
  if (!media || !media.type) return "";
  if (media.type === "image") return "📷 Photo";
  if (media.type === "video") return "🎬 Vidéo";
  if (media.type === "voice") return "🎤 Note vocale";
  if (media.type === "audio") return "🎵 Son";
  if (media.type === "sticker") return "🙂 Autocollant";
  return media.nom ? `📄 Document : ${media.nom}` : "📄 Document";
}
