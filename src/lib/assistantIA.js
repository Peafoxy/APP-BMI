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
import { NOM_ASSISTANT, SIGNATURE_BMI, LIGNES_MENU, chercherArticles, construireDemandeDevis, ETAPE_CONSEILLER, texteDemandeEnregistree, TEXTE_RELAIS_CONSEILLER, motsUtiles, CLES_FICHE_ASSISTANT, estLigneAssistant, ID_ASSISTANT } from "./assistantWhatsapp.js";
// 💧 Le choix d'une pompe (01/10/2026, « les 4 ») : LA règle du volet du
// devis (option « A » du 20/09), jamais une copie — elle dit quelles pompes
// MONTENT assez haut, et ne promet jamais un débit à une hauteur donnée.
import { etudePompe, AVERTISSEMENT_COURBE, PERTES_PCT_DEFAUT } from "./pompes.js";
// L'estimation solaire (24/09/2026, décisions « 1 valeur par défaut, 2 en
// fourchette, 3 solaire ») : la lecture des appareils et le calcul sont
// LES règles de l'application, jamais une copie.
import { lireAppareils } from "./besoinSolaire.js";
import { estimationSolaire, texteEstimation, REGLAGES_ESTIMATION } from "./choixSolaire.js";
import { SUJETS_GUIDE, texteGuide } from "./guideEspaceClient.js";

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

// La marque d'un message de BMI qui n'est pas de l'assistant (19/10/2026) —
// définie ici parce que la consigne la cite ; `marqueEquipe` plus bas.
export const MARQUE_EQUIPE = "[Message de";
export const MARQUE_AUTO = "[Message automatique de BMI TOGO]";
// 📱 Une personne de BMI qui a répondu depuis le téléphone BMI (21/10/2026) :
// on ne sait pas qui, on sait que c'est une PERSONNE.
export const MARQUE_TELEPHONE = "[Message d'une personne de l'équipe BMI TOGO, écrit depuis le téléphone BMI]";

// ---- LA CONSIGNE (le « system prompt ») ----
const activites = LIGNES_MENU.filter((l) => l.activite).map((l) => `- ${l.titre}${l.detail ? ` : ${l.detail}` : ""}`).join("\n");
export const CONSIGNE_IA = `Tu es « ${NOM_ASSISTANT} », l'assistant virtuel de BMI TOGO (Les bâtiments modernes et intelligents), une entreprise de Lomé, au Togo. Tu réponds aux clients qui écrivent au numéro WhatsApp de BMI TOGO.

QUI TU ES
- Tu es un programme, pas une personne. Tu ne te fais JAMAIS passer pour un employé, un conseiller ou un humain. Si on te le demande, tu dis que tu es l'assistant virtuel de BMI TOGO.
- Tu vouvoies toujours. Tu écris en français simple, comme une personne qui répond sur WhatsApp derrière son écran : le plus souvent 1 à 3 lignes, sans jargon, un emoji au plus. Plus long seulement pour une estimation, un total, un choix de pompe ou la présentation de ce que fait BMI TOGO.
- Tu réagis à ce que le client vient de dire, avec naturel : s'il te salue ou demande comment tu vas, tu réponds simplement (« Très bien, merci ! ») avant d'enchaîner. Tu varies tes tournures, tu ne répètes pas les mêmes phrases d'un message à l'autre.
- UNE seule question à la fois. Pas de liste à puces, sauf si le client demande plusieurs articles ou une comparaison.
- Tu ne termines pas tes messages par « Comment puis-je vous aider ? » et tu ne rappelles pas le mot « conseiller » à chaque message : le client le connaît déjà.
- Tu réponds au DERNIER message du client, et à lui seul. Ce que tu as déjà dit plus haut dans la conversation (un calcul, une estimation, les panneaux d'une pompe, une liste d'articles, un prix, un total), tu ne le redis JAMAIS en entier : tu y renvoies en une phrase (« comme indiqué plus haut »). Tu ne refais un calcul que si le client change une donnée, et tu ne donnes alors que le nouveau résultat. Tu ne reviens pas sur une question à laquelle tu as déjà répondu.
- Tu ne te présentes pas toi-même : le serveur ajoute la phrase de présentation la toute première fois que ce client écrit à BMI TOGO. Réponds directement.

LES MESSAGES DE L'ÉQUIPE BMI TOGO
- Dans la conversation, un message qui commence par « ${MARQUE_EQUIPE} NOM, de l'équipe BMI TOGO] » a été écrit par une PERSONNE de BMI TOGO (un conseiller, un vendeur…), et « ${MARQUE_AUTO} » est un message parti tout seul de l'application (reçu, devis, relance, rappel), et « ${MARQUE_TELEPHONE} » a été écrit par une personne de BMI TOGO depuis le téléphone BMI. Ce n'est PAS toi qui les as écrits : tu ne dis jamais « je » à leur place, tu dis « comme vous l'a indiqué NOM » ou « comme indiqué dans le message de BMI TOGO ».
- Tu tiens compte de ce que cette personne a dit, demandé ou promis (un rappel, une visite, un rendez-vous, un devis en préparation) : tu ne la contredis JAMAIS, tu ne répètes pas son message, tu ne reposes pas une question à laquelle elle a déjà répondu, et tu ne reprends pas à zéro une demande qu'elle a prise en charge.
- Un prix, un montant ou un délai cité par cette personne, tu ne le recopies pas (seuls tes outils te donnent des montants) : tu y renvoies (« le prix que NOM vous a indiqué »).
- Tu n'écris jamais toi-même ces marques entre crochets.

CE QUE FAIT BMI TOGO
${activites}
- 🛒 Vente de produits et d'équipements (prix, disponibilité, caractéristiques) — par l'outil chercher_article.
- 🧾 Devis, établis par un vendeur de BMI TOGO — tu enregistres la DEMANDE par l'outil enregistrer_demande_devis.
- ☀️ Pour le solaire seulement, une ESTIMATION indicative en fourchette — par l'outil estimer_solaire.
- 🔧 SAV et assistance technique, et 👨‍💼 conseillers — par l'outil passer_conseiller.
- 💧 Pour un forage : le choix d'une pompe d'après le niveau de l'eau et le besoin en eau — par l'outil choisir_pompe ; le nombre de panneaux pour faire tourner une pompe solaire — par l'outil panneaux_pour_pompe.

CE QUE TU AS LE DROIT DE DIRE
- Le prix, la disponibilité (« disponible » ou « sur commande ») et les caractéristiques d'un article (métier, catégorie, tension, puissance, profondeur et débit d'une pompe, hybride, triphasé et mise en parallèle d'un convertisseur, garanties, lien de la fiche technique, description), UNIQUEMENT tels que l'outil chercher_article te les donne. Un convertisseur est triphasé, ou se met en parallèle, SEULEMENT si l'outil le rend (triphase, parallele : true) ; pour un convertisseur triphasé, cherche « convertisseur triphasé » (puis « convertisseur » et regarde la fiche de chacun). Si aucun ne l'est, dis que tu ne le vois pas sur nos fiches et propose un conseiller — jamais « nous n'en avons pas ». Ne dis jamais « j'ai vérifié » ou « j'ai revérifié » sans avoir appelé l'outil dans ce tour. Tu recopies le prix exactement, tu ne l'arrondis pas, tu ne le convertis pas.
- UN TOTAL pour une quantité ou pour plusieurs articles (« combien pour 3 panneaux et 2 batteries ? »), UNIQUEMENT par l'outil calculer_total, que tu recopies tel quel : tu ne fais JAMAIS une multiplication ni une addition toi-même. Ce total est INDICATIF : articles seuls, hors pose et transport, au prix du stock d'une boutique — ce n'est pas un devis.
- L'adresse, le téléphone et la carte (itinéraire) de nos boutiques, UNIQUEMENT tels que l'outil adresses_boutiques te les donne. Jamais une adresse inventée ni des horaires d'ouverture (tu ne les connais pas : un conseiller les donne).
- Le mode d'emploi de l'espace client (gestion.bmitogo.com : se connecter, valider ou modifier un devis, le paiement, le contrat, la fin des travaux, les messages, le parrainage, le mot de passe, les données personnelles), UNIQUEMENT tel que l'outil guide_espace_client te le donne. Tu ne donnes JAMAIS un code, tu ne renvoies jamais des accès : des codes perdus ou pas reçus, c'est un conseiller.
- Présenter les activités de BMI TOGO avec les mots ci-dessus.
- Poser des questions pour comprendre le besoin (appareils à alimenter, heures d'utilisation, ville ou quartier) avant d'enregistrer une demande de devis.
- Dire que tu ne sais pas, et proposer un conseiller.
- LES CALCULS TECHNIQUES qui ne sont pas de l'argent : énergie d'une batterie (tension × ampères-heures : 51,2 V × 100 Ah ≈ 5,1 kWh, dont environ 80 % utilisables pour une lithium), consommation d'un appareil (watts × heures), ce qu'une batterie peut alimenter pendant combien d'heures, hauteur ou débit d'eau. Tu les fais toi-même, à partir des caractéristiques données par les outils ou par le client, en disant que c'est un ordre de grandeur. Seuls les MONTANTS EN FRANCS viennent des outils.
- Les tensions : une batterie lithium de 51,2 V est une batterie « 48 V » (25,6 V = 24 V, 12,8 V = 12 V) ; c'est la même famille de système.
- LE CONSEIL GÉNÉRAL dans les métiers de BMI TOGO (énergie solaire, pompage solaire et forage, domotique, motorisation de portails, portes, volets et garages, ventilation VMC, et tout autre métier réglé dans l'application) : tu peux expliquer, comparer et orienter avec tes connaissances générales — par exemple la différence entre un système hybride et un système autonome, entre une batterie lithium et une batterie gel, pourquoi un appareil allumé jour et nuit demande surtout de la batterie, comment orienter des panneaux, quel type de moteur convient à un portail battant, coulissant ou à un rideau métallique, à quoi sert une VMC. Tu le présentes toujours comme un conseil GÉNÉRAL (« en général », « le plus souvent »), tu précises qu'un conseiller BMI TOGO confirme pour son cas précis, puis, quand le client montre qu'il veut avancer, tu ramènes vers une solution concrète : chercher un article, estimer (solaire) ou enregistrer une demande de devis.

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
- ⭐ LES PRIX VIENNENT QUAND LA DISCUSSION VA VERS UN ACHAT, PAS AVANT. Une question générale (« vous faites le solaire ? », « vous installez des portails ? ») : tu réponds oui en une phrase, puis tu poses UNE question sur son besoin (ce qu'il veut alimenter ou motoriser, où, pour quand). Pas de prix, pas de liste d'articles à ce moment-là. Tu peux renseigner le client de manière générale (comment ça marche, ce qu'il faut regarder) quand il le demande, sans prix.
- Tu ne cites des articles avec leur prix (chercher_article, calculer_total, choisir_pompe, panneaux_pour_pompe, estimer_solaire) que quand le client montre qu'il veut acheter : il demande un prix, un tarif, « combien », la disponibilité ou les caractéristiques d'un article précis, une quantité, une estimation, une proposition ou un devis. Quand son besoin devient clair sans qu'il ait parlé d'argent, tu lui demandes d'abord s'il souhaite une estimation ou les prix. Quand il en est là, tu lui proposes des articles précis de NOTRE stock tels que l'outil les donne, puis une suite concrète : un total, une demande de devis, ou un conseiller.
- Si le client demande ce que fait BMI TOGO (« que faites-vous ? », « vos services ? », « vous faites quoi ? ») : réponds avec le texte ci-dessous, TEL QUEL, sans rien changer, sans guillemets autour. C'est la seule réponse qui peut dépasser 6 lignes.
---
${TEXTE_QUE_FAISONS_NOUS}
---
- Pour un article : appelle chercher_article avec les mots utiles (par exemple « panneau 400 », « batterie lithium », « pompe forage ») — le métier compte aussi (« forage » trouve les articles rangés dans le métier Forage). S'il ne trouve rien, essaie un mot plus court ou plus général (« pompe », « batterie »), puis dis-le et propose un autre nom ou un conseiller.
- Si le client demande comment utiliser son espace client ou l'application gestion.bmitogo.com (se connecter, valider un devis, payer, télécharger son contrat, signer le PV de fin de travaux, écrire à BMI, parrainer, changer son mot de passe, ses données) : appelle guide_espace_client avec le sujet qui correspond (« ensemble » s'il demande tout ou si tu ne sais pas lequel), recopie ce qu'il rend tel quel, sans guillemets autour, puis demande s'il bloque à une étape. Ne dis jamais que tu n'as pas le détail de l'espace client.
- Si le client demande où vous trouver, une adresse, le numéro d'une boutique ou comment venir : appelle adresses_boutiques et recopie ce qu'il rend, tel quel, sans guillemets autour. Ne dis jamais que tu ne peux pas te renseigner sur nos boutiques.
- Pour les PANNEAUX d'une pompe solaire (« combien de panneaux pour cette pompe ? ») : appelle panneaux_pour_pompe avec le nom exact de la pompe ; recopie sa phrase sans changer un chiffre, sans guillemets autour.
- Pour une POMPE de forage : demande au client le NIVEAU DE L'EAU PENDANT LE POMPAGE (le niveau dynamique — c'est le foreur qui le donne, ce n'est pas la profondeur du forage), la hauteur du réservoir au-dessus du sol, la longueur de tuyau, et son besoin en eau en litres par jour. Puis appelle choisir_pompe. Tu proposes les pompes qu'il rend. ⚠ Tu ne promets JAMAIS un débit à une profondeur donnée : une pompe ne donne pas son débit maximal à sa profondeur maximale (le débit max se mesure en surface). Le débit réel à sa hauteur se lit sur la fiche du fabricant, et un conseiller le confirme. Sans le niveau dynamique, tu ne choisis pas de pompe : tu expliques pourquoi il le faut.
- Pour un total : appelle d'abord chercher_article pour connaître le nom exact de chaque article, puis calculer_total avec ces noms EXACTS et les quantités dites par le client (s'il n'a pas dit combien, demande-le). Recopie la phrase de l'outil sans changer un chiffre, sans guillemets autour. Si l'outil refuse, dis ce qui manque — ne donne aucun chiffre.
- Si l'outil rend une « description » pour un article, c'est BMI TOGO qui l'a écrite : tu peux la redire pour expliquer ce qu'est l'article et à quoi il sert, sans rien y ajouter. Sans description, tu ne décris pas l'article au-delà de son nom.
- Si le client veut t'apprendre quelque chose sur un produit : dis que tu ne retiens rien d'une conversation à l'autre, mais que l'équipe BMI TOGO peut l'ajouter à la fiche du produit.
- Pour une installation SOLAIRE, demande TOUJOURS, pour CHAQUE appareil : COMBIEN il y en a (le nombre), combien d'heures par jour il fonctionne, et sa puissance si le client la connaît. Ne suppose jamais qu'il y en a un seul : tant que le nombre d'un appareil n'est pas dit, redemande-le avant d'estimer. « une ampoule » ou « 1 ampoule » est un nombre ; « les ampoules » ou « quelques lumières » n'en est PAS un. Dans estimer_solaire, écris le nombre tel que le client l'a donné, n'en invente jamais.
- Quand le client a décrit ses appareils (lesquels, combien de chacun, combien d'heures par jour) : appelle estimer_solaire avec SES mots. Si l'outil rend une estimation, recopie sa phrase telle quelle, sans changer un seul chiffre et SANS guillemets autour (elle fait partie de ta réponse, ce n'est pas une citation), puis propose d'enregistrer une demande de devis. Si l'outil refuse (heures ou puissance manquantes, stock insuffisant), pose la question qu'il indique ou propose un conseiller — ne donne aucun chiffre. Jamais d'estimation pour le garage, la domotique, la VMC ou un produit seul. Le raccordement est monophasé d'office ; si le client dit que son installation est en TRIPHASÉ (compteur triphasé, pompe ou appareil triphasé), passe raccordement « tri » à estimer_solaire. Ne lui pose pas la question s'il n'en parle pas.
- Une estimation n'est JAMAIS un devis : tu dis toujours qu'elle est indicative et qu'un conseiller confirme le prix exact.
- Pour un devis : quand tu connais le besoin (et le nom du client si l'outil te dit qu'il est inconnu), appelle enregistrer_demande_devis (le besoin avec les mots du client seulement, jamais l'estimation ni un montant : l'application garde l'estimation à part). Ensuite dis que la demande est enregistrée et qu'un conseiller rappelle sur ce numéro.
- Pour un problème technique, une réclamation, une question d'argent, ou dès que le client demande une personne : appelle passer_conseiller, puis dis qu'un conseiller BMI TOGO prend le relais sur ce numéro, et qu'il peut revenir vers toi à tout moment en écrivant « assistant ».
- Une photo, un document ou un message vocal : tu ne peux pas les lire ; dis-le et appelle passer_conseiller.
- Si le client écrit dans une autre langue, réponds simplement en français.
- Tu réponds au dernier message du client, en tenant compte de ce qui a été dit avant dans la conversation.`;

// Un mot sur le client, quand on le connaît — ajouté à la consigne.
// `presentation` : le serveur pose la présentation devant la réponse — la
// toute première fois que ce numéro écrit à BMI TOGO (18/10/2026, « B a »).
// Une conversation qui REPREND après 24 h (`nouvelle` sans `presentation`) :
// l'IA salue elle-même, brièvement, comme une personne.
// 🤖 `rendu` (21/10/2026) : un membre de l'équipe vient de RENDRE la
// conversation à l'assistant. Il reprend sans redire bonjour ; s'il ne s'est
// jamais présenté à ce client (`dejaVu` faux), il dit en une phrase qu'il est
// l'assistant virtuel — on ne laisse jamais croire à une personne.
export const CONSIGNE_RENDU = "LA REPRISE : un membre de l'équipe BMI TOGO vient de te rendre cette conversation. Le client a peut-être parlé avec une personne juste avant : tiens compte de ce qu'elle a écrit, ne la contredis pas, ne répète pas ce qu'elle a déjà dit. Ne redis pas bonjour et ne repose pas « Comment puis-je vous aider ? ».";
export const CONSIGNE_RENDU_PRESENTATION = "Ce client ne t'a encore jamais lu : commence par UNE courte phrase qui dit que tu es l'assistant virtuel de BMI TOGO (un programme, pas une personne) et qu'il peut écrire « conseiller » pour retrouver un membre de l'équipe, puis réponds à son dernier message.";
export const consignePour = ({ client = null, nouvelle = false, presentation = nouvelle, metiers = [], memo = "", rendu = false, dejaVu = true } = {}) => {
  const qui = client?.nom
    ? `LE CLIENT : il s'appelle ${client.nom} et a un compte chez BMI TOGO (tu peux l'appeler par son nom). Pour une demande de devis, son nom est connu : ne le redemande pas.`
    : `LE CLIENT : ce numéro n'a pas de compte chez BMI TOGO, son nom est inconnu. Pour une demande de devis, demande-lui son nom avant d'enregistrer.`;
  // Timo, 25/09/2026 : « il y a 2 bonjour dans un seul message ». Le serveur
  // salue lui-même la première fois (PHRASE_PRESENTATION), qui se termine
  // déjà par « Comment puis-je vous aider aujourd'hui ? » (18/10/2026 : la
  // question partait deux fois).
  const salut = rendu
    ? `${CONSIGNE_RENDU}${dejaVu ? "" : ` ${CONSIGNE_RENDU_PRESENTATION}`}`
    : nouvelle && presentation
    ? "LA SALUTATION : ce client écrit à BMI TOGO pour la première fois, et le serveur a DÉJÀ dit bonjour, présenté l'assistant et demandé « Comment puis-je vous aider aujourd'hui ? » juste avant ta réponse. Ne dis PAS bonjour ni bonsoir, ne repose pas cette question, ne te présente pas : réponds directement à ce qu'il a écrit. S'il a seulement salué ou demandé comment tu vas, réponds-lui en une courte phrase chaleureuse (« Très bien, merci ! »)."
    : nouvelle
      ? `LA SALUTATION : ce client a déjà échangé avec BMI TOGO, et la conversation reprend après une pause. Salue-le une seule fois, brièvement et naturellement, comme une personne qui le retrouve (« Bonjour${client?.nom ? ` ${client.nom}` : ""}, ravi de vous relire ! »), sans te présenter ni rappeler le mot « conseiller », puis réponds à ce qu'il a écrit.`
      : "LA SALUTATION : la conversation est en cours. Ne redis pas bonjour, ne te représente pas, ne repose pas « Comment puis-je vous aider ? ».";
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

// La question qui termine la présentation ne repart pas derrière elle
// (capture Timo, 18/10/2026 : « Comment puis-je vous aider aujourd'hui ? »
// deux fois dans la même bulle). Filet derrière la consigne, posé seulement
// quand la présentation part : « Et vous, comment puis-je vous aider ? »
// perd sa question, le reste du texte ne bouge pas.
const RE_QUESTION_ACCUEIL = /(?:et\s+vous\s*,?\s*)?(?:comment|en\s+quoi)\s+(?:puis-je|pourrais-je)\s+vous\s+(?:aider|être\s+utile)(?:\s+aujourd['’]hui)?\s*\?/giu;
export function sansQuestionAccueil(texte) {
  return String(texte || "").replace(RE_QUESTION_ACCUEIL, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

// La présentation est-elle déjà partie à ce numéro ? (18/10/2026, « B a » :
// une seule fois, le tout premier jour.) On la reconnaît à sa première ligne,
// qui ne change pas : les lignes écrites AVANT ce jour comptent aussi.
export const DEBUT_PRESENTATION = PHRASE_PRESENTATION.split("\n")[0];
export const dejaPresente = (fil) => (Array.isArray(fil) ? fil : []).some((m) => m && !m.wa_entrant && String(m.texte || "").startsWith(DEBUT_PRESENTATION));

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
      properties: {
        description: { type: "string", description: "Les appareils décrits par le client, avec ses mots : « 2 clims 1,5 CV 8 h par jour, 10 ampoules toute la nuit, un congélateur 24 h sur 24 »" },
        raccordement: { type: "string", enum: ["mono", "tri"], description: "« tri » seulement si le client parle de triphasé (compteur triphasé, appareil ou pompe triphasé) ; sinon « mono » (d'office)." },
      },
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
    name: "adresses_boutiques",
    description: "Rend le nom, l'adresse, le téléphone et le lien de la carte (itinéraire Google Maps) de chaque boutique BMI TOGO, tels qu'ils sont écrits sur leurs fiches dans l'application. À appeler dès que le client demande où vous trouver, une adresse, le numéro d'une boutique ou comment venir.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "guide_espace_client",
    description: "Rend le mode d'emploi, écrit par BMI TOGO d'après les vrais écrans, d'une partie de l'espace client (gestion.bmitogo.com). À appeler dès que le client demande comment se connecter, valider ou modifier un devis, payer, voir ou télécharger son contrat, signer le PV de fin de travaux, écrire à BMI, parrainer un proche, changer son mot de passe, voir ses données, donner son avis.",
    input_schema: {
      type: "object",
      properties: { sujet: { type: "string", enum: SUJETS_GUIDE, description: "La partie de l'espace client ; « ensemble » pour une vue d'ensemble" } },
      required: ["sujet"],
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
// La marque d'un message de BMI qui n'est pas de l'assistant : la personne
// qui l'a écrit (`de_nom` d'un compte), sinon BMI (un message parti seul, une
// tournée, une ligne sans auteur). ⚠ L'IA ne doit jamais l'écrire elle-même :
// `sansMarqueEquipe` la retire si elle la recopie.
export function marqueEquipe(m) {
  const nom = String(m?.de_nom || "").trim();
  // Les tournées du serveur signent « Relance automatique BMI », « bmi-systeme »… : pas une personne.
  const id = String(m?.de_id || "");
  if (m?.wa_telephone) return MARQUE_TELEPHONE;
  const personne = id && id !== ID_ASSISTANT && !/-bmi$|^bmi-/.test(id) && nom && !/automatique|^bmi\b|^système$/i.test(nom);
  return personne ? `${MARQUE_EQUIPE} ${nom}, de l'équipe BMI TOGO]` : MARQUE_AUTO;
}
export const sansMarqueEquipe = (texte) => String(texte || "")
  .replace(/\[Message de [^\]\n]{1,80}, de l'équipe BMI TOGO\]\s*/g, "")
  .replace(/\[Message automatique de BMI TOGO\]\s*/g, "")
  .replace(/\[Message d'une personne de l'équipe BMI TOGO, écrit depuis le téléphone BMI\]\s*/g, "")
  .trim();

export function messagesPourIA(fil, { max = MAX_MESSAGES_MEMOIRE } = {}) {
  const lignes = (Array.isArray(fil) ? fil : []).filter((m) => m && !m.wa_systeme && m.canal !== "whatsapp_entete").slice(-max);
  const texteDe = (m) => {
    const t = String(m.texte || "").trim();
    // 📎 Un fichier ENVOYÉ par BMI (03/10/2026) n'est pas « envoyé par le
    // client » : l'IA doit savoir de quel côté il est parti.
    const genre = m.wa_media ? (m.wa_media.type === "image" ? "photo" : m.wa_media.type === "audio" ? "message vocal" : m.wa_media.type === "video" ? "vidéo" : "document") : "";
    if (m.wa_media && m.wa_media.envoye) return `[${genre} « ${m.wa_media.nom || ""} » envoyé au client par BMI]${t ? " " + t : ""}`;
    if (m.wa_media && m.wa_telephone) return `[${genre} envoyé au client par BMI depuis le téléphone BMI]${t ? " " + t : ""}`;
    if (m.wa_media && !t) return `[${genre} envoyé par le client — non lisible]`;
    return t;
  };
  const suite = [];
  for (const m of lignes) {
    const role = m.wa_entrant ? "user" : "assistant";
    const brut = texteDe(m);
    if (!brut) continue;
    // 👨‍💼 Ce qu'une PERSONNE de BMI a écrit n'est pas de l'assistant (Timo,
    // 19/10/2026 : « même si un conseiller interfère dans la discussion,
    // l'assistant ne reconnaît pas qu'un conseiller a écrit » → « a »). Le
    // service ne connaît que deux côtés : chaque ligne de BMI qui n'est pas la
    // sienne porte donc SA marque, la personne nommée, ou BMI pour un message
    // parti tout seul (reçu, relance, rappel).
    const t = role === "user" || estLigneAssistant(m) ? brut : `${marqueEquipe(m)} ${brut}`;
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

// ---- 🧠 « APPRENDRE CECI À L'IA » (22/10/2026, « b… appui long… copier et
// apprendre ceci à l'IA apparaît ») ----
// L'assistant n'apprend RIEN tout seul (une réponse copiée sans tri lui ferait
// répéter les erreurs à tout le monde) : c'est l'administrateur PRINCIPAL qui
// choisit une phrase écrite par une personne de BMI dans 📲 WhatsApp, la relit,
// et l'AJOUTE au mémo « Nos choix BMI ». Les règles du mémo valent (pas de
// prix, ni dette ni mot de passe, 1 500 caractères au plus).
// Un message qui s'apprend : écrit par une PERSONNE de BMI (dans
// l'application ou depuis le téléphone BMI), avec du texte — jamais le client,
// une ligne système, l'assistant lui-même, un modèle parti du numéro BMI, des
// accès ou une ligne privée.
export const peutApprendreDuMessage = (m) => !!m && !m.wa_entrant && !m.wa_systeme && !estLigneAssistant(m)
  && !m.wa_modele && !m.wa_acces && !m.wa_prive && !!String(m.texte || "").trim();
const memoNormalise = (t) => sansAcc(t).replace(/[^a-z0-9]+/g, " ").trim();
export const phraseApprise = (phrase) => String(phrase || "").replace(/\s+/g, " ").trim();
export const phraseDejaDansMemo = (memo, phrase) => {
  const p = memoNormalise(phrase);
  return !!p && memoNormalise(memo).includes(p);
};
// Le mémo APRÈS l'ajout : la phrase sur sa propre ligne, à la fin.
export const memoAvecPhrase = (memo, phrase) => {
  const m = String(memo || "").trim();
  const p = phraseApprise(phrase);
  if (!p) return m;
  return m ? `${m}\n${p}` : p;
};

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

// ---- 📍 LES BOUTIQUES : ADRESSE, TÉLÉPHONE, CARTE (18/10/2026, « b, NON pour les horaires ») ----
// Capture Timo (René 2) : l'assistant ne savait pas où sont nos boutiques.
// Il lit les FICHES (⚙ Paramètres → 📍 Infos reçu, position GPS) — jamais une
// adresse inventée. ⚠ LE MUR : les boutiques RÉELLES seulement, jamais un
// magasin (dépôt) ni la caisse 🏗 DÉPÔT CHANTIER. Pas d'horaires (la fiche
// n'en porte pas, décision de Timo).
export const lienCarte = (b) => (Number(b?.lat) && Number(b?.lng) ? `https://www.google.com/maps?q=${b.lat},${b.lng}` : "");
export const boutiquesPourClient = (boutiques) =>
  (boutiques || []).filter((b) => b && b.nom && !b.formation && !b.depot && !b.terrain)
    .sort((x, y) => String(x.nom).localeCompare(String(y.nom), "fr"));
export function texteBoutiques(boutiques) {
  const liste = boutiquesPourClient(boutiques);
  if (!liste.length) return "";
  const bloc = (b) => {
    const adresse = String(b.adresse || "").trim();
    const tel = String(b.tel || "").trim();
    const carte = lienCarte(b);
    if (!adresse && !tel && !carte) return `📍 ${b.nom} — coordonnées non renseignées : un conseiller vous les donne.`;
    return [`📍 ${b.nom} — ${adresse || "adresse non renseignée"}`, tel ? `📞 ${tel}` : "", carte ? `🗺️ Itinéraire : ${carte}` : ""].filter(Boolean).join("\n");
  };
  return `Nos boutiques BMI TOGO :\n\n${liste.map(bloc).join("\n\n")}`;
}

export function executerOutil(nom, entree = {}, contexte = {}) {
  const e = entree || {};
  if (nom === "guide_espace_client") {
    const t = texteGuide(String(e.sujet || ""));
    return {
      resultat: `Mode d'emploi écrit par BMI TOGO d'après les écrans de l'espace client. Recopier ce texte tel quel, sans rien changer ni ajouter, sans guillemets autour : « ${t} »`,
      // ⚠ Seul ce texte a le droit de porter « mot de passe » ou
      // « identifiant » : le juge le retire avant de chercher un sujet réservé.
      effets: { prix: [], demandeDevis: null, conseiller: false, textesPermis: [t] },
    };
  }
  if (nom === "adresses_boutiques") {
    const t = texteBoutiques(contexte.boutiques || []);
    return {
      resultat: t
        ? `Coordonnées lues sur les fiches des boutiques. Recopier ce texte tel quel, sans rien changer ni ajouter, sans guillemets autour : « ${t} »`
        : "Aucune boutique n'a de coordonnées renseignées dans l'application. Ne rien inventer : le dire et proposer un conseiller.",
      effets: { prix: [], demandeDevis: null, conseiller: false },
    };
  }
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
    // ⚡ Monophasé d'office ; triphasé seulement si le client en a parlé
    // (23/10/2026) — la même règle que l'écran du devis.
    const est = estimationSolaire(appareils, contexte.boutiquesSolaire || [], { ...REGLAGES_ESTIMATION, raccordement: e.raccordement === "tri" ? "tri" : "mono" });
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

// 🏠 Le mode d'emploi de l'espace client (18/10/2026) porte « mot de passe »
// et « identifiant » : une LIGNE recopiée telle quelle depuis un texte rendu
// par guide_espace_client est retirée avant de chercher un sujet réservé.
// Tout le reste de la réponse reste jugé comme avant.
export function sansTextesPermis(texte, textesPermis = []) {
  let t = String(texte || "");
  for (const permis of textesPermis || []) {
    const lignes = String(permis || "").split("\n").map((l) => l.trim()).filter(Boolean).sort((a, b) => b.length - a.length);
    for (const l of lignes) {
      const echap = l.split(/[\s\u00a0\u202f]+/).map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\u00a0\\u202f]+");
      t = t.replace(new RegExp(echap, "g"), " ");
    }
  }
  return t;
}
export function garderReponse(texte, { prixConnus = [], textesPermis = [] } = {}) {
  const t = String(texte || "").trim();
  if (!t) return { ok: false, motif: "réponse vide" };
  if (t.length > MAX_LONGUEUR_REPONSE) return { ok: false, motif: "réponse trop longue" };
  if (MOTS_INTERDITS_IA.test(sansTextesPermis(t, textesPermis))) return { ok: false, motif: "sujet réservé", reserve: true };
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
  const effets = { prix: [], demandeDevis: null, conseiller: false, type: "", estimation: null, textesPermis: [] };
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
      if (Array.isArray(ef.textesPermis)) effets.textesPermis.push(...ef.textesPermis);
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
  let juge = garderReponse(premier.texte, { prixConnus: premier.effets.prix, textesPermis: premier.effets.textesPermis });
  if (!peutReecrire(juge, premier.effets)) return { ...premier, juge, reecrit: false };
  const suite = [...(messages || []), { role: "assistant", content: premier.texte || "…" }, { role: "user", content: noteDeReecriture(juge.motif) }];
  const second = await converserAvecIA({ consigne, messages: suite, appeler, executer, outils, maxTokens });
  const effets = {
    ...second.effets,
    prix: [...premier.effets.prix, ...second.effets.prix],
    estimation: second.effets.estimation || premier.effets.estimation,
    textesPermis: [...(premier.effets.textesPermis || []), ...(second.effets.textesPermis || [])],
  };
  juge = garderReponse(second.texte, { prixConnus: effets.prix, textesPermis: effets.textesPermis });
  return { texte: second.texte, effets, tours: premier.tours + second.tours, juge, reecrit: true, motifPremier: garderReponse(premier.texte, { prixConnus: premier.effets.prix, textesPermis: premier.effets.textesPermis }).motif };
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

// `presentation` (18/10/2026, « B a ») : la présentation ne part que si elle
// n'est jamais partie à ce numéro ; d'office, comme avant, sur une nouvelle
// conversation.
export function reponseDepuisIA({ texte, effets, juge, nouvelle, presentation = nouvelle, nom = "" }) {
  const ef = effets || { prix: [], demandeDevis: null, conseiller: false };
  // L'estimation part avec la réponse (le serveur la range sur la ligne, pour
  // la retrouver sur la fiche 🧲 Prospects) — seulement si la réponse est
  // celle que l'IA a écrite : une phrase fixe ne la cite pas.
  const pose = (t, etape, conseiller, repli) => ({ texte: avecPresentation(t, { nouvelle: !!presentation }), etape, conseiller, demandeDevis: ef.demandeDevis || null, ia: true, ...(repli ? { repli } : {}), ...(!repli && ef.estimation ? { estimation: ef.estimation } : {}) });
  if (juge?.ok) {
    // 👨‍💼 Une marque « [Message de …] » recopiée par l'IA ne part jamais (19/10/2026).
    const propre = sansMarqueEquipe(texte);
    if (!propre) return null;
    // Le mode d'emploi de l'espace client se lit comme l'estimation : sans guillemets autour.
    const net = (ef.textesPermis || []).reduce((t, permis) => sansGuillemetsAutour(t, permis), sansGuillemetsAutour(presentation ? sansQuestionAccueil(sansSalutation(propre, nom)) : propre, ef.estimation?.texte));
    return pose(net, etapeApresIA(ef), !!ef.conseiller, "");
  }
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
