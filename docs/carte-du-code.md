# Carte du code — où vit quoi

Écrite le 15/09/2026, à la demande de Timo : « à chaque question, il faut
relire le code… comment essayer de te donner une mémoire ».

**À quoi ça sert :** trouver le bon fichier sans fouiller. Une ligne par
fichier, qui dit **à quoi il sert**, jamais comment il marche — un sujet
vieillit lentement, un détail vieillit vite (voir le fonds de caisse, qui a
changé trois fois de règle en deux jours sans changer de fichier).

**Le banc la garde à jour :** `verifier-cloisonnement` tombe si un fichier de
`src/lib/` n'est pas cité ici. Une carte incomplète ne part pas.

⚠ Le banc vérifie qu'un fichier FIGURE, pas que sa phrase est encore vraie.
Si vous voyez une ligne fausse, c'est un défaut : on la corrige.

---

## L'argent

| Fichier | À quoi il sert |
|---|---|
| `lib/versements.js` | Le versement des fonds par les boutiques, et **le fonds de caisse** (l'enveloppe, à part du tiroir) |
| `lib/cloture.js` | La clôture du jour (les ventes tous moyens, et le comptage du tiroir), et le blocage des ventes du lendemain |
| `lib/validationDepenses.js` | La validation des dépenses par le DG, l'origine des fonds (« Payé avec »), les avances de frais |
| `lib/apporteurDevis.js` | L'apporteur externe nommé dans le devis : 3 % d'office, le pourcentage changé par l'administrateur principal seul (brouillon), la commission sur les articles ou la pose, la dette de pose qui le porte |
| `lib/caissesCentrales.js` | Les caisses « Chez le DG », « BANQUE », « Chez le comptable » et leurs relevés |
| `lib/caissesMobiles.js` | Le solde des comptes Flooz et Mixx/T-Money, boutique par boutique |
| `lib/inventaireVentes.js` | 📋 L'inventaire de 💰 Ventes : ventes, recettes, dépenses, versements, caisse, dettes et comptage d'une boutique sur une période, et `inventaireGeneral` : toutes les caisses ensemble, dettes comptées une fois, caisses centrales à part (lecture seule, les règles de Caisse et de la clôture) |
| `lib/rendezVous.js` | 📅 Les rendez-vous : pro ou privé, qui modifie (auteur, administrateur), qui marque fait (+ participants), le conflit, ce qu'un changement dit à chacun, les rappels du serveur (la veille à 14 h, le jour même à 7 h, un privé neutre) |
| `lib/affectationChantier.js` | Qui est prévenu quand une installation est programmée : l'affectation (nouveaux, nouveau chef), le changement (retiré, chef remplacé, date déplacée), le rappel de la veille au chef (tournée de 17 h) |
| `lib/anniversaires.js` | Les anniversaires des employés : qui est fêté tel jour (le dernier jour du mois pour un jour absent), le rappel de la veille au principal (17 h), les vœux du numéro BMI le jour même (7 h), une fois par an |
| `lib/relanceSalaire.js` | La relance d'un salaire payé que l'employé n'a pas confirmé reçu : le bouton 📲 de 💵 Salaires et la tournée de 7 h (3e au 10e jour, une fois — notification et WhatsApp `rappel_confirmation_salaire`), la marque sur le virement, la ligne privée du fil |
| `lib/commissionsDues.js` | Les commissions devenues dues (réception ET solde) à annoncer par WhatsApp, et leur marque « annoncée » |
| `lib/compteExploitant.js` | Le compte de l'exploitant (BMI est une entreprise individuelle) : la caisse de BMI chez le DG, à part de ce que BMI lui doit ; ses apports et ses prélèvements |
| `lib/depensesChantier.js` | Les petites dépenses rattachées à un chantier de devis |
| `lib/argentChantier.js` | L'argent remis à quelqu'un (pour un chantier ou hors chantier) : son détail, le reste rendu |
| `lib/primeChantier.js` | La prime de chantier d'un employé de boutique : quels chantiers, prise sur la part de BMI |
| `lib/reprises.js` | La reprise d'un article par BMI (le client rend, l'argent repart) |
| `lib/echanges.js` | L'échange d'un article vendu contre un autre : avoir, différence payée ou rendue, stock ou SAV |
| `lib/carteFidelite.js` | La carte de fidélité à code-barres : numéro FID-, % sur la fiche du client, remplacement, scan dans l'espace regardé, remise fixe — couple securite-45 |
| `lib/autorisationRemise.js` | La remise ponctuelle autorisée à distance : le vendeur ou le gérant demande (`demandes_remise`), tout administrateur accorde (`remises_autorisees`), pour ce panier, ce %, ce client, une fois — couple securite-44 |
| `lib/remiseApresVente.js` | La remise après-vente (gérant, admin) : un montant retiré d'une vente déjà encaissée, sans article rendu — dette réduite ou remboursement |
| `lib/bons.js` | Le bon de reprise et le bon de retour (des documents, jamais des écritures) |
| `lib/bandesVersement.js` | La bande noire d'un versement dans 💰 Ventes, et le résumé des ventes depuis le versement précédent |
| `lib/banques.js` | La liste des banques et la banque d'un employé |
| `lib/affectation.js` | 📍 Le lieu d'affectation d'un employé SANS boutique — aucun droit, la boutique l'emporte (sans import) |
| `lib/cibleNotification.js` | 🔔 Ce qu'une notification ouvre : sa cible (boutique, ligne, conversation, membre), la personne visée, le repli d'un écran que le rôle n'a pas, l'adresse d'ouverture |
| `lib/connexionsComptes.js` | 👥 Qui a déjà ouvert son compte : dates de première et dernière connexion (comptes sécurisés), lues par le serveur pour l'administrateur principal seul |
| `lib/contratTravail.js` | 📄 Le contrat de travail d'un employé : type (le code CNSS, une source), fin d'un CDD, sortie, rappel de fin au principal |
| `lib/certificatTravail.js` | 📄 Les documents remis à un employé : certificat de travail, attestation de stage / de fin d'apprentissage à la sortie, attestation de travail en poste (le texte ; la mise en page dans impression.js) |
| `lib/civilite.js` | ⚧ Le sexe d'un compte (H / F / vide) : « M. » / « Mme » et les accords (employé / employée) pour le contrat et les attestations |
| `lib/loyer.js` | Le loyer d'un local loué : sa fiche, l'état du mois (payé, à payer, en retard), jamais deux fois |
| `lib/paie.js` | La fiche de paie, séparée de la fiche employé |
| `lib/cnss.js` | La déclaration des rémunérations et cotisations |

## La vente, le stock, les documents

| Fichier | À quoi il sert |
|---|---|
| `lib/calculs.js` | Le gros des calculs métier : stock, boutiques, rôles, espaces, remises, index |
| `lib/core.js` | Les briques de base : montants, dates, numéros, WhatsApp, messages, dépenses, statut d'une dette |
| `lib/attestationSortie.js` | L'attestation de fin de contrat mise à la disposition de l'employé (CDI au clic, CDD par la tournée), son accès fermé 24 h après ; la ligne privée et la notification de la tournée |
| `lib/infobulle.js` | La description d'un bouton dans sa fenêtre : la couleur du bouton, la place à l'écran (sans import ; l'hôte `InfobulleHost` vit dans ui.jsx) |
| `lib/horloge.js` | L'heure du SERVEUR : l'écart de l'horloge de l'appareil, retiré de toute date et heure écrite (sans import) |
| `lib/panier.js` | Le panier d'une vente ou d'une commande |
| `lib/transfertsStock.js` | Le transfert de stock entre boutiques (la boutique qui reçoit valide) |
| `lib/importStock.js` | L'importation d'articles en stock (Excel ou texte collé) |
| `lib/travaux.js` | 🛠 Travaux à crédit : les prestations hors devis |
| `lib/depotChantier.js` | 🏗 Le dépôt chantier : l'encaissement d'un devis avec installation n'est pas une vente ; ce qui compte comme vente (achats « 🏗 Chantier », reste à la réception), l'état de chaque dépôt |
| `lib/achatsChantier.js` | 🏗 Le matériel qui part au chantier : la case « Avec installation » du devis, les achats payés par le chantier, l'argent du chantier, 🔒 le matériel réservé (avertissement de vente, « Marquer terminé » sans achat) |
| `lib/pompes.js` | Les pompes : ce qu'on en note (puissance, profondeur, débit, tension, hybride), « quelle pompe pour ce forage », la ligne grise sous le nom (`ficheLisible`, lue dans le registre) — son seul import : ficheArticle.js |
| `lib/ficheArticle.js` | LE registre des cases de la fiche d'un article : « client » (l'assistant, le menu, la ligne grise la lisent toutes seules), « interne » (prix d'achat, fournisseur, notes… jamais chez le client), « à part » — **n'importe RIEN** |
| `lib/outillage.js` | 🧰 Le matériel de travail de BMI : le registre, les sorties et retours, les pertes, l'appel de la semaine |
| `lib/impression.js` | Les documents imprimables : reçus, bons, contrats |
| `lib/export.js` | L'export CSV des tableaux |
| `lib/fournisseurs.js` | Modifier la fiche d'un fournisseur : représentant, dû / réglé au principal, un nouveau nom suit les articles |
| `lib/barcode.js` | Le code-barres des étiquettes |
| `lib/archivage.js` | LA règle d'archivage des historiques (10 lignes, puis les archives) |

## Le devis, le client, le chantier

| Fichier | À quoi il sert |
|---|---|
| `lib/solaire.js` | Les calculs du dimensionnement solaire (panneaux, batteries, rails) |
| `lib/appareils.js` | Le catalogue des appareils électriques proposés dans un devis |
| `lib/validationDevis.js` | La validation d'un devis (espace client et signature en boutique) |
| `lib/modifDevis.js` | Modifier un devis DÉJÀ SIGNÉ : le client ouvre la porte |
| `lib/motifReseau.js` | Une connexion coupée avec le serveur se dit en français (« Failed to fetch » part dans la console) |
| `lib/antiDoublonEnvoi.js` | Le même message WhatsApp (modèle, numéro, mots) ne repart pas pendant qu'il part ni dans la minute qui suit — le filet de `envoyerModele` |
| `lib/contrat.js` | Le contrat et le PV de réception |
| `lib/reglement.js` | Comment le client va solder son installation (le plan de règlement) |
| `lib/prospects.js` | Un prospect devient client |
| `lib/comptesClients.js` | Les identifiants automatiques d'un compte client, les relances de devis |
| `lib/identiteClient.js` | L'identifiant et le mot de passe d'un client, et **la comparaison de deux identifiants de connexion** (`memeIdentifiant`, lue par l'écran ET par le serveur) — **n'importe RIEN** |
| `lib/clientsConnus.js` | Les clients que la boutique connaît déjà (proposés dans Ventes, Dettes, Travaux) |
| `lib/clientEntreprise.js` | Le prénom du client et l'entreprise qu'il représente (son répondant) : sur la fiche, la vente, la proforma, le devis, le reçu et le contrat |
| `lib/libellesStatuts.js` | Les mots des statuts d'un devis et d'un chantier, écrits une fois (Tous les devis, Clients installés, fiche client) |
| `lib/versionDistante.js` | Quand un appareil reprend la version du serveur à la lecture (l'heure du serveur seule, jamais celle d'un appareil) |
| `lib/effacementClient.js` | 🔒 Le droit à l'effacement : ce qui part, ce que les livres gardent sans son nom |
| `lib/dossierPersonnel.js` | 📄 Le droit d'accès : tout ce qu'on a sur un client, en un document — **jamais son mot de passe** |
| `lib/dossierEmploye.js` | 👥 Le droit d'accès d'un EMPLOYÉ : paie, CNSS, banque masquée — **pas d'effacement, la loi l'interdit** |
| `lib/conservation.js` | ⏳ Combien de temps on garde les données d'un client (6 ans, réglable) — **il DIT qui dépasse, il n'efface JAMAIS** |
| `lib/motInformation.js` | 👋 Le mot d'information de la première ouverture (client et employé) — **les mots qui mettent mal à l'aise y sont listés pour être évités** |
| `lib/whatsappModeles.js` | 📲 Les modèles de messages WhatsApp approuvés par Meta et l'ordre de leurs trous, y compris le choix entre un rappel de dette ordinaire et un rappel d'échéance — **le serveur lit CE fichier**, l'alerte à l'administrateur quand un client demande un conseiller (`alerte_conseiller`, envoyée par le serveur seul), et aucun mot de passe n'y entre |
| `lib/besoinSolaire.js` | 🔆 Les appareils LUS dans le besoin d'un prospect (« 2 clim de 1,5hp 8h par jour… ») pour pré-remplir le volet solaire — quantité, appareil du catalogue, puissance, heures ; rien d'inventé, une case vide plutôt qu'un chiffre deviné (24/09/2026) |
| `lib/catalogueAppareils.js` | 🔌 La liste des 60 appareils et leur puissance typique, et sa fusion avec la liste réglée dans ⚙ Paramètres — SANS import, pour que le serveur (estimation de l'assistant) lise la même liste que le vendeur (24/09/2026) |
| `lib/choixSolaire.js` | ☀️ Le CHOIX du matériel solaire dans le stock (quel panneau, quelle batterie, quel convertisseur, combien, tension et type compatibles, fixation) — sorti de l'écran le 24/09/2026 pour que l'écran du vendeur et le serveur lisent la MÊME règle ; et l'ESTIMATION en fourchette que l'assistant WhatsApp donne au client (valeurs par défaut, ± 15 %, solaire seulement, jamais un devis) |
| `lib/assistantIA.js` | 🗣 L'assistant qui DISCUTE (niveau 3, 24/09/2026) : la consigne donnée au service d'IA (un programme, jamais une personne ; vouvoiement ; rien d'inventé), les SIX outils qu'il a le droit d'appeler (chercher un article, enregistrer une demande de devis, estimer le solaire, calculer un total, choisir une pompe, passer la main), nos métiers avec leurs familles (`domainesPourIA`), la règle « conseil général puis articles de notre stock », la mémoire (le fil), le JUGE qui jette une réponse (montant qu'aucun outil n'a donné, dette, trop long), la boucle bornée, la phrase de présentation posée par le serveur, le réglage IA / menu — ne parle jamais au réseau (c'est `api/_assistantIA.js`), le menu reste le repli |
| `lib/assistantWhatsapp.js` | 🤖 L'assistant du numéro WhatsApp BMI (24/09/2026) : le mot d'accueil et les huit lignes du menu écrits par Timo, quand le robot répond et quand il se TAIT (conversation confiée, employé qui a répondu, conseiller demandé), ce qu'il dit avec NOS données (prix et « disponible / sur commande », jamais la quantité, jamais une dette), la demande de devis qui devient une fiche 🧲 Prospects, la ligne qu'il écrit, le client qui ATTEND un conseiller (`attenteConseiller`), la fiche d'article dite aux clients (`ficheArticleAssistant` : métier, garanties, fiche technique, pompe ; `note_assistant` ; jamais prix d'achat, fournisseur ni notes internes) — **le serveur lit CE fichier** (`api/whatsapp-entrant.js`), sans IA, rien ne sort du Togo |
| `lib/guideEspaceClient.js` | 🏠 Le mode d'emploi de l'espace client que l'assistant WhatsApp recopie (connexion, devis, paiement, contrat, PV, messages, parrainage, mot de passe, données, avis) — les noms des boutons sont ceux des écrans du client, **jamais un code** ; sans import, lu par le serveur (outil `guide_espace_client`) |
| `lib/whatsappConversations.js` | 📲 Les réponses du client dans 📲 WhatsApp : à qui est une conversation, qui a le droit de la voir (le comptable non depuis le 20/09/2026 ; depuis le 21/09 une conversation confiée n'est lue que par son propriétaire et l'admin, les autres n'en voient qu'une **fiche légère** sans un mot du contenu), la fenêtre de 24 h de Meta, ce qu'on lit d'une photo reçue, ce qu'un fichier ENVOYÉ peut être (`critiqueFichier`, 3 Mo, 03/10/2026), et RIEN en formation (`MOTIF_WA_FORMATION`, 22/09/2026 ; couple `securite-30`) — **le serveur lit CE fichier** (webhook, envoi, fichiers) |

## Les personnes, les espaces, la sécurité

| Fichier | À quoi il sert |
|---|---|
| `lib/espace.js` | À quel espace (réel / formation) appartient un compte, et qui prévenir |
| `lib/verrou.js` | Le verrou d'inactivité, et la reconnaissance d'un téléphone |
| `lib/empreinte.js` | Qui peut ouvrir le verrou avec son doigt, et la clé rangée par appareil — **aucune empreinte n'entre ici**, le téléphone compare tout seul (`src/empreinte.js` est le seul à lui parler) |
| `lib/vocauxStockes.js` | 🎤 Les notes vocales ENVOYÉES par BMI, rangées 30 jours dans l'espace de fichiers PRIVÉ de Supabase (« vocaux-wa ») : le chemin « jour/clé_hasard.ext », ce qui se range (le micro seulement), 30 jours, l'écoute refusée pour une autre conversation (sans import, lue par le serveur) |
| `lib/oggOpus.js` | 🎤 Une note vocale WebM / Opus (Chrome) remise dans une boîte Ogg, la seule que WhatsApp lit comme note vocale — sans recoder ; durée lisible « 0:07 » (`src/enregistreurVocal.js` est le seul à toucher le micro) |
| `lib/notifications.js` | Ce qui part en notification à chaque enregistrement |
| `lib/rappels.js` | Les rappels « pour information » qui dépendent du temps (tournée du matin) |
| `lib/conversations.js` | L'ordre de la liste des conversations de 💬 Messages |
| `lib/contactGoogle.js` | 📇 Enregistrer un client WhatsApp dans les contacts Google de BMI (bmitogo.info) : numéro international, refus, corps envoyé à Google, trace sur la fiche ; quand chercher tout seul le nom d'un client qui écrit |
| `lib/ordreOnglets.js` | L'ordre des onglets, au choix de chacun |
| `lib/pileRetour.js` | La touche retour d'Android : ce qu'il faut fermer à chaque appui |

## Les données : charger, fusionner, sauvegarder

| Fichier | À quoi il sert |
|---|---|
| `lib/constants.js` | Les constantes globales, la VERSION, les catégories, les données de démonstration |
| `lib/fusion.js` | Réconcilier deux modifications faites en même temps |
| `lib/rebase.js` | Reporter une modification d'écran sur l'état le plus récent |
| `lib/fileUnique.js` | « Une seule synchronisation à la fois, mais aucune perdue » |
| `lib/abandonLot.js` | Le filet : abandonner un geste que le serveur refuse |
| `lib/relanceAssistant.js` | 🤖 L'assistant RELANCE le client qui s'est tu (17/10/2026) : quand (20 h après le dernier message du client, avant la fermeture de la fenêtre de 24 h, l'IA ayant parlé en dernier, une seule fois par demande, jamais si confiée, employé récent, conseiller demandé ou demande de devis enregistrée, jamais en mode menu), la consigne et la note interne données à l'IA, la phrase fixe de repli, la ligne marquée `relance` — le serveur l'envoie (`api/_relanceAssistant.js`) |
| `lib/panneIA.js` | ⚠ Le service d'IA refuse de répondre (crédit Anthropic épuisé, clé refusée) : quelle panne mérite d'être dite, la notification au principal, une fois par jour (marque `alerte_ia` sur sa fiche) — le serveur l'envoie (`api/_alertePanneIA.js`) — **n'importe RIEN** |
| `lib/relaisDevisPdf.js` | 📎 Le devis repart SANS PDF quand Meta rejette le `devis_pdf` APRÈS l'envoi (❌ reçu par l'adresse d'arrivée) : `devis_disponible`, une seule fois (marque `wa_relais_le`), jamais un devis de formation ou à la corbeille — envoyé par `api/_relaisDevisPdf.js` |
| `lib/relanceAutoDevis.js` | La relance automatique d'un devis ⏳ Proposé au 8e jour, qui annonce la fin de l'offre (serveur, tournée de 7 h) |
| `lib/rappelEntretien.js` | Le rappel d'entretien automatique : 10 jours avant, le message au client et la tâche du chef du chantier (serveur, tournée de 7 h) ; « ✅ Entretien fait » et la prochaine date à +6 mois |
| `lib/demandeAvis.js` | La demande d'avis Google : du 10e au 40e jour après la réception d'un chantier, une seule fois (serveur, tournée de 7 h) ; le lien réglé dans ⚙ Paramètres |
| `lib/lignesPrivees.js` | Le détail d'un reçu de vente ou d'un bon dans 📲 WhatsApp, recomposé depuis la vente pour le vendeur et l'administrateur principal seulement |
| `lib/recuDeVente.js` | LA fabrique des reçus WhatsApp d'une vente (le détaillé, le court, ou celui d'un dépôt chantier) — lisible par le serveur, lue par 💰 Ventes, `lignesPrivees.js` et le relais d'un reçu sans PDF |
| `lib/relaisRecuPdf.js` | 📎 Le reçu et la proforma repartent EN TEXTE quand Meta rejette le `recu_pdf` / `proforma_pdf` APRÈS l'envoi : le texte rangé sur la ligne du PDF (versement, réservation, proforma), recomposé depuis la vente pour un reçu de vente ; une seule fois, jamais en formation — envoyé par `api/_relaisRecuPdf.js` |
| `lib/relaisAcces.js` | 🔑 Les identifiants repartent par `espace` (message de service) quand Meta rejette `espace_portail` APRÈS l'envoi (❌ reçu par l'adresse d'arrivée, ex. 130472 « essai de Meta ») : le mot de passe RECALCULÉ depuis la fiche, jamais écrit dans le fil ; une seule fois, jamais en formation ni sur une fiche fermée ou bloquée — envoyé par `api/_relaisAcces.js` |
| `lib/payeDirectement.js` | 💸 « Argent remis à » se CHOISIT (plus de choix d'office) ; « Personne — payé directement » exige le NOM de qui a reçu l'argent, le numéro facultatif (`paye_a` sur la dépense) ; l'avis `fonds_remis` part UNE fois quand la dépense compte (sous le seuil, ou validée), jamais rejetée, jamais en formation (`avise_le`) — envoyé par 📤 Dépenses |
| `lib/corbeille.js` | La corbeille des fiches supprimées (30 jours) : chantiers, dettes sans aucun versement (`critiqueSuppressionDette`), devis ⏳ Proposés (famille imbriquée dans la fiche du client), conversations WhatsApp |
| `lib/devisCfVisite.js` | 📋 Les éléments d'un devis « à compléter après la visite » (cf. visite) : sans prix, hors total, pas de validation ni d'acompte tant qu'il en reste ; qui complète (auteur, administrateur, resp. commercial), et la critique de la saisie |
| `lib/nomSurDocument.js` | 🪪 Le nom d'un employé sur un document imprimé : son nom complet (🆔 Identité) s'il est renseigné, sinon son identifiant (`nomSurDocument`, le registre posé par App.jsx) |
| `lib/lignesDevis.js` | 📄 L'ordre des lignes « Équipement proposé » du PDF d'un devis (articles seuls d'abord, catégories titrées à partir de 2 lignes, frais en dernier) et la reconnaissance d'une ligne de frais (`estLigneFrais`, réexportée par devisCommun) |
| `lib/devisSansSuite.js` | 📁 Classer un devis ⏳ Proposé sans suite (auteur, administrateur, resp. commercial ; motif obligatoire) et le rouvrir : le devis reste entier, il sort de la liste active, plus de validation ni de relance |
| `lib/poseSeule.js` | 🔧 Le règlement d'une pose seule : 70 % d'acompte (pas de programmation avant), 30 % au PV, le rappel du solde 3 jours après la signature (tournée de 7 h), qui encaisse |
| `lib/sauvegarde.js` | La sauvegarde JSON : téléchargement, et écriture horaire dans un dossier |
| `lib/suiviEnvoi.js` | Les coches d'un message parti du numéro BMI (✓ parti, ✓✓ arrivé, ✓✓ bleu lu, ❌ non reçu) : lire la nouvelle de Meta, ne jamais reculer |
| `lib/suggestions.js` | LA règle de recherche d'un champ à suggestions (toute recherche tapée) |

---

## Les composants partagés (`src/components/`)

| Fichier | À quoi il sert |
|---|---|
| `ui.jsx` | Les briques de toute l'application : champs, boutons, fenêtres, questions, partage PDF, colonnes figées, `allerALaLigne` (une notification mène à sa ligne), la règle des lignes (ligne dépliable, pastilles, texte qui se déplie, `BoutonRond`, `CelluleActions`), le bouton qui se grise pendant un envoi (`BoutonEnvoi`, `useEnvoiEnCours`), et la fenêtre de description d'un bouton au survol (`InfobulleHost`) |
| `cibleEcran.js` | 🔔 Ce qu'un écran fait d'une notification cliquée : `useCible`, la boutique visée (`useCibleBoutique`, jamais un employé déplacé hors de sa boutique) |
| `ChampSuggestions.jsx` | LE champ à suggestions (le seul ; plus de `<datalist>`) |
| `NoteVocale.jsx` | 🎤 Les notes vocales de 📲 WhatsApp comme sur WhatsApp : le lecteur (▶, barres, vitesse), le micro qu'on garde appuyé, et la réécoute d'une note envoyée par la copie de l'appareil (`useCopieVocale`) |
| `FiltrePeriode.jsx` | 📅 Le filtre de période d'une liste (Toute période, quatre périodes, Personnaliser), écrit une fois pour Ventes, Dépenses, Dettes et Tous les devis (et 📋 Inventaire, qui ouvre sur « Aujourd'hui ») |
| `carteFidelite.js` | 💳 Les gestes de la carte de fidélité (administrateur principal) : créer, changer la remise, remplacer, retirer, imprimer ; la fiche fermée d'un client de comptoir |
| `FicheClient.jsx` | 🗂 La fiche d'un client ouverte d'un clic dans 📋 Clients : achats, dettes, proformas, commandes, devis, chantiers de l'espace regardé |
| `CompleterDevis.jsx` | ✍️ Le panneau « Compléter le devis » après la visite (📋 Tous les devis) : chaque élément cf. visite chiffré ou « sans objet », des lignes ajoutées, le nouveau total lu par la vraie règle |
| `ChampsEntreprise.jsx` | La case « entreprise cliente » et ses lignes (nom, téléphone, NIF, RCCM), écrite une fois pour Ventes, le devis et la création d'un compte client |
| `SelecteurArticle.jsx` | La fenêtre « Rechercher un article » |
| `encaissementPose.js` | LE geste qui encaisse une pose seule (acompte 70 %, puis solde) — 🧾 Commandes et 🏠 Clients installés |
| `verserOrigine.js` | LE geste « 💸 Verser » l'argent d'UNE vente (💰 Ventes) ou d'UN règlement de dette (📋 Dettes) au DG / BANQUE / comptable — sans bande noire |
| `SelecteurBoutique.jsx` | La rangée de pastilles des boutiques |
| `OngletsDeplacables.jsx` | La barre d'onglets qu'on déplace par appui long |
| `HistoriqueArchive.jsx` | LE cadre d'historique qui défile et archive |
| `ArgentChantier.jsx` | Les cadres de l'argent remis (onglet 💼 Argent reçu, validation du gérant, fiche du chantier) |
| `AchatsChantier.jsx` | 🏗 La case « Chantier » de 💰 Ventes et la liste des achats pour les chantiers |
| `EcranVerrou.jsx` | La fenêtre du verrou d'inactivité |
| `HeureServeur.jsx` | « 🕓 Heure serveur » dans la barre du haut (ordinateur), entre le nom de l'onglet et « Verrouiller » — son propre minuteur |
| `ZoneSignature.jsx` | LA zone de signature (les quatre emplacements) |
| `CarteCaisse.jsx` | LA carte d'une caisse centrale (DG, BANQUE, comptable) |

| `DepotsChantier.jsx` | 🏗 La pastille DÉPÔT CHANTIER du tableau de bord : déposé, puisé (devenu vente), vendu à la réception, reste en dépôt |
| `CompteExploitant.jsx` | La pastille 👤 DG en deux relevés (caisse de BMI chez lui, compte de l'exploitant) et ses gestes ➕ Apport / ➖ Prélèvement |
| `RechercheGlobale.jsx` | La loupe du menu : recherche transversale (ventes, articles, devis, clients, prospects) |
| `MotInformation.jsx` | 👋 LA fenêtre du mot d'information (une seule pour le client et l'employé, seuls les mots changent) |
| `Carte.jsx` | La carte OpenStreetMap pour choisir une position — ⚠ **jamais d'enfant React dans le cadre de Leaflet** |

## Le reste

| Où | Quoi |
|---|---|
| `src/App.jsx` | Le cadre : onglets par rôle, chargement, enregistrement (`save`), synchronisation, sauvegardes |
| `src/db.js` | La base locale (Dexie / IndexedDB) et les tables |
| `src/pdf.js` | Les PDF fabriqués (devis commercial, relevés, rapports) |
| `src/retour.js` | La touche retour d'Android — **le seul endroit** qui écrit dans la liste des pages du téléphone (`useRetour`, `useRetourOnglets`) |
| `src/push.js` | Les notifications sur l'appareil — **le seul endroit** où `Notification` et `pushManager` existent |
| `src/horloge.js` | La MESURE de l'écart avec l'heure du serveur (date de la réponse de version.json), gardée sur l'appareil pour le hors-connexion |
| `src/vocauxLocaux.js` | 🎤 La copie d'une note vocale ENVOYÉE, gardée 30 jours dans le navigateur de l'appareil qui l'a enregistrée (IndexedDB « bmi_vocaux ») — jouée d'abord ; les collègues l'entendent par l'espace privé de Supabase (`lib/vocauxStockes.js`) |
| `src/whatsapp.js` | 📲 L'envoi d'un message du numéro BMI — **le seul endroit** qui appelle le serveur WhatsApp, et qui replie sur l'ouverture WhatsApp si ça rate |
| `src/screens/` | Un écran par onglet (dont `InventaireVentes.jsx` : 📋 Inventaire, le second bouton de 💰 Ventes, et 📊 INVENTAIRE GÉNÉRAL de l'administrateur ; `MesDonnees.jsx` : 🔒 Mes données, l'onglet du client à côté de 💬 Messages ; `Whatsapp.jsx` : 📲 WhatsApp, séparé de 💬 Messages le 20/09/2026 ; `ArgentRecu.jsx` : 💼 Argent reçu, l'onglet de qui a reçu de l'argent ; `RendezVous.jsx` : 📅 Rendez-vous, pro ou privé, pour tout le personnel ; et `MonAttestation.jsx` : 📄 Mon attestation, le SEUL écran d'un employé sorti pendant ses 24 dernières heures) |
| `api/` | Les fonctions serveur (Vercel) : connexion, filleuls, tournée du matin (`rappels-du-matin.js`, 7 h) et du soir (`rappels-du-soir.js`, 17 h : le rappel des anniversaires de demain ; appelée aussi à 14 h avec `?tournee=rendez-vous` : les rendez-vous de demain), les rappels des rendez-vous écrits une fois pour les deux (`_rendezVous.js`), l'attestation d'un CDD mise à disposition et les accès fermés 24 h après (`_attestationSortie.js`, tournée de 7 h), la lecture d'une table entière écrite une fois pour les deux, et celle d'UNE conversation WhatsApp, page par page (`_tables.js`), envoi WhatsApp (`whatsapp.js`, qui garde la clé YCloud), réception (`whatsapp-entrant.js`, qui fait aussi répondre l'assistant), la porte vers YCloud écrite une fois (`_ycloud.js`, qui dépose aussi un fichier envoyé au client), la porte vers le service d'IA écrite une fois (`_assistantIA.js` — la SEULE à lire la clé `ANTHROPIC_API_KEY` et le nom du modèle `ASSISTANT_IA_MODELE`, variables Vercel) et ouverture d'un fichier reçu (`whatsapp-media.js`), et la relance de l'assistant au client qui s'est tu (`_relanceAssistant.js`, appelée par l'adresse d'arrivée et les tournées de 7 h, 14 h et 17 h), l'alerte au principal quand le service d'IA refuse de répondre (`_alertePanneIA.js`), et le devis renvoyé sans PDF quand Meta rejette le `devis_pdf` (`_relaisDevisPdf.js`, appelée par l'adresse d'arrivée), comme le reçu et la proforma en texte (`_relaisRecuPdf.js`) et les identifiants par `espace` (`_relaisAcces.js`), et « 🤖 Rendre à l'assistant » (`_rendreAssistant.js`, appelée par `whatsapp.js` : la marque, puis la réponse immédiate), et les notes vocales envoyées rangées 30 jours dans l'espace privé de Supabase (`_vocauxStockes.js` : rangées par `whatsapp.js` après l'envoi, rendues par `whatsapp-media.js` après le mur, effacées par la tournée de 7 h) |
| `supabase/securite-*.sql` | Les verrous côté base — **Timo les colle lui-même**, jamais nous (et `rendez-vous-1-table.sql` : la table protégée des rendez-vous) |
| `scripts/` | Le banc : `verifier-*` (application) et `tester-*-sql.sh` (base jetable). Les `_rendu-*.jsx` MONTENT un vrai écran pour le mesurer — seul moyen d'attraper un écran blanc |

---

## Les pièges à ne pas refaire

Ils sont dans `CLAUDE.md` § 5. Les trois qui coûtent le plus cher :
`verifier-imports` attrape un écran blanc que le build ne voit pas ;
`export { x } from "y"` ne crée pas de variable locale ;
un UPSERT déclenche AVANT INSERT même quand la ligne existe.
