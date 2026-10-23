// ============================================================
// lib/assistantWhatsapp.js — 🤖 L'ASSISTANT DU NUMÉRO WHATSAPP BMI (24/09/2026)
//
// Timo, après la question « on peut implémenter un assistant aussi avec les
// API WhatsApp avec ce même numéro ? » et les recommandations de ChatGPT :
// « Lance », avec les trois décisions qu'il a écrites lui-même — les LIGNES
// DU MENU (les activités de BMI TOGO, dans ses mots), CE QUE L'ASSISTANT A
// LE DROIT DE DIRE, et le MESSAGE D'ACCUEIL (mot pour mot, `TEXTE_ACCUEIL`).
//
// CE QUE C'EST : le niveau « menu à chiffres branché sur la base », SANS
// intelligence artificielle. Le client écrit au numéro BMI, l'assistant lui
// répond dans la fenêtre de 24 h que son message vient d'ouvrir (la règle
// de Meta, lib/whatsappConversations.js), avec NOS données — jamais une
// invention. Rien ne sort du Togo : aucun service extérieur ne lit le
// message du client.
//
// ⚠⚠ CE QU'IL NE DIT JAMAIS, et pourquoi :
//   • une DETTE, un crédit, un montant dû — l'authentifier voudrait dire
//     faire circuler un identifiant ou un mot de passe dans WhatsApp, ce
//     qu'on ne fait jamais. Le client a son espace pour ça ; l'assistant
//     l'y renvoie et propose un conseiller.
//   • une QUANTITÉ en stock — « disponible » ou « sur commande », jamais le
//     nombre, à quelqu'un qu'on ne connaît pas.
//   • un PRIX de devis, un délai, une caractéristique qui n'est pas sur la
//     fiche de l'article : « il ne doit jamais inventer » (Timo).
//   • un DEVIS : il prépare une DEMANDE (une fiche 🧲 Prospects), c'est un
//     vendeur qui établit le devis. Le devis engage BMI, il est signé.
//
// ⚠⚠ QUAND IL SE TAIT — la règle qui empêche un robot de parler à la place
// d'une personne (`decisionAssistant`) :
//   • le réglage est coupé (⚙ Paramètres) ;
//   • la conversation A UN PROPRIÉTAIRE (confiée, ou née d'un devis parti
//     du numéro BMI) : elle est à quelqu'un, le client lui parle, pas au
//     robot — c'est la décision de l'étape 2 (« les réponses vont dans
//     l'espace du personnel qui a écrit ») ;
//   • un EMPLOYÉ a répondu il y a moins de 24 h (une réponse libre, un
//     modèle parti de l'application) : la conversation est entre humains ;
//   • le client a demandé un conseiller (ou un SAV, ou déposé une demande
//     de devis) il y a moins de 24 h : quelqu'un doit prendre le relais.
//   Passé 24 h sans un mot de BMI, c'est une NOUVELLE conversation : il
//   accueille à nouveau. Et « menu » (ou 0) le fait toujours revenir.
//
// ⚠ LE MUR : ce fichier ne reçoit JAMAIS `db` — il reçoit des LISTES déjà
// filtrées (les articles des boutiques RÉELLES, préparés par le serveur) ;
// une fonction pure qui reçoit une table entière et la parcourt est un
// passage de mur en puissance (leçon payée deux fois le 18/09/2026). Une
// demande de devis naît RÉELLE (pas de marque `formation`) : le numéro est
// vrai, le client aussi.
//
// ⚠ LE COUPLE : `api/whatsapp-entrant.js` IMPORTE ce fichier (le serveur
// lit ce fichier tel quel, comme whatsappModeles.js) ; le seul autre import
// est la règle commune de recherche (`correspond`, lib/suggestions.js, sans
// import elle aussi) — UNE règle pour toute recherche tapée (13/09/2026).
// Le banc (`npm run verifier-whatsapp`) exerce ces règles pour de vrai.
// ============================================================
import { correspond, sansAccents } from "./suggestions.js";
// La règle des pompes (sans import elle aussi) : c'est la CATÉGORIE qui fait
// une pompe, jamais le nom — même règle que 📦 Stocks.
import { estPompe } from "./pompes.js";
import { estCategorieConvertisseur } from "./choixSolaire.js";
import { CHAMPS_CLIENT, CLES_CLIENT, valeurDiteDe, bouClair } from "./ficheArticle.js";
import { maintenantISO } from "./horloge.js";

export const NOM_ASSISTANT = "Assistant BMI TOGO";
// Le `de_id` des lignes qu'il écrit : jamais celui d'une personne.
export const ID_ASSISTANT = "assistant-bmi";
export const SIGNATURE_BMI = "BMI TOGO — Les bâtiments modernes et intelligents";
export const HEURES_SILENCE = 24;

// ---- LES LIGNES DU MENU (Timo, 24/09/2026 — ses mots) ----
// `activite` : une activité de BMI TOGO qu'on PRÉSENTE (garage, domotique,
// VMC ne sont pas des métiers de l'application : l'assistant ne cherche
// rien dans la base pour elles, il présente et propose la suite).
export const LIGNES_MENU = [
  { n: 1, id: "solaire", titre: "☀️ Énergie solaire", detail: "panneaux, onduleurs, batteries et installations", activite: true },
  { n: 2, id: "garage", titre: "🚪 Automatisation de garage", detail: "moteurs, portes, portails et accessoires", activite: true },
  { n: 3, id: "domotique", titre: "🏠 Domotique & automatisation", detail: "solutions pour bâtiments intelligents", activite: true },
  { n: 4, id: "vmc", titre: "🌬️ VMC & ventilation", detail: "", activite: true },
  { n: 5, id: "produits", titre: "🛒 Produits & équipements", detail: "prix, disponibilité et caractéristiques" },
  { n: 6, id: "devis", titre: "🧾 Demande de devis", detail: "" },
  { n: 7, id: "sav", titre: "🔧 SAV & assistance technique", detail: "" },
  { n: 8, id: "conseiller", titre: "👨‍💼 Parler à un conseiller BMI TOGO", detail: "" },
];
export const ligneMenu = (n) => LIGNES_MENU.find((l) => l.n === Number(n)) || null;

// ---- LE MESSAGE D'ACCUEIL — écrit par Timo, mot pour mot ----
export const TEXTE_ACCUEIL = `👋 Bonjour et bienvenue chez BMI TOGO !

Je suis l'assistant virtuel de BMI TOGO. Je peux vous aider à trouver un produit, connaître son prix, vérifier sa disponibilité, demander un devis ou obtenir une assistance.

Que souhaitez-vous faire ?

1️⃣ Énergie solaire
2️⃣ Automatisation de garage
3️⃣ Domotique & automatisation
4️⃣ VMC & ventilation
5️⃣ Produits & équipements
6️⃣ Demander un devis
7️⃣ SAV & assistance technique
8️⃣ Parler à un conseiller

👉 Répondez simplement avec le numéro correspondant à votre demande.

${SIGNATURE_BMI}`;

// Le menu court, pour redire les choix sans le paragraphe d'accueil.
export const MENU_COURT = LIGNES_MENU.map((l) => `${l.n}️⃣ ${l.titre.replace(/^\S+\s/, "")}`).join("\n");
export const PIED_SUITE = "Tapez « menu » pour revenir au menu, ou 8 pour un conseiller.";

// ---- LES ÉTAPES — ce que l'assistant attend du client au message suivant ----
export const ETAPE_MENU = "menu";           // un chiffre de 1 à 8
export const ETAPE_PRODUIT = "produit";     // le nom d'un article
export const ETAPE_DEVIS_BESOIN = "devis_besoin"; // la description du besoin
export const ETAPE_DEVIS_NOM = "devis_nom"; // le nom du client (inconnu de nous)
export const ETAPE_CONSEILLER = "conseiller"; // il se tait : une personne prend le relais
export const ETAPES = [ETAPE_MENU, ETAPE_PRODUIT, ETAPE_DEVIS_BESOIN, ETAPE_DEVIS_NOM, ETAPE_CONSEILLER];

export const estLigneAssistant = (m) => !!m && !!m.wa_assistant && m.de_id === ID_ASSISTANT;

// ---- CE QUE LE CLIENT A TAPÉ ----
// Un chiffre seul (avec ou sans son emoji ⃣) est TOUJOURS un choix du menu,
// à n'importe quelle étape ; « menu » et « 0 » ramènent à l'accueil.
export const MOTS_RETOUR_ASSISTANT = ["assistant", "l'assistant", "assistant bmi", "revenir a l'assistant", "retour assistant"];
export function interpreterEntree(texte) {
  const t = sansAccents(String(texte || "").replace(/️|⃣/g, ""));
  if (!t) return { vide: true, chiffre: null, menu: false, texte: "" };
  if (t === "menu" || t === "0" || t === "accueil") return { vide: false, chiffre: null, menu: true, texte: t };
  // 🤖 « assistant » : le client REVIENT à l'assistant après lui avoir
  // passé la main à un conseiller (Timo, 01/10/2026 : « il peut toujours
  // proposer un conseiller, mais avoir la possibilité de revenir à
  // l'assistant »). La conversation continue, elle ne recommence pas.
  if (MOTS_RETOUR_ASSISTANT.includes(t)) return { vide: false, chiffre: null, menu: false, assistant: true, texte: String(texte || "").trim() };
  const m = /^([1-8])\s*[.)]?$/.exec(t);
  return { vide: false, chiffre: m ? Number(m[1]) : null, menu: false, texte: String(texte || "").trim() };
}

// ---- LES MOTS DU CLIENT QUI DÉSIGNENT UNE LIGNE DU MENU ----
// ⚠⚠ Capture Timo, 24/09/2026, une heure après la mise en service : « Je veux
// un devis » tapé à l'étape « nom d'un produit » a reçu « Je ne trouve pas
// « Je veux un devis » dans notre base ». « La règle est trop rigide… il
// devrait se référer à sa liste de sélection pour voir s'il y a un mot du
// client qui concorde avec sa liste. » Depuis : un chiffre reste un choix,
// mais un MOT en est un aussi. Les mots sont comparés sans accents ni
// majuscules, MOT ENTIER (« panne » ne réveille pas « panneau »).
// ⚠ L'ORDRE COMPTE : un GESTE (conseiller, SAV, devis) prime sur une activité
// — « je veux un devis solaire » est une demande de devis, pas une
// présentation du solaire. Et à une étape où le client DÉCRIT (son besoin,
// son nom), rien n'est interprété : « installation solaire » est sa réponse.
export const MOTS_CLES = {
  conseiller: ["conseiller", "conseillere", "humain", "quelqu'un", "quelqu un", "agent", "commercial", "appeler", "appelez", "appel", "rappeler", "rappelez", "parler", "personne", "responsable"],
  sav: ["sav", "panne", "depannage", "depanner", "reparation", "reparer", "garantie", "ne marche plus", "ne marche pas", "ne fonctionne plus", "ne fonctionne pas", "probleme", "defaut", "defectueux", "assistance", "technicien"],
  devis: ["devis", "cotation", "proforma", "pro forma", "estimation", "chiffrage", "chiffrer"],
  produits: ["prix", "tarif", "cout", "coute", "coutent", "combien", "produit", "article", "equipement", "disponible", "disponibilite", "dispo", "stock", "acheter", "achat", "vendez", "vente"],
  solaire: ["solaire", "photovoltaique", "panneau", "onduleur", "batterie", "kit solaire", "energie"],
  garage: ["garage", "portail", "moteur", "porte", "rideau"],
  domotique: ["domotique", "automatisation", "automatisme", "batiment intelligent", "maison intelligente"],
  vmc: ["vmc", "ventilation", "aeration", "extracteur"],
};
export const ORDRE_GESTES = ["conseiller", "sav", "devis"];
export const ORDRE_ACTIVITES = ["produits", "solaire", "garage", "domotique", "vmc"];
const motsDe = (t) => sansAccents(t).replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean);
const porteLeMot = (mots, t, k) => (k.includes(" ") ? ` ${t} `.includes(` ${k} `) : mots.some((m) => m === k || m === `${k}s` || m === `${k}x`));
export function choixParMots(texte, ids = [...ORDRE_GESTES, ...ORDRE_ACTIVITES]) {
  const t = sansAccents(texte).replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();
  const mots = motsDe(texte);
  for (const id of ids) if ((MOTS_CLES[id] || []).some((k) => porteLeMot(mots, t, k))) return LIGNES_MENU.find((l) => l.id === id) || null;
  return null;
}

// Les mots qui ne désignent pas un article, retirés avant de chercher dans
// le stock : « combien coûte le panneau 400 » → « panneau 400 ».
const MOTS_VIDES = new Set(["je", "j", "veux", "voudrais", "voulais", "souhaite", "cherche", "recherche", "le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "pour", "est", "ce", "c", "que", "qu", "quel", "quelle", "quels", "quelles", "vous", "avez", "as", "tu", "bonjour", "bonsoir", "svp", "stp", "merci", "il", "y", "a", "et", "en", "votre", "vos", "me", "moi", "donner", "donnez", "donne", "dispo", "disponible", "disponibilite", "stock", "acheter", "achat", "prix", "tarif", "cout", "coute", "coutent", "combien", "produit", "produits", "article", "articles", "equipement", "equipements", "avoir", "sur", "chez", "au", "aux", "ca", "sa", "mon", "ma", "mes", "ton", "ta", "tes", "on", "nous", "avec", "sans", "ou", "ok", "oui", "non", "vendez", "vente", "info", "infos", "information", "informations", "s", "il", "ils", "elle", "elles", "faut", "besoin", "dans", "par", "the"]);
export const motsUtiles = (texte) => motsDe(texte).filter((m) => !MOTS_VIDES.has(m)).join(" ");

// Ce qu'on comprend d'un message LIBRE (hors chiffre) : un geste, sinon un
// article du stock, sinon une activité — sinon rien. `articles` peut être
// vide (le serveur ne charge le stock que quand il peut servir).
export function comprendreLibre(texte, articles = []) {
  const geste = choixParMots(texte, ORDRE_GESTES);
  if (geste) return { choix: geste };
  const requete = motsUtiles(texte);
  const trouves = requete ? chercherArticles(articles, requete) : [];
  if (trouves.length) return { trouves, requete };
  const activite = choixParMots(texte, ORDRE_ACTIVITES);
  if (activite) return { choix: activite };
  return null;
}

// ---- QUAND RÉPONDRE, ET À QUELLE ÉTAPE ----
// `fil` : la conversation, du plus ancien au plus récent, le message du
// client EN DERNIER (celui qu'on vient de recevoir). Rend
//   { repondre, etape, pourquoi } — `etape` = l'étape où l'on est (null pour
// une conversation neuve : l'accueil).
// ---- 🤖 « RENDRE À L'ASSISTANT » (21/10/2026, « 1 oui, et non pour le c ») ----
// Timo : « Nous même ne pouvons pas donner instruction à l'assistant de
// répondre à un message ? » puis « il ne peut pas continuer toute la
// conversation ? ». Un bouton de 📲 WhatsApp pose une LIGNE SYSTÈME qui porte
// cette marque : à partir d'elle, l'assistant reprend la main — il répond
// tout de suite au dernier message du client resté sans réponse (serveur,
// api/_rendreAssistant.js), puis continue comme si aucun employé n'avait
// écrit. ⚠ Il se tait de nouveau dans les cas d'aujourd'hui : une personne de
// BMI écrit après la marque, le client demande un conseiller, ou la
// conversation est confiée (une ligne `proprietaire_id`) après elle.
// ⚠ Une conversation CONFIÉE peut être rendue (par son propriétaire ou
// l'administrateur) : elle reste confiée — visible par lui seul — mais
// l'assistant y parle.
export const MARQUE_RENDU_ASSISTANT = "wa_rendu_assistant";
export const estMarqueRendu = (m) => !!m && !!m[MARQUE_RENDU_ASSISTANT];
// La marque EN VIGUEUR, ou null : la plus récente, sans personne de BMI qui
// a écrit après elle, ni conversation confiée après elle. Les lignes du
// client, de l'assistant et la fiche légère ne l'annulent pas.
export function renduActif(fil) {
  const liste = Array.isArray(fil) ? fil : [];
  for (let i = liste.length - 1; i >= 0; i--) {
    const m = liste[i];
    if (!m || m.wa_entrant || m.canal === "whatsapp_entete" || estLigneAssistant(m)) continue;
    if (estMarqueRendu(m)) return m;
    if (m.wa_systeme) {
      if (m.proprietaire_id) return null;
      continue;
    }
    return null;
  }
  return null;
}
// La ligne posée par le bouton : système (au milieu du fil), sans
// propriétaire, elle n'ouvre pas la fenêtre et ne compte pas comme non lue.
export function ligneRenduAssistant({ cle, tel, nom, par, par_id, ts } = {}) {
  return {
    id: `wa-rendu-${String(ts || "").replace(/\D/g, "").slice(0, 17) || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: String(ts || "").slice(0, 10), ts: String(ts || ""),
    canal: "whatsapp", wa_tel: String(cle || ""), wa_numero: String(tel || ""), ...(nom ? { wa_nom: String(nom) } : {}),
    wa_entrant: false, wa_systeme: true,
    de_id: String(par_id || ""), de_nom: String(par || ""),
    texte: `🤖 Conversation rendue à l'assistant par ${par || "un membre de l'équipe"}.`,
    [MARQUE_RENDU_ASSISTANT]: { par: String(par || ""), par_id: String(par_id || ""), le: String(ts || "") },
    lu_par: [],
  };
}
// 🙋 LE CLIENT ATTEND UNE RÉPONSE (21/10/2026, capture Timo d'EDEM, « les
// deux, lance ») : son message est le DERNIER du fil, personne n'y a répondu
// (ni l'assistant, ni une personne — téléphone BMI compris), depuis au moins
// 2 minutes (l'assistant a pu être en train de répondre) et moins de 24 h
// (au-delà, WhatsApp n'accepte plus de réponse libre).
export const MINUTES_AVANT_RENDRE = 2;
export function clientSansReponse(fil, maintenant) {
  const liste = Array.isArray(fil) ? fil : [];
  for (let i = liste.length - 1; i >= 0; i--) {
    const m = liste[i];
    if (!m || m.canal === "whatsapp_entete") continue;
    if (estMarqueRendu(m)) return false;
    if (m.wa_systeme) continue;
    if (!m.wa_entrant) return false;
    const age = Date.parse(maintenant || "") - Date.parse(m.ts || "");
    return Number.isFinite(age) && age >= MINUTES_AVANT_RENDRE * 60 * 1000 && age < HEURES_SILENCE * 3600 * 1000;
  }
  return false;
}
// L'assistant s'est-il tu à cause d'une PERSONNE (le bouton a alors un sens) ?
// Conversation confiée sans marque en vigueur ; un employé qui a écrit il y a
// moins de 24 h ; l'assistant qui a passé la main à un conseiller ; ou — depuis
// le 21/10/2026 — un client resté sans réponse (`clientSansReponse`).
export function assistantEnRetrait({ fil, proprietaireId = "", maintenant } = {}) {
  const liste = Array.isArray(fil) ? fil : [];
  if (proprietaireId && !renduActif(liste)) return true;
  if (clientSansReponse(liste, maintenant)) return true;
  for (let i = liste.length - 1; i >= 0; i--) {
    const m = liste[i];
    if (!m || m.wa_entrant || m.canal === "whatsapp_entete") continue;
    if (estMarqueRendu(m)) return false;
    if (m.wa_systeme) continue;
    if (estLigneAssistant(m)) return m.wa_assistant.etape === ETAPE_CONSEILLER;
    const age = Date.parse(maintenant || "") - Date.parse(m.ts || "");
    return Number.isFinite(age) && age < HEURES_SILENCE * 3600 * 1000;
  }
  return false;
}

export function decisionAssistant({ fil, proprietaireId = "", actif = true, maintenant } = {}) {
  if (!actif) return { repondre: false, etape: null, pourquoi: "assistant coupé dans ⚙ Paramètres" };
  const liste = Array.isArray(fil) ? fil : [];
  // 🤖 Une conversation confiée se tait — sauf si elle a été RENDUE à l'assistant.
  if (proprietaireId && !renduActif(liste)) return { repondre: false, etape: null, pourquoi: "conversation confiée à une personne" };
  const entrant = liste[liste.length - 1];
  if (!entrant || !entrant.wa_entrant) return { repondre: false, etape: null, pourquoi: "pas de message du client" };
  const entree = interpreterEntree(entrant.texte);
  // Le dernier mot de BMI avant ce message : une personne, un modèle, ou
  // l'assistant — ou la marque « rendue à l'assistant ».
  let precedent = null;
  for (let i = liste.length - 2; i >= 0; i--) {
    const m = liste[i];
    if (estMarqueRendu(m)) { precedent = m; break; }
    if (m && !m.wa_entrant && !m.wa_systeme) { precedent = m; break; }
  }
  if (!precedent) return { repondre: true, etape: null, pourquoi: "nouvelle conversation" };
  const t = Date.parse(maintenant || entrant.ts || "");
  const age = t - Date.parse(precedent.ts || "");
  const recent = Number.isFinite(age) && age < HEURES_SILENCE * 3600 * 1000;
  if (!recent) return { repondre: true, etape: null, pourquoi: "plus de 24 h sans un mot de BMI : nouvelle conversation" };
  // 🤖 Rendue à l'assistant : il reprend, la conversation continue (pas de
  // présentation du premier jour ; `rendu` dit au serveur de se présenter
  // en une phrase s'il ne l'a jamais fait pour ce client).
  if (estMarqueRendu(precedent)) return { repondre: true, etape: ETAPE_MENU, pourquoi: "conversation rendue à l'assistant", rendu: true, memoire: {} };
  if (!estLigneAssistant(precedent)) {
    // 🤖 « assistant » après une personne de BMI (« c oui », 19/10/2026) : le
    // client fait revenir l'assistant sans attendre 24 h. La conversation
    // continue (pas de présentation) ; l'IA lit ce que la personne a écrit.
    // ⚠ Une conversation CONFIÉE ne passe jamais ici (elle s'est tue plus haut).
    if (entree.assistant) return { repondre: true, etape: ETAPE_MENU, pourquoi: "le client revient à l'assistant après un message de BMI", retour: true, memoire: {} };
    return { repondre: false, etape: null, pourquoi: "un employé a répondu il y a moins de 24 h" };
  }
  const etape = precedent.wa_assistant.etape;
  if (etape === ETAPE_CONSEILLER) {
    if (entree.menu) return { repondre: true, etape: null, pourquoi: "le client redemande le menu" };
    // ⚠ Le retour à l'assistant ne rouvre PAS une conversation : pas de
    // nouvelle présentation, l'IA reprend avec le fil (étape menu = suite).
    if (entree.assistant) return { repondre: true, etape: ETAPE_MENU, pourquoi: "le client revient à l'assistant", retour: true, memoire: {} };
    return { repondre: false, etape: ETAPE_CONSEILLER, pourquoi: "une personne doit prendre le relais" };
  }
  // La mémoire de l'étape (le besoin déjà décrit, en attendant le nom) suit.
  return { repondre: true, etape: ETAPES.includes(etape) ? etape : ETAPE_MENU, pourquoi: "suite de l'échange", memoire: precedent.wa_assistant.memoire || {} };
}

// ---- ⏳ PLUSIEURS MESSAGES RAPIDES = UNE SEULE RÉPONSE (18/10/2026) ----
// Capture Timo : « Okay » puis « Comment vous allez » à quelques secondes —
// deux appels de l'adresse d'arrivée, deux réponses, deux présentations. Le
// serveur attend un peu (`ATTENTE_GROUPEMENT_MS`), relit la conversation, et
// ne répond QUE pour le dernier message du client : sa réponse lit tous ceux
// qui précèdent. ⚠ Seul un message ENTRANT plus récent dépasse ; une ligne
// d'une PERSONNE de BMI arrivée entre-temps fait taire l'assistant par une
// règle à part (`bmiAEcritApres`, « b » du 19/10/2026).
export const ATTENTE_GROUPEMENT_MS = 4000;

const apres = (a, b) => {
  const ta = String(a?.ts || ""), tb = String(b?.ts || "");
  if (ta !== tb) return ta > tb;
  return String(a?.id || "") > String(b?.id || "");
};

export function messageDepasse(fil, ligne) {
  if (!ligne) return false;
  return (Array.isArray(fil) ? fil : []).some((m) => m && m.wa_entrant && m.id !== ligne.id && apres(m, ligne));
}

// ---- 👨‍💼 UNE PERSONNE DE BMI A ÉCRIT APRÈS LE CLIENT (« b », 19/10/2026) ----
// Pendant que l'assistant attend ou prépare sa réponse, un conseiller (ou un
// message parti de l'application) a pu répondre : l'assistant se tait, le
// message de la personne passe seul. Ses propres lignes ne comptent pas.
export function bmiAEcritApres(fil, ligne) {
  if (!ligne) return false;
  return (Array.isArray(fil) ? fil : []).some((m) => m && !m.wa_entrant && !m.wa_systeme && m.canal !== "whatsapp_entete" && !estLigneAssistant(m) && m.id !== ligne.id && apres(m, ligne));
}

// La conversation telle que la décision et l'IA doivent la lire : la version
// relue, le message du client EN DERNIER (une réponse de BMI rangée un peu
// après lui ne doit pas faire croire que le client n'a rien dit).
export function filPourReponse(fil, ligne) {
  const liste = (Array.isArray(fil) ? fil : []).filter((m) => m && m.id !== ligne?.id);
  return ligne ? [...liste, ligne] : liste;
}

// La conversation est-elle une conversation de l'IA EN COURS ? (le dernier mot
// de BMI est une ligne de l'IA). Alors une panne ne doit pas y faire surgir le
// menu à chiffres (capture Timo, 01/10/2026 : « Quel produit cherchez-vous ? »
// au milieu d'une question sur les panneaux d'une pompe).
export function conversationIAEnCours(fil) {
  const liste = Array.isArray(fil) ? fil : [];
  for (let i = liste.length - 1; i >= 0; i--) {
    const m = liste[i];
    if (!m || m.wa_entrant || m.canal === "whatsapp_entete") continue;
    // 🤖 Rendue à l'assistant (21/10/2026) : c'est lui qui a la main.
    if (estMarqueRendu(m)) return true;
    if (m.wa_systeme) continue;
    // 🤖 Une relance (17/10/2026) appartient à la conversation de l'IA, même
    // écrite par la phrase de repli.
    return !!(m.wa_assistant && (m.wa_assistant.ia || m.wa_assistant.relance) && m.wa_assistant.etape !== ETAPE_CONSEILLER);
  }
  return false;
}

// ---- LES ARTICLES QU'ON PEUT CITER ----
// Le serveur prépare la liste (boutiques RÉELLES seulement) ; ici on ne fait
// que chercher dedans, par LA règle commune. « disponible » = il en reste
// au moins un ; « sur commande » sinon. Jamais le nombre.
// ⚠ Le stock se calcule comme `stockActuel` (lib/calculs.js) : initial +
// entrées − vendu (hors `deja_sorti`) + ajustements. calculs.js n'est pas
// lisible par le serveur ; le banc COMPARE les deux sur le même jeu d'essai.
export function stockDepuisLignes(p, ventes = [], ajustements = []) {
  const lignes = (v) => (v.articles && v.articles.length ? v.articles : [{ produit_id: v.produit_id, qte: v.qte }]);
  const vendu = (ventes || []).reduce((s, v) => s + lignes(v).filter((l) => l.produit_id === p.id && !l.deja_sorti && !l.au_chantier).reduce((t, l) => t + Number(l.qte || 0), 0), 0);
  const ajuste = (ajustements || []).filter((a) => a.produit_id === p.id).reduce((s, a) => s + Number(a.qte || 0), 0);
  return Number(p.initial || 0) + Number(p.entrees || 0) - vendu + ajuste;
}

// 🤖 « Ce que l'assistant peut dire aux clients » (fiche article, 25/09/2026 :
// « dès qu'un client te parle de moteurs centraux, savoir que c'est de ce
// type de moteur qu'il parle »). ⚠ Un champ À PART, jamais `notes` (« Notes
// internes ») : ce qui est écrit ici part chez le client. Borné.
export const NOTE_ASSISTANT_MAX = 400;
export const noteAssistantDe = (p) => String(p?.note_assistant || "").trim().slice(0, NOTE_ASSISTANT_MAX);

// ---- LA FICHE D'UN ARTICLE, TELLE QUE L'ASSISTANT PEUT LA DIRE ----
// 01/10/2026, Timo : « pas seulement la fiche des pompes… mais de tous les
// articles ». 23/10/2026 : « la règle d'or devrait être qu'il lise les fiches
// produit tant qu'elles existent… demain si on ajoute une fiche à un produit,
// on n'aura plus besoin d'aller informer l'assistant » → « a, lance ».
// Il lit donc LE registre (lib/ficheArticle.js) : toute case rangée « client »
// et remplie part, sans une ligne de plus ici. Un champ vide ne passe pas (on
// n'écrit pas « garantie : »).
// ⚠⚠ JAMAIS : ce qui est rangé « interne » (prix d'achat, fournisseur, notes
// internes, code-barres, seuil, stock à atteindre, quantités) — ni ce qui
// n'est rangé nulle part. Le banc lit les clés rendues.
// ⚠ Une case propre à une pompe ou à un convertisseur ne passe QUE pour lui :
// c'est la catégorie qui décide (`pour` dans le registre).
export const CLES_FICHE_ASSISTANT = CLES_CLIENT;
const portePour = (pour, p) => (pour === "pompe" ? estPompe(p) : pour === "convertisseur" ? estCategorieConvertisseur(p?.categorie) : true);
export function ficheArticleAssistant(p) {
  const f = {};
  for (const c of CHAMPS_CLIENT) {
    if (!portePour(c.pour, p)) continue;
    const v = valeurDiteDe(c, p);
    if (v !== null) f[c.cle] = v;
  }
  return f;
}

// Le MÉTIER d'un article : le nom du domaine réglé dans ⚙ Paramètres
// (`p.domaine` porte son identifiant), sinon l'identifiant lui-même.
export const nomsDesMetiers = (boutiques) => {
  const b = (boutiques || []).find((x) => x && !x.formation && Array.isArray(x.domaines) && x.domaines.length);
  const m = {};
  for (const d of (b ? b.domaines : [])) if (d && d.id) m[d.id] = String(d.nom || d.id);
  return m;
};

export function articlesPourAssistant({ produits = [], boutiques = [], ventes = [], ajustements = [] } = {}) {
  const reelles = new Set((boutiques || []).filter((b) => b && b.nom && !b.formation).map((b) => b.nom));
  const metiers = nomsDesMetiers(boutiques);
  return (produits || [])
    .filter((p) => p && p.nom && reelles.has(p.boutique))
    .map((p) => ({
      nom: String(p.nom), categorie: String(p.categorie || ""), boutique: String(p.boutique),
      metier: p.domaine ? String(metiers[p.domaine] || p.domaine) : "",
      prix: Number(p.prix_vente || 0), disponible: stockDepuisLignes(p, ventes, ajustements) > 0,
      tension: String(p.tension || ""),
      description: noteAssistantDe(p),
      ...ficheArticleAssistant(p),
    }));
}

// ⚡ LA TENSION SE CHERCHE (01/10/2026, capture Timo : « une batterie de
// 51,2 V c'est une batterie de 48 V » — l'assistant ne la trouvait pas).
// Une lithium porte sa tension RÉELLE (51,2 / 25,6 / 12,8 V) ; le métier dit
// 48 / 24 / 12 V. Les deux se trouvent, et « 48 V » tapé vaut « 48v ».
const TENSIONS_NOMINALES = [["51,2", "48v"], ["51.2", "48v"], ["25,6", "24v"], ["25.6", "24v"], ["12,8", "12v"], ["12.8", "12v"]];
export function motsDeTension(a) {
  const t = `${a?.nom || ""} ${a?.tension || ""}`.toLowerCase();
  const mots = [];
  for (const [reel, nominal] of TENSIONS_NOMINALES) if (t.includes(reel)) mots.push(nominal);
  const ten = String(a?.tension || "").replace(/\s+/g, "").toLowerCase();
  if (ten) mots.push(/v$/.test(ten) ? ten : `${ten}v`);
  return mots.join(" ");
}
// « 48 V » → « 48v », « 51,2 V » → « 51,2v » : le nombre et son unité collés.
const requeteTension = (q) => String(q || "").replace(/(\d+(?:[.,]\d+)?)\s+v\b/gi, "$1v");
// Les cases cochées de la fiche se cherchent aussi (« convertisseur triphasé »,
// « pompe hybride ») — toutes celles du registre, sans les nommer ici.
const motsDesCases = (a) => CHAMPS_CLIENT.filter((c) => c.sorte === "case" && a?.[c.cle] === true).map((c) => c.mot).join(" ");
export const MAX_ARTICLES_CITES = 6;
export function chercherArticles(articles, requete) {
  const q = requeteTension(String(requete || "").trim());
  if (q.length < 2) return [];
  return (articles || [])
    // On cherche aussi dans le MÉTIER (« pompe forage » trouve les pompes
    // rangées dans Forage, 01/10/2026) et dans ce que la fiche dit.
    .filter((a) => correspond(`${a.nom} ${a.categorie} ${a.metier || ""} ${motsDeTension(a)} ${a.description || ""} ${motsDesCases(a)}`, q))
    .sort((a, b) => (a.disponible === b.disponible ? a.nom.localeCompare(b.nom, "fr") : a.disponible ? -1 : 1))
    .slice(0, MAX_ARTICLES_CITES);
}

// La fiche en une ligne, pour le menu à chiffres (l'IA la reçoit en clair).
// Elle suit LE registre : chaque case client remplie, dans son ordre.
export function ficheEnClair(a) {
  const b = [];
  for (const c of CHAMPS_CLIENT) {
    const v = a?.[c.cle];
    if (v === undefined || v === null || v === "" || v === false || v === 0) continue;
    b.push(bouClair(c, v));
  }
  return b.join(" · ");
}
const fmtF = (n) => `${Math.round(Number(n || 0)).toLocaleString("fr-FR")} F`;
export function texteArticles(requete, trouves) {
  if (!trouves.length) return `Je ne trouve pas « ${requete} » dans notre base. Essayez un autre nom (par exemple la marque ou la puissance), écrivez « devis » pour une demande de devis, ou « conseiller » (ou 8) pour parler à quelqu'un.`;
  const lignes = trouves.map((a) => `• ${a.nom}${a.tension ? ` (${a.tension})` : ""} — ${a.prix > 0 ? fmtF(a.prix) : "prix sur demande"} — ${a.disponible ? "disponible" : "sur commande"} (${a.boutique})${ficheEnClair(a) ? `\n   ${ficheEnClair(a)}` : ""}${a.description ? `\n   ${a.description}` : ""}`);
  return `Voici ce que je trouve pour « ${requete} » :\n${lignes.join("\n")}\n\nÉcrivez un autre nom pour continuer, tapez 6 pour un devis, ou 8 pour un conseiller.`;
}

// ---- LA DEMANDE DE DEVIS — une fiche 🧲 Prospects, jamais un devis ----
export const CATEGORIE_PROSPECT_ASSISTANT = "Assistant WhatsApp";
export function construireDemandeDevis({ cle, tel, nom, besoin, date, ts } = {}) {
  const jour = String(date || String(ts || "").slice(0, 10));
  return {
    id: `wa-devis-${cle}-${String(ts || "").replace(/\D/g, "").slice(0, 14) || Date.now()}`,
    date: jour, maj_le: jour,
    commercial: NOM_ASSISTANT,
    categorie: CATEGORIE_PROSPECT_ASSISTANT,
    localisation: "", nom: String(nom || "").trim(), tel: String(tel || ""), nature: String(besoin || "").trim(),
    statut: "Favorable", interet: "Intéressé", relance: "", lat: null, lng: null,
    source: "assistant_whatsapp", wa_tel: cle,
  };
}

// ---- LA RÉPONSE ----
// Rend { texte, etape, demandeDevis?, conseiller } — ou null si rien à dire.
// `client` : { nom } si le numéro est celui d'un compte client, sinon null.
// `articles` : la liste préparée par le serveur (boutiques réelles).
export function reponseAssistant({ etape, texte, media = null, client = null, articles = [], memoire = {} } = {}) {
  const entree = interpreterEntree(texte);
  // Un envoi sans un mot (photo, note vocale, document) : une personne regarde.
  if (entree.vide && media) return { texte: `Merci pour votre envoi. Un conseiller BMI TOGO le regarde et vous répond sur ce numéro.\n\n${SIGNATURE_BMI}`, etape: ETAPE_CONSEILLER, conseiller: true };
  if (entree.vide) return null;
  if (entree.menu || entree.assistant) return { texte: TEXTE_ACCUEIL, etape: ETAPE_MENU, conseiller: false };
  if (entree.chiffre) return reponseAuChoix(entree.chiffre, client);
  // Un message LIBRE, là où on attend un choix ou un nom d'article : on
  // regarde d'abord si un mot du client désigne une ligne du menu, puis le
  // stock. « Je ne trouve pas » n'arrive qu'après (capture Timo, 24/09/2026).
  const libre = (etape === null || etape === undefined || etape === ETAPE_MENU || etape === ETAPE_PRODUIT) ? comprendreLibre(entree.texte, articles) : null;
  if (libre?.choix) return reponseAuChoix(libre.choix.n, client);
  if (libre?.trouves) return { texte: texteArticles(libre.requete, libre.trouves), etape: ETAPE_PRODUIT, conseiller: false, trouves: libre.trouves.length };
  if (etape === null || etape === undefined) return { texte: TEXTE_ACCUEIL, etape: ETAPE_MENU, conseiller: false };
  switch (etape) {
    case ETAPE_PRODUIT:
      return { texte: texteArticles(motsUtiles(entree.texte) || entree.texte, []), etape: ETAPE_PRODUIT, conseiller: false, trouves: 0 };
    case ETAPE_DEVIS_BESOIN: {
      if (client?.nom) return demandeEnregistree(client.nom, entree.texte);
      return { texte: "Merci. À quel nom dois-je enregistrer votre demande ?", etape: ETAPE_DEVIS_NOM, conseiller: false, memoire: { besoin: entree.texte } };
    }
    case ETAPE_DEVIS_NOM:
      return demandeEnregistree(entree.texte, memoire.besoin || "");
    default:
      return { texte: `Je n'ai pas compris. Répondez avec un numéro de 1 à 8 :\n\n${MENU_COURT}`, etape: ETAPE_MENU, conseiller: false };
  }
}

// Les deux phrases fixes que l'assistant qui DISCUTE (lib/assistantIA.js)
// réemploie quand sa propre réponse est jetée par le juge : la demande a
// bien été enregistrée, ou une personne prend le relais — on le dit avec
// les mêmes mots que le menu, jamais avec un texte inventé.
// La porte de retour, dite à chaque fois qu'on passe la main (01/10/2026).
export const PHRASE_RETOUR_ASSISTANT = "🤖 Pour revenir à l'assistant, écrivez simplement « assistant ».";
export const texteDemandeEnregistree = (nom) => `✅ Merci ${nom}, votre demande de devis est enregistrée. Un conseiller BMI TOGO vous contacte sur ce numéro pour la compléter et vous proposer une offre.\n\n${PHRASE_RETOUR_ASSISTANT}\n\n${SIGNATURE_BMI}`;
export const TEXTE_RELAIS_CONSEILLER = `👨‍💼 Un conseiller BMI TOGO prend le relais sur ce numéro. Écrivez-lui votre demande, il vous répond dès que possible.\n\n${PHRASE_RETOUR_ASSISTANT}\n\n${SIGNATURE_BMI}`;

function demandeEnregistree(nom, besoin) {
  return { texte: texteDemandeEnregistree(nom), etape: ETAPE_CONSEILLER, conseiller: true, demandeDevis: { nom, besoin } };
}

function reponseAuChoix(n, client) {
  const l = ligneMenu(n);
  if (l.activite) {
    const presentation = l.detail ? `${l.titre} — ${l.detail}.` : `${l.titre}.`;
    return { texte: `${presentation}\n\nPour aller plus loin :\n5️⃣ Prix et disponibilité d'un produit\n6️⃣ Demander un devis\n8️⃣ Parler à un conseiller\n\n${PIED_SUITE}`, etape: ETAPE_MENU, conseiller: false };
  }
  switch (l.id) {
    case "produits":
      return { texte: "🛒 Quel produit cherchez-vous ? Écrivez son nom (par exemple « panneau 400 W » ou « batterie lithium ») : je vous donne le prix et la disponibilité.", etape: ETAPE_PRODUIT, conseiller: false };
    case "devis":
      return { texte: `🧾 Pour préparer votre devis, décrivez-moi votre besoin en un message : ce que vous voulez installer ou alimenter (appareils, nombre d'heures d'utilisation…), et votre quartier ou ville.${client?.nom ? "" : " Un conseiller vous rappellera sur ce numéro."}`, etape: ETAPE_DEVIS_BESOIN, conseiller: false };
    case "sav":
      return { texte: `🔧 SAV & assistance technique — décrivez votre problème en un message (l'équipement, depuis quand, ce qui se passe) : un technicien BMI TOGO vous répond sur ce numéro.\n\n${SIGNATURE_BMI}`, etape: ETAPE_CONSEILLER, conseiller: true };
    default:
      return { texte: TEXTE_RELAIS_CONSEILLER, etape: ETAPE_CONSEILLER, conseiller: true };
  }
}

// ---- 👨‍💼 UN CLIENT ATTEND UNE PERSONNE (25/09/2026) ----
// Timo : « comment se fait la mise en relation avec un conseiller ?… j'ai
// compris qu'il n'y a pas une suite ». La suite existait (l'assistant se tait,
// une notification part), mais dans 📲 WhatsApp rien ne distinguait ce client
// d'un message ordinaire. Rend { depuis } tant que le DERNIER mot de BMI est
// l'assistant qui a passé la main ; `null` dès qu'une personne (réponse libre
// ou modèle) a écrit après, ou que l'assistant a repris (le client a redemandé
// le menu). Les lignes « système » (Confier, Rendre à tous) ne comptent pas.
export function attenteConseiller(fil) {
  const liste = Array.isArray(fil) ? fil : [];
  for (let i = liste.length - 1; i >= 0; i--) {
    const m = liste[i];
    if (!m || m.wa_entrant) continue;
    // 🤖 Rendue à l'assistant : le client n'attend plus personne.
    if (estMarqueRendu(m)) return null;
    if (m.wa_systeme) continue;
    if (!estLigneAssistant(m)) return null;
    return m.wa_assistant.etape === ETAPE_CONSEILLER ? { depuis: String(m.ts || "") } : null;
  }
  return null;
}
// « depuis 12 min », « depuis 2 h 05 », « depuis 3 j » — jamais un nombre négatif.
export function libelleAttente(depuis, maintenant = maintenantISO()) {
  const ms = Date.parse(maintenant) - Date.parse(depuis || "");
  if (!Number.isFinite(ms)) return "";
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 60) return `depuis ${min} min`;
  if (min < 24 * 60) return `depuis ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
  return `depuis ${Math.floor(min / 1440)} j`;
}

// ---- LA LIGNE QU'IL ÉCRIT DANS LE FIL ----
// Sortante, sans propriétaire (l'assistant ne s'approprie rien — seul
// « 🔁 Confier » le fait), sans `wa_entrant` (elle n'ouvre pas la fenêtre
// de 24 h, ne compte pas comme non lu). `wa_assistant.etape` est SA mémoire :
// c'est là que `decisionAssistant` relit où l'on en est.
export function ligneAssistant({ cle, tel, nom, texte, etape, ts, memoire = null, ia = false } = {}) {
  return {
    id: `wa-assist-${String(ts || "").replace(/\D/g, "").slice(0, 17) || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: String(ts || "").slice(0, 10), ts: String(ts || ""),
    canal: "whatsapp", wa_tel: cle, wa_numero: String(tel || ""), wa_nom: String(nom || ""),
    wa_entrant: false, de_id: ID_ASSISTANT, de_nom: NOM_ASSISTANT,
    texte: String(texte || ""),
    // `ia: true` : la phrase a été écrite par le service d'IA (niveau 3), pas
    // par le menu — l'écran le dit, et on sait relire ce qui a été dit.
    wa_assistant: { etape, ...(memoire ? { memoire } : {}), ...(ia ? { ia: true } : {}) },
    lu_par: [],
  };
}

// ---- LE RÉGLAGE (⚙ Paramètres, administrateur principal) ----
// Une POLITIQUE, pas une donnée : rangée sur les boutiques (`assistant_wa`),
// lue sur la première qui la porte — comme la durée de conservation. ALLUMÉ
// tant que personne ne l'a coupé (c'est ce que « Lance » veut dire).
export const assistantActif = (boutiques) => {
  const b = (boutiques || []).find((x) => x && x.assistant_wa !== undefined && x.assistant_wa !== null);
  return b ? b.assistant_wa !== false : true;
};
export const poserAssistant = (boutiques, actif) => (boutiques || []).map((b) => ({ ...b, assistant_wa: !!actif }));
