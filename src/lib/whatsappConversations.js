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
import { maintenantISO } from "./horloge.js";

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

// ⚠ Une ligne À LA CORBEILLE (`supprime_le`, 05/10/2026 — lib/corbeille.js)
// n'appartient plus à aucune conversation : l'appareil la met de côté au
// chargement, et le SERVEUR (qui lit la table brute) l'écarte ici. Sans ça,
// un client qui réécrit retrouverait l'ancien propriétaire, l'ancienne
// fenêtre et la mémoire de l'assistant d'une conversation supprimée.
export const estALaCorbeille = (m) => !!(m && m.supprime_le);
export const estEnteteWa = (m) => !!m && m.canal === CANAL_WA_ENTETE && !estALaCorbeille(m);
export const idEntete = (cle) => `waent_${cle}`;

// ✏️ UN DEVIS CORRIGÉ ET RENVOYÉ (20/10/2026, capture Timo, compte d'un
// gérant : « 4 opération(s) n'arrivent pas… Effacer une conversation
// WhatsApp : réservé à l'administrateur principal ») : « Modifier et
// renvoyer » retirait TOUS les messages qui citent le devis — la demande de
// modification interne, mais aussi, depuis le 23/09, la ligne « 📲 Envoyé du
// numéro BMI — Devis… » de 📲 WhatsApp (elle porte `devis_id`). La base
// refuse cet effacement à tout autre que le principal (securite-36) : tout le
// lot restait coincé. Chez le principal, il passait — et la trace de ce qui
// était parti chez le client disparaissait en silence. Seuls les messages
// INTERNES partent ; une ligne WhatsApp (message ou fiche légère) reste.
export const estLigneWhatsApp = (m) => !!m && (m.canal === CANAL_WA || m.canal === CANAL_WA_ENTETE);
export const messagesApresCorrectionDevis = (messages, idDevis) =>
  (Array.isArray(messages) ? messages : []).filter((m) => !m || m.devis_id !== idDevis || estLigneWhatsApp(m));

// ⚠ AUCUN `texte`, aucun `de_id`, aucun `lu_par` : ce qui n'est pas là ne
// peut pas fuir. Le banc le MESURE, il ne le présume pas.
// ⚠ `entete` = la fiche d'AVANT, quand on la connaît : le nom donné par
// l'administrateur (`wa_nom_donne`) et le nom WhatsApp du client
// (`wa_profil`) ne vivent QUE sur elle — une fiche réécrite sans eux les
// perdrait en silence au message suivant. `profil` / `nom_donne` passés
// explicitement l'emportent (`nom_donne: ""` retire le nom donné).
export function construireEntete({ cle, tel, nom, proprietaire_id, proprietaire_nom, derniere, entete = null, profil, nom_donne, contact_google, google_cherche_le } = {}) {
  const k = String(cle || "");
  if (!k) return null;
  const donne = nom_donne !== undefined ? nettoyerNomContact(nom_donne) : String(entete?.wa_nom_donne || "");
  const prof = profil ? nettoyerNomContact(profil) : String(entete?.wa_profil || "");
  // 📇 La trace « enregistré dans les contacts Google de BMI » (09/10/2026)
  // vit elle aussi sur la fiche : une réécriture la GARDE, comme les noms.
  const contact = contact_google || entete?.wa_contact_google || null;
  // 🔎 La date de la dernière recherche automatique chez Google (16/10/2026,
  // « a et b ») : gardée elle aussi, sinon chaque message relancerait Google.
  const cherche = String(google_cherche_le || entete?.wa_google_cherche_le || "");
  return {
    id: idEntete(k),
    canal: CANAL_WA_ENTETE,
    wa_tel: k,
    wa_numero: String(tel || k),
    ...(nom ? { wa_nom: String(nom) } : {}),
    ...(donne ? { wa_nom_donne: donne } : {}),
    ...(prof ? { wa_profil: prof } : {}),
    ...(contact ? { wa_contact_google: contact } : {}),
    ...(cherche ? { wa_google_cherche_le: cherche } : {}),
    ...(proprietaire_id ? { proprietaire_id, proprietaire_nom: proprietaire_nom || "" } : {}),
    derniere: String(derniere || ""),
    ts: String(derniere || ""),
  };
}

// Poser la fiche dans la liste des messages : on REMPLACE celle qui existe
// (même id), on n'en empile jamais une seconde — en GARDANT ses noms.
export function messagesAvecEntete(messages, infos) {
  const liste = Array.isArray(messages) ? messages : [];
  const k = String(infos?.cle || "");
  const avant = k ? liste.find((m) => m && m.id === idEntete(k)) : null;
  const fiche = construireEntete({ entete: avant, ...infos });
  if (!fiche) return liste;
  return [fiche, ...liste.filter((m) => m && m.id !== fiche.id)];
}

// ---------------------------------------------------------------
// 👤 LE NOM D'UNE CONVERSATION (06/10/2026, décision « b » de Timo)
// ---------------------------------------------------------------
// « Est-il possible d'afficher les noms des contacts de Messenger ? » —
// le répertoire du téléphone BMI, NON : ni Meta ni YCloud ne le donnent.
// Ce qu'on peut : (1) le nom que le client s'est donné dans SON WhatsApp,
// joint par Meta à chaque message (`wa_profil`) ; (2) un nom donné par
// l'administrateur, comme dans un répertoire (`wa_nom_donne`, « ✏️ Nommer »).
// L'ORDRE : le nom donné, puis le compte BMI, puis le nom WhatsApp, puis le
// numéro. ⚠ Le nom WhatsApp est choisi par le CLIENT (un surnom, un emoji) :
// il se lit marqué « nom WhatsApp », jamais comme un client vérifié.
export const LONGUEUR_NOM_CONTACT = 60;
export const nettoyerNomContact = (s) =>
  String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, LONGUEUR_NOM_CONTACT);

// Le nom WhatsApp dans le paquet reçu — les deux formes connues : YCloud
// (`customerProfile.name`) et Meta (`contacts[0].profile.name`). Rien → "".
export function lireNomProfil(corps) {
  const c = corps && typeof corps === "object" ? corps : {};
  const m = c.whatsappInboundMessage || c.inboundMessage || c.message || c.data || c;
  const brut = m?.customerProfile?.name || c?.customerProfile?.name
    || m?.contacts?.[0]?.profile?.name || c?.contacts?.[0]?.profile?.name
    || m?.profile?.name || "";
  return nettoyerNomContact(typeof brut === "string" ? brut : "");
}

// { nom, origine } — origine : "donne" | "compte" | "google" | "whatsapp" | "" (numéro).
// 📇 16/10/2026 (Timo : « pourquoi le nom que la personne s'est donné prévaut
// sur celui enregistré chez nous ? » → « a et b, lance ») : le nom des
// CONTACTS GOOGLE DE BMI passe devant le nom WhatsApp, après le compte BMI —
// celui tapé dans « 📇 Enregistrer » (a) ou trouvé tout seul chez Google (b).
// ⚠ Le répertoire du téléphone BMI, lui, n'arrive toujours jamais : seuls
// les contacts rangés dans le compte Google de BMI se retrouvent.
export function nomDeConversation({ nomDonne = "", nomCompte = "", nomGoogle = "", profil = "", tel = "", cle = "" } = {}) {
  if (nomDonne) return { nom: nomDonne, origine: "donne" };
  if (nomCompte) return { nom: nomCompte, origine: "compte" };
  if (nomGoogle) return { nom: nomGoogle, origine: "google" };
  if (profil) return { nom: profil, origine: "whatsapp" };
  return { nom: String(tel || cle || ""), origine: "" };
}

export function critiqueNomContact(profile, nom) {
  if (!peutReattribuer(profile)) return "Seul un administrateur peut nommer une conversation.";
  if (String(nom ?? "").length > 200) return `Un nom tient en ${LONGUEUR_NOM_CONTACT} caractères au plus.`;
  return "";
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

export const estMessageWa = (m) => !!m && m.canal === CANAL_WA && !estALaCorbeille(m);

// Les messages d'UNE conversation, du plus ancien au plus récent.
export const filDeLaConversation = (messages, cle) =>
  (Array.isArray(messages) ? messages : [])
    .filter((m) => estMessageWa(m) && m.wa_tel === cle)
    .sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));

// ---------------------------------------------------------------
// 🔁 LE MÊME MESSAGE DU CLIENT REÇU DEUX FOIS (18/10/2026)
// ---------------------------------------------------------------
// Capture Timo (René 2, 15:45) : DEUX réponses de l'assistant à UN message.
// YCloud renvoie un message quand notre adresse tarde à répondre — et elle
// tarde davantage depuis l'attente de 4 s. La garde d'avant ne regardait que
// l'identifiant de YCloud : un renvoi qui en porte un autre (ou aucun)
// passait, s'écrivait une seconde fois et recevait sa propre réponse.
// Un doublon = le même identifiant YCloud, OU le même identifiant de Meta
// (wamid), OU, dans la même conversation, le même texte (ou le même fichier)
// envoyé à la MÊME seconde par le client. ⚠ Sans heure d'envoi, on ne compare
// pas le texte : deux « ok » d'affilée ne se perdent jamais.
export function doublonEntrant(messages, { cle, id, wamid, texte, mediaId, ts } = {}) {
  const contenu = String(texte || "") || String(mediaId || "");
  return (Array.isArray(messages) ? messages : []).some((m) => {
    if (!m || !m.wa_entrant) return false;
    if (id && m.wa_id === id) return true;
    if (wamid && m.wa_wamid_recu === wamid) return true;
    if (!ts || !contenu || m.wa_tel !== cle || String(m.ts || "") !== String(ts)) return false;
    return (String(m.texte || "") || String(m.wa_media?.media_id || "")) === contenu;
  });
}

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

export function fenetre(fil, maintenant = maintenantISO()) {
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
    // 👥 Un devis envoyé POUR un commercial lui donne la conversation (12/10/2026).
    if (t.pour_id) return { id: t.pour_id, nom: t.pour || "" };
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
export function conversationsWa(messages, profile, maintenant = maintenantISO(), { espaceFormation = false } = {}) {
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
      const telG = String(fiche.wa_numero || cle);
      const nomG = nomDeConversation({ nomDonne: fiche.wa_nom_donne, nomCompte: fiche.wa_nom, nomGoogle: fiche.wa_contact_google?.nom, profil: fiche.wa_profil, tel: telG, cle });
      sorties.push({
        cle,
        tel: telG,
        nom: String(fiche.wa_nom || ""),
        nomAffiche: nomG.nom,
        origineNom: nomG.origine,
        profil: String(fiche.wa_profil || ""),
        contactGoogle: fiche.wa_contact_google || null,
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
    const tel = fil.find((m) => m.wa_numero)?.wa_numero || String(fiche?.wa_numero || cle);
    const nomCompte = [...fil].reverse().find((m) => m.wa_nom)?.wa_nom || String(fiche?.wa_nom || "");
    const profil = [...fil].reverse().find((m) => m.wa_profil)?.wa_profil || String(fiche?.wa_profil || "");
    const nomV = nomDeConversation({ nomDonne: fiche?.wa_nom_donne, nomCompte, nomGoogle: fiche?.wa_contact_google?.nom, profil, tel, cle });
    sorties.push({
      cle,
      tel,
      nom: nomCompte,
      nomAffiche: nomV.nom,
      origineNom: nomV.origine,
      profil,
      contactGoogle: fiche?.wa_contact_google || null,
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

export function critiqueReponse({ profile, conv, texte, fichier = null, enLigne = true, maintenant, espaceFormation = false } = {}) {
  // 🎓 Revérifié DANS le geste (22/09/2026) : même si l'écran se trompait,
  // aucune réponse ne part pendant qu'on regarde la formation.
  if (espaceFormation) return MOTIF_WA_FORMATION;
  if (!conv) return "Choisissez d'abord une conversation.";
  if (!peutVoirConversation(profile, conv)) return motifVerrouillee(conv);
  // 📎 Un fichier part seul ou avec une phrase FACULTATIVE (Timo, 03/10/2026).
  if (fichier) {
    const refusFichier = critiqueFichier(fichier, texte);
    if (refusFichier) return refusFichier;
  } else if (!String(texte || "").trim()) return "Écrivez d'abord votre message.";
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

// ---------------------------------------------------------------
// 📱 CE QUI EST ÉCRIT DEPUIS LE TÉLÉPHONE BMI (21/10/2026)
// ---------------------------------------------------------------
// Capture Timo (EDEM) : un collègue répond depuis le WhatsApp du téléphone
// BMI ; l'application n'en voit rien — le fil a l'air sans réponse, et
// l'assistant reparle par-dessus (il a même renvoyé son menu). « Les deux,
// lance. » YCloud prévient de ces messages (coexistence) par les événements
// `whatsapp.smb.message.echoes` / `whatsapp.smb.message.created` : ils entrent
// dans le fil comme une réponse de BMI écrite par une PERSONNE — donc
// l'assistant se tait 24 h, comme après un collègue (decisionAssistant).
// ⚠ Ils sont lus AVANT les nouvelles de suivi : un écho porte lui aussi un
// `status: "sent"`, et pris pour une coche il attendrait une ligne qui
// n'existera jamais.
// ---------------------------------------------------------------
// ✏️ UN MESSAGE MODIFIÉ (23/10/2026, capture Timo : « [edit] » dans le fil)
// ---------------------------------------------------------------
// Le client modifie un message déjà envoyé : WhatsApp le prévient comme d'un
// message à part, de type « edit ». La règle du 20/09 (« on ne comprend pas,
// on ne perd pas ») écrivait le nom du type, « [edit] », qui ne dit rien à
// l'équipe. Il se lit maintenant en français, avec le NOUVEAU texte quand
// l'avis le porte. ⚠ La forme exacte de cet avis n'a été lue nulle part chez
// YCloud : on cherche le texte dans le bloc `edit` (ou `edited`) sans
// deviner davantage ; sans texte, la phrase seule.
export const TYPES_MODIFICATION = ["edit", "edited"];
const texteDansBloc = (b, profondeur = 0) => {
  if (!b || profondeur > 3) return "";
  if (typeof b === "string") return b;
  if (typeof b !== "object") return "";
  if (typeof b.body === "string" && b.body.trim()) return b.body;
  if (typeof b.text === "string" && b.text.trim()) return b.text;
  for (const k of ["text", "message", "new_message", "newMessage", "content"]) {
    const t = texteDansBloc(b[k], profondeur + 1);
    if (t && t.trim()) return t;
  }
  return "";
};
export function texteModification(m, { parBmi = false, ecrit = "" } = {}) {
  const bloc = (m && (m.edit || m.edited)) || null;
  const nouveau = String(texteDansBloc(bloc) || ecrit || "").trim();
  const phrase = parBmi ? "✏️ Message modifié depuis le téléphone BMI" : "✏️ Le client a modifié son message";
  return nouveau ? `${phrase} : « ${nouveau} »` : phrase;
}
// Le texte d'un message que WhatsApp nous donne : ce qui est écrit, sinon la
// légende d'un fichier, sinon (un type qu'on ne sait pas lire) son nom entre
// crochets — UNE règle pour l'entrée du client et l'écho du téléphone BMI.
export function texteDuMessageWa(m, media, { ecrit = "", parBmi = false } = {}) {
  if (m && TYPES_MODIFICATION.includes(String(m.type || ""))) return texteModification(m, { parBmi, ecrit });
  if (ecrit) return ecrit;
  if (media) return media.legende || "";
  return m && m.type && m.type !== "text" ? `[${m.type}]` : "";
}

export const TYPES_ECHO_TELEPHONE = ["whatsapp.smb.message.echoes", "whatsapp.smb.message.created"];
export const ID_TELEPHONE_BMI = "telephone-bmi-wa";
export const NOM_TELEPHONE_BMI = "📱 Téléphone BMI";

export function lireEchoTelephone(corps) {
  const c = corps && typeof corps === "object" ? corps : {};
  if (!TYPES_ECHO_TELEPHONE.includes(String(c.type || ""))) return null;
  const m = c.whatsappMessage && typeof c.whatsappMessage === "object" ? c.whatsappMessage : null;
  if (!m) return null;
  const media = lireMedia(m);
  const ecrit = (typeof m.text === "string" ? m.text : m.text?.body) || "";
  const texte = texteDuMessageWa(m, media, { ecrit, parBmi: true });
  return {
    to: String(m.to || ""),
    texte: String(texte || ""),
    media,
    id: String(m.id || ""),
    wamid: String(m.wamid || ""),
    ts: String(m.sendTime || m.createTime || c.createTime || ""),
  };
}

// Déjà dans le fil ? (YCloud renvoie, et les deux événements peuvent arriver
// pour le même message.) Le wamid de Meta est le même partout.
export function echoDejaLa(messages, { id, wamid } = {}) {
  return (Array.isArray(messages) ? messages : []).some((m) => m && !m.wa_entrant && (
    (id && (m.wa_id === id || m.wa_envoi_id === id)) || (wamid && (m.wa_wamid === wamid || m.wa_wamid_recu === wamid))));
}

// La ligne du fil : une réponse de BMI, écrite par une personne sur le
// téléphone. Elle ne prend pas la conversation (pas de propriétaire), ne
// rouvre pas la fenêtre de 24 h (seul le client la rouvre), et porte son
// wamid : les coches ✓✓ de Meta la retrouvent.
export function ligneEchoTelephone({ echo, cle, nomClient = "", ts }) {
  const e = echo || {};
  const quand = String(ts || "");
  return {
    id: `wa-tel-${e.id || e.wamid || quand}`.replace(/[^A-Za-z0-9_.:-]/g, "").slice(0, 120),
    date: quand.slice(0, 10),
    ts: quand,
    canal: CANAL_WA,
    wa_tel: String(cle || ""),
    wa_numero: e.to || String(cle || ""),
    ...(nomClient ? { wa_nom: nomClient } : {}),
    wa_telephone: true,
    wa_id: e.id || "",
    ...(e.wamid ? { wa_wamid: e.wamid } : {}),
    wa_statut: { etat: "envoye", le: quand },
    de_id: ID_TELEPHONE_BMI,
    de_nom: NOM_TELEPHONE_BMI,
    texte: e.texte || "",
    ...(e.media ? { wa_media: e.media } : {}),
    lu_par: [],
  };
}

// ---------------------------------------------------------------
// 📎 ENVOYER UN FICHIER AU CLIENT, DU NUMÉRO BMI (03/10/2026)
// ---------------------------------------------------------------
// Timo : « dans WhatsApp de l'app BMI, ajouter la possibilité d'envoyer les
// fichiers » → « tous les documents », « la phrase qui accompagne
// facultative ». C'est une RÉPONSE : seulement dans la fenêtre de 24 h
// (un modèle ne peut pas porter un fichier choisi au moment de l'envoi),
// mêmes personnes, jamais en formation.
// ⚠⚠ AUCUN FICHIER N'EST RANGÉ CHEZ NOUS (sa décision du 20/09/2026) : il
// traverse le serveur et part chez WhatsApp. Le fil ne garde que son NOM.
// ⚠ 3 Mo au plus : c'est la limite de notre serveur (Vercel refuse un envoi
// de plus de 4,5 Mo, et le fichier voyage codé, un tiers plus gros). Une
// photo est réduite par l'application AVANT, donc elle passe presque
// toujours ; un PDF trop lourd est refusé, et le refus le dit.
export const TAILLE_MAX_ENVOI = 3 * 1024 * 1024;
export const LEGENDE_MAX = 1024; // la limite de Meta pour la phrase d'un fichier

// Les familles que WhatsApp accepte. Une image qui n'est ni JPEG ni PNG (un
// HEIC d'iPhone que le navigateur n'a pas su réduire, un GIF) part comme
// DOCUMENT : le client la reçoit quand même, en pièce jointe.
const MIMES_ENVOI = {
  image: ["image/jpeg", "image/png"],
  video: ["video/mp4", "video/3gpp"],
  audio: ["audio/aac", "audio/mp4", "audio/mpeg", "audio/amr", "audio/ogg"],
};
const EXTENSIONS_DOCUMENT = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "jpg", "jpeg", "png", "gif", "webp", "heic"];

export function typeEnvoiFichier(mime) {
  const m = String(mime || "").toLowerCase().split(";")[0].trim();
  for (const [type, liste] of Object.entries(MIMES_ENVOI)) if (liste.includes(m)) return type;
  return "document";
}

const extension = (nom) => {
  const n = String(nom || "").toLowerCase();
  const i = n.lastIndexOf(".");
  return i > -1 ? n.slice(i + 1) : "";
};

// Mo lisibles, à la française : « 2,4 Mo », « 850 Ko ».
export function tailleLisible(octets) {
  const n = Number(octets) || 0;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
  return `${Math.max(1, Math.round(n / 1024))} Ko`;
}

// Rend "" si le fichier peut partir, sinon le refus en français.
export function critiqueFichier(fichier, phrase = "") {
  const f = fichier || {};
  const nom = String(f.nom || "").trim();
  const taille = Number(f.taille) || 0;
  if (!nom || !taille) return "Ce fichier est vide ou illisible.";
  if (taille > TAILLE_MAX_ENVOI) {
    return `« ${nom} » pèse ${tailleLisible(taille)} : au plus ${tailleLisible(TAILLE_MAX_ENVOI)} par fichier. Réduisez-le (un PDF s'allège en l'enregistrant « taille réduite ») ou envoyez-le en plusieurs morceaux.`;
  }
  const type = typeEnvoiFichier(f.mime);
  if (type === "document" && !EXTENSIONS_DOCUMENT.includes(extension(nom))) {
    return `« ${nom} » n'est pas un type que WhatsApp accepte. On peut envoyer : photos, PDF, Word, Excel, PowerPoint, texte, vidéo MP4 et son.`;
  }
  const p = String(phrase || "").trim();
  // Un son ne porte pas de phrase chez WhatsApp : on ne la perd pas en silence.
  if (type === "audio" && p) return "Un son part sans phrase chez WhatsApp : envoyez le son seul, puis votre phrase dans un message à part.";
  if (p.length > LEGENDE_MAX) return `La phrase qui accompagne un fichier fait au plus ${LEGENDE_MAX} caractères.`;
  return "";
}

// Ce que la ligne du fil garde d'un fichier ENVOYÉ : son nom, son type, sa
// taille — JAMAIS le fichier. `envoye` dit à l'écran que c'est BMI qui l'a
// envoyé (la copie reste sur le téléphone BMI).
// 🎤 Le numéro du dépôt chez WhatsApp n'est PAS gardé (20/10/2026, « a ») :
// YCloud ne rend pas un fichier déposé, ce numéro ne commanderait rien. Une
// note envoyée se réécoute par la copie de l'appareil (src/vocauxLocaux.js)
// ET, depuis le 21/10/2026, par l'espace privé de Supabase : `stocke` est le
// CHEMIN que le serveur a rendu (src/lib/vocauxStockes.js), jamais le son.
export function mediaEnvoye(fichier, stocke = "") {
  const f = fichier || {};
  const vocal = estNoteVocale(f);
  return {
    type: vocal ? "voice" : typeEnvoiFichier(f.mime),
    nom: String(f.nom || ""),
    mime: String(f.mime || ""),
    taille: Number(f.taille) || 0,
    ...(Number(f.duree) > 0 ? { duree: Math.max(1, Math.round(Number(f.duree))) } : {}),
    ...(stocke ? { stocke: String(stocke) } : {}),
    envoye: true,
  };
}

// 🎤 UNE NOTE VOCALE ENREGISTRÉE DANS L'APPLICATION (20/10/2026, « B ») :
// WhatsApp ne la montre comme note vocale (le rond, la vitesse) que si c'est
// un .ogg en Opus ET que le message le dit (`voice: true`). Un son MP4
// (iPhone) part comme un simple son. Lu par l'écran ET par le serveur.
export function estNoteVocale(fichier) {
  const f = fichier || {};
  return !!f.vocal && String(f.mime || "").toLowerCase().split(";")[0].trim() === "audio/ogg";
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
