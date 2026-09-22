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
// ⚠⚠ LA PORTE EST FERMÉE POUR DE BON — ce n'est plus un filtre d'affichage.
// Jusqu'au 20/09/2026 la conversation ne s'AFFICHAIT pas chez qui n'y avait
// pas droit, mais sa copie locale la contenait (la table des messages n'est
// pas cloisonnée par personne, comme les dépenses d'un technicien). Ça lui a
// été dit tel quel, et c'est ce qui a permis de lui proposer `securite-27`,
// puis `securite-28` le 21/09 : ce qui ne regarde pas quelqu'un ne DESCEND
// plus sur son téléphone. L'application filtre ce qui s'AFFICHE, la base ce
// qui DESCEND — les deux doivent dire la même chose, et le banc les compare.
//
// ⚠ Ce fichier n'importe que `identiteClient.js` (qui n'importe rien) et
// `constants.js` : il est lu par l'application ET par la fonction serveur
// api/whatsapp-entrant.js, donc ses imports portent leur « .js ».
// ============================================================
import { numeroComparable, cleIdentifiant } from "./identiteClient.js";

export const CANAL_WA = "whatsapp";

// ---------------------------------------------------------------
// 🔒 LA FICHE LÉGÈRE D'UNE CONVERSATION — « grisée, pas disparue »
// ---------------------------------------------------------------
// Timo, 21/09/2026, devant une conversation confiée à TIMO1 dans laquelle
// ANGELE écrivait encore : « assigned_to = TIMO1 → visible à TIMO1 + admin ».
// Puis, sur la façon : « on peut voir la discussion mais grisé. Impossible
// d'ouvrir par les autres. Pas juste la faire disparaître. »
//
// ⚠⚠ ET C'EST LÀ QUE ÇA SE COMPLIQUE, PARCE QU'UNE CONVERSATION N'EST RIEN
// D'AUTRE QUE SES MESSAGES. Il n'existe pas de fiche « conversation »
// rangée à part : pour qu'ANGELE VOIE une ligne grisée, il faut que son
// téléphone ait reçu quelque chose. Or ce qu'on vient de fermer le
// 20/09 (`securite-27`), c'est justement la descente des messages.
//   → décision « B » de Timo : on ajoute une FICHE LÉGÈRE par conversation,
//     qui ne porte QUE le numéro, le nom, le propriétaire et la date du
//     dernier message. PAS UN MOT DU CONTENU. C'est elle qui descend sur
//     tous les téléphones et qui dessine la ligne grisée ; les messages,
//     eux, restent verrouillés par la base (`securite-28`).
//
// ⚠ ELLE EST UN PANNEAU INDICATEUR, JAMAIS UNE SOURCE DE VÉRITÉ. Le vrai
// propriétaire se lit sur les MESSAGES (le dernier qui en porte un, posé
// par « 🔁 Confier ») — la fiche n'en est que le reflet. Quelqu'un qui la
// réécrirait ne s'ouvrirait aucune porte : c'est la base qui décide ce qui
// descend, pas elle.
// ⚠ Son id est DÉRIVÉ de la clé (jamais tiré au hasard) : c'est ce qui la
// remplace au lieu de l'empiler à chaque message — une fiche par
// conversation, pas une de plus par mot échangé.
export const CANAL_WA_ENTETE = "whatsapp_entete";

export const estEnteteWa = (m) => !!m && m.canal === CANAL_WA_ENTETE;
export const idEntete = (cle) => `waent_${cle}`;

// ⚠ AUCUN `texte`, aucun `de_id`, aucun `lu_par` : ce qui n'est pas là ne
// peut pas fuir. Le banc le MESURE, il ne le présume pas.
export function construireEntete({ cle, tel, nom, proprietaire_id, proprietaire_nom, derniere } = {}) {
  const k = String(cle || "");
  if (!k) return null;
  return {
    id: idEntete(k),
    canal: CANAL_WA_ENTETE,
    wa_tel: k,
    wa_numero: String(tel || k),
    ...(nom ? { wa_nom: String(nom) } : {}),
    ...(proprietaire_id ? { proprietaire_id, proprietaire_nom: proprietaire_nom || "" } : {}),
    derniere: String(derniere || ""),
    ts: String(derniere || ""),
  };
}

// Poser la fiche dans la liste des messages : on REMPLACE celle qui existe
// (même id), on n'en empile jamais une seconde.
export function messagesAvecEntete(messages, infos) {
  const fiche = construireEntete(infos);
  const liste = Array.isArray(messages) ? messages : [];
  if (!fiche) return liste;
  return [fiche, ...liste.filter((m) => m && m.id !== fiche.id)];
}

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
// ---------------------------------------------------------------
// 🔓 RENDRE UNE CONVERSATION À TOUT LE MONDE (21/09/2026)
// ---------------------------------------------------------------
// Timo : « donner la possibilité à l'administrateur de rendre la discussion
// déjà confiée à redevenir accessible à tous les utilisateurs ». Sans ça,
// une conversation confiée à quelqu'un qui part en congé n'a AUCUNE porte de
// sortie : l'administrateur peut la donner à un autre, jamais la rouvrir.
//
// ⚠⚠ ON NE RÉÉCRIT RIEN — on POSE une ligne de plus, comme « 🔁 Confier ».
// Mais une ligne SANS propriétaire n'efface rien : `proprietaireDe` remonte
// le fil jusqu'au dernier message qui en PORTE un, et le retrouverait.
// D'où une MARQUE explicite, `proprietaire_efface`, que la remontée regarde
// au même titre qu'un propriétaire : la première des deux qu'elle rencontre
// en remontant décide. Poser la marque, c'est dire « à partir d'ici,
// personne », et l'histoire d'avant reste lisible.
//
// ⚠ LE COUPLE : `wa_proprietaire` (securite-29) doit s'arrêter sur la MÊME
// marque. Sans le SQL, l'écran rendrait la conversation à tous pendant que
// la base continuerait de la cacher — la moitié du geste, invisible.
export const MARQUE_RENDUE = "proprietaire_efface";

export function proprietaireDe(fil) {
  for (let i = (fil || []).length - 1; i >= 0; i--) {
    const m = fil[i] || {};
    if (m[MARQUE_RENDUE]) return { id: "", nom: "" };
    if (m.proprietaire_id) return { id: m.proprietaire_id, nom: m.proprietaire_nom || "" };
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
// ⚠⚠ RETOURNÉE LE 21/09/2026, PAS ASSOUPLIE. La liste portait six rôles —
// « tous les salariés voient tout », sa décision du 20/09. Il l'a vue à
// l'œuvre le lendemain, sur une capture : une conversation confiée à TIMO1
// dans laquelle ANGELE (vendeuse) écrivait encore. Sa nouvelle règle, mot
// pour mot : « assigned_to = null → visible à tous ; assigned_to = TIMO1 →
// visible à TIMO1 + admin ». Il ne reste donc que l'ADMINISTRATEUR.
// ⚠ Elle reste une LISTE, et pas un `role === "admin"` écrit à la main :
// c'est elle que le banc compare, mot pour mot, aux rôles de `securite-28`.
// Un couple se surveille mieux quand les deux côtés ont la même forme.
export const ROLES_TOUTES_CONVERSATIONS = ["admin"];

// Qui a le droit d'ouvrir 📲 WhatsApp, quelle que soit la conversation.
// ⚠ Le CLIENT est au bout du fil : c'est de lui qu'on parle.
// ⚠ Le COMPTABLE est en dehors depuis le 20/09/2026 (sa décision).
export const aAccesWhatsapp = (profile) =>
  !!profile && profile.role !== "client" && profile.role !== "comptable";

// ---------------------------------------------------------------
// 🎓 LES CONVERSATIONS WHATSAPP N'EXISTENT QU'EN RÉEL (22/09/2026, « B »)
// ---------------------------------------------------------------
// Timo : « les messages WhatsApp sont-ils finalement bloqués sur l'espace
// formation ? » — l'ENVOI par modèle l'était (quatre écrans passent l'espace
// de la donnée, et le serveur refuse tout compte de formation). Mais la
// RÉPONSE libre ne passait aucun espace, et la liste des conversations
// n'était pas cloisonnée du tout : la table des messages est hors du
// cloisonnement par espace depuis l'origine. Une conversation WhatsApp est
// un VRAI client qui écrit sur le VRAI numéro BMI — il n'existe pas de
// conversation « de formation ». Devant trois propositions il a choisi
// **« B »** : en regardant la formation, 📲 WhatsApp est VIDE et le dit ;
// répondre est refusé DANS le geste ; et `securite-30` empêche un compte de
// formation de recevoir une seule ligne WhatsApp sur son appareil.
// ⚠ DEUX BARRIÈRES QUI NE PROTÈGENT PAS LA MÊME CHOSE : la base ne sait pas
// ce que l'administrateur principal REGARDE (son compte est réel) — c'est
// l'écran qui le protège, lui ; la base protège un compte de FORMATION.
export const MOTIF_WA_FORMATION = "Les conversations WhatsApp n'existent qu'en réel : rien ne s'affiche ni ne part depuis l'espace formation.";

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
// ⚠ Rendre à tous passe par LE MÊME droit (21/09/2026) : deux listes pour
// deux gestes voisins finiraient par diverger, et c'est le même pouvoir —
// décider à qui appartient une conversation, ou à personne.
export const peutReattribuer = (profile) => profile?.role === "admin";

// ---------------------------------------------------------------
// LA LISTE DES CONVERSATIONS VISIBLES
// ---------------------------------------------------------------
// Rend, de la plus récente à la plus ancienne :
//   { cle, tel, nom, proprietaire_id, proprietaire_nom, fil, fenetre, derniere, nonLus }
export function conversationsWa(messages, profile, maintenant = new Date().toISOString(), { espaceFormation = false } = {}) {
  // ⚠⚠ CE GARDE-FOU EST INDISPENSABLE DEPUIS LE 21/09/2026, et il n'est pas
  // une précaution de style : sans lui, un compte qui n'a AUCUN droit sur
  // 📲 WhatsApp (le client, le comptable) verrait toutes les conversations
  // en lignes GRISÉES — `peutVoirConversation` lui répond non, et « non »
  // veut désormais dire « grisée », plus « absente ».
  if (!aAccesWhatsapp(profile)) return [];
  // 🎓 En regardant la formation, il n'y a RIEN — pas même une ligne grisée
  // (décision « B », 22/09/2026). `espaceFormation` est l'espace REGARDÉ,
  // passé par l'écran : ce fichier est lu par le serveur et ne peut pas
  // importer calculs.js pour le calculer lui-même.
  if (espaceFormation) return [];
  const parCle = new Map();
  const fiches = new Map();
  (Array.isArray(messages) ? messages : []).forEach((m) => {
    if (!m || !m.wa_tel) return;
    if (estEnteteWa(m)) { fiches.set(m.wa_tel, m); return; }
    if (!estMessageWa(m)) return;
    if (!parCle.has(m.wa_tel)) parCle.set(m.wa_tel, []);
    parCle.get(m.wa_tel).push(m);
  });
  const sorties = [];
  new Set([...parCle.keys(), ...fiches.keys()]).forEach((cle) => {
    const fil = (parCle.get(cle) || []).sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));
    const fiche = fiches.get(cle) || null;
    // Le propriétaire se lit sur les MESSAGES quand on les a ; la fiche
    // légère ne sert que quand on ne les a pas — c'est un reflet, jamais
    // la source.
    const prop = fil.length
      ? proprietaireDe(fil)
      : { id: fiche?.proprietaire_id || "", nom: fiche?.proprietaire_nom || "" };
    if (!peutVoirConversation(profile, { proprietaire_id: prop.id })) {
      // ⚠ « Pas juste la faire disparaître » : la ligne se voit, GRISÉE.
      // ⚠⚠ MAIS ELLE NE PORTE RIEN — `fil` vide, `nonLus` à zéro. Même si
      // un message avait échappé à la base, il ne ressortirait pas par ici.
      // Et sans fiche légère, on ne la connaît pas du tout : rien à montrer.
      if (!fiche) return;
      sorties.push({
        cle,
        tel: String(fiche.wa_numero || cle),
        nom: String(fiche.wa_nom || ""),
        proprietaire_id: prop.id,
        proprietaire_nom: prop.nom,
        fil: [],
        fenetre: fenetre([], maintenant),
        derniere: String(fiche.derniere || fiche.ts || ""),
        nonLus: 0,
        verrouillee: true,
      });
      return;
    }
    const dernier = fil[fil.length - 1] || {};
    sorties.push({
      cle,
      tel: fil.find((m) => m.wa_numero)?.wa_numero || String(fiche?.wa_numero || cle),
      nom: [...fil].reverse().find((m) => m.wa_nom)?.wa_nom || String(fiche?.wa_nom || ""),
      proprietaire_id: prop.id,
      proprietaire_nom: prop.nom,
      fil,
      fenetre: fenetre(fil, maintenant),
      derniere: String(dernier.ts || fiche?.derniere || ""),
      nonLus: fil.filter((m) => m.wa_entrant && !(m.lu_par || []).includes(profile?.id)).length,
      verrouillee: false,
    });
  });
  return sorties.sort((a, b) => b.derniere.localeCompare(a.derniere));
}

// ---------------------------------------------------------------
// LE REFUS D'UNE RÉPONSE — revérifié DANS le geste
// ---------------------------------------------------------------
// ⚠ LE REFUS NOMME LA PERSONNE, et dit la porte de sortie : sinon celui qui
// tombe sur une ligne grisée ne sait ni pourquoi, ni à qui demander. Une
// règle qu'on ne comprend pas ressemble à une panne (leçon du repli muet,
// 19/09/2026).
// ⚠ On ne dit jamais « lui » ni « elle » : on ne connaît pas la personne.
export const motifVerrouillee = (conv) =>
  conv?.proprietaire_nom
    ? `Cette conversation est confiée à ${conv.proprietaire_nom}. Seule cette personne, ou un administrateur, peut l'ouvrir.`
    : "Cette conversation ne vous est pas accessible.";

export function critiqueReponse({ profile, conv, texte, enLigne = true, maintenant, espaceFormation = false } = {}) {
  // 🎓 Revérifié DANS le geste (22/09/2026) : même si l'écran se trompait,
  // aucune réponse ne part pendant qu'on regarde la formation.
  if (espaceFormation) return MOTIF_WA_FORMATION;
  if (!conv) return "Choisissez d'abord une conversation.";
  if (!peutVoirConversation(profile, conv)) return motifVerrouillee(conv);
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
