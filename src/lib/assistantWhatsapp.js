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
export function interpreterEntree(texte) {
  const t = sansAccents(String(texte || "").replace(/️|⃣/g, ""));
  if (!t) return { vide: true, chiffre: null, menu: false, texte: "" };
  if (t === "menu" || t === "0" || t === "accueil") return { vide: false, chiffre: null, menu: true, texte: t };
  const m = /^([1-8])\s*[.)]?$/.exec(t);
  return { vide: false, chiffre: m ? Number(m[1]) : null, menu: false, texte: String(texte || "").trim() };
}

// ---- QUAND RÉPONDRE, ET À QUELLE ÉTAPE ----
// `fil` : la conversation, du plus ancien au plus récent, le message du
// client EN DERNIER (celui qu'on vient de recevoir). Rend
//   { repondre, etape, pourquoi } — `etape` = l'étape où l'on est (null pour
// une conversation neuve : l'accueil).
export function decisionAssistant({ fil, proprietaireId = "", actif = true, maintenant } = {}) {
  if (!actif) return { repondre: false, etape: null, pourquoi: "assistant coupé dans ⚙ Paramètres" };
  if (proprietaireId) return { repondre: false, etape: null, pourquoi: "conversation confiée à une personne" };
  const liste = Array.isArray(fil) ? fil : [];
  const entrant = liste[liste.length - 1];
  if (!entrant || !entrant.wa_entrant) return { repondre: false, etape: null, pourquoi: "pas de message du client" };
  const entree = interpreterEntree(entrant.texte);
  // Le dernier mot de BMI avant ce message : une personne, un modèle, ou l'assistant.
  let precedent = null;
  for (let i = liste.length - 2; i >= 0; i--) {
    const m = liste[i];
    if (m && !m.wa_entrant && !m.wa_systeme) { precedent = m; break; }
  }
  if (!precedent) return { repondre: true, etape: null, pourquoi: "nouvelle conversation" };
  const t = Date.parse(maintenant || entrant.ts || "");
  const age = t - Date.parse(precedent.ts || "");
  const recent = Number.isFinite(age) && age < HEURES_SILENCE * 3600 * 1000;
  if (!recent) return { repondre: true, etape: null, pourquoi: "plus de 24 h sans un mot de BMI : nouvelle conversation" };
  if (!estLigneAssistant(precedent)) return { repondre: false, etape: null, pourquoi: "un employé a répondu il y a moins de 24 h" };
  const etape = precedent.wa_assistant.etape;
  if (etape === ETAPE_CONSEILLER) {
    return entree.menu
      ? { repondre: true, etape: null, pourquoi: "le client redemande le menu" }
      : { repondre: false, etape: ETAPE_CONSEILLER, pourquoi: "une personne doit prendre le relais" };
  }
  // La mémoire de l'étape (le besoin déjà décrit, en attendant le nom) suit.
  return { repondre: true, etape: ETAPES.includes(etape) ? etape : ETAPE_MENU, pourquoi: "suite de l'échange", memoire: precedent.wa_assistant.memoire || {} };
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
  const vendu = (ventes || []).reduce((s, v) => s + lignes(v).filter((l) => l.produit_id === p.id && !l.deja_sorti).reduce((t, l) => t + Number(l.qte || 0), 0), 0);
  const ajuste = (ajustements || []).filter((a) => a.produit_id === p.id).reduce((s, a) => s + Number(a.qte || 0), 0);
  return Number(p.initial || 0) + Number(p.entrees || 0) - vendu + ajuste;
}

export function articlesPourAssistant({ produits = [], boutiques = [], ventes = [], ajustements = [] } = {}) {
  const reelles = new Set((boutiques || []).filter((b) => b && b.nom && !b.formation).map((b) => b.nom));
  return (produits || [])
    .filter((p) => p && p.nom && reelles.has(p.boutique))
    .map((p) => ({
      nom: String(p.nom), categorie: String(p.categorie || ""), boutique: String(p.boutique),
      prix: Number(p.prix_vente || 0), disponible: stockDepuisLignes(p, ventes, ajustements) > 0,
      tension: String(p.tension || ""),
    }));
}

export const MAX_ARTICLES_CITES = 6;
export function chercherArticles(articles, requete) {
  const q = String(requete || "").trim();
  if (q.length < 2) return [];
  return (articles || [])
    .filter((a) => correspond(`${a.nom} ${a.categorie}`, q))
    .sort((a, b) => (a.disponible === b.disponible ? a.nom.localeCompare(b.nom, "fr") : a.disponible ? -1 : 1))
    .slice(0, MAX_ARTICLES_CITES);
}

const fmtF = (n) => `${Math.round(Number(n || 0)).toLocaleString("fr-FR")} F`;
export function texteArticles(requete, trouves) {
  if (!trouves.length) return `Je ne trouve pas « ${requete} » dans notre base. Essayez un autre nom (par exemple la marque ou la puissance), ou tapez 8 pour un conseiller.`;
  const lignes = trouves.map((a) => `• ${a.nom}${a.tension ? ` (${a.tension})` : ""} — ${a.prix > 0 ? fmtF(a.prix) : "prix sur demande"} — ${a.disponible ? "disponible" : "sur commande"} (${a.boutique})`);
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
  if (etape === null || etape === undefined || entree.menu) return { texte: TEXTE_ACCUEIL, etape: ETAPE_MENU, conseiller: false };
  if (entree.chiffre) return reponseAuChoix(entree.chiffre, client);
  switch (etape) {
    case ETAPE_PRODUIT: {
      const trouves = chercherArticles(articles, entree.texte);
      return { texte: texteArticles(entree.texte, trouves), etape: ETAPE_PRODUIT, conseiller: false, trouves: trouves.length };
    }
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

function demandeEnregistree(nom, besoin) {
  return {
    texte: `✅ Merci ${nom}, votre demande de devis est enregistrée. Un conseiller BMI TOGO vous contacte sur ce numéro pour la compléter et vous proposer une offre.\n\n${SIGNATURE_BMI}`,
    etape: ETAPE_CONSEILLER, conseiller: true, demandeDevis: { nom, besoin },
  };
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
      return { texte: `👨‍💼 Un conseiller BMI TOGO prend le relais sur ce numéro. Écrivez-lui votre demande, il vous répond dès que possible.\n\n${SIGNATURE_BMI}`, etape: ETAPE_CONSEILLER, conseiller: true };
  }
}

// ---- LA LIGNE QU'IL ÉCRIT DANS LE FIL ----
// Sortante, sans propriétaire (l'assistant ne s'approprie rien — seul
// « 🔁 Confier » le fait), sans `wa_entrant` (elle n'ouvre pas la fenêtre
// de 24 h, ne compte pas comme non lu). `wa_assistant.etape` est SA mémoire :
// c'est là que `decisionAssistant` relit où l'on en est.
export function ligneAssistant({ cle, tel, nom, texte, etape, ts, memoire = null } = {}) {
  return {
    id: `wa-assist-${String(ts || "").replace(/\D/g, "").slice(0, 17) || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: String(ts || "").slice(0, 10), ts: String(ts || ""),
    canal: "whatsapp", wa_tel: cle, wa_numero: String(tel || ""), wa_nom: String(nom || ""),
    wa_entrant: false, de_id: ID_ASSISTANT, de_nom: NOM_ASSISTANT,
    texte: String(texte || ""),
    wa_assistant: { etape, ...(memoire ? { memoire } : {}) },
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
