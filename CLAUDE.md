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
npm run verifier-cloisonnement   # 992 contrôles : la séparation formation / réel, et tout ce qui a été fermé
npm run tester-verrouillage      # 41  : le blocage des connexions
npm run tester-reglement         # 39  : les échéanciers client
npm run tester-parrainage        # 23  : la création de filleuls
npm run verifier-ecran-stocks    # 11  : l'écran Stocks
npm run verifier-ecran-ventes    # 36  : l'argent dans l'écran Ventes
npm run tester-faire-part        # 14  : les faire-part de suppression (serveur)
npm run tester-argent            # 66  : les règles de rôle sur l'argent (serveur)
npm run tester-comptes           # 54  : les règles de rôle sur les comptes (serveur)
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
  un défaut.
- **Toute liste passe par un filtre d'espace** : boutiques →
  `boutiquesVisibles` ; personnes → `utilisateursDeLEspace` ; lignes
  (ventes, proformas…) → `filtreEspaceAffichage` ou la boutique regardée.
  ⚠ La table des comptes n'est PAS cloisonnée par le serveur (un appareil
  neuf doit retrouver son compte) : pour les personnes, le filtre de
  l'application est la SEULE barrière, pour tous les rôles. Le banc compte
  les lectures brutes de `db.users` fichier par fichier ; une de plus fait
  tomber le contrôle. Trois défauts de ce genre ont été trouvés par Timo
  (Paramètres/Utilisateurs le 29/08, proformas et Salaires le 05/09) —
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
  applique la même règle par déclencheur (`supabase/securite-3` à `-8`).
- **Formation = VIOLET, réel = BLEU** ; la couleur suit l'espace regardé, via
  les variables `--color-sky-*` / `--color-blue-*` de `src/index.css` — jamais
  classe par classe. Vert, rouge, ambre ne changent pas (payé, refusé, attente).
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
  transfert du rôle, bascule réel ↔ formation, plan de règlement, signature
  du contrat en boutique, écran de connexion, cachet, suppression d'une
  boutique avec ses données, restauration d'une sauvegarde, corbeille.
- Magasinier + gérant + admin : articles, entrées, ajustements, transferts,
  inventaire, bons. Gérant + admin : clôture de caisse, fournisseurs.
  Admin + resp. commercial : programmer une installation. Admin ou chef de
  CE chantier : marquer terminé. Admin ou son commercial (« laisser comme
  tel ») : supprimer un chantier, gestes sur un prospect. Réassigner un
  prospect : admin / resp. com / chef d'équipe avec le pouvoir.
- **Remise au-delà de 3 %** : admin seul (devis, vente, proforma, commande).
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
- **Nom des documents : UNE règle** (`nomDocument` / `fichierPdf`, lib/core.js)
  → « Type - Client - Numéro ». **Zone de signature : UNE**
  (`components/ZoneSignature.jsx`, 440 × 300) pour les quatre emplacements.
- **Corbeille** : supprimer un chantier le met de côté 30 jours, restaurable
  par l'admin principal (⚙ Paramètres → 🗑), purge automatique ; aucun écran
  ne voit une fiche à la corbeille (`lib/corbeille.js`, séparée au chargement,
  refusionnée à l'écriture, comme la paie).

### Retours / SAV
- **Un échange n'est JAMAIS une vente** : ajustement négatif
  (`echange_garantie`), aucun CA, aucune commission ; logique dans
  `construireRetour()`. Le défectueux entre dans un **stock SAV à part**
  (« renvoyé au fournisseur » ou « rebut »). Les frais passent par une
  **dette du montant saisi**. Geste réservé à tout admin.

### Stocks
- Présélectionner un article remplit le formulaire d'ajout ; la correction
  ne passe que par ✏️ Corriger. Importation Excel : une feuille par boutique,
  colonnes nom, fournisseur, domaine, catégorie, initial, seuil, prix
  d'achat, prix de vente ; deux modes (nouveaux articles / entrées).

### Apparence et étiquettes
- **Le tableau de bord reste tel qu'il est** (pastel, sélecteur entre les
  deux rangées) : l'habillage « cartes blanches » a été refusé. Ne pas le
  reproposer. Depuis le 09/09/2026, une rangée de pastilles en haut :
  **Toutes** (l'écran tel quel) / chaque boutique / TERRAIN / « Chez le
  comptable » (réel seul) — une boutique choisie filtre TOUT l'écran
  (`dansLaBoutique`, `NOMS_VUES`), mémorisée par écran, jamais hors de
  l'espace regardé.
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
