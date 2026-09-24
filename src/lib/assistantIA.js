// ============================================================
// lib/assistantIA.js — 🤖 L'ASSISTANT QUI DISCUTE (niveau 3, 24/09/2026)
//
// Timo : « L'assistant doit être plus intelligent et interagir avec les
// clients, que de balancer des messages et que le client choisisse des
// numéros. Il doit arriver à discuter comme un humain. » Puis, devant les
// trois décisions : « Lance avec ces trois réponses » — (1) les messages
// des clients peuvent être lus par un service extérieur (la démarche IPDCP
// est de son côté) ; (2) Claude, d'Anthropic ; (3) vouvoiement, français
// simple, « je suis l'assistant de BMI TOGO », jamais se faire passer pour
// une personne.
//
// CE QUE C'EST : le client écrit comme il parle, une intelligence
// artificielle lit la conversation et écrit la réponse. MAIS ELLE N'A PAS
// LE DROIT DE SAVOIR DES CHOSES TOUTE SEULE : tout ce qui est un FAIT vient
// de l'application, par trois « outils » qu'elle appelle et que le serveur
// exécute (`OUTILS_IA` / `executerOutil`) — chercher un article (prix,
// disponible ou sur commande, jamais la quantité), enregistrer une demande
// de devis (une fiche 🧲 Prospects, jamais un devis), passer la main à un
// conseiller. Les règles de Timo du 24/09 sont gravées dans sa consigne
// (`CONSIGNE_IA`) ET revérifiées APRÈS coup sur ce qu'elle a écrit
// (`garderReponse`) : un montant qu'aucun outil n'a donné, un mot sur une
// dette, un texte trop long → la réponse est JETÉE et l'assistant à menu
// (lib/assistantWhatsapp.js) reprend. Jamais un client sans réponse.
//
// ⚠⚠ CE FICHIER NE PARLE PAS AU SERVICE D'IA : il prépare (la consigne,
// les messages, les outils) et il juge (la réponse). L'appel réseau, la clé
// et le nom du modèle vivent dans `api/_assistantIA.js`, côté serveur,
// dans des variables Vercel — jamais ici, jamais dans le navigateur.
//
// ⚠ LE MUR : comme lib/assistantWhatsapp.js, ce fichier ne reçoit JAMAIS
// `db` — des listes déjà filtrées (les articles des boutiques RÉELLES).
// ============================================================
import { NOM_ASSISTANT, SIGNATURE_BMI, LIGNES_MENU, chercherArticles, construireDemandeDevis, ETAPE_CONSEILLER, texteDemandeEnregistree, TEXTE_RELAIS_CONSEILLER } from "./assistantWhatsapp.js";
// L'estimation solaire (24/09/2026, décisions « 1 valeur par défaut, 2 en
// fourchette, 3 solaire ») : la lecture des appareils et le calcul sont
// LES règles de l'application, jamais une copie.
import { lireAppareils } from "./besoinSolaire.js";
import { estimationSolaire, texteEstimation } from "./choixSolaire.js";

// L'étape que porte une ligne écrite par l'IA : la mémoire est le fil
// lui-même, il n'y a pas de « menu » ni de « produit » à retenir.
export const ETAPE_IA = "ia";
export const MAX_TOURS_OUTILS = 4;       // au plus 4 allers-retours d'outils par réponse
export const MAX_MESSAGES_MEMOIRE = 24;  // les 24 dernières lignes du fil, pas plus
export const MAX_LONGUEUR_REPONSE = 1500;
export const MAX_TOKENS_REPONSE = 600;

// ---- LA PHRASE DE PRÉSENTATION D'UNE NOUVELLE CONVERSATION ----
// Posée PAR LE SERVEUR devant la première réponse (jamais confiée à l'IA,
// qui pourrait l'oublier). TEXTE DE TIMO, MOT POUR MOT (24/09/2026, « dis
// plutôt… »). Elle dit qui parle — un assistant VIRTUEL, jamais une personne
// (sa décision 3) — et la porte « conseiller ».
// ⚠ La mention « vos messages sont lus par un service situé hors du Togo »
// a été RETIRÉE à sa demande le même soir (« je ne veux pas le texte de
// traité hors du Togo »), après qu'on lui a rappelé que c'était sa décision
// du matin. La démarche IPDCP est de son côté. Ne pas la remettre sans lui.
export const PHRASE_PRESENTATION = "👋 Bonjour et bienvenue chez BMI TOGO !\n\n🤖 Je suis l’assistant virtuel de BMI TOGO, conçu pour vous renseigner et vous orienter.\n\n👤 À tout moment, écrivez « conseiller » pour parler directement à un membre de notre équipe.\n\nComment puis-je vous aider aujourd’hui ?";
// Quand l'IA touche à un sujet qui lui est fermé (dette, crédit, compte),
// on ne cherche pas à reformuler : une phrase fixe, et une personne.
export const REPONSE_SUJET_RESERVE = `Pour tout ce qui concerne un paiement, un règlement ou votre compte client, un conseiller BMI TOGO vous répond sur ce numéro. Vous pouvez aussi consulter votre espace client sur gestion.bmitogo.com.\n\n${SIGNATURE_BMI}`;

// ---- LA CONSIGNE (le « system prompt ») ----
const activites = LIGNES_MENU.filter((l) => l.activite).map((l) => `- ${l.titre}${l.detail ? ` : ${l.detail}` : ""}`).join("\n");
export const CONSIGNE_IA = `Tu es « ${NOM_ASSISTANT} », l'assistant virtuel de BMI TOGO (Les bâtiments modernes et intelligents), une entreprise de Lomé, au Togo. Tu réponds aux clients qui écrivent au numéro WhatsApp de BMI TOGO.

QUI TU ES
- Tu es un programme, pas une personne. Tu ne te fais JAMAIS passer pour un employé, un conseiller ou un humain. Si on te le demande, tu dis que tu es l'assistant virtuel de BMI TOGO.
- Tu vouvoies toujours. Tu écris en français simple, en phrases courtes, comme dans une conversation WhatsApp : 2 à 6 lignes, sans jargon, un emoji au plus.
- Tu ne te présentes pas toi-même : le serveur ajoute la phrase de présentation au début d'une nouvelle conversation. Réponds directement.

CE QUE FAIT BMI TOGO
${activites}
- 🛒 Vente de produits et d'équipements (prix, disponibilité, caractéristiques) — par l'outil chercher_article.
- 🧾 Devis, établis par un vendeur de BMI TOGO — tu enregistres la DEMANDE par l'outil enregistrer_demande_devis.
- ☀️ Pour le solaire seulement, une ESTIMATION indicative en fourchette — par l'outil estimer_solaire.
- 🔧 SAV et assistance technique, et 👨‍💼 conseillers — par l'outil passer_conseiller.

CE QUE TU AS LE DROIT DE DIRE
- Le prix, la disponibilité (« disponible » ou « sur commande ») et les caractéristiques d'un article, UNIQUEMENT tels que l'outil chercher_article te les donne. Tu recopies le prix exactement, tu ne l'arrondis pas, tu ne le convertis pas.
- Présenter les activités de BMI TOGO avec les mots ci-dessus.
- Poser des questions pour comprendre le besoin (appareils à alimenter, heures d'utilisation, ville ou quartier) avant d'enregistrer une demande de devis.
- Dire que tu ne sais pas, et proposer un conseiller.

CE QUE TU NE DIS JAMAIS
- Un prix, un délai, une garantie, une caractéristique technique ou une quantité en stock que l'outil ne t'a pas donnés. Tu n'inventes RIEN. Sans outil, tu dis que tu ne sais pas et tu proposes un conseiller.
- Le nombre exact d'articles en stock : seulement « disponible » ou « sur commande ».
- Une dette, un crédit, un solde, un montant dû, un mot de passe, un identifiant : tu ne connais pas les comptes des clients. Tu renvoies à l'espace client (gestion.bmitogo.com) et tu proposes un conseiller par l'outil passer_conseiller.
- Un devis chiffré, une promesse d'installation, une remise, une date : seul un vendeur de BMI TOGO s'engage. Tu enregistres la demande, une personne rappelle.
- Une opinion sur un concurrent, une information sur un autre client, un avis médical, juridique ou financier.

COMMENT TU T'Y PRENDS
- Pour un article : appelle chercher_article avec les mots utiles (par exemple « panneau 400 », « batterie lithium ») et réponds avec ce qu'il rend. S'il ne trouve rien, dis-le et propose un autre nom ou un conseiller.
- Pour une installation SOLAIRE, quand le client a décrit ses appareils (lesquels, combien, combien d'heures par jour) : appelle estimer_solaire avec SES mots. Si l'outil rend une estimation, recopie sa phrase telle quelle, sans changer un seul chiffre et SANS guillemets autour (elle fait partie de ta réponse, ce n'est pas une citation), puis propose d'enregistrer une demande de devis. Si l'outil refuse (heures ou puissance manquantes, stock insuffisant), pose la question qu'il indique ou propose un conseiller — ne donne aucun chiffre. Jamais d'estimation pour le garage, la domotique, la VMC ou un produit seul.
- Une estimation n'est JAMAIS un devis : tu dis toujours qu'elle est indicative et qu'un conseiller confirme le prix exact.
- Pour un devis : quand tu connais le besoin (et le nom du client si l'outil te dit qu'il est inconnu), appelle enregistrer_demande_devis. Ensuite dis que la demande est enregistrée et qu'un conseiller rappelle sur ce numéro.
- Pour un problème technique, une réclamation, une question d'argent, ou dès que le client demande une personne : appelle passer_conseiller, puis dis qu'un conseiller BMI TOGO prend le relais sur ce numéro.
- Une photo, un document ou un message vocal : tu ne peux pas les lire ; dis-le et appelle passer_conseiller.
- Si le client écrit dans une autre langue, réponds simplement en français.
- Tu réponds au dernier message du client, en tenant compte de ce qui a été dit avant dans la conversation.`;

// Un mot sur le client, quand on le connaît — ajouté à la consigne.
export const consignePour = ({ client = null } = {}) =>
  client?.nom
    ? `${CONSIGNE_IA}\n\nLE CLIENT : il s'appelle ${client.nom} et a un compte chez BMI TOGO (tu peux l'appeler par son nom). Pour une demande de devis, son nom est connu : ne le redemande pas.`
    : `${CONSIGNE_IA}\n\nLE CLIENT : ce numéro n'a pas de compte chez BMI TOGO, son nom est inconnu. Pour une demande de devis, demande-lui son nom avant d'enregistrer.`;

// ---- LES OUTILS (ce que l'IA a le droit de FAIRE, et rien d'autre) ----
export const OUTILS_IA = [
  {
    name: "chercher_article",
    description: "Cherche des articles dans le stock des boutiques BMI TOGO par leur nom (marque, puissance, catégorie). Rend pour chacun : nom, catégorie, boutique, prix en francs CFA, disponible (true) ou sur commande (false), tension. Ne rend jamais la quantité en stock.",
    input_schema: {
      type: "object",
      properties: { recherche: { type: "string", description: "Les mots utiles, par exemple « panneau 400 » ou « batterie lithium »" } },
      required: ["recherche"],
    },
  },
  {
    name: "enregistrer_demande_devis",
    description: "Enregistre une demande de devis pour ce client dans l'application BMI TOGO. Un vendeur la reprend et rappelle le client. À appeler une seule fois, quand le besoin est décrit (et le nom connu).",
    input_schema: {
      type: "object",
      properties: {
        nom: { type: "string", description: "Le nom du client (vide si le client est déjà connu)" },
        besoin: { type: "string", description: "Le besoin, avec les mots du client : appareils, heures d'utilisation, lieu, type de projet" },
      },
      required: ["besoin"],
    },
  },
  {
    name: "estimer_solaire",
    description: "Pour une installation solaire uniquement : calcule avec les règles et le stock de BMI TOGO une estimation INDICATIVE en fourchette (nombre de panneaux, batteries, convertisseur, prix entre X et Y, pose comprise). Donner les mots du client tels quels : appareils, quantités, puissance si connue, heures d'utilisation par jour. Refuse s'il manque une puissance ou des heures, et dit quoi demander.",
    input_schema: {
      type: "object",
      properties: { description: { type: "string", description: "Les appareils décrits par le client, avec ses mots : « 2 clims 1,5 CV 8 h par jour, 10 ampoules toute la nuit, un congélateur 24 h sur 24 »" } },
      required: ["description"],
    },
  },
  {
    name: "passer_conseiller",
    description: "Passe la main à une personne de BMI TOGO sur ce numéro : conseiller commercial, SAV / technicien, question sur un paiement ou un compte, photo ou vocal à regarder. Après cet appel, l'assistant se tait et une personne répond.",
    input_schema: {
      type: "object",
      properties: {
        motif: { type: "string", description: "En quelques mots, pourquoi une personne doit prendre le relais" },
        type: { type: "string", enum: ["conseiller", "sav", "paiement"], description: "conseiller : commercial ; sav : panne ou technique ; paiement : argent, dette, compte" },
      },
      required: ["motif", "type"],
    },
  },
];

// ---- LA MÉMOIRE : le fil, dans la forme que le service attend ----
// Le message du client → « user » ; tout ce que BMI a écrit (une personne,
// un modèle parti de l'application, l'assistant) → « assistant ». Deux
// lignes de suite du même côté sont réunies ; le premier message doit
// venir du client, le dernier aussi. Une photo ou un vocal devient un mot
// entre crochets : l'IA ne les lit pas, elle doit le savoir.
export function messagesPourIA(fil, { max = MAX_MESSAGES_MEMOIRE } = {}) {
  const lignes = (Array.isArray(fil) ? fil : []).filter((m) => m && !m.wa_systeme && m.canal !== "whatsapp_entete").slice(-max);
  const texteDe = (m) => {
    const t = String(m.texte || "").trim();
    if (m.wa_media && !t) return `[${m.wa_media.type === "image" ? "photo" : m.wa_media.type === "audio" ? "message vocal" : m.wa_media.type === "video" ? "vidéo" : "document"} envoyé par le client — non lisible]`;
    return t;
  };
  const suite = [];
  for (const m of lignes) {
    const role = m.wa_entrant ? "user" : "assistant";
    const t = texteDe(m);
    if (!t) continue;
    const dernier = suite[suite.length - 1];
    if (dernier && dernier.role === role) dernier.content += `\n${t}`;
    else suite.push({ role, content: t });
  }
  while (suite.length && suite[0].role !== "user") suite.shift();
  while (suite.length && suite[suite.length - 1].role !== "user") suite.pop();
  return suite;
}

// ---- EXÉCUTER UN OUTIL — le serveur appelle ceci, la règle décide ----
// `contexte` : { articles (boutiques réelles, déjà préparés), client, cle,
// tel, ts }. Rend { resultat (texte rendu à l'IA), effets }.
//   effets : { prix: [..] (les montants qu'elle a le droit de citer),
//              demandeDevis: {nom, besoin} | null, conseiller: bool, type }
export function executerOutil(nom, entree = {}, contexte = {}) {
  const e = entree || {};
  if (nom === "chercher_article") {
    const trouves = chercherArticles(contexte.articles || [], String(e.recherche || ""));
    return {
      resultat: trouves.length
        ? JSON.stringify(trouves.map((a) => ({ nom: a.nom, categorie: a.categorie, boutique: a.boutique, prix_fcfa: a.prix, disponible: a.disponible, tension: a.tension })))
        : "Aucun article trouvé pour cette recherche. Ne pas inventer de prix : proposer un autre nom ou un conseiller.",
      effets: { prix: trouves.map((a) => a.prix), demandeDevis: null, conseiller: false },
    };
  }
  if (nom === "enregistrer_demande_devis") {
    const nomClient = String(contexte.client?.nom || e.nom || "").trim();
    const besoin = String(e.besoin || "").trim();
    if (!besoin) return { resultat: "Refusé : le besoin est vide. Demander au client ce qu'il veut installer ou alimenter.", effets: { prix: [], demandeDevis: null, conseiller: false } };
    if (!nomClient) return { resultat: "Refusé : le nom du client est inconnu. Le lui demander, puis rappeler cet outil avec le nom.", effets: { prix: [], demandeDevis: null, conseiller: false } };
    return {
      resultat: `Demande enregistrée au nom de ${nomClient}. Dire au client qu'un conseiller BMI TOGO le rappelle sur ce numéro. Ne pas donner de prix ni de délai.`,
      effets: { prix: [], demandeDevis: { nom: nomClient, besoin }, conseiller: true, type: "devis" },
    };
  }
  if (nom === "estimer_solaire") {
    const description = String(e.description || "").trim();
    const appareils = lireAppareils(description, contexte.catalogue || []);
    const inconnus = appareils.filter((a) => !a.reconnu).map((a) => a.nom);
    const est = estimationSolaire(appareils, contexte.boutiquesSolaire || []);
    if (!est.ok) {
      return {
        resultat: `Pas d'estimation. ${est.motif}${inconnus.length ? ` Appareils non reconnus : ${inconnus.join(", ")}.` : ""} Ne donner AUCUN chiffre.`,
        effets: { prix: [], demandeDevis: null, conseiller: false },
      };
    }
    const phrase = texteEstimation(est);
    return {
      resultat: `Estimation calculée par l'application. Recopier cette phrase telle quelle, sans changer un chiffre : « ${phrase} » Puis proposer d'enregistrer une demande de devis.`,
      effets: { prix: [est.bas, est.haut], demandeDevis: null, conseiller: false, estimation: { bas: est.bas, haut: est.haut, texte: phrase, appareils: description } },
    };
  }
  if (nom === "passer_conseiller") {
    const type = ["conseiller", "sav", "paiement"].includes(e.type) ? e.type : "conseiller";
    return {
      resultat: `Une personne de BMI TOGO prend le relais (${type}). Dire au client qu'un conseiller lui répond sur ce numéro, sans rien promettre d'autre.`,
      effets: { prix: [], demandeDevis: null, conseiller: true, type },
    };
  }
  return { resultat: `Outil inconnu : ${nom}.`, effets: { prix: [], demandeDevis: null, conseiller: false } };
}

// ---- LE JUGE : ce que l'IA a écrit passe-t-il ? ----
// On ne se fie pas à la consigne : on VÉRIFIE. Rend { ok, motif }.
//   • vide → non ;
//   • trop long → non (WhatsApp n'est pas une lettre) ;
//   • un sujet fermé (dette, crédit, solde, mot de passe, identifiant) →
//     non, motif « sujet réservé » (le serveur envoie REPONSE_SUJET_RESERVE
//     et passe la main) ;
//   • un montant en francs qu'AUCUN outil n'a donné → non : un prix inventé
//     est une faute au nom de BMI.
// ⚠ Pas de `\b` : en JavaScript il ne connaît que les lettres ASCII, et
// « dû » finit par une lettre accentuée — « montant dû » passait au travers.
export const MOTS_INTERDITS_IA = /(?<![a-zà-ÿ])(dette|dettes|cr[ée]dit|cr[ée]dits|solde|soldes|mot de passe|identifiant|identifiants|montant d[ûu])(?![a-zà-ÿ])/i;
// ⚠ 24/09/2026, trouvé en ajoutant l'estimation : « 5,5 millions de francs »
// ou « 500 mille » n'étaient PAS lus comme des montants — l'IA aurait pu
// écrire un prix inventé sous cette forme sans que le juge le voie. Un
// nombre suivi de « million(s) » ou de « mille » est un montant, avec ou sans
// le mot francs derrière.
const ESPACES = /[\s\u00a0\u202f]/g;
export function montantsCites(texte) {
  const out = [];
  const t = String(texte || "");
  const pris = [];
  const reGrand = /(\d+(?:[.,]\d+)?)\s*(millions?|mille)(?![a-zà-ÿ])/gi;
  let m;
  while ((m = reGrand.exec(t))) {
    const n = Number(m[1].replace(",", ".")) * (/^million/i.test(m[2]) ? 1e6 : 1e3);
    if (Number.isFinite(n)) { out.push(Math.round(n)); pris.push([m.index, m.index + m[0].length]); }
  }
  const re = /(\d[\d\s\u00a0\u202f.,]*)\s*(?:F\b|FCFA|F\s*CFA|francs?)/gi;
  while ((m = re.exec(t))) {
    const debut = m.index;
    if (pris.some(([a, b]) => debut >= a && debut < b)) continue;
    const n = Number(m[1].replace(ESPACES, "").replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n)) out.push(Math.round(n));
  }
  return out;
}
export function garderReponse(texte, { prixConnus = [] } = {}) {
  const t = String(texte || "").trim();
  if (!t) return { ok: false, motif: "réponse vide" };
  if (t.length > MAX_LONGUEUR_REPONSE) return { ok: false, motif: "réponse trop longue" };
  if (MOTS_INTERDITS_IA.test(t)) return { ok: false, motif: "sujet réservé", reserve: true };
  const connus = new Set((prixConnus || []).map((p) => Math.round(Number(p) || 0)));
  const inconnu = montantsCites(t).find((n) => !connus.has(n));
  if (inconnu !== undefined) return { ok: false, motif: `montant non donné par un outil : ${inconnu} F` };
  return { ok: true, motif: "" };
}

// ---- LA CONVERSATION AVEC LE SERVICE, tour par tour ----
// `appeler(corps)` est fourni par le serveur (api/_assistantIA.js) — ou par
// le banc, qui joue le service. `executer(nom, entree)` rend
// { resultat, effets } (en général `executerOutil` avec le contexte).
// Rend { texte, effets: { prix, demandeDevis, conseiller, type }, tours }.
// ⚠ Bornée : au-delà de MAX_TOURS_OUTILS allers-retours, on s'arrête avec
// ce qu'on a — un service qui boucle ne doit jamais coûter sans fin.
export async function converserAvecIA({ consigne, messages, appeler, executer, outils = OUTILS_IA, maxTokens = MAX_TOKENS_REPONSE } = {}) {
  const suite = [...(messages || [])];
  const effets = { prix: [], demandeDevis: null, conseiller: false, type: "", estimation: null };
  let texte = "";
  let tours = 0;
  if (!suite.length || suite[suite.length - 1].role !== "user") return { texte: "", effets, tours, motif: "rien du client" };
  for (;;) {
    const reponse = await appeler({ system: consigne, messages: suite, tools: outils, max_tokens: maxTokens });
    const blocs = Array.isArray(reponse?.content) ? reponse.content : [];
    const textes = blocs.filter((b) => b.type === "text").map((b) => String(b.text || "").trim()).filter(Boolean);
    const appels = blocs.filter((b) => b.type === "tool_use");
    if (textes.length) texte = textes.join("\n");
    if (!appels.length || reponse.stop_reason !== "tool_use") break;
    if (tours >= MAX_TOURS_OUTILS) break;
    tours++;
    suite.push({ role: "assistant", content: blocs });
    const resultats = [];
    for (const a of appels) {
      const r = await executer(a.name, a.input || {});
      resultats.push({ type: "tool_result", tool_use_id: a.id, content: String(r?.resultat || "") });
      const ef = r?.effets || {};
      if (Array.isArray(ef.prix)) effets.prix.push(...ef.prix);
      if (ef.demandeDevis && !effets.demandeDevis) effets.demandeDevis = ef.demandeDevis;
      if (ef.estimation) effets.estimation = ef.estimation;
      if (ef.conseiller) { effets.conseiller = true; effets.type = ef.type || effets.type || "conseiller"; }
    }
    suite.push({ role: "user", content: resultats });
  }
  return { texte, effets, tours };
}

// L'étape à écrire sur la ligne : conseiller (silence ensuite), sinon « ia ».
export const etapeApresIA = (effets) => (effets?.conseiller ? ETAPE_CONSEILLER : ETAPE_IA);

// Une NOUVELLE conversation (rien de BMI depuis 24 h : `decisionAssistant`
// rend l'étape null) reçoit la présentation devant la réponse.
export const avecPresentation = (texte, { nouvelle }) => (nouvelle ? `${PHRASE_PRESENTATION}\n\n${texte}` : texte);
export const conversationNouvelle = (decision) => !decision || decision.etape === null || decision.etape === undefined;

// ---- CE QU'ON ENVOIE, D'APRÈS LE VERDICT DU JUGE ----
// Rend la réponse à envoyer { texte, etape, conseiller, demandeDevis, ia,
// repli? } — ou null : rien d'utilisable, le menu reprend.
//   • jugée bonne → telle quelle ;
//   • sujet réservé → la phrase fixe, et une personne ;
//   • jetée MAIS un outil a enregistré une demande de devis / passé la main
//     → la phrase fixe du menu (rien de ce qui a été FAIT n'est perdu, et
//       rien de ce qui a été DIT de travers ne part).
// L'estimation se lit comme une phrase de la réponse, pas comme une citation
// (Timo, 24/09/2026 : « retire les guillemets ») : si l'IA l'a quand même
// mise entre « … » ou "…", on retire les guillemets — la phrase elle-même
// ne bouge pas d'un caractère. Filet derrière la consigne, qui le demande.
export function sansGuillemetsAutour(texte, phrase) {
  const t = String(texte || "");
  const p = String(phrase || "").trim();
  if (!p) return t;
  // Les espaces (normales, insécables, fines) se valent : l'IA recopie
  // souvent « 3 300 000 » avec des espaces ordinaires.
  const echap = p.split(/[\s\u00a0\u202f]+/).map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\u00a0\\u202f]+");
  return t.replace(new RegExp(`(?:«\\s*|"|\u201c)(${echap})(?:\\s*»|"|\u201d)`, "g"), "$1");
}

export function reponseDepuisIA({ texte, effets, juge, nouvelle }) {
  const ef = effets || { prix: [], demandeDevis: null, conseiller: false };
  // L'estimation part avec la réponse (le serveur la range sur la ligne, pour
  // la retrouver sur la fiche 🧲 Prospects) — seulement si la réponse est
  // celle que l'IA a écrite : une phrase fixe ne la cite pas.
  const pose = (t, etape, conseiller, repli) => ({ texte: avecPresentation(t, { nouvelle }), etape, conseiller, demandeDevis: ef.demandeDevis || null, ia: true, ...(repli ? { repli } : {}), ...(!repli && ef.estimation ? { estimation: ef.estimation } : {}) });
  if (juge?.ok) return pose(sansGuillemetsAutour(texte, ef.estimation?.texte), etapeApresIA(ef), !!ef.conseiller, "");
  if (juge?.reserve) return pose(REPONSE_SUJET_RESERVE, ETAPE_CONSEILLER, true, juge.motif);
  if (ef.demandeDevis) return pose(texteDemandeEnregistree(ef.demandeDevis.nom), ETAPE_CONSEILLER, true, juge?.motif || "");
  if (ef.conseiller) return pose(TEXTE_RELAIS_CONSEILLER, ETAPE_CONSEILLER, true, juge?.motif || "");
  return null;
}

// La fiche 🧲 Prospects d'une demande enregistrée par l'IA : la MÊME
// fabrique que l'assistant à menu (une seule forme de fiche).
// L'estimation donnée au client (même tour, ou plus tôt dans le fil) suit
// sur la fiche : le vendeur doit savoir quel chiffre le client a en tête.
export const demandeDevisIA = ({ cle, tel, demandeDevis, ts, estimation = null }) => ({
  ...construireDemandeDevis({ cle, tel, nom: demandeDevis.nom, besoin: demandeDevis.besoin, ts }),
  ...(estimation ? { estimation_assistant: { bas: estimation.bas, haut: estimation.haut, texte: estimation.texte, le: String(ts || "").slice(0, 10) } } : {}),
});
// La dernière estimation donnée dans le fil (lignes de l'assistant).
export const derniereEstimation = (fil) => {
  const l = [...(fil || [])].reverse().find((m) => m && m.wa_assistant && m.wa_assistant.memoire && m.wa_assistant.memoire.estimation);
  return l ? l.wa_assistant.memoire.estimation : null;
};

// ---- LE RÉGLAGE : conversation par IA, ou menu à chiffres ----
// Une POLITIQUE sur les boutiques (`assistant_wa_mode`), comme `assistant_wa`.
// « ia » tant que personne n'a choisi le menu ; sans clé côté serveur, le
// menu reprend de lui-même.
export const MODES_ASSISTANT = ["ia", "menu"];
export const modeAssistant = (boutiques) => {
  const b = (boutiques || []).find((x) => x && MODES_ASSISTANT.includes(x.assistant_wa_mode));
  return b ? b.assistant_wa_mode : "ia";
};
export const poserModeAssistant = (boutiques, mode) => (boutiques || []).map((b) => ({ ...b, assistant_wa_mode: MODES_ASSISTANT.includes(mode) ? mode : "ia" }));
