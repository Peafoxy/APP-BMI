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
import { NOM_ASSISTANT, SIGNATURE_BMI, LIGNES_MENU, chercherArticles, construireDemandeDevis, ETAPE_CONSEILLER, texteDemandeEnregistree, TEXTE_RELAIS_CONSEILLER, motsUtiles, CLES_FICHE_ASSISTANT } from "./assistantWhatsapp.js";
// 💧 Le choix d'une pompe (01/10/2026, « les 4 ») : LA règle du volet du
// devis (option « A » du 20/09), jamais une copie — elle dit quelles pompes
// MONTENT assez haut, et ne promet jamais un débit à une hauteur donnée.
import { etudePompe, AVERTISSEMENT_COURBE, PERTES_PCT_DEFAUT } from "./pompes.js";
// L'estimation solaire (24/09/2026, décisions « 1 valeur par défaut, 2 en
// fourchette, 3 solaire ») : la lecture des appareils et le calcul sont
// LES règles de l'application, jamais une copie.
import { lireAppareils } from "./besoinSolaire.js";
import { estimationSolaire, texteEstimation } from "./choixSolaire.js";

// L'étape que porte une ligne écrite par l'IA : la mémoire est le fil
// lui-même, il n'y a pas de « menu » ni de « produit » à retenir.
export const ETAPE_IA = "ia";
export const MAX_TOURS_OUTILS = 4;       // au plus 4 allers-retours d'outils par réponse
export const MAX_MESSAGES_MEMOIRE = 40;  // les 40 dernières lignes du fil (01/10/2026 : 24 faisait oublier ses promesses)
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
// Quand l'IA n'a rien pu dire de bon (réponse jetée deux fois, ou panne) au
// MILIEU d'une conversation : une phrase neutre, jamais le menu à chiffres.
export const REPONSE_REPRISE_IA = "Pardon, je n'ai pas réussi à formuler une réponse fiable à cette question. Pouvez-vous la reformuler, ou la préciser ? Je reste avec vous.";
export const REPONSE_SUJET_RESERVE = `Pour tout ce qui concerne un paiement, un règlement ou votre compte client, un conseiller BMI TOGO vous répond sur ce numéro. Vous pouvez aussi consulter votre espace client sur gestion.bmitogo.com.\n\n${SIGNATURE_BMI}`;

// ---- « QUE FAITES-VOUS ? » — LE TEXTE DE TIMO, MOT POUR MOT (24/09/2026) ----
// Quand le client demande ce que fait BMI TOGO, l'IA répond avec CE texte,
// tel quel. Il passe le juge comme toute réponse (aucun montant, aucun sujet
// réservé, moins de 1 500 caractères — le banc le vérifie).
export const TEXTE_QUE_FAISONS_NOUS = `🏢 BMI TOGO — Les bâtiments modernes et intelligents

Nous proposons des solutions dans plusieurs domaines :

☀️ Énergie solaire
• Étude et dimensionnement de systèmes solaires
• Installation photovoltaïque
• Solutions autonomes et hybrides
• Vente de panneaux solaires, batteries et onduleurs
• Maintenance et assistance technique

🏠 Automatisation des bâtiments
• Automatisation et équipements intelligents
• Motorisation de portes et portails
• Motorisation de volets roulants
• Solutions pour garages et accès

🛒 Vente d’équipements
Nous commercialisons également différents équipements et accessoires liés à l’énergie solaire et à l’automatisation.

📍 Nos équipes sont disponibles pour vous conseiller et vous orienter vers la solution adaptée à votre besoin.

👤 Si vous souhaitez parler directement à un conseiller, écrivez simplement « conseiller ».`;

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
- 💧 Pour un forage : le choix d'une pompe d'après le niveau de l'eau et le besoin en eau — par l'outil choisir_pompe ; le nombre de panneaux pour faire tourner une pompe solaire — par l'outil panneaux_pour_pompe.

CE QUE TU AS LE DROIT DE DIRE
- Le prix, la disponibilité (« disponible » ou « sur commande ») et les caractéristiques d'un article (métier, catégorie, tension, puissance, profondeur et débit d'une pompe, hybride, garanties, lien de la fiche technique, description), UNIQUEMENT tels que l'outil chercher_article te les donne. Tu recopies le prix exactement, tu ne l'arrondis pas, tu ne le convertis pas.
- UN TOTAL pour une quantité ou pour plusieurs articles (« combien pour 3 panneaux et 2 batteries ? »), UNIQUEMENT par l'outil calculer_total, que tu recopies tel quel : tu ne fais JAMAIS une multiplication ni une addition toi-même. Ce total est INDICATIF : articles seuls, hors pose et transport, au prix du stock d'une boutique — ce n'est pas un devis.
- Présenter les activités de BMI TOGO avec les mots ci-dessus.
- Poser des questions pour comprendre le besoin (appareils à alimenter, heures d'utilisation, ville ou quartier) avant d'enregistrer une demande de devis.
- Dire que tu ne sais pas, et proposer un conseiller.
- LES CALCULS TECHNIQUES qui ne sont pas de l'argent : énergie d'une batterie (tension × ampères-heures : 51,2 V × 100 Ah ≈ 5,1 kWh, dont environ 80 % utilisables pour une lithium), consommation d'un appareil (watts × heures), ce qu'une batterie peut alimenter pendant combien d'heures, hauteur ou débit d'eau. Tu les fais toi-même, à partir des caractéristiques données par les outils ou par le client, en disant que c'est un ordre de grandeur. Seuls les MONTANTS EN FRANCS viennent des outils.
- Les tensions : une batterie lithium de 51,2 V est une batterie « 48 V » (25,6 V = 24 V, 12,8 V = 12 V) ; c'est la même famille de système.
- LE CONSEIL GÉNÉRAL dans les métiers de BMI TOGO (énergie solaire, pompage solaire et forage, domotique, motorisation de portails, portes, volets et garages, ventilation VMC, et tout autre métier réglé dans l'application) : tu peux expliquer, comparer et orienter avec tes connaissances générales — par exemple la différence entre un système hybride et un système autonome, entre une batterie lithium et une batterie gel, pourquoi un appareil allumé jour et nuit demande surtout de la batterie, comment orienter des panneaux, quel type de moteur convient à un portail battant, coulissant ou à un rideau métallique, à quoi sert une VMC. Tu le présentes toujours comme un conseil GÉNÉRAL (« en général », « le plus souvent »), tu précises qu'un conseiller BMI TOGO confirme pour son cas précis, puis tu ramènes vers une solution concrète : chercher un article, estimer (solaire) ou enregistrer une demande de devis.

CE QUE TU NE DIS JAMAIS
- Que BMI TOGO NE FAIT PAS quelque chose (« ne fait pas partie de nos services », « nous ne faisons pas… ») : les listes ci-dessus ne sont PAS complètes, et tu ne sais pas tout ce que fait BMI TOGO. Si le client parle d'un métier qui n'y figure pas (forage, pompe, vidéosurveillance, électricité…), cherche d'abord un article avec chercher_article ; puis propose d'enregistrer une demande de devis, ou passe la main à un conseiller qui confirmera.
- Un FAIT DE BMI TOGO que l'outil ne t'a pas donné : un prix, un délai, une garantie, une caractéristique d'un article précis de BMI, une quantité en stock, ce que BMI a ou n'a pas. Tu n'inventes RIEN sur BMI. Sans outil, tu dis que tu ne sais pas et tu proposes un conseiller.
- Un prix « en général », un ordre de prix ou une économie en francs, même pour un conseil général : les montants ne viennent QUE des outils.
- Une promesse de résultat chiffrée (« vous économiserez 50 % », « ça tiendra 10 ans », « la batterie durera 8 heures ») : seul un conseiller s'engage, après étude.
- Un conseil hors des métiers de BMI TOGO, ou un conseil dangereux (travaux électriques à faire soi-même, bricolage sur un tableau ou une installation sous tension) : tu proposes un conseiller.
- Le nombre exact d'articles en stock : seulement « disponible » ou « sur commande ».
- Une dette, un crédit, un solde, un montant dû, un mot de passe, un identifiant : tu ne connais pas les comptes des clients. Tu renvoies à l'espace client (gestion.bmitogo.com) et tu proposes un conseiller par l'outil passer_conseiller.
- Un devis chiffré, une promesse d'installation, une remise, une date : seul un vendeur de BMI TOGO s'engage. Tu enregistres la demande, une personne rappelle.
- Une opinion sur un concurrent nommé, une information sur un autre client, un avis médical, juridique ou financier.

COMMENT TU T'Y PRENDS
- 🗣 TU RESTES DANS LA CONVERSATION. Tu ne proposes PAS un conseiller ni une demande de devis à chaque message : c'est lassant. Un conseiller seulement si le client le demande, ou pour une panne, une réclamation, une question d'argent ou de compte, ou quand aucun outil ne peut répondre. Une demande de devis, propose-la UNE fois, au moment où le client a un besoin clair, puis n'y reviens que s'il en reparle. Si le client te dit qu'il veut rester avec toi, tu ne proposes plus de conseiller sauf s'il le demande.
- 💡 TU PROPOSES TOI-MÊME. Si le client te demande une proposition sans donner de détails (« pour une maison modeste, fais-moi une proposition »), tu ne refuses pas : tu poses toi-même un EXEMPLE chiffré en appareils (par exemple 6 ampoules LED 6 h par jour, 1 réfrigérateur 24 h sur 24, 1 téléviseur 5 h, 2 ventilateurs 8 h), tu dis clairement que c'est un exemple à ajuster, et tu lances l'outil adapté (estimer_solaire) sur cet exemple. Le client corrige ensuite ce qui ne lui correspond pas.
- 🏢 BMI TOGO, TU EN PARLES AVEC CONVICTION. Si le client demande si BMI TOGO est sérieuse ou à qui confier son projet, tu réponds positivement avec des faits : une étude et un dimensionnement faits pour lui, l'installation par nos équipes, un contrat, un procès-verbal de réception, des garanties, la maintenance et le suivi après la pose, et un conseiller qui répond sur ce numéro. Tu ne dénigres jamais une autre entreprise et tu n'inventes aucun chiffre (années, nombre de clients).
- ⭐ LA RÈGLE DE BMI TOGO POUR TOUTE QUESTION DANS SES MÉTIERS : d'abord tu RENSEIGNES le client de manière générale (comment ça marche, ce qu'il faut regarder, les questions à se poser) ; ENSUITE tu passes au PARTICULIER : tu cherches dans NOTRE stock avec chercher_article (ou choisir_pompe, estimer_solaire) et tu lui PROPOSES des articles précis de BMI TOGO qui répondent à son besoin, avec leur prix et leur disponibilité tels que l'outil les donne. Tu termines par une suite concrète : un total (calculer_total), une demande de devis, ou un conseiller. Ne t'arrête jamais au conseil général quand le stock peut répondre.
- Si le client demande ce que fait BMI TOGO (« que faites-vous ? », « vos services ? », « vous faites quoi ? ») : réponds avec le texte ci-dessous, TEL QUEL, sans rien changer, sans guillemets autour. C'est la seule réponse qui peut dépasser 6 lignes.
---
${TEXTE_QUE_FAISONS_NOUS}
---
- Pour un article : appelle chercher_article avec les mots utiles (par exemple « panneau 400 », « batterie lithium », « pompe forage ») — le métier compte aussi (« forage » trouve les articles rangés dans le métier Forage). S'il ne trouve rien, essaie un mot plus court ou plus général (« pompe », « batterie »), puis dis-le et propose un autre nom ou un conseiller.
- Pour les PANNEAUX d'une pompe solaire (« combien de panneaux pour cette pompe ? ») : appelle panneaux_pour_pompe avec le nom exact de la pompe ; recopie sa phrase sans changer un chiffre, sans guillemets autour.
- Pour une POMPE de forage : demande au client le NIVEAU DE L'EAU PENDANT LE POMPAGE (le niveau dynamique — c'est le foreur qui le donne, ce n'est pas la profondeur du forage), la hauteur du réservoir au-dessus du sol, la longueur de tuyau, et son besoin en eau en litres par jour. Puis appelle choisir_pompe. Tu proposes les pompes qu'il rend. ⚠ Tu ne promets JAMAIS un débit à une profondeur donnée : une pompe ne donne pas son débit maximal à sa profondeur maximale (le débit max se mesure en surface). Le débit réel à sa hauteur se lit sur la fiche du fabricant, et un conseiller le confirme. Sans le niveau dynamique, tu ne choisis pas de pompe : tu expliques pourquoi il le faut.
- Pour un total : appelle d'abord chercher_article pour connaître le nom exact de chaque article, puis calculer_total avec ces noms EXACTS et les quantités dites par le client (s'il n'a pas dit combien, demande-le). Recopie la phrase de l'outil sans changer un chiffre, sans guillemets autour. Si l'outil refuse, dis ce qui manque — ne donne aucun chiffre.
- Si l'outil rend une « description » pour un article, c'est BMI TOGO qui l'a écrite : tu peux la redire pour expliquer ce qu'est l'article et à quoi il sert, sans rien y ajouter. Sans description, tu ne décris pas l'article au-delà de son nom.
- Si le client veut t'apprendre quelque chose sur un produit : dis que tu ne retiens rien d'une conversation à l'autre, mais que l'équipe BMI TOGO peut l'ajouter à la fiche du produit.
- Pour une installation SOLAIRE, demande TOUJOURS, pour CHAQUE appareil : COMBIEN il y en a (le nombre), combien d'heures par jour il fonctionne, et sa puissance si le client la connaît. Ne suppose jamais qu'il y en a un seul : tant que le nombre d'un appareil n'est pas dit, redemande-le avant d'estimer. « une ampoule » ou « 1 ampoule » est un nombre ; « les ampoules » ou « quelques lumières » n'en est PAS un. Dans estimer_solaire, écris le nombre tel que le client l'a donné, n'en invente jamais.
- Quand le client a décrit ses appareils (lesquels, combien de chacun, combien d'heures par jour) : appelle estimer_solaire avec SES mots. Si l'outil rend une estimation, recopie sa phrase telle quelle, sans changer un seul chiffre et SANS guillemets autour (elle fait partie de ta réponse, ce n'est pas une citation), puis propose d'enregistrer une demande de devis. Si l'outil refuse (heures ou puissance manquantes, stock insuffisant), pose la question qu'il indique ou propose un conseiller — ne donne aucun chiffre. Jamais d'estimation pour le garage, la domotique, la VMC ou un produit seul.
- Une estimation n'est JAMAIS un devis : tu dis toujours qu'elle est indicative et qu'un conseiller confirme le prix exact.
- Pour un devis : quand tu connais le besoin (et le nom du client si l'outil te dit qu'il est inconnu), appelle enregistrer_demande_devis (le besoin avec les mots du client seulement, jamais l'estimation ni un montant : l'application garde l'estimation à part). Ensuite dis que la demande est enregistrée et qu'un conseiller rappelle sur ce numéro.
- Pour un problème technique, une réclamation, une question d'argent, ou dès que le client demande une personne : appelle passer_conseiller, puis dis qu'un conseiller BMI TOGO prend le relais sur ce numéro, et qu'il peut revenir vers toi à tout moment en écrivant « assistant ».
- Une photo, un document ou un message vocal : tu ne peux pas les lire ; dis-le et appelle passer_conseiller.
- Si le client écrit dans une autre langue, réponds simplement en français.
- Tu réponds au dernier message du client, en tenant compte de ce qui a été dit avant dans la conversation.`;

// Un mot sur le client, quand on le connaît — ajouté à la consigne.
export const consignePour = ({ client = null, nouvelle = false, metiers = [], memo = "" } = {}) => {
  const qui = client?.nom
    ? `LE CLIENT : il s'appelle ${client.nom} et a un compte chez BMI TOGO (tu peux l'appeler par son nom). Pour une demande de devis, son nom est connu : ne le redemande pas.`
    : `LE CLIENT : ce numéro n'a pas de compte chez BMI TOGO, son nom est inconnu. Pour une demande de devis, demande-lui son nom avant d'enregistrer.`;
  // Timo, 25/09/2026 : « il y a 2 bonjour dans un seul message ». Le serveur
  // salue lui-même au début d'une conversation (PHRASE_PRESENTATION).
  const salut = nouvelle
    ? "LA SALUTATION : cette conversation commence, et le serveur a DÉJÀ dit bonjour et présenté BMI TOGO juste avant ta réponse. Ne dis PAS bonjour ni bonsoir : réponds directement à la question."
    : "LA SALUTATION : la conversation est en cours. Ne redis pas bonjour à chaque message.";
  // Les MÉTIERS réglés dans l'application (⚙ Paramètres → domaines, boutiques
  // réelles) : un métier ajouté par Timo (Forage…) se dit sans toucher au code.
  // 01/10/2026 (« il faut qu'il accède à nos domaines ») : un métier peut
  // venir avec ses FAMILLES d'articles (« Forage : Pompe, Tuyaux… »).
  const noms = (metiers || []).map((m) => {
    if (m && typeof m === "object") {
      const nomM = String(m.nom || "").trim();
      const fam = (m.familles || []).map((f) => String(f || "").trim()).filter(Boolean);
      return nomM ? (fam.length ? `${nomM} (${fam.join(", ")})` : nomM) : "";
    }
    return String(m || "").trim();
  }).filter(Boolean);
  const met = noms.length
    ? `\n\nLES MÉTIERS DE BMI TOGO RÉGLÉS DANS L'APPLICATION, avec leurs familles d'articles : ${noms.join(" ; ")}. Ce sont des métiers de BMI TOGO : tu n'en exclus aucun, tu peux y donner un conseil général, puis chercher dans le stock (le nom du métier ou de la famille est un bon mot de recherche).`
    : "";
  // 📝 « Nos choix BMI » (01/10/2026, « lance les deux ») : écrits par la
  // direction dans ⚙ Paramètres. Ils PRIMENT sur le conseil général.
  const m = String(memo || "").trim();
  const choix = m
    ? `\n\nLES CHOIX DE BMI TOGO (écrits par la direction de BMI TOGO — ce sont des faits de BMI, tu peux les dire) :\n${m}\nQuand l'un de ces choix répond à la question du client, tu conseilles SELON LUI, plutôt qu'en général, en disant que c'est ce que BMI TOGO recommande ou installe. Tu n'en tires jamais un prix, un délai ou une promesse : les montants ne viennent que des outils.`
    : "";
  return `${CONSIGNE_IA}\n\n${qui}\n\n${salut}${met}${choix}`;
};

// Le filet derrière la consigne : sur une conversation NOUVELLE, une réponse
// qui commence quand même par « Bonjour » (ou « Bonsoir ESSO 😊 ») perd ce
// salut — la présentation posée juste au-dessus l'a déjà dit. Seuls le mot de
// salut, le NOM du client s'il est connu, la ponctuation et les emojis qui
// suivent partent ; la suite du texte ne bouge pas.
export function sansSalutation(texte, nom = "") {
  const t = String(texte || "");
  const echap = (x) => String(x || "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const leNom = echap(nom) ? `(?:\\s+${echap(nom)})?` : "";
  const re = new RegExp(`^\\s*(?:bonjour|bonsoir|salut|hello)(?![\\p{L}])${leNom}[\\s!,.]*(?:[\\p{Extended_Pictographic}\\u200d\\ufe0f]+[\\s!,.]*)*`, "iu");
  if (!re.test(t)) return t;
  const reste = t.replace(re, "");
  return reste ? reste.charAt(0).toUpperCase() + reste.slice(1) : "";
}

// ---- LES OUTILS (ce que l'IA a le droit de FAIRE, et rien d'autre) ----
export const OUTILS_IA = [
  {
    name: "chercher_article",
    description: "Cherche des articles dans le stock des boutiques BMI TOGO par leur nom (marque, puissance, catégorie) ou leur métier (solaire, forage, garage…). Rend pour chacun : nom, catégorie, métier, boutique, prix en francs CFA, disponible (true) ou sur commande (false), et ce que la fiche porte quand c'est renseigné : tension, puissance (kW), pour une pompe la profondeur maximale (m), le débit maximal en surface (m³/h) et si elle est hybride, les garanties, le lien de la fiche technique, et une description écrite par BMI TOGO (ce que l'article est, à quoi il sert). Cherche aussi dans cette description : « moteur rideau » trouve un moteur central décrit ainsi. Ne rend jamais la quantité en stock.",
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
        besoin: { type: "string", description: "Le besoin, avec les mots du client : appareils (avec leur nombre), heures d'utilisation, lieu, type de projet. Jamais l'estimation ni aucun montant : l'application les garde à part." },
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
    name: "calculer_total",
    description: "Calcule avec les prix du stock de BMI TOGO le TOTAL d'une quantité ou de plusieurs articles (articles seuls, hors pose et transport). Donner le nom EXACT de chaque article tel que chercher_article l'a rendu, et la quantité dite par le client. Si les articles sont dans plusieurs boutiques à des prix différents, rend un total par boutique ; préciser « boutique » pour n'en avoir qu'une. Refuse un article introuvable, sans prix, ou une quantité non dite.",
    input_schema: {
      type: "object",
      properties: {
        lignes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              article: { type: "string", description: "Le nom exact de l'article, tel que rendu par chercher_article" },
              quantite: { type: "number", description: "Le nombre dit par le client (entier, au moins 1)" },
            },
            required: ["article", "quantite"],
          },
        },
        boutique: { type: "string", description: "Facultatif : la boutique dont on veut les prix" },
      },
      required: ["lignes"],
    },
  },
  {
    name: "choisir_pompe",
    description: "Pour un forage : calcule avec la règle de BMI TOGO la hauteur que la pompe doit faire monter (niveau dynamique + réservoir + frottements du tuyau, estimés) et le débit nécessaire, puis rend les pompes du stock qui MONTENT assez haut (la plus juste d'abord), avec leur prix et leur disponibilité, et celles qui sont trop courtes. Ne promet jamais un débit à cette hauteur. Refuse sans le niveau dynamique ou sans le besoin en eau, et dit quoi demander.",
    input_schema: {
      type: "object",
      properties: {
        niveau_dynamique_m: { type: "number", description: "Le niveau de l'eau PENDANT le pompage, en mètres (donné par le foreur ; ce n'est pas la profondeur du forage)" },
        hauteur_reservoir_m: { type: "number", description: "La hauteur du réservoir au-dessus du sol, en mètres (0 si pas de château d'eau)" },
        longueur_tuyau_m: { type: "number", description: "La longueur de tuyau de la pompe au réservoir, en mètres (0 si inconnue)" },
        litres_par_jour: { type: "number", description: "Le besoin en eau par jour, en litres" },
      },
      required: ["niveau_dynamique_m", "litres_par_jour"],
    },
  },
  {
    name: "panneaux_pour_pompe",
    description: "Pour une pompe SOLAIRE du stock : calcule le nombre approximatif de panneaux pour la faire tourner (puissance de la pompe × 1,3, divisée par la puissance du panneau le plus puissant du stock, arrondi au panneau supérieur) et le prix de ces panneaux dans chaque boutique. Donner le nom exact de la pompe tel que chercher_article ou choisir_pompe l'a rendu. Refuse si la puissance de la pompe n'est pas renseignée.",
    input_schema: {
      type: "object",
      properties: { pompe: { type: "string", description: "Le nom exact de la pompe" } },
      required: ["pompe"],
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
// ---- LE BESOIN NE PORTE QUE CE QUE LE CLIENT A DIT (25/09/2026) ----
// Capture Timo : l'IA recopiait « Estimation donnée : 22 panneaux… entre
// 4 600 000 et 6 250 000 F CFA » DANS le besoin, pendant que la fiche
// affichait déjà l'estimation à part — le chiffre se lisait deux fois. La
// consigne le dit, et ce filet retire toute phrase qui parle d'estimation ou
// porte un montant. Il ne vide jamais un besoin : s'il ne restait rien, on
// garde le texte tel quel (une personne le relit).
const PHRASE_A_RETIRER = /estimation|f\s?cfa|\d[\d\s\u00a0\u202f]{3,}\s?(?:f\b|francs?)/i;
export function besoinSansEstimation(texte) {
  const brut = String(texte || "").trim();
  if (!brut) return "";
  const phrases = brut.split(/(?<=[.!?\n])\s+/);
  const gardees = phrases.filter((ph) => !PHRASE_A_RETIRER.test(ph)).join(" ").trim();
  return gardees || brut;
}

// ---- 🧮 LE TOTAL, CALCULÉ PAR L'APPLICATION (01/10/2026, « lance les deux ») ----
// Timo voulait un assistant qui réponde comme un conseiller : « 3 panneaux,
// combien ? ». L'IA ne calcule JAMAIS (le juge jette tout montant qu'aucun
// outil n'a donné) : c'est cette règle qui multiplie et additionne, au prix
// du stock, boutique par boutique — jamais un mélange de deux boutiques, on
// ne choisit pas une boutique à la place du client. Articles seuls : ni pose,
// ni transport, ni remise. Rend { ok, motif } ou { ok, texte, montants }.
export const MAX_LIGNES_TOTAL = 20;
export const MAX_QUANTITE_TOTAL = 10000;
const cleNom = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const fmtTotal = (n) => `${Math.round(Number(n || 0)).toLocaleString("fr-FR")} F`;
export function totalArticles(articles, lignes, boutique = "") {
  const ls = Array.isArray(lignes) ? lignes : [];
  if (!ls.length) return { ok: false, motif: "Aucun article donné." };
  if (ls.length > MAX_LIGNES_TOTAL) return { ok: false, motif: `Trop d'articles (${MAX_LIGNES_TOTAL} au plus) : proposer une demande de devis.` };
  const voulue = cleNom(boutique);
  const tous = (articles || []).filter((a) => a && a.nom && (!voulue || cleNom(a.boutique) === voulue));
  if (voulue && !tous.length) return { ok: false, motif: `Aucun article dans la boutique « ${boutique} ».` };
  const demandes = [];
  for (const l of ls) {
    const q = Number(l && l.quantite);
    const nomA = String((l && l.article) || "").trim();
    if (!nomA) return { ok: false, motif: "Un article n'a pas de nom." };
    if (!Number.isInteger(q) || q < 1 || q > MAX_QUANTITE_TOTAL) return { ok: false, motif: `La quantité de « ${nomA} » n'est pas un nombre entier dit par le client : la lui demander.` };
    let memes = tous.filter((a) => cleNom(a.nom) === cleNom(nomA));
    if (!memes.length) {
      const proches = chercherArticles(tous, nomA);
      const noms = [...new Set(proches.map((a) => cleNom(a.nom)))];
      if (noms.length === 1) memes = tous.filter((a) => cleNom(a.nom) === noms[0]);
    }
    if (!memes.length) return { ok: false, motif: `« ${nomA} » est introuvable : appeler chercher_article et reprendre le nom exact.` };
    demandes.push({ cle: cleNom(memes[0].nom), nom: memes[0].nom, quantite: q });
  }
  const boutiques = [...new Set(tous.map((a) => a.boutique))].sort((x, y) => x.localeCompare(y, "fr"));
  const parBoutique = [];
  for (const b of boutiques) {
    const lignesB = [];
    let complet = true;
    for (const d of demandes) {
      const a = tous.find((x) => x.boutique === b && cleNom(x.nom) === d.cle);
      if (!a || !(Number(a.prix) > 0)) { complet = false; break; }
      lignesB.push({ nom: a.nom, quantite: d.quantite, prix: Math.round(Number(a.prix)), montant: Math.round(Number(a.prix)) * d.quantite, disponible: !!a.disponible });
    }
    if (complet) parBoutique.push({ boutique: b, lignes: lignesB, total: lignesB.reduce((s, x) => s + x.montant, 0) });
  }
  if (!parBoutique.length) return { ok: false, motif: "Aucune boutique n'a tous ces articles avec un prix : proposer une demande de devis ou un conseiller." };
  // Deux boutiques au même total et aux mêmes lignes = une seule réponse.
  const uniques = [];
  for (const p of parBoutique) {
    const meme = uniques.find((u) => u.total === p.total && u.lignes.every((l, i) => l.prix === p.lignes[i].prix));
    if (meme) meme.boutiques.push(p.boutique); else uniques.push({ ...p, boutiques: [p.boutique] });
  }
  const bloc = (u) => {
    const detail = u.lignes.map((l) => `• ${l.quantite} × ${l.nom} : ${fmtTotal(l.montant)}${l.quantite > 1 ? ` (${fmtTotal(l.prix)} l'unité)` : ""}${l.disponible ? "" : " — sur commande"}`).join("\n");
    return `À ${u.boutiques.join(" et ")} :\n${detail}\nTotal : ${fmtTotal(u.total)}`;
  };
  const texte = `${uniques.map(bloc).join("\n\n")}\n\n${PHRASE_TOTAL}`;
  const montants = [...new Set(uniques.flatMap((u) => [u.total, ...u.lignes.flatMap((l) => [l.prix, l.montant])]))];
  return { ok: true, texte, montants, parBoutique: uniques };
}
export const PHRASE_TOTAL = "Prix indicatif des articles seuls, hors pose et transport ; un conseiller BMI TOGO vous confirme le prix exact dans un devis.";

// ---- 📝 « NOS CHOIX BMI » — le mémo de la direction (01/10/2026) ----
// L'assistant conseillait « en général » (décision « A », 25/09) ; Timo veut
// qu'il conseille COMME LA MAISON (48 V, lithium…). Le mémo est écrit dans
// ⚙ Paramètres → 🤖 Assistant (administrateur PRINCIPAL), rangé sur les
// boutiques (`assistant_memo`, rien à coller), lu sur une boutique RÉELLE
// seulement (le mur). ⚠ PAS DE PRIX dedans : le juge jette tout montant
// qu'aucun outil n'a donné — un prix écrit ici ferait jeter les réponses.
export const MEMO_ASSISTANT_MAX = 1500;
export const memoAssistant = (boutiques) => {
  const b = (boutiques || []).find((x) => x && !x.formation && String(x.assistant_memo || "").trim());
  return b ? String(b.assistant_memo).trim() : "";
};
export const poserMemoAssistant = (boutiques, texte) =>
  (boutiques || []).map((b) => ({ ...b, assistant_memo: String(texte || "").trim() }));
export function critiqueMemoAssistant(texte) {
  const t = String(texte || "").trim();
  if (t.length > MEMO_ASSISTANT_MAX) return `Le mémo est trop long (${t.length} caractères, ${MEMO_ASSISTANT_MAX} au plus) : gardez l'essentiel.`;
  if (montantsCites(t).length) return "Pas de prix dans le mémo : l'assistant ne cite que les prix du stock. Retirez les montants (les prix se règlent sur les fiches des articles).";
  if (MOTS_INTERDITS_IA.test(t)) return "Le mémo parle de dette, de crédit, de solde ou de mot de passe : l'assistant n'a pas le droit d'en parler. Retirez ces mots.";
  return "";
}

// ---- ☀️💧 LES PANNEAUX D'UNE POMPE SOLAIRE (01/10/2026, « marge 1,3, le plus puissant du stock ») ----
// Puissance de la pompe × 1,3 (les pertes et les heures de faible soleil),
// divisée par la puissance du panneau le PLUS PUISSANT du stock, arrondie au
// panneau supérieur. Le prix vient du stock, boutique par boutique (jamais un
// mélange). ⚠ Une estimation : le câblage (série / parallèle pour atteindre la
// tension de la pompe) peut demander un panneau de plus ; un conseiller confirme.
export const MARGE_PANNEAUX_POMPE = 1.3;
const sansAcc = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const wattsDuPanneau = (a) => {
  if (Number(a?.puissance_kw) > 0) return Math.round(Number(a.puissance_kw) * 1000);
  const m = /(\d{2,4})\s*w(?:c|att)?\b/i.exec(String(a?.nom || ""));
  return m ? Number(m[1]) : 0;
};
export const estPanneau = (a) => /panneau/.test(sansAcc(`${a?.categorie} ${a?.nom}`)) && !/support|rail|etrier|cable|connecteur/.test(sansAcc(a?.nom));
export function panneauxPourPompe(articles, nomPompe) {
  const tous = (articles || []).filter(Boolean);
  const cle = sansAcc(String(nomPompe || "").trim()).replace(/\s+/g, " ");
  if (!cle) return { ok: false, motif: "Aucune pompe donnée." };
  let pompe = tous.find((a) => sansAcc(a.nom).replace(/\s+/g, " ") === cle);
  if (!pompe) {
    const proches = chercherArticles(tous.filter((a) => /pompe/.test(sansAcc(a.categorie))), nomPompe);
    if (proches.length && new Set(proches.map((a) => a.nom)).size === 1) pompe = proches[0];
  }
  if (!pompe) return { ok: false, motif: `La pompe « ${nomPompe} » est introuvable : appeler chercher_article et reprendre le nom exact.` };
  const kw = Number(pompe.puissance_kw) || 0;
  if (!(kw > 0)) return { ok: false, motif: `La puissance de « ${pompe.nom} » n'est pas renseignée sur sa fiche : proposer un conseiller.` };
  const panneaux = tous.filter((a) => estPanneau(a) && wattsDuPanneau(a) > 0);
  if (!panneaux.length) return { ok: false, motif: "Aucun panneau solaire avec sa puissance dans le stock." };
  const wMax = Math.max(...panneaux.map(wattsDuPanneau));
  const lesPlusPuissants = panneaux.filter((a) => wattsDuPanneau(a) === wMax);
  const puissanceVisee = Math.round(kw * 1000 * MARGE_PANNEAUX_POMPE);
  const nombre = Math.max(1, Math.ceil(puissanceVisee / wMax));
  const nomPanneau = lesPlusPuissants.find((a) => a.disponible)?.nom || lesPlusPuissants[0].nom;
  const parBoutique = lesPlusPuissants.filter((a) => sansAcc(a.nom) === sansAcc(nomPanneau) && Number(a.prix) > 0)
    .map((a) => ({ boutique: a.boutique, prix: Math.round(Number(a.prix)), total: Math.round(Number(a.prix)) * nombre, disponible: !!a.disponible }))
    .sort((x, y) => x.boutique.localeCompare(y.boutique, "fr"));
  const virgule = (n) => String(n).replace(".", ",");
  const prixTxt = parBoutique.length
    ? ` ${parBoutique.map((b) => `À ${b.boutique} : ${nombre} × ${fmtTotal(b.prix)} = ${fmtTotal(b.total)}${b.disponible ? "" : " (sur commande)"}`).join(" ; ")}.`
    : "";
  const texte = `Pour la pompe ${pompe.nom} (${virgule(kw)} kW) : environ ${nombre} × ${nomPanneau} (${virgule(kw)} kW × ${virgule(MARGE_PANNEAUX_POMPE)} = ${puissanceVisee} W visés).${prixTxt} Estimation indicative des panneaux seuls : le câblage pour atteindre la tension de la pompe peut demander un ajustement, un conseiller BMI TOGO confirme.`;
  return { ok: true, nombre, panneau: nomPanneau, puissanceVisee, texte, montants: [...new Set(parBoutique.flatMap((b) => [b.prix, b.total]))], parBoutique };
}

// Ce qu'un article dit à l'IA : la fiche entière que le client peut lire
// (01/10/2026, « pas seulement la fiche des pompes… de tous les articles »),
// rien d'autre — jamais la quantité, jamais un prix d'achat, jamais les notes
// internes (articlesPourAssistant ne les a déjà pas).
export function articlePourIA(a) {
  const o = { nom: a.nom, categorie: a.categorie, ...(a.metier ? { metier: a.metier } : {}), boutique: a.boutique, prix_fcfa: a.prix, disponible: a.disponible, ...(a.tension ? { tension: a.tension } : {}) };
  for (const k of CLES_FICHE_ASSISTANT) if (a[k] !== undefined && a[k] !== "" && a[k] !== false) o[k] = a[k];
  // Le débit d'une pompe se lit EN SURFACE (règle du 20/09) : le nom le dit.
  if (o.debit_max_m3h) { o.debit_max_m3h_en_surface = o.debit_max_m3h; delete o.debit_max_m3h; }
  if (a.description) o.description = a.description;
  return o;
}

// Les métiers réglés (boutiques RÉELLES), avec leurs familles d'articles.
export const domainesPourIA = (boutiques) => {
  const b = (boutiques || []).find((x) => x && !x.formation && Array.isArray(x.domaines) && x.domaines.length);
  return b ? b.domaines.filter((d) => d && d.nom).map((d) => ({ nom: d.nom, familles: Array.isArray(d.familles) ? d.familles : [] })) : [];
};

export function executerOutil(nom, entree = {}, contexte = {}) {
  const e = entree || {};
  if (nom === "chercher_article") {
    // Les petits mots (« je veux une pompe de forage ») sont retirés avant
    // de chercher, par LA règle du menu (01/10/2026) — sinon une phrase
    // entière ne trouve presque jamais rien.
    const brut = String(e.recherche || "");
    const trouves = chercherArticles(contexte.articles || [], motsUtiles(brut) || brut);
    return {
      resultat: trouves.length
        ? JSON.stringify(trouves.map(articlePourIA))
        : "Aucun article trouvé pour cette recherche. Essayer un mot plus court ou plus général. Ne pas inventer de prix : proposer un autre nom ou un conseiller.",
      effets: { prix: trouves.map((a) => a.prix), demandeDevis: null, conseiller: false },
    };
  }
  if (nom === "panneaux_pour_pompe") {
    const r = panneauxPourPompe(contexte.articles || [], e.pompe);
    if (!r.ok) return { resultat: `Pas de calcul. ${r.motif} Ne donner AUCUN chiffre de prix.`, effets: { prix: [], demandeDevis: null, conseiller: false } };
    return {
      resultat: `Calcul de l'application. Recopier cette phrase telle quelle, sans changer un chiffre : « ${r.texte} »`,
      effets: { prix: r.montants, demandeDevis: null, conseiller: false },
    };
  }
  if (nom === "choisir_pompe") {
    const pompes = (contexte.articles || []).filter((a) => a && /pompe/i.test(String(a.categorie || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
    const saisie = {
      niveauDynamique: e.niveau_dynamique_m, hauteurReservoir: e.hauteur_reservoir_m,
      longueurTuyau: e.longueur_tuyau_m, litresParJour: e.litres_par_jour,
      pctPertes: Number(contexte.pertesPct) > 0 ? Number(contexte.pertesPct) : PERTES_PCT_DEFAUT,
    };
    const et = etudePompe(pompes, saisie);
    if (et.refus) return { resultat: `Pas de choix de pompe. ${et.refus} Ne donner AUCUN chiffre de pompe.`, effets: { prix: [], demandeDevis: null, conseiller: false } };
    const conviennent = et.conviennent.slice(0, 6);
    const resultat = {
      hauteur_a_faire_monter_m: et.hmt,
      detail: `eau ${et.eau} m + réservoir ${et.reservoir} m + frottements estimés ${et.pertes} m`,
      debit_necessaire_m3h: et.debit,
      pompes_qui_montent_assez_haut: conviennent.map((a) => {
        const pan = panneauxPourPompe(contexte.articles || [], a.nom);
        return { ...articlePourIA(a), ...(pan.ok ? { panneaux_solaires_estimes: `${pan.nombre} × ${pan.panneau} (${pan.puissanceVisee} W visés)` } : {}) };
      }),
      pompes_trop_courtes: et.tropCourtes.slice(0, 4).map((a) => `${a.nom} (jusqu'à ${a.profondeur_max_m} m)`),
      pompes_sans_fiche: et.sansFiche.length,
      a_dire_au_client: AVERTISSEMENT_COURBE.replace("Avant de promettre un débit au client, vérifiez-le", "Le débit réel à cette hauteur se vérifie"),
      consigne: conviennent.length
        ? "Proposer ces pompes (la première est la plus juste). Ne JAMAIS promettre un débit à cette hauteur : le débit max est celui en surface. Un conseiller confirme avec la fiche du fabricant."
        : "Aucune pompe renseignée du stock ne monte assez haut. Le dire, ne rien inventer, proposer une demande de devis ou un conseiller.",
    };
    return { resultat: JSON.stringify(resultat), effets: { prix: conviennent.map((a) => a.prix), demandeDevis: null, conseiller: false } };
  }
  if (nom === "enregistrer_demande_devis") {
    const nomClient = String(contexte.client?.nom || e.nom || "").trim();
    const besoin = besoinSansEstimation(e.besoin);
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
  if (nom === "calculer_total") {
    const t = totalArticles(contexte.articles || [], e.lignes, e.boutique);
    if (!t.ok) return { resultat: `Pas de total. ${t.motif} Ne donner AUCUN chiffre.`, effets: { prix: [], demandeDevis: null, conseiller: false } };
    return {
      resultat: `Total calculé par l'application. Recopier cette phrase telle quelle, sans changer un chiffre : « ${t.texte} »`,
      effets: { prix: t.montants, demandeDevis: null, conseiller: false },
    };
  }
  if (nom === "passer_conseiller") {
    const type = ["conseiller", "sav", "paiement"].includes(e.type) ? e.type : "conseiller";
    return {
      resultat: `Une personne de BMI TOGO prend le relais (${type}). Dire au client qu'un conseiller lui répond sur ce numéro, sans rien promettre d'autre, et qu'il peut revenir vers l'assistant à tout moment en écrivant « assistant ».`,
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
// ⚠ 30/09/2026 (capture Timo) : « Installation de forage » → l'IA a répondu
// que le forage « ne fait pas partie des services de BMI TOGO » — FAUX (les
// pompes vivent dans le métier Forage). Dire ce que BMI ne fait PAS, c'est
// inventer un fait de BMI : la réponse est JETÉE et un conseiller prend le
// relais (il confirme, lui).
export const METIER_NIE = /ne (?:fait|font) pas partie (?:de nos|des) (?:services|activit[ée]s|m[ée]tiers)|(?:nous|BMI(?: TOGO)?) ne (?:faisons|proposons|fait|propose|traitons|traite|r[ée]alisons|r[ée]alise|vendons|vend|installons|installe) pas|(?:n'est|ne sont) pas (?:dans|parmi) nos (?:services|activit[ée]s|m[ée]tiers|domaines)|(?:hors|en dehors) de nos (?:services|activit[ée]s|m[ée]tiers|domaines)/i;

export function garderReponse(texte, { prixConnus = [] } = {}) {
  const t = String(texte || "").trim();
  if (!t) return { ok: false, motif: "réponse vide" };
  if (t.length > MAX_LONGUEUR_REPONSE) return { ok: false, motif: "réponse trop longue" };
  if (MOTS_INTERDITS_IA.test(t)) return { ok: false, motif: "sujet réservé", reserve: true };
  if (METIER_NIE.test(t)) return { ok: false, motif: "BMI dit ne pas faire un métier (fait inventé)", metierNie: true };
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

// ---- UNE RÉPONSE JETÉE SE RÉÉCRIT UNE FOIS (01/10/2026) ----
// Capture Timo : une réponse refusée par le juge faisait surgir le menu à
// chiffres au milieu de la conversation. Désormais on dit à l'IA POURQUOI sa
// réponse n'est pas partie, et elle réécrit une fois. Pas de seconde chance
// sur un sujet réservé (la phrase fixe s'en charge) ni quand un outil a déjà
// AGI (demande enregistrée, main passée : la phrase fixe le dit).
export const noteDeReecriture = (motif) => `[Contrôle de BMI TOGO — message interne, pas du client] Ta réponse précédente n'a pas été envoyée : ${motif}. Réécris ta réponse au dernier message du client sans ce défaut (un montant en francs ne vient que d'un outil ; ne dis jamais que BMI TOGO ne fait pas quelque chose).`;
export const peutReecrire = (juge, effets) => !!juge && !juge.ok && !juge.reserve && !(effets && (effets.demandeDevis || effets.conseiller));
export async function converserAvecJuge({ consigne, messages, appeler, executer, outils = OUTILS_IA, maxTokens = MAX_TOKENS_REPONSE } = {}) {
  const premier = await converserAvecIA({ consigne, messages, appeler, executer, outils, maxTokens });
  let juge = garderReponse(premier.texte, { prixConnus: premier.effets.prix });
  if (!peutReecrire(juge, premier.effets)) return { ...premier, juge, reecrit: false };
  const suite = [...(messages || []), { role: "assistant", content: premier.texte || "…" }, { role: "user", content: noteDeReecriture(juge.motif) }];
  const second = await converserAvecIA({ consigne, messages: suite, appeler, executer, outils, maxTokens });
  const effets = {
    ...second.effets,
    prix: [...premier.effets.prix, ...second.effets.prix],
    estimation: second.effets.estimation || premier.effets.estimation,
  };
  juge = garderReponse(second.texte, { prixConnus: effets.prix });
  return { texte: second.texte, effets, tours: premier.tours + second.tours, juge, reecrit: true, motifPremier: garderReponse(premier.texte, { prixConnus: premier.effets.prix }).motif };
}

// L'étape à écrire sur la ligne : conseiller (silence ensuite), sinon « ia ».
export const etapeApresIA = (effets) => (effets?.conseiller ? ETAPE_CONSEILLER : ETAPE_IA);

// Une NOUVELLE conversation (rien de BMI depuis 24 h : `decisionAssistant`
// rend l'étape null) reçoit la présentation devant la réponse.
export const avecPresentation = (texte, { nouvelle }) => (nouvelle ? (String(texte || "").trim() ? `${PHRASE_PRESENTATION}\n\n${texte}` : PHRASE_PRESENTATION) : texte);
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

export function reponseDepuisIA({ texte, effets, juge, nouvelle, nom = "" }) {
  const ef = effets || { prix: [], demandeDevis: null, conseiller: false };
  // L'estimation part avec la réponse (le serveur la range sur la ligne, pour
  // la retrouver sur la fiche 🧲 Prospects) — seulement si la réponse est
  // celle que l'IA a écrite : une phrase fixe ne la cite pas.
  const pose = (t, etape, conseiller, repli) => ({ texte: avecPresentation(t, { nouvelle }), etape, conseiller, demandeDevis: ef.demandeDevis || null, ia: true, ...(repli ? { repli } : {}), ...(!repli && ef.estimation ? { estimation: ef.estimation } : {}) });
  if (juge?.ok) return pose(sansGuillemetsAutour(nouvelle ? sansSalutation(texte, nom) : texte, ef.estimation?.texte), etapeApresIA(ef), !!ef.conseiller, "");
  if (juge?.reserve) return pose(REPONSE_SUJET_RESERVE, ETAPE_CONSEILLER, true, juge.motif);
  if (juge?.metierNie) return pose(TEXTE_RELAIS_CONSEILLER, ETAPE_CONSEILLER, true, juge.motif);
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
