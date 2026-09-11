# BMI-Gestion — ce qui a déjà été tranché

Ce fichier est lu au début de chaque session. Il existe pour une raison :
**Timo ne doit pas avoir à réexpliquer ce qu'il a déjà décidé.** Tout ce qui
est ici a été tranché par lui, ou appris à la dure sur ce dépôt. Une règle
ne se contourne pas et ne se « réinterprète » pas : si elle gêne, on le dit
à Timo et on attend sa réponse.

Ce fichier ne garde que les RÈGLES et les PIÈGES. L'état des chantiers et
les histoires sont dans `docs/etat-*.md` (voir § 6) — on les lit quand le
sujet revient, pas avant.

---

## 1. À qui on parle

Timo dirige BMI Togo (matériel solaire, Lomé). Il **n'est pas développeur**,
connaît son métier mieux que quiconque et repère les défauts que les tests
ne voient pas : plusieurs corrections importantes sont parties d'une de ses
captures d'écran.

- **On lui écrit en français**, toujours, sans jargon (« la base refuse la
  ligne », pas « violation RLS »). Un mot technique inévitable s'explique
  en passant.
- **On explique AVANT de construire.** Mot pour mot : « tu veux implémenter
  quoi ? dis-moi d'abord ». On décrit, il valide, on construit.
- **On ne le rassure pas à tort.** Un test qui ne teste rien est pire qu'un
  test absent. Si quelque chose n'est pas vérifié, on le dit.
- **Seule exception accordée** : « Si je casse quelque chose, je répare
  immédiatement sans attendre votre feu vert — mais je vous le dis tout de
  suite après. » Un défaut qui viole une règle déjà tranchée par lui (par
  exemple un mélange formation / réel) se répare de même, et on le lui dit.

---

## 2. Les interdits absolus

| Interdit | Pourquoi |
|---|---|
| **Exécuter du SQL sur sa base Supabase** — même si un outil le permet | On l'écrit, on l'explique, **il le colle lui-même**. Le SQL se met **dans le message**, jamais « voir tel fichier ». |
| **Demander ou accepter un `.env`, une clé `service_role`** | Elle n'existe que comme variable Vercel, côté serveur. |
| **Préfixer une clé secrète par `VITE_`** | Vite l'embarque dans le paquet envoyé au navigateur. |
| **`npm run dist`** | Déploiement web uniquement ; Electron n'est plus utilisé. |
| **Pousser sur une autre branche** que celle demandée | — |
| **Mettre un nom de modèle d'IA** dans un commit, un commentaire, une PR | — |

---

## 3. Avant chaque envoi

```
npm run build                    # refuse de passer si le JSX est cassé
npm run verifier-imports         # aucune variable non définie (le build ne le voit PAS — écran blanc 2.101.59)
npm run verifier-cloisonnement   # 1141 contrôles : la séparation formation / réel, et tout ce qui a été fermé
npm run tester-verrouillage      # 41  : le blocage des connexions
npm run tester-reglement         # 39  : les échéanciers client
npm run tester-parrainage        # 23  : la création de filleuls
npm run verifier-ecran-stocks    # 16  : l'écran Stocks
npm run verifier-ecran-ventes    # 36  : l'argent dans l'écran Ventes
npm run tester-faire-part        # 14  : les faire-part de suppression (serveur)
npm run tester-argent            # 134 : les règles de rôle sur l'argent (serveur)
npm run tester-comptes           # 67  : les règles de rôle sur les comptes (serveur)
npm run tester-devis-chantiers   # 84  : devis, chantiers, prospects, boutiques, groupes, corbeille (serveur)
```

Puis `VERSION` dans `src/lib/constants.js` s'incrémente (une version par
envoi, sans exception : c'est ce qui déclenche la mise à jour chez lui), et
`public/version.json`, réécrit par le build, part avec le commit (`git add -A`,
puis `git status` avant de commettre — oublié deux fois).

**⚠ Pousser sur la branche ne déploie rien.** Vercel envoie `main`, rien
d'autre. On ne dit **jamais « déployée »** avant `git push origin HEAD:main`
(le 29/08/2026, dix versions « annoncées » n'étaient pas en ligne ; c'est
Timo qui l'a vu). **La fusion fait partie de l'envoi, on ne la demande pas** :

```
tous les bancs au vert  →  VERSION incrémentée  →  push sur la branche
                        →  git push origin HEAD:main   ← toujours
```

On ne s'arrête avant la fusion que si un banc échoue, ou si la correction
change ses habitudes et qu'il ne l'a pas encore validée — et on le DIT.

**Le banc est la mémoire du projet.** Un défaut fermé reste fermé parce qu'un
contrôle le surveille. Quand un contrôle décrit un comportement qui n'a plus
cours, **on le retourne, on ne le supprime pas**. Tout SQL serveur a son banc
sur base jetable (`scripts/tester-*-sql.sh`) : on regarde si la base a levé
une objection, jamais ce que psql affiche (leçon du 29/08/2026 : un banc qui
lit mal est pire qu'un banc absent).

---

## 4. Les règles métier qu'il a posées

### Formation / réel — le mur
- Une boutique, un compte, une donnée appartiennent à **un espace et un seul**.
- **Seul l'administrateur principal traverse le mur** (« je suis le seul
  admin principal qui peut voir les 2 espaces à la fois »). Il bascule avec
  « 👁 Je regarde » dans ⚙ Paramètres ; le basculement recharge la page,
  survit au F5, meurt à la déconnexion. Sa clé n'est écrite qu'à un endroit,
  `lib/calculs.js`.
- **« Je vois les deux espaces » ne veut jamais dire « je les affiche
  ensemble ».** C'est l'espace REGARDÉ qui décide, pour lui aussi. Toute
  condition `voitLesDeuxEspaces(...) || ...` dans un filtre d'affichage est
  un défaut (quatrième trouvé par Timo : 👑 Équipe, 09/09/2026 — le
  principal y voyait réel et formation mélangés, badge 🎓).
- **Toute liste passe par un filtre d'espace** : boutiques →
  `boutiquesVisibles` ; personnes → `utilisateursDeLEspace` ; lignes
  (ventes, proformas…) → `filtreEspaceAffichage` ou la boutique regardée.
  ⚠ La table des comptes n'est PAS cloisonnée par le serveur (un appareil
  neuf doit retrouver son compte) : pour les personnes, le filtre de
  l'application est la SEULE barrière, pour tous les rôles. Le banc compte
  les lectures brutes de `db.users` fichier par fichier ; une de plus fait
  tomber le contrôle. Quatre défauts de ce genre ont été trouvés par Timo
  (Paramètres/Utilisateurs le 29/08, proformas et Salaires le 05/09, Équipe le 09/09) —
  l'impact argent du dernier a été vérifié sur la vraie base : 0 ligne.
- **L'espace du compte prime sur le réglage** : un admin placé dans la
  formation ne voit jamais les chiffres réels. **Ce qu'on crée naît dans
  l'espace qu'on regarde** (plus de case « formation » à cocher).
- La caisse **« Chez le comptable » est réelle et n'a pas de jumelle** ; la
  caisse TERRAIN, elle, a sa jumelle de formation. Seul le contrôle
  d'unicité d'un nom de boutique regarde les deux espaces.
- La dérogation `'tous'` doit apparaître dans **chaque** politique
  `espace_cloisonnement` côté Supabase.
- **L'application et le serveur doivent dire la même chose.** `api/sync-auth.js`
  et `voitLesDeuxEspaces()` sont un couple : on ne touche jamais l'un sans
  l'autre (un contrôle du banc vérifie leur accord). Tout geste réservé à un
  rôle le revérifie DANS le geste (`refuserSaufAdmin`, `refuserSaufRoles`,
  `refuserSaufAdminPrincipal`, `refuserSaufProprietaire`…), et le serveur
  applique la même règle par déclencheur (`supabase/securite-3` à `-14`).
- **Formation = VIOLET, réel = BLEU** ; la couleur suit l'espace regardé, via
  les variables `--color-sky-*` / `--color-blue-*` de `src/index.css` — jamais
  classe par classe. Vert, rouge, ambre ne changent pas (payé, refusé, attente).
- **🔒 Verrou d'inactivité** (09/09/2026) : après **3 min sans geste sur
  PC, 6 sur téléphone**, une fenêtre couvre l'écran et demande le mot de
  passe du compte (vérifié sur l'appareil, fiche actuelle) ; 5 erreurs ferment la
  session ; le verrou survit au F5 (la session rouvre verrouillée, jamais
  déverrouillée seule). **À 30 min sans geste, verrouillée ou non, la
  session se ferme** (`doitDeconnecter`, PC et téléphone ; Timo : « ne pas
  laisser indéfiniment la session verrouillée »), et une session plus
  vieille que ça ne se restaure pas après F5. **La fermeture des 30 min se VOIT
  tout de suite** (11/09/2026, Timo : « cette page survit toujours et dès que je
  rentre le mot de passe, c'est maintenant la page d'accueil qui revient ») : on
  n'attend pas le réseau pour retirer la fenêtre, **un mot de passe ne ressuscite
  jamais une session expirée** (message « Session expirée : 30 minutes sans
  activité »), et **un déverrouillage réussi remet le compteur à zéro**.
  Règle pure `lib/verrou.js`, fenêtre
  `components/EcranVerrou.jsx` — un FRÈRE du cadre de l'application, jamais
  un enfant ; **aucun `filter: blur` sur l'application derrière** (le
  09/09/2026 : « le mot de passe ne s'écrit pas », redessin de tout l'écran
  à chaque lettre sur un PC modeste).
  Barre du haut (ordinateur) : un bouton « Verrouiller » **sans cadenas**, à
  la place de « En ligne / version / nom » (la barre latérale les garde) ;
  téléphone : juste un 🔐 sur la ligne du titre. **La fenêtre de verrou
  garde sa petite carte** (pas le logo ni le bandeau de la connexion), posée
  sur **le fond de la connexion, avec ses bulles** : UNE règle,
  `decorAccueil` / `FondAccueil` / `Bulles` (screens/Connexion.jsx). **La
  couleur et la transparence de la carte de verrou se règlent à part**
  (⚙ Paramètres → 🔒 Fenêtre de verrouillage, `verrou_couleur_carte` /
  `verrou_opacite_carte`, règles pures dans lib/verrou.js) ; carte sombre →
  texte clair, **mais le champ garde texte et curseur sombres** (sinon blanc
  sur blanc : « le mot de passe ne s'écrit pas », 09/09/2026). **Session sécurisée tombée = la même fenêtre de verrou**
  (« permission denied » à la lecture → `marquerSessionPerdue`, message en
  français, `sync.sessionPerdue`) : le mot de passe déverrouille ET rouvre
  la session (`synchroniserAuth`), sans réseau on déverrouille quand même.
  Plus jamais « déconnectez-vous et reconnectez-vous ». **Jamais de verrou
  par surprise** : une bande orange « Rétablir » en haut, sinon le verrou
  d'inactivité s'en charge ; la session est renouvelée au réveil de
  l'appareil et 10 min avant expiration (`expireBientot`).
- L'étiquette de connexion (espace, rôle, principal, boutique, pouvoirs
  retirés) n'est réécrite **qu'à la connexion** : tout changement de règle
  prend effet à la prochaine reconnexion de chacun — à dire à Timo.

### Les rôles (décisions du 04/09/2026, appliquées côté serveur)
- Admin seul : supprimer vente / dette / dépense / article / compte ; prix
  d'achat, prix de vente, quantité initiale ; retours sous garantie ; agents
  commerciaux ; bloquer un compte et les champs de gestion d'un employé ;
  la fiche d'un chantier (adresse, garantie, délai, entretien, cadeau,
  photo supprimée, compte lié, frais, primes, lien PV, réception forcée,
  avenant) ; catégories de prospects, boutiques, groupes.
- Admin PRINCIPAL seul (« moi seul ») : mot de passe d'un autre compte,
  transfert du rôle, **changer le rôle d'un compte** (🎭 Rôle dans 👥
  Utilisateurs, 09/09/2026 ; jamais un client, jamais sa propre fiche ; la
  boutique suit le rôle ; effet à la prochaine connexion ; `securite-9`),
  bascule réel ↔ formation, plan de règlement, signature
  du contrat en boutique, écran de connexion, cachet, suppression d'une
  boutique avec ses données, restauration d'une sauvegarde, corbeille.
- Magasinier + gérant + admin : articles, entrées, ajustements, transferts,
  inventaire, bons. **Vendeur + gérant + admin : clôture de caisse**
  (09/09/2026, « comment la clôture peut être impossible à un vendeur ? » —
  le « gérant + admin » du 04/09 était un malentendu ; `securite-11`).
  Gérant + admin : fournisseurs.
  **Le vendeur n'a pas l'onglet 🔁 Transfert** (09/09/2026 : il ne peut
  pas valider, l'onglet est parti ; le gérant le garde).
  Admin + resp. commercial : programmer une installation. Admin ou chef de
  CE chantier : marquer terminé. Admin ou son commercial (« laisser comme
  tel ») : supprimer un chantier, gestes sur un prospect. Réassigner un
  prospect : admin / resp. com / chef d'équipe avec le pouvoir.
- **Remise au-delà de 3 %** : admin seul (devis, vente, proforma, commande).
  **Les remises par article suivent la même limite** (10/09/2026 : « même
  sur la remise sur un article, au-delà de 3 % ça devrait refuser ») : une
  remise de ligne > 3 % du prix de la ligne = admin seul. **Remise sur un
  article ET remise générale = refusé pour tout le monde, admin compris**
  (« si la remise est offerte même sur un article, plus possible d'offrir
  une remise générale ») : l'une ou l'autre ; dans 💰 Ventes le champ de
  l'autre se grise. Règle pure `critiqueRemises` (calculs.js) ; serveur
  `securite-14` (ventes et proformas, seulement quand lignes ou remise
  changent — upsert relu). Le rabais du commercial n'est pas une remise
  (pris sur sa commission, plafonné à elle).
- Le comptable est en lecture seule, sauf SON geste : pointer un décaissement.

### Boutique de travail
- « **NE JAMAIS CHANGER DE BOUTIQUE APRÈS UNE SÉRIE D'ACTUALISATIONS.** » La
  boutique est mémorisée **par écran** (`bmi_boutique:<id>:<écran>`) ; le
  dimensionnement en a une seule pour ses trois volets.
- On aide par **présélection**, jamais par une question de confirmation (ses
  boutiques vendent le même matériel : l'alerte partirait sur le cas normal).

### Clients, devis, chantiers
- Un téléphone se compare sur ses **8 derniers chiffres** (`memeNumero`).
- **Une commission n'est due qu'après DEUX choses** : réception des travaux
  **et** solde de la dette (« un franc ne sort pas de la caisse avant d'y
  être entré »). Part du parrain et apporteur externe : même règle.
- Le plan de règlement se choisit **à la signature du contrat**, pas du PV ;
  date de première échéance **libre**.
- L'appareil d'un client ne télécharge que ses données : les politiques RLS
  sont la seule barrière, aucun filtre côté application.
- Un devis ne touche pas le stock ; l'encaissement, oui (« ça reste ainsi »).
  Solaire : le rail se vend au mètre (prix de ⚙ Paramètres, jamais celui du
  stock) ; **supports de rail = rails × 2 arrondi au pair suivant, étriers =
  (panneaux × 2) + 8** (règle Timo du 07/09/2026), lignes ajoutées seulement
  si l'article est en stock, au prix du stock, liées à lui pour la sortie.
  **Chaque ligne de fixation a sa case de quantité** (0 = retirée) ; une
  correction est liée à la base qui l'a produite (mètres de rails,
  panneaux) et tombe si la base change. **Le brouillon du volet solaire
  garde équipements, quantités, rails et corrections** : un F5 ne remet
  rien au calcul (Timo, 08/09/2026 : « les quantités reviennent »). Pour y
  revenir : **UN lien « Annuler (revenir à la sélection automatique) »**
  (`LienAuto`, Solaire.jsx) sur toute ligne qui s'écarte du calcul —
  article, quantité, rails, supports, étriers. Pas de bouton global
  (« prendre la règle existante »). **Portail et Autre font pareil** :
  leur brouillon garde choix, verrous, HB, options et **autres
  équipements** (les trois volets) ; un devis repris prime toujours, et le
  premier calcul au montage saute (`sauterPremierCalcul`).
- **Autres équipements** (08/09/2026) : le champ Article propose d'abord le
  stock de la boutique regardée ; un nom qui y correspond LIE la ligne
  (prix du stock pré-rempli, `produit_id`, sortie de stock à l'encaissement,
  HB décochée) ; un nom libre reste libre et **coche HB d'office** (règle
  pure `lierAutreAuStock`, devisCommun.js). Jamais `db.produits` en entier.
  **Aucune mention sous le champ** (« supprimer la mention ») : la case HB dit tout.
- **Les appareils du volet solaire** (09/09/2026) : catalogue de 60 appareils
  avec puissance typique et **autres noms / abréviations** (`lib/appareils.js`),
  proposé dans le champ Appareil ; **seul un CLIC sur une proposition
  pré-remplit** (`onChoisir`), ce qui est tapé n'est jamais transformé
  (« à peine j'écris TV, la case se remplit » — refusé) ; hors liste =
  saisie libre. **Une faute d'une lettre est tolérée** (mots de 4
  lettres et plus, `correspondApprox`). Un mot partagé (« poste »,
  « machine ») ouvre la liste, ne choisit jamais. La liste grandit dans
  ⚙ Paramètres → 🔌 Appareils (admin ; écrit `appareils_catalogue` sur les
  boutiques de l'espace regardé) ; « à classer » = les inconnus des devis,
  dérivé, jamais écrit par un vendeur.
- **🆕 Nouveau devis** (solaire, 09/09/2026) : à côté de « Ajouter un
  appareil », **seulement au-delà de 5 appareils** (en dessous on retire à
  la main) ; confirmation avant d'effacer, qui rappelle « Enregistrer un
  brouillon » ; efface appareils, choix, rails, autres équipements, client,
  conditions — garde autonomie, soleil, tension, batterie.
- **Les devis SANS CALCUL** (vidéo surveillance, électricité, forage — volet
  « Autre ») : **catégorie à gauche, ses articles à droite** (11/09/2026, après
  « besoin du client / article proposé… je ne comprends pas » puis « je propose
  que le besoin du client soit une catégorie et article proposé déroule les
  articles de la catégorie choisie… tout court. Ceci pour tous les devis sans
  calcul »). ⚠ **Les colonnes gardent les MOTS DU MÉTIER** : « Besoin du
  client » et « Article proposé », jamais « Catégorie » et « Article »
  (11/09/2026 : « besoin du client reste toujours besoin et non catégorie ») —
  la liste déroulante est notre façon de faire, le vendeur choisit un BESOIN.
  Deux listes déroulantes, **aucune recherche par ressemblance** :
  `categoriesDuStock` (catégories du stock du domaine regardé) puis
  `articlesDeCategorie`. La première catégorie propose son premier article, le
  vendeur déroule. « ✏️ Saisir un article hors stock » reste. **Chaque ligne
  porte SA catégorie** — elle titre son groupe dans le PDF dès 2 lignes — et le
  devis **ne fabrique plus de bloc « Votre demande »** : répéter les catégories
  au-dessus de l'équipement serait la tautologie retirée le matin même. Une
  reprise récupère tout ce qui n'est pas « Autres équipements ».
  `correspondancesBesoin` et le champ à suggestions ont été RETIRÉS de ce
  volet : une règle qui ne commande plus rien ne reste pas en place.
- **UN champ à suggestions pour toute l'application** (08/09/2026) :
  `components/ChampSuggestions.jsx` + règle pure `lib/suggestions.js`.
  Recherche sans accents ni majuscules, chaque mot tapé dans n'importe quel
  ordre (« came » → Caméra) ; **un mot court (≤ 3 lettres) doit COMMENCER un
  mot** (« tv » ne sort ni « dstv » ni « cctv », capture Timo 09/09) ; la liste s'ouvre **sous la ligne**, à sa
  largeur (320 px au moins), le **nom en entier** sur plusieurs lignes s'il
  le faut, le détail dessous — jamais coupé par « … » (« risque de choisir
  un autre câble »). Jamais un voile sur tout l'écran. La **recherche
  générale** (loupe du menu) suit la même règle et montre **prix et stock**
  de chaque article. **Plus jamais de `<datalist>`**
  natif (le banc l'interdit).
- Signature en boutique : admin principal seul, jusqu'au mode superviseur.
- **Aucun avertissement « quantité inhabituelle »** dans le dimensionnement
  (08/09/2026, « quelle que soit la quantité ») : la quantité est juste, sans
  plafond ni message. Ne pas le remettre.
- **📝 Brouillons de devis** (08/09/2026) : bouton « Enregistrer un brouillon »
  à côté de l'envoi WhatsApp, allumé dès que le client est choisi, **sans
  aucune question** (« je ne veux pas un déroulé »). Le brouillon vit dans la
  fiche de l'employé (`brouillons_devis`, liste pour la fusion), onglet
  « Mes brouillons » dans Dimensionnement ; envoyé ou converti, il disparaît.
  Un brouillon repris s'AJOUTE chez le client à l'envoi (jamais `idAReprendre`).
- **✏️ Corriger un devis déjà envoyé** (11/09/2026, « celui qui a proposé le
  devis peut avoir la possibilité de modifier le devis ? ») : « Modifier et
  renvoyer » s'ouvre aussi sur un devis **⏳ Proposé** (avant, il fallait que
  le client ait réagi ; une faute vue juste après l'envoi obligeait à refaire
  un devis entier). **Qui** (option « b » choisie par Timo) : **celui qui l'a
  établi, l'admin, le resp. commercial** — pas le vendeur de la boutique de
  paiement, qui le voit pourtant. **✅ Validé et 💰 Payé restent fermés à
  tous** en direct (contrat signé, argent encaissé). Le devis repris **REMPLACE** l'ancien (même id, `idAReprendre`), jamais un
  doublon chez le client. **Toute correction laisse sa TRACE** (« personne ne
  baisse un prix en silence ») : `modifie_le`, `modifie_par`,
  `nb_modifications` posés par `marquerModification`, badge sur la ligne.
  Règles pures `peutModifierDevis` / `motifRefusModification` /
  `marquerModification` (lib/comptesClients.js), revérifiées DANS le geste.
- **✏️ Modifier un devis DÉJÀ SIGNÉ : le client ouvre la porte** (11/09/2026,
  « s'il a déjà signé, impossible de modifier… l'utilisateur va faire une
  demande de modification auprès du client… le client valide la demande avant
  que le devis ne soit modifiable ») — **`lib/modifDevis.js`**, règles pures.
  **✅ Validé SEUL** (« Validé seul » ; 💰 payé jamais : c'est la vente qu'on
  corrige, par une reprise). Le parcours : « Demander une modification »
  (motif obligatoire, auteur / admin / resp. com) → **⏳ en attente** du
  client, le devis n'est PAS encore modifiable → le client **accepte**
  (`devisModifiable` s'ouvre) ou **refuse** (le devis reste signé tel quel,
  rien ne bouge) → le vendeur corrige et renvoie → **🔄 Corrigé**, jamais
  « proposé » (Timo) → le client **accepte et RE-SIGNE** (décision A : même
  numéro de contrat, ancienne signature archivée dans `historique_modif`,
  **plan de règlement remis à valider** — décision C) **ou refuse et le devis
  est REJETÉ** (décision B, l'affaire s'arrête). **3 aller-retour au plus**
  (`MAX_CYCLES_MODIF`, `cycles_modif`) : au-delà, « il devient caduc », on
  établit un nouveau devis. **Deux portes fermées d'office** : chantier
  **réceptionné** (travaux livrés) et **argent déjà versé** sur ce devis. Pose
  seule : la dette et les frais du chantier SUIVENT le nouveau montant, jamais
  un second chantier (`accepterDevisCorrige`, pas `validerDevis`). ⚠ Ne pas
  confondre `demande_bmi` (BMI demande au client) et `demande_modif` (le
  client demande à BMI, champ ancien).
- **📲 Relance des devis sans réponse** (09/09/2026, « Tous les devis ») :
  seuil **15 jours**, comptés depuis la dernière relance (`relance_le`)
  sinon depuis le devis. **Proposé et validé (non payé) seulement ; payé
  ne se relance plus**, ni rejeté, ni modification (là c'est au vendeur de
  répondre). Le texte dépend du statut — UNE règle pure, `texteRelanceDevis`
  (lib/comptesClients.js), exercée par le banc ; l'écran passe par
  `envoyerWhatsApp` et note date, auteur, nombre de relances sur le devis.
- **Un message, une dépense automatique : UNE fabrique** (`nouveauMessage`,
  `SYSTEME`, `nouvelleDepense`, lib/core.js, 08/09/2026). Les questions
  posées partout aussi (`demanderMoyenPaiement`, `demanderMois`,
  `demanderDate`, components/ui.jsx). Le banc interdit les copies.
- **Prospect devenu client : UNE fiche** (`prospectAcquis`, lib/prospects.js,
  08/09/2026) : encaissement et « Convertir » posent les mêmes champs, vente
  et compte dès qu'on les connaît, jamais retirés.
- **Contrat et PV : UNE règle** (`lib/contrat.js`, 08/09/2026) : numéro de
  contrat, numéro de PV, plan de règlement signé, champs du lien PV — les
  deux chemins de signature (téléphone du client, boutique) y passent.
- **WhatsApp : UNE règle** (`lienWhatsApp` / `envoyerWhatsApp`, lib/core.js,
  08/09/2026) : numéro nettoyé, texte encodé, filet anti-blocage. Aucun
  écran n'écrit `wa.me` ni n'ouvre WhatsApp lui-même — le banc l'interdit.
- **📄 Le devis a UNE présentation commerciale, pour les trois volets**
  (11/09/2026, après un avis extérieur sur le PDF « administratif » ; Timo :
  « ça me convient », puis « fais le même rendu pour portail et autre ») :
  `devisCommercial` dans `src/pdf.js`. **UNE charpente** — bloc du besoin,
  **Équipement proposé** (**la catégorie ne titre son groupe que s'il compte
  AU MOINS 2 lignes** — 11/09/2026, « trop de tautologie » : « Panneaux
  solaires » au-dessus de « Panneau 400W » se lisait deux fois ; deux modèles
  et le titre revient seul —, remise en rouge négatif), **TOTAL DU PROJET**
  puis acompte et solde (`pct_acompte`,
  `montant_acompte`, `delai_installation`), **mentions + validité
  (`VALIDITE_OFFRE_JOURS` = 15) + DEUX cadres de signature**. **Le devis
  engage BMI** (11/09/2026, « un devis devrait avoir une signature ? » — il
  n'y avait que celui du client) : cadre gauche **« Pour BMI Togo »** avec le
  nom de l'élaborateur, sa `signature_personnelle` si sa fiche en porte une,
  et LE cachet de la maison (`cachet_bmi` / `CACHET_BMI_DEFAUT`, le même que
  les contrats — jamais un deuxième) ; cadre droit « Bon pour accord » avec
  **la date libre DEDANS** (« la date d'en bas n'est plus importante car en
  haut déjà il y a une date » : celle du haut est la date du devis, celle du
  bas le jour où le client dit oui). Une image illisible ne fait jamais
  tomber le PDF (`imageDansCadre`) ; **le cachet est CARRÉ, c'est la hauteur
  du cadre qui le bride** (11/09/2026, deux captures dans l'ordre : « le cachet
  est trop petit, l'agrandir davantage », puis « les cadres des signatures sont
  trop trop gros, réduire au max ») : **cadre 56 × 28, cachet dessiné à 20 mm**,
  marges intérieures réduites à presque rien ; le banc MESURE la taille
  réellement dessinée (entre 19 et 22 mm — ni rabougri, ni cadre géant).
- **Le bas du devis tient sur la page de l'équipement** (11/09/2026, « est-ce
  possible d'avoir les signatures sur la même page ? ») : **TOTAL + acompte +
  mentions + les deux cadres forment UN bloc insécable** (`hauteurBlocFinal`,
  UN seul `placePour` dans `devisCommercial`) — jamais une page 2 qui ne porte
  que la signature, jamais du matériel sans son prix. La place vient de l'AIR,
  pas du contenu : lignes de tableau resserrées (`cellPadding`), identité du
  haut à 4 mm d'écart, cases du besoin à 15 mm, blancs entre blocs. Un devis
  ordinaire (6 appareils, 7 lignes, acompte + solde + délai) tient sur UNE
  page ; le banc le mesure, et mesure aussi qu'**aucun texte n'en chevauche un
  autre** (poser les mentions à gauche du total a été tenté et ABANDONNÉ : la
  première ligne, 108 mm, mordait sur « Acompte à la commande »). ⚠ **Le
  bandeau TOTAL monte 7,5 mm AU-DESSUS de son libellé** (`bandeauTotal`
  dessine de `y-6` à `y+5`) : l'oublier en resserrant les blancs le pose SUR
  la dernière ligne du tableau (capture Timo, 11/09/2026 — « Frais
  d'installation » écrasé). `blocEquipement` rend donc `finalY + 6 + 3`, et
  le banc MESURE cet écart (≥ 3 mm) — le contrôle de chevauchement des
  TEXTES ne voyait rien, le bandeau étant un rectangle plein. ⚠ **Un titre de
  colonne ne reçoit PAS `columnStyles`** : il reste à gauche pendant que ses
  valeurs sont à droite (capture Timo, 11/09/2026 — « la puissance (W) n'est
  pas centrée sous la ligne… même souci dans équipement proposé »). Chaque
  titre porte donc son alignement (`enTete(texte, halign)`), le pied aussi, et
  le banc MESURE bord à bord que le titre d'une colonne de montants finit là
  où finissent ses montants. **Seul le bloc du
  besoin change** (`blocBesoin` choisit d'après la forme des besoins) :
  solaire → « Votre besoin » en trois cases (kWh/jour, kW simultanés,
  autonomie ; **jamais de Wh bruts**) puis « Vos appareils » ; portail → le
  **TYPE réel du projet** en titre (« VOTRE PORTAIL COULISSANT », « VOTRE
  RIDEAU MÉTALLIQUE »… — jamais le mot « ouvrant », qui est celui du code :
  Timo, « votre ouvrant ??? »), dimensions, poids RETENU, usage en un mot,
  puis le détail ; autre → « Votre demande », ce que le client a demandé
  tel qu'exprimé. **Le document parle la langue du client, pas celle du
  code.** **On n'invente jamais un bloc vide** : un ancien devis sans
  besoins commence directement à l'équipement, sans en-tête de groupe
  inventé. Aucune donnée, aucun calcul, aucune règle de rôle ne change :
  **la mise en page seulement**, et les briques communes (entête, bandeau
  de formation, bandeau total, mentions, pied de page) restent écrites UNE
  fois. Le banc MESURE le texte réellement écrit dans le PDF.
- **🛒 Une proforma se REPREND au panier** (11/09/2026, après « dans les
  grands logiciels, ça se passe comment ? » — la proforma y est une façon
  d'imprimer le devis, donc transformable ; Timo a choisi de garder la
  proforma telle quelle et de la rendre reprenable) : bouton **« 🛒 Vendre »**
  sur sa ligne dans 💰 Ventes. **« Reprise » ne désigne QUE l'article rendu
  par le client** (11/09/2026 : « reprise des proforma pour en faire une
  vente et reprise dans vente pour reprendre un article, ça porte
  confusion ») : trois gestes voisins, trois mots distincts — « 🛒 Vendre »
  sur une proforma, « ↩ Reprise » sur une vente, « 🔁 Retour » pour la
  garantie. Le clic remplit le panier, **l'encaissement reste à faire**. Règle pure `reprendreProforma`
  (lib/calculs.js) : la proforma émise garde `produit_id` sur chaque ligne,
  les anciennes sont retrouvées par le NOM dans la boutique ; une proforma
  d'une AUTRE boutique est refusée en nommant la bonne, **jamais de
  changement de boutique tout seul** ; un article introuvable est listé au
  vendeur, jamais mis au panier sans sa fiche ; le prix de la proforma est
  gardé et l'écart avec le prix du jour est signalé ; une vieille proforma
  qui cumule remise de ligne et remise générale voit **la générale écartée**
  (règle du 10/09). Rien n'est enregistré à la reprise : le vendeur vérifie
  puis encaisse. Pas de bouton direct devis → vente : la validation et le
  contrat restent le passage obligé.
  **Une proforma déjà encaissée se reprend quand même, mais on PRÉVIENT**
  (11/09/2026 : « l'avertissement, avec un nouveau numéro de reçu
  évidemment car c'est une nouvelle vente ») : la vente cite sa proforma
  (`proforma_id`, `proforma_numero`), la liste dit ce que chaque proforma
  est devenue (« ✅ Encaissée le … — reçu N° » ou « ⏳ En attente »,
  `ventesDeProforma`), et reprendre une proforma déjà encaissée demande
  confirmation en nommant la date et le reçu. **Jamais de blocage** : un
  client peut recommander le même matériel. Le numéro de reçu est de toute
  façon recalculé à chaque vente (`prochainNumeroVente`).
- **Nom des documents : UNE règle** (`nomDocument` / `fichierPdf`, lib/core.js)
  → « Type - Client - Numéro ». **Zone de signature : UNE**
  (`components/ZoneSignature.jsx`, 440 × 300) pour les quatre emplacements.
- **Corbeille** : supprimer un chantier le met de côté 30 jours, restaurable
  par l'admin principal (⚙ Paramètres → 🗑), purge automatique ; aucun écran
  ne voit une fiche à la corbeille (`lib/corbeille.js`, séparée au chargement,
  refusionnée à l'écriture, comme la paie).

### Versement des fonds (09/09/2026)
- **« 💸 Verser les fonds » dans 🔒 Caisse** (**gérant et admin — pas le
  vendeur**, décision du 09/09/2026 ; serveur `securite-11`) :
  destinations **Chez le DG / BANQUE / Chez le comptable**, **« Chez le
  DG » proposé d'office** (10/09/2026) ; BANQUE exige
  nom de la banque et numéro de bordereau. **Plus de « recette du … au »**
  (deuxième idée de Timo) : l'application attend `fondsAVerser` ; **si le
  montant versé diffère, la Note apparaît avec, en rouge, « Justifiez
  pourquoi le montant n'est pas X »**, et elle est obligatoire ; montant
  égal → pas de note. Chez le DG et le comptable : **« Versement du
  <date> »**, jamais un intervalle ; écart et justification suivent. Le versement est une dépense
  espèces de la boutique (catégorie « Versement de fonds », champ
  `versement`) ; « Chez le comptable » pose en plus une entrée miroir
  (montant négatif, `versement_id`) dans la caisse du comptable.
  **Validation : Chez le DG et BANQUE → le DG = administrateur PRINCIPAL**
  (bloc **permanent** en haut de 🔒 Caisse, vide il le dit, **la boutique
  regardée seule** — « dans Demakpoe, Demakpoe seul », 10/09/2026 —
  montant en gras) ; **Chez le comptable → le comptable**, par son
  pointage « ✅ Encaissé ». UNE règle pure : `lib/versements.js`. Versement
  libre, jamais imposé à la clôture. Un compte de formation n'a jamais
  « Chez le comptable ». Serveur : `securite-10` (la validation DG = admin
  principal seul, upsert relu).
- **Un versement n'est JAMAIS une dépense** (10/09/2026, capture : « pourquoi
  il pense que le versement est une dépense ? » — résultat du jour à
  −252 299). Il n'est une sortie que pour la caisse (fonds à verser,
  clôture). Tableau de bord (cartes, graphique, synthèse par période),
  export « Dépenses » et journal comptable passent par `horsVersements`
  (`lib/constants.js`, où vit `CATEGORIE_VERSEMENT`, réexportée par
  lib/versements.js) ; les versements ont leur export « Versements ».
- **✖ Rejet d'un versement** (10/09/2026, « l'argent doit retourner comme
  jamais versé ») : **qui valide rejette** (DG pour Chez le DG / BANQUE,
  comptable pour Chez le comptable), **en attente seulement**, motif
  obligatoire, rejet inaltérable, rejeté jamais validé. « Jamais versé » =
  la sortie ET l'entrée miroir passent à **0 F** (montant d'origine gardé
  dans `versement.montant`) : tout ce qui additionne les dépenses l'ignore
  sans exception à écrire. Le gérant reçoit un message. Règle pure
  `critiqueRejet` / `rejeterVersement` (lib/versements.js) ; serveur
  `securite-12` (montant forcé à 0 ; le comptable n'obtient que ce geste en
  plus de son pointage, porte `rejetVersement` de `save`).

### Clôture de caisse (09/09/2026)
- **Caisse non clôturée = ventes bloquées le lendemain** (décision Timo :
  « un blocage est mieux »). Une journée PASSÉE avec au moins une vente (tout
  moyen) ou un encaissement espèces, sans clôture, bloque l'encaissement dans
  💰 Ventes pour cette boutique, avec le motif en tête d'écran et au clic.
  L'écran 🔒 Caisse propose alors les jours en retard (le plus ancien
  d'abord) et permet de clôturer un jour passé (`cloture_le` = jour réel).
  La règle ne regarde pas avant `DEBUT_REGLE_CLOTURE` (2026-09-09). UNE règle
  pure, `lib/cloture.js` (`activiteDuJour` sert aussi à l'écran Caisse).
  **« Montant attendu dans le tiroir » = le SOLDE d'espèces à la fin du jour**
  (`soldeEspecesFinDeJour`), pas le flux du jour (capture Timo, 09/09/2026 :
  −150 900 affiché alors qu'il restait 50 000 dans le tiroir). **La clôture
  se lit en quatre lignes** (Timo : « c'est journalier : recette du jour
  théorique contre montant du tiroir ») : fonds de caisse d'hier soir +
  recette du jour − sorties justifiées (dépenses + versements, **qui ne
  créent jamais d'écart** : « une dépense n'est pas un manque ») = attendu
  dans le tiroir ; le champ s'appelle « Montant du tiroir (tout ce qu'il
  contient, compté) ». Saisir la recette du jour à la place du tiroir est
  signalé en rouge avec le calcul (`alerteSaisieRecette`, écart 1 400 de sa
  capture). Blocage côté application seulement (règle de travail, pas de rôle).
  **Plusieurs vendeurs, UNE caisse, UNE clôture** (11/09/2026 : « que ce soit
  l'admin, le gérant ou le vendeur qui a vendu, c'est la même caisse ») : la
  clôture montre « Recette du jour par vendeur » (ventes tout moyen, espèces
  encaissées ventes + dettes, autres moyens ; `recetteParPersonne`), une
  lecture, jamais une clôture par personne. Le tiroir par vendeur (option 3)
  n'a pas été demandé : ne pas le construire sans sa demande explicite.

### Retours / SAV
- **↩ Reprise d'un article par le client** (10/09/2026, « un article vendu
  mais sur le champ le client ne veut plus le prendre » → « Reprise pour
  l'administrateur principal seul ») : bouton dans 💰 Ventes, principal
  seul. **La vente reste telle qu'encaissée** (reçu, numéro, date, total,
  caisse du jour intacts) ; la reprise est notée sur la vente (`reprises`,
  liste qui ne rétrécit jamais) ; **CA et commission deviennent nets**
  (`caVente` = `caVenteBrut` − `montantRepris`, `caLigneVente` idem,
  Rentabilité nette en quantité et coût) ; l'article revient au **stock
  normal** (ajustement `reprise_client`, jamais le SAV) ; l'argent :
  vente payée → dépense **« Remboursement client »** du jour, au prix
  payé net des remises au prorata, moyen au choix (jamais à crédit) ;
  vente à crédit → **la dette diminue**, seul le versé au-delà est rendu.
  Motif obligatoire ; refusée si chantier créé ou commission payée.
  « Remboursement client » n'est pas une charge (`CATEGORIES_HORS_CHARGES`,
  avec le versement). Règle pure `lib/reprises.js` ; serveur `securite-13`
  (remplace ventes securite-8, ajustements securite-4, dépenses securite-12).
- **Un échange n'est JAMAIS une vente** : ajustement négatif
  (`echange_garantie`), aucun CA, aucune commission ; logique dans
  `construireRetour()`. Le défectueux entre dans un **stock SAV à part**
  (« renvoyé au fournisseur » ou « rebut »). Les frais passent par une
  **dette du montant saisi**. Geste réservé à tout admin.

### Stocks
- **⚠ À réapprovisionner** (10/09/2026, « comment avoir la liste de tous les
  articles à approvisionner ? ») : un encadré dans 📦 Stocks, pour la
  boutique ou le magasin regardé, avec **TOUS** les articles au seuil ou en
  dessous, du plus urgent au moins urgent, manque = seuil − reste (au
  moins 1) ; bouton Exporter ; sur une boutique de vente, « 🚚 Demander ce
  ravitaillement » pré-remplit la demande au magasin (`panierInitial`),
  modifiable avant l'envoi. Règle pure `articlesAReapprovisionner`
  (lib/calculs.js). L'encadré du magasin « Alertes de stock dans les
  boutiques » n'a plus de limite à 20 lignes. **Les deux listes tiennent
  dans un cadre à hauteur fixe qui défile** (« au plus 8 ou 10 lignes, et
  une barre de défilement », 10/09/2026), en-tête collé en haut, et **la
  colonne Article collée à gauche pendant le défilement horizontal, sur
  téléphone exclusivement** (« figer le nom de l'article », 10/09/2026 ;
  `lg:static`).
- Présélectionner un article remplit le formulaire d'ajout ; la correction
  ne passe que par ✏️ Corriger. Importation Excel : une feuille par boutique,
  colonnes nom, fournisseur, domaine, catégorie, initial, seuil, prix
  d'achat, prix de vente ; deux modes (nouveaux articles / entrées).

### Apparence et étiquettes
- **Le tableau de bord reste tel qu'il est** (pastel, sélecteur entre les
  deux rangées) : l'habillage « cartes blanches » a été refusé. Ne pas le
  reproposer. Depuis le 09/09/2026, une rangée de pastilles en haut :
  **TOUTES** (en majuscules ; l'écran tel quel) / chaque boutique / TERRAIN / « Chez le
  comptable » (réel seul) — une boutique choisie filtre TOUT l'écran
  (`dansLaBoutique`, `NOMS_VUES`), mémorisée par écran, jamais hors de
  l'espace regardé. **Pas de carte à zéro** : un dépôt ou « Chez le
  comptable » ne montrent que dépenses (+ stock pour le dépôt) ; TERRAIN
  pas de stock ; le graphique et la synthèse ignorent les dépôts
  (`NOMS_GRAPHE`). **Les cartes Ventes / Dépenses / Résultat sous le
  sélecteur suivent la période choisie**, nommée sur la carte (capture
  Timo, 10/09/2026 : « Aujourd'hui » choisi, elles disaient encore « du
  mois ») ; « Dettes en cours » ne dépend pas de la période. **Le sélecteur
  démarre sur « Aujourd'hui »** (11/09/2026 : « Période doit rester sur
  Aujourd'hui par défaut » — c'était « Ce mois »).
- Étiquettes **60 × 30 mm**, boutique en haut, article en bas, code-barres
  11 mm ; `LONGUEUR_MAX_CODE = 17` (barre fine jamais sous 0,25 mm).

---

## 5. Les pièges rencontrés — ne pas y retomber

- **Le build ne vérifie PAS les noms** : une fonction utilisée sans import
  passe le build et donne un ÉCRAN BLANC (2.101.59). `verifier-imports`
  fait partie de chaque envoi ; un script qui ajoute une ligne ajoute
  l'import dans le MÊME geste, et on vérifie.
- **`export { x } from "y"` ne crée PAS de variable locale** : importer ET
  réexporter. Touché deux fois.
- **Aucun hook React après un `return` anticipé** dans `App.jsx`
  (`if (!db) return …`) : écran blanc. Touché deux fois.
- **Un UPSERT n'est pas une création — et PostgreSQL déclenche AVANT INSERT
  même quand la ligne existe.** L'application n'écrit QUE par upsert : toute
  règle « créer = réservé à… » dans une branche INSERT doit d'abord relire
  la ligne (`select data into avant … where id = new.id`) et, si elle
  existe, appliquer les règles de MISE À JOUR. Touché TROIS fois : comptes
  (18/08, roles-1b), puis boutiques / dépenses / ventes / proformas (08/09,
  securite-8 — « demande de ravitaillement ne passe pas », capture Timo).
  Une politique RLS d'INSERT a le même piège (pointage du comptable). **Le
  banc SQL teste chaque règle par UPSERT (`UPS`), pas seulement par UPDATE**
  — le banc par UPDATE seul rassurait sans protéger.
- **Supabase donne les droits par défaut à `anon` sur toute nouvelle table
  ET toute nouvelle fonction.** `revoke from public` ne suffit pas.
- **`src/lib/identiteClient.js` ne doit rien importer** (lu par Node aussi).
- **Un cadre confié à une bibliothèque extérieure (Leaflet) n'a JAMAIS
  d'enfant React** : div auto-fermé, textes dans un frère (carte blanche
  du 02/09, trouvée par mesure après trois correctifs à côté).
- **Une expression régulière trop large casse le JSX en silence** : après
  toute retouche en masse, `npm run build`, et `git checkout --` sans hésiter.
- **Un pouvoir, un bouton, une alerte qui ne commande plus rien se retire**,
  jamais laissé en place.
- **Une écriture refusée par le serveur coince tout le lot** (tout ou rien)
  et doit afficher son motif ; le filet « Abandonner ce geste refusé »
  (admin principal) retire le geste de la file.
- **Le banc mesure, il ne présume pas** : bundler le module (esbuild) et
  exercer la vraie fonction plutôt que lire le code ; un contrôle qui rassure
  sans protéger est pire qu'absent.

---

## 6. Ce qui reste ouvert — voir `docs/`

Un fichier par sujet, à lire **quand le sujet revient**. Chacun dit où l'on
s'est arrêté, mot pour mot.

| Sujet | État | Fichier |
|---|---|---|
| Chantiers en attente du feu vert de Timo : **mots de passe clients** (3 voies proposées, pas tranché), **mode superviseur** (cadré, « pas pour le moment »), **corbeille** (faite pour les chantiers ; prospects / articles / ventes possibles) | À sa demande | `docs/etat-chantiers-en-attente.md` |
| **WhatsApp depuis le numéro BMI** (coexistence, YCloud créé, arrêté au QR) | En pause, ne pas relancer | `docs/etat-whatsapp-numero-bmi.md` |
| **Doublons** : les 17 points du relevé (A1–A12, B1–B5) sont unifiés, 2.101.64 → 2.101.81 (« lance tout », 08/09/2026) ; le fichier dit où vit chaque règle | Clos | `docs/doublons-2026-09.md` |
| Vague 3 — verrous serveur entre employés | Terminée, tout collé | `docs/etat-vague-3-verrous-serveur.md` |
| Vague 2 — lecture des comptes clients (histoire ESSO close) | Terminée, tout collé | `docs/etat-vague-2-lecture-client.md` |
| Suites de l'audit du 29/08 (graves fermés, hygiène, 3 projets sur la base) | Fermé, ne pas rouvrir | `docs/etat-audit-2026-08.md` |
| Inventaire des verrous (cases cochées par Timo) | Référence | `docs/inventaire-verrous-employes-2026-09.md` |
| Audit complet du 29/08 (22 279 lignes lues) | Référence | `docs/audit-complet-2026-08.md` |
| L'ancien CLAUDE.md complet (659 lignes), tel qu'il était avant le rangement du 06/09 — pour retrouver un détail condensé ici | Référence | `docs/CLAUDE-avant-rangement-2026-09-05.md` |
| Cloisonnement **par boutique** (au-delà de l'espace) | Reporté | — |

Quand un chantier avance, on met à jour SON fichier dans `docs/`, et ce
tableau seulement si l'état change.
