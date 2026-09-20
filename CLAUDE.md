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
| **Un compte ou un mot de passe de départ dans le code** | Retiré le 12/09/2026 (« ADMIN2026 », avis extérieur relu par Timo). Une base neuve crée son premier administrateur côté serveur : `docs/installation-premier-administrateur.md`. |

---

## 3. Avant chaque envoi

```
npm run build                    # refuse de passer si le JSX est cassé
npm run verifier-imports         # aucune variable non définie (le build ne le voit PAS — écran blanc 2.101.59)
npm run verifier-cloisonnement   # 1767 contrôles : la séparation formation / réel, et tout ce qui a été fermé
npm run tester-verrouillage      # 41  : le blocage des connexions
npm run tester-reglement         # 39  : les échéanciers client
npm run tester-parrainage        # 23  : la création de filleuls
npm run tester-notifications     # 77  : les notifications (liste A = messages, liste B = pour information, tournée du matin, le mur, un seul chemin, rien de secret)
npm run verifier-ecran-stocks    # 18  : l'écran Stocks (liste Catégorie, Toutes d'office, colonne Article figée sur téléphone)
npm run verifier-ecran-ventes    # 48  : l'argent dans l'écran Ventes, sa liste mesurée dans Chromium (clic, logo WhatsApp), une dette affichée pareil, l'historique qui défile et s'archive
npm run verifier-ecran-travaux   # 17  : l'écran 🛠 Travaux à crédit monté dans Chromium (chiffres, prestation, choix de l'article en tapant, titres des cases)
npm run verifier-onglets-deplacables # 13 : l'appui long qui déplace un onglet, dans un vrai navigateur (souris et doigt)
npm run verifier-champs          # 18  : la LARGEUR des champs, mesurée dans Chromium (la ligne de recherche bridée sur PC, pleine sur téléphone ; les DEUX témoins qui prouvent qu'un max-w sur un champ et une transition sur un bouton ne commandent rien)
npm run verifier-mot-information # 35  : le mot d'information de la première ouverture (les mots qui mettent mal à l'aise, la fenêtre mesurée dans Chromium : un seul bouton « J'ai compris », aucun rouge, les deux bouts atteignables)
npm run verifier-whatsapp        # 102 : l'envoi WhatsApp du numéro BMI (l'ordre des trous d'un modèle, le mur, aucun secret, un seul chemin, rien de perdu en silence, le refus de WhatsApp dit en français)
npm run verifier-partage         # 4   : le PDF partagé, mesuré dans Chromium (A4 quelle que soit la largeur de l'écran, pages, marges rognées au contenu, étiquette)
npm run tester-faire-part        # 14  : les faire-part de suppression (serveur)
npm run tester-argent            # 196 : les règles de rôle sur l'argent (serveur)
npm run tester-comptes           # 78  : les règles de rôle sur les comptes (serveur)
npm run tester-devis-chantiers   # 118 : devis, chantiers, prospects, boutiques, groupes, corbeille (serveur)
npm run tester-paie              # 46  : la fiche de paie séparée, et le numéro de compte bancaire (serveur)
```

Puis `VERSION` dans `src/lib/constants.js` s'incrémente (une version par
envoi, sans exception : c'est ce qui déclenche la mise à jour chez lui), et
`public/version.json` **et `package.json`**, réécrits par le build (12/09/2026 :
package.json était resté à 2.101.13), partent avec le commit (`git add -A`,
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
  principal y voyait réel et formation mélangés, badge 🎓). **Cinquième
  (14/09/2026, capture du formulaire d'un nouveau chantier) : un écran qui
  lit `estCompteFormation(db, profile)` pour DÉCIDER d'une liste se trompe
  pour le principal** (son compte est réel, quel que soit l'espace regardé) :
  `espaceDuChantier` sans boutique passe par `espaceDuCompte` (l'espace
  regardé). `estCompteFormation` sert à dire ce qu'EST un compte, jamais ce
  qu'il REGARDE.
  **Et aucune mention de l'autre espace** (14/09/2026, « pourquoi
  nécessairement informer ? je suis en réel, c'est cloisonné, un technicien
  formation n'existe pas — débat clos ») : la note « N technicien(s) ne sont
  pas proposés ici : ils appartiennent à l'autre espace » a été RETIRÉE du
  formulaire de chantier ; la liste est celle de l'espace regardé, point. Ne
  pas la remettre, ni ailleurs sous une autre forme.
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
  applique la même règle par déclencheur (`supabase/securite-3` à `-18`).
- **Formation = VIOLET, réel = BLEU** ; la couleur suit l'espace regardé, via
  les variables `--color-sky-*` / `--color-blue-*` de `src/index.css` — jamais
  classe par classe. Vert, rouge, ambre ne changent pas (payé, refusé, attente).
- **🔒 Verrou d'inactivité** (09/09/2026) : après **10 min sans geste, PC
  comme téléphone** (11/09/2026 : « augmenter le temps de verrouillage de 3 à
  10 min » — c'était 3 sur PC et 6 sur téléphone ; le téléphone était
  volontairement PLUS tolérant, le laisser à 6 l'aurait rendu plus strict),
  une fenêtre couvre l'écran et demande le mot de
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
  sur blanc : « le mot de passe ne s'écrit pas », 09/09/2026). **Le bouton
  « Se déconnecter » est REMPLI en rouge pâle** (capture Timo, 12/09/2026 :
  « il n'est pas pré-rempli… pour certaines couleurs de fond il devient
  invisible… rouge pâle signifiant le petit danger »), quelle que soit la
  carte. **Session sécurisée tombée = la même fenêtre de verrou**
  (« permission denied » à la lecture → `marquerSessionPerdue`, message en
  français, `sync.sessionPerdue`) : le mot de passe déverrouille ET rouvre
  la session (`synchroniserAuth`), sans réseau on déverrouille quand même.
  Plus jamais « déconnectez-vous et reconnectez-vous ». **Jamais de verrou
  par surprise** : une bande orange « Rétablir » en haut, sinon le verrou
  d'inactivité s'en charge ; la session est renouvelée au réveil de
  l'appareil et 10 min avant expiration (`expireBientot`).
- **👆 L'EMPREINTE OUVRE LE VERROU — niveau 1** (16/09/2026 : « sur téléphone,
  est-il possible d'ajouter l'authentification par empreinte digitale ? » →
  « lance le niveau 1 sur le verrou »). Règles pures `lib/empreinte.js` (sans
  import) ; **`src/empreinte.js` est le SEUL à toucher `navigator.credentials`
  / `PublicKeyCredential`**, comme `src/push.js` pour les notifications — le
  banc l'impose.
  - **L'application ne LIT JAMAIS une empreinte** : le téléphone compare tout
    seul et répond oui ou non. Ce qui est rangé sur la fiche (`empreintes`,
    une par appareil — **rien à coller**, comme `ordre_onglets`) est une CLÉ,
    jamais un doigt. `attestation: "none"` : on ne veut rien savoir de
    l'appareil. Phrase à dire à l'équipe : **il n'y a aucune empreinte à
    protéger chez nous, parce qu'il n'y en a aucune.**
  - ⚠ **NIVEAU 1 = une COMMODITÉ, pas un verrou** : la réponse du téléphone
    est crue sur parole, notre serveur ne vérifie rien. **Ne jamais écrire
    « sécurisé » à son sujet.** Le niveau 2 (signature vérifiée côté Vercel)
    garde ces deux fonctions telles quelles et ajoute la vérification.
  - **Elle n'ouvre QUE le verrou d'INACTIVITÉ** (`empreinteOuvreCeVerrou`,
    revérifié DANS le geste) : à 30 min la session est finie (le mot de passe
    non plus ne la ressuscite pas) ; une session sécurisée tombée a besoin du
    VRAI mot de passe, qui ROUVRE la session (`synchroniserAuth`).
  - **L'empreinte EST le chemin principal une fois posée** (16/09/2026, deux
    captures : « tant que la personne a activé les empreintes, on ne devrait
    plus lui poser la question de taper avant que les empreintes ne s'ouvrent…
    ça devrait venir automatiquement dès qu'on rentre ou qu'on rouvre
    l'application. Sauf s'il annule, ça revient sur mot de passe
    normalement ») : **elle est tentée TOUTE SEULE à l'ouverture de la
    fenêtre, UNE fois** (`autoTente`, jamais deux — on ne harcèle personne).
    ⚠ **MAIS LES DEUX PORTES SE VOIENT ENSEMBLE** (capture Timo d'une autre
    application, le même jour : « tu vois cet exemple… empreinte ET
    possibilité de taper le mot de passe aussi ») : une version avait CACHÉ le
    champ tant que l'empreinte menait — **retiré**. Clavier au-dessus, **rond
    de l'empreinte juste en dessous** (`IconeEmpreinte`, dessinée UNE fois
    dans ui.jsx comme le logo WhatsApp — jamais un emoji, flou et de travers
    sur un gros bouton). ⚠ **La règle du geste vaut pour
    l'ACTIVATION (`create`), pas pour l'OUVERTURE (`get`)** — mais l'essai
    automatique **n'est pas garanti** : certains navigateurs le refusent aussi.
    Refusé → **on ne dit RIEN** (la personne n'a rien demandé), le mot de passe
    se découvre, le bouton 👆 reste. **Le mot de passe ne disparaît jamais.**
    Un doigt non reconnu ne consomme **aucun** des 5 essais (un doigt mouillé
    n'est pas un mot de passe faux).
  - ⚠ **Le bouton d'ouverture n'attend PAS le téléphone** (capture Timo,
    16/09/2026, juste après le verrouillage : le bouton MANQUAIT, et
    n'apparaissait qu'après un F5) : il attendait `empreinteDisponible()`,
    la réponse à « as-tu un capteur ? », qui met parfois une seconde ou deux.
    **Une clé déjà posée sur cet appareil PROUVE que le capteur existe.**
    `dispo` ne sert plus qu'à proposer l'ACTIVATION là où il n'y a rien.
  - **L'activation vit DANS la fenêtre de verrou**, et nulle part ailleurs :
    **le vendeur n'a pas l'onglet ⚙ Paramètres**, et c'est là que la gêne est.
    Un BOUTON sous le champ ; le mot de passe tapé SERT de preuve — aucune
    question de plus. « Retirer l'empreinte de cet appareil » au même endroit.
    ⚠ **Et « Non merci » ferme la proposition POUR DE BON** (capture Timo,
    16/09/2026 : « même si la personne ne veut pas les empreintes, le message
    est toujours là tant que ce n'est pas activé ») : le refus vit dans le
    navigateur (`CLE_REFUS` = `bmi_empreinte_non`), sur CET appareil — donc
    refuser sur le téléphone ne refuse pas sur le PC, et c'est voulu (la clé
    aussi est par appareil).
    **Une proposition qu'on ne peut pas refuser n'est pas une proposition.**
    ⚠⚠ **ET ELLE DOIT SE VOIR** (capture Timo, 17/09/2026, sur son PC :
    « pourquoi le bouton est-il persistant… et on ne peut pas décliner ? ») :
    « Non merci » ÉTAIT là, mais en 11 px souligné au bout d'un paragraphe —
    il ressemblait à la fin de la phrase, pas à un choix. **DEUX VRAIS
    BOUTONS, côte à côte, même hauteur.** Un refus qu'on ne voit pas ne vaut
    pas mieux qu'un refus absent.
  - ⚠ **LE DIAGNOSTIC DU VERROU NE S'AFFICHE PLUS** (capture Timo,
    16/09/2026 : « le champ du message rouge sous la ligne du mot de passe…
    je n'aime plus voir ça ») : le texte du 09/09 (« Le champ n'a pas le
    clavier — au-dessus : input.w-full… ») était écrit pour le DÉPANNAGE et
    s'affichait chez lui. Il part dans la console (`journalDiag`). **Le FILET
    reste entier** — focus repris à tout clic et à toute touche : c'est lui
    qui soigne « le curseur ne clignote pas », pas le message.
  - ⚠⚠ **LES DEUX FAUTES DE LA PREMIÈRE VERSION** (16/09/2026, Timo : « je
    pense que le fonctionnement n'a pas réussi… il faut te documenter » — la
    2.101.240 ne marchait PAS sur son téléphone) :
    **(1) LE GESTE DOIT ÊTRE ENCORE CHAUD.** Le capteur n'obéit qu'à un clic
    RÉCENT (« transient user activation »), et **un `await` posé avant l'appel
    consomme ce droit**. La version fautive vérifiait le mot de passe (calcul
    long) PUIS touchait le capteur : refus systématique. **L'ordre est
    maintenant : capteur d'ABORD, dans le clic, sans un seul `await` devant ;
    le mot de passe — déjà tapé dans la case — est vérifié APRÈS** et reste la
    preuve (faux → la clé est jetée, rien n'est rangé). D'où un **BOUTON**
    « 👆 Activer l'empreinte sur cet appareil », jamais une case à cocher : le
    clic lui-même est ce qui donne le droit. Le banc le MESURE (découpe le
    corps du geste, vérifie l'ordre et l'absence d'`await`) — et le contrôle a
    été éprouvé en remettant la faute exprès : il tombe.
    **(2) LES ERREURS ÉTAIENT AVALÉES** (`catch { return "" }`) : rien ne se
    passait, personne ne pouvait comprendre. Le capteur dit TOUJOURS pourquoi,
    en un nom (`NotAllowedError`, `NotSupportedError`, `InvalidStateError`…) ;
    `MOTIF_EMPREINTE` / `motifEmpreinte` (lib/empreinte.js) le traduit, l'écran
    l'affiche. ⚠ Seules `idAppareil` et `empreinteDisponible` ont le droit de
    retomber en silence (navigation privée, téléphone sans capteur).
  - ⚠ **Un téléphone dit oui à TOUTES les empreintes qu'il connaît** : on ne
    peut pas savoir de quel doigt il s'agit. Règle à l'équipe, pas un défaut à
    corriger : le téléphone de travail ne porte que votre doigt. Et l'id de
    l'appareil vit dans le navigateur (`bmi_appareil`) : vider les données du
    site le perd, la personne réactive — seul dégât possible.
- L'étiquette de connexion (espace, rôle, principal, boutique, pouvoirs
  retirés) n'est réécrite **qu'à la connexion** : tout changement de règle
  prend effet à la prochaine reconnexion de chacun — à dire à Timo.

### Les rôles (décisions du 04/09/2026, appliquées côté serveur)
- Admin seul : supprimer vente / dette / dépense / article / compte ; prix
  d'achat, prix de vente, quantité initiale ; ~~retours sous garantie~~
  (**gérant + admin depuis le 14/09/2026** : « ouvre le retour sous garantie
  au gérant » — `ROLES_RETOUR_GARANTIE`, serveur `securite-17` ; statuer sur
  le défectueux, renvoyé / rebut, reste admin) ; agents commerciaux ; bloquer un compte et les champs de gestion d'un employé ;
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
  **Le vendeur n'a ni l'onglet 📤 Dépenses ni 🔁 Transfert.** Dépenses :
  retiré le 15/09/2026 (« le vendeur en boutique clôture juste la caisse, il
  ne fait jamais le versement ni dépense ; ici c'est le gérant aussi qui
  vend ») — il garde 🔒 Caisse, la clôture reste son geste. Transfert
  (09/09/2026 : il ne peut
  pas valider, l'onglet est parti ; le gérant le garde).
- **👷 LE CHEF DES TECHNICIENS = un TECHNICIEN BMI coché ⭐ chef d'équipe**
  (17/09/2026 : « ouvre le rôle technicien BMI »). Le chef des techniciens est
  un SALARIÉ : le seul rôle qui lui convienne est « technicien BMI » — le
  technicien à commission n'est pas sur la paie (`SALARIES`), et administrateur
  diminué donne un vrai admin côté base. Or ce rôle ne pouvait même PAS être
  nommé chef (le bouton n'existait que pour commercial et technicien) et
  n'avait ni 👑 Équipe ni ✅ Mes tâches : un chef qui ne peut ni suivre ses
  hommes ni leur donner du travail. Ouverts d'un coup : la case à la création,
  le bouton « Nommer chef », l'étoile ⭐ sur sa pastille, `taches` et `equipe`
  dans `ONGLETS_ROLE` (👑 Mon équipe ne s'affiche que s'il EST chef, comme pour
  le commercial et le technicien), et les trois pouvoirs d'un chef —
  `act_taches`, `act_commission`, `act_reaffecter` — LISTÉS pour ce rôle dans
  `ACTIONS_POUVOIR`. ⚠ **Un pouvoir non listé n'est pas un pouvoir absent** :
  `aDroit` dit oui par défaut à tout ce qui n'est pas dans `droits_off` — non
  listé, il s'appliquait quand même et l'administrateur ne pouvait pas le
  retirer. **Nommer un chef reste le geste de l'administrateur**
  (`refuserSaufAdmin` ; `chef_equipe` est déjà dans la liste « gestion » du
  serveur, rien de plus à coller de ce côté). ⚠ **LE COUPLE** : `ROLES_TACHES`
  (lib/calculs.js) et `a_pouvoir_taches()` (serveur, **`securite-21`**) doivent
  nommer les MÊMES rôles — sinon le geste part, la base dit non, et tout le lot
  reste coincé dans la file d'attente. Le banc mesure les deux côtés et compare.
  **`securite-21` collé par Timo le 17/09/2026 (`true | true`).**
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

### 🔔 Notifications sur les appareils (13/09/2026)
- Timo : « Notification par défaut, pas besoin d'activer quelque chose dans
  l'app ; tant que tu l'utilises, tu auras des notifications » ; sur le
  contenu : **« Lance avec la liste A telle quelle comme message, et B
  aussi telle quelle, à titre informatif dans les notifications »** — et
  avant : « ce qui est informatif reste juste informatif, rien dans
  Messages ». Détail, tableau complet et mise en service :
  `docs/etat-notifications-push.md`.
- **Liste A = UNE règle** : chaque nouveau message de 💬 Messages est une
  notification pour son destinataire (`envoisMessages`). **Liste B = « pour
  information », JAMAIS écrit dans 💬 Messages** (`infosDepuisDiff`) :
  ravitaillement, transfert, commande à valider, prime à payer, devis
  proposé au client, tâches, pointage du comptable, article qui PASSE au
  seuil, clôture dépassée ; et la **tournée du matin** (`lib/rappels.js`,
  serveur `api/rappels-du-matin.js`, Vercel cron 7 h) : caisse d'hier non
  clôturée, dette qui passe les 30 jours, devis qui atteint 15 jours.
- **UN seul chemin** : `envoisDepuisSave(prev, final, profile)` dans le
  `save()` de App.jsx — aucun écran n'envoie de notification (le banc
  l'interdit) ; `Notification.` / `pushManager` n'existent que dans
  `src/push.js` (+ `public/push-sw.js`). **L'auteur d'un geste n'est jamais
  prévenu de son propre geste.** **Le mur** : les destinataires viennent
  des briques de `lib/espace.js` (`idsDeLaBoutique`, `idsParRole`,
  `idsAdmins`, `personnesDeLEspace`) — jamais un `db.users.filter` maison ;
  l'admin principal reçoit les deux espaces, la formation marquée 🎓.
- **`estCompteFormation` vit dans `lib/espace.js`** (sans import, lu par le
  serveur) et calculs.js la réexporte ; la chaîne lisible par Node
  (`rappels → cloture → versements / validationDepenses → core → constants`,
  `comptesClients`, `espace`) écrit ses imports **avec `.js`** — le banc
  l'importe sans bundler, comme Vercel. **Les règles « dette en retard 30 j »
  et « devis à relancer 15 j » vivent dans lib/rappels.js**, les écrans
  Dettes et Tous les devis les importent.
- **La permission se demande AU CLIC de connexion** (geste utilisateur,
  exigé par iPhone et Chrome), une fois par appareil ; l'appareil est
  rattaché à la personne à la connexion et au retour (F5), **détaché à la
  déconnexion AVANT la fin de session** (téléphone partagé). Refus → rappel
  discret dans ⚙ Paramètres, rien d'autre. File d'envoi dans localStorage
  (24 h), repart au retour du réseau. Un clic ouvre l'écran visé seulement
  s'il est un onglet du rôle.
- **Rien de secret dans l'application** : clé publique `CLE_PUBLIQUE_PUSH`
  (constants.js) ; clé privée = variable Vercel `VAPID_PRIVATE_KEY`
  uniquement ; la tournée exige `CRON_SECRET`. Table `abonnements_push` sans
  aucune politique (service_role seul). **En service depuis le 14/09/2026**
  (réglages faits par Timo, test réel sur Android réussi, 7 h validé).

### L'ordre des onglets (12/09/2026)
- « Un système de déplacement des onglets par la préférence de chaque
  utilisateur… ramener l'onglet caisse juste après vente, librement, dans son
  espace à lui seul » — et sur le geste : **« pas de ligne "ordre des
  onglets"… appui long et on déplace, tout court »**. Pas de fenêtre, pas de
  flèches, pas de réglage : on tient l'onglet un demi-seconde sans bouger
  (il vibre et se soulève), on le glisse, on relâche. Un doigt qui part tout
  de suite fait défiler comme avant ; un clic reste un clic.
- **Le rôle décide QUELS onglets, la personne décide de l'ORDRE** : règle
  pure `lib/ordreOnglets.js` (`appliquerOrdre` : un id inconnu est ignoré,
  un onglet non cité va à la fin dans l'ordre du rôle), appliquée APRÈS le
  filtre des pouvoirs. L'ordre vit dans **la fiche de la personne**
  (`ordre_onglets`, comme ses brouillons de devis) : il suit ses appareils
  et ne change rien pour les autres ; rien à coller dans Supabase (la fiche
  accepte déjà un champ personnel). L'écriture ne part que si l'ordre change
  (`ordreApres`), sans ligne de journal.
- **L'onglet OUVERT est toujours visible dans la barre** (15/09/2026, capture
  Timo : « quand tu te reconnectes, le dernier onglet est mémorisé, l'écran
  affiche ses données, mais les onglets eux-mêmes sont restés sur les premiers
  — tableau de bord, rentabilité… » ; « j'avais déjà soulevé le problème ») :
  au montage et à chaque changement d'onglet, `OngletsDeplacables` ramène SA
  barre sur l'onglet actif s'il est hors du cadre. ⚠ **On fait défiler la
  BARRE, jamais la page** : pas de `scrollIntoView`, qui entraînerait tout
  l'écran. Rien ne bouge si l'onglet est déjà visible, ni pendant un
  déplacement. Mesuré dans Chromium (barre étroite, dernier onglet ouvert).
- Composant unique `components/OngletsDeplacables.jsx` pour la barre
  latérale (verticale) et la barre du téléphone (horizontale). Pièges
  réglés : le `touchmove` est avalé en écouteur NON passif pendant le
  déplacement seulement (React pose les siens passifs, le doigt ferait
  défiler la page) ; le clic qui suit un déplacement est avalé ; pas de menu
  contextuel sur l'appui long. **Le geste est MESURÉ dans un vrai
  navigateur** (`verifier-onglets-deplacables`, Chromium : souris ET doigt,
  l'exemple exact de Timo — Caisse juste après Ventes).

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
  stock). **Le stock compte des BARRES de 4,2 m** (14/09/2026 : « le rail est
  vendu à l'unité de 4,2 m dans le stock ; dans le dimensionnement c'est au
  mètre… par quel mécanisme déduire le stock ? » — option « b » choisie, et
  « prix réglable dans Paramètres ») : les mètres calculés (panneaux × 2,2)
  sont arrondis aux **barres entamées**, **le client paie ces barres** au
  prix du mètre (22 m → 6 barres → 25,2 m facturés), le stock perd ce nombre
  de barres à l'encaissement (la ligne part au panier **en barres**, au prix
  d'une barre) ; la chute est dite pour information. Règle pure `barresDeRail`
  (lib/solaire.js), longueur `longueurRailBarre` / `LONGUEUR_RAIL_DEFAUT` =
  4,2 (calculs.js, champ `longueur_rail` des boutiques, ⚙ Paramètres à côté du
  prix du mètre, admin). La ligne du devis garde `metres_calcules`,
  `metres_factures`, `longueur_barre` ; une reprise relit les mètres (une
  ancienne ligne a ses mètres en quantité). L'article « rail » du stock n'est
  jamais un support ni un étrier.
  **Supports de rail = UN par mètre de rail calculé** (14/09/2026 : « c'était
  une erreur, le nombre de supports, c'est le nombre de mètres de rail » — le
  « rails × 2, pair suivant » du 07/09 est RETOURNÉ, `pairSuivant` retiré) ;
  **étriers = (panneaux × 2) + 8** (07/09/2026) ; lignes ajoutées seulement
  si l'article est en stock, au prix du stock, liées à lui pour la sortie.
  **Le MODÈLE de support se choisit dans le devis, dans UNE liste déroulante
  des SUPPORTS de la boutique** (14/09/2026, trois messages : « il y a les M8
  et les M10, pour l'instant c'est resté sur M8 par défaut » ; capture : « on
  ne peut pas choisir, il reste choisi par défaut » — la liste ne s'affichait
  qu'à partir de deux supports ; puis, devant un champ sur tout le stock :
  « une liste déroulante dans laquelle seuls les supports sont
  sélectionnables, et non tous les articles ») : `supportsDuStock` = les
  articles dont le nom ou la catégorie porte « support », jamais un étrier ;
  la liste s'affiche TOUJOURS, même avec un seul, et dit combien la boutique
  en a ; le premier d'office ; le choix suit le brouillon (`supportId`) et le
  devis repris (`supportDepuisLignes`, par le nom). Un support que la liste
  ne montre pas = un article sans le mot « support », ou d'une autre boutique.
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
  Les deux colonnes passent par **LE champ commun** `ChampSuggestions`
  (11/09/2026 : « on peut aussi, à part dérouler et sélectionner, écrire et la
  présélection est proposée ») : cliquer ouvre toute la liste, taper la filtre,
  la frappe n'est jamais transformée — un CLIC lie l'article, un nom tapé ne le
  lie que s'il correspond exactement. **Aucune recherche par ressemblance.**
  ⚠ **LE DOMAINE RANGE, IL NE CACHE PLUS** (option « a », 11/09/2026 : « dans
  forage, pas de catégorie des panneaux… alors que pour le forage aussi on
  utilise les panneaux. Comment résoudre le problème ? ») : les besoins du
  métier ouvert en tête (`categoriesDuDomaine`), **tout le reste du stock de la
  boutique en dessous** (`categoriesAutres`, détail « Autre métier ») ; les
  articles d'un besoin sont ceux du domaine d'abord, puis les autres de la
  boutique. Rien à réétiqueter, et **plus jamais un article introuvable parce
  qu'il est rangé dans un autre métier**. Une reprise retrouve l'article dans
  TOUT le stock. « ✏️ Saisir un article hors stock » reste. **Chaque ligne
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
  natif (le banc l'interdit). **UNE règle pour TOUTE recherche tapée**
  (capture Timo, 13/09/2026, fenêtre « Rechercher un article » de Ventes :
  « la recherche d'articles est rigide… avoir une seule règle qui régit les
  recherches dans l'application ») : `correspond` (lib/suggestions.js) dans
  le sélecteur d'article (Ventes, Commandes), la loupe du menu, les listes
  Ventes / proformas, Utilisateurs, Stocks, Clients, Historique, Prospects,
  Clients installés. Le banc interdit tout filtre « maison »
  (`toLowerCase().includes`, `normNom().includes`) dans écrans et composants ;
  `trouverArticle` (calculs.js) n'est pas une recherche mais un appariement.
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
  autre** — PAGE PAR PAGE (une première version mettait les pages à plat et
  « voyait » l'entête de la page 1 sur le total de la page 2 : un contrôle qui
  crie à tort finit par ne plus être cru). Poser les mentions à gauche du TOTAL
  a été tenté et ABANDONNÉ (la première ligne, 108 mm, mordait sur « Acompte à
  la commande ») — elles sont **à gauche des CADRES DE SIGNATURE**, en colonne
  de 62 mm (`MENTIONS_LARGEUR`, `phrasesOffre` écrites une fois, cadres réduits
  à 48 mm) : 12 mm rendus, capture Timo du 11/09/2026 « le problème est
  revenu », où le bas partait seul sur une page alors qu'il ne manquait que
  **1 à 13 mm** (mesuré). ⚠ **Un devis à acompte + solde + délai porte 12 mm de
  plus** et peut encore demander une deuxième page : le banc mesure les huit
  formes à paiement intégral qui tombaient dans ce trou. ⚠ **Le
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
- **📤 Partager, sur TOUS les documents de l'aperçu** (14/09/2026, deux
  captures : « sur tous les fichiers générés par l'app, un bouton Partager à
  la place de "Aperçu avant impression", exclusivement sur téléphone ; sous
  Windows, en plus de ce bouton, garder toujours "Aperçu avant impression" »).
  Écrit UNE fois dans `PrintHost` (components/ui.jsx) : le document affiché
  devient un PDF (`pdfDeLApercu` : image du document par html2canvas, **rendu
  HORS ÉCRAN à la largeur d'une page, `LARGEUR_RENDU_PX` = 794, jamais à la
  largeur du téléphone** — deux captures du 14/09/2026 : le PDF partagé
  sortait étroit, tableau coupé — découpée en pages au format de l'aperçu,
  `dimensionsPage`, **la coupe cherche une ligne blanche**, `positionCoupe`,
  jamais au milieu d'une ligne ; **l'image est ROGNÉE au contenu réel**,
  `cadreContenu` — capture Timo : « les marges sont trop grandes », le reçu
  de 680 px était posé au centre du cadre de 794 px), nommé par la règle des
  documents (`nomFichierPartage`), remis à la **feuille de partage** du
  téléphone (`navigator.share`, WhatsApp / mail…) ; navigateur sans partage →
  le PDF est enregistré et on le dit. Le titre « Aperçu avant impression »
  est `hidden sm:block`. `navigator.share` et `html2canvas` n'existent que
  dans ui.jsx (le banc l'impose).
- **Nom des documents : UNE règle** (`nomDocument` / `fichierPdf`, lib/core.js)
  → « Type - Client - Numéro ». **Zone de signature : UNE**
  (`components/ZoneSignature.jsx`, 440 × 300) pour les quatre emplacements.
- **Corbeille** : supprimer un chantier le met de côté 30 jours, restaurable
  par l'admin principal (⚙ Paramètres → 🗑), purge automatique ; aucun écran
  ne voit une fiche à la corbeille (`lib/corbeille.js`, séparée au chargement,
  refusionnée à l'écriture, comme la paie).

### ✏️ UNE PÉRIODE À SOI DANS 💰 VENTES (19/09/2026)
- Timo, devant le filtre : « pour filtrer les ventes ou proforma, il n'y a
  pas personnaliser… ajouter ». Les cinq périodes toutes faites ne répondent
  pas à « du 3 au 12 » — la question qu'on se pose devant un client, ou quand
  on ne se rappelle que la semaine d'une vente. Option **« ✏️ Personnaliser… »**
  après les cinq, et DEUX cases de date qui n'apparaissent **que si on les
  demande** : le filtre reste aussi simple qu'avant pour qui n'en a pas besoin.
- Règle pure `bornesPersonnalisees` / `libellePeriodePersonnalisee`
  (lib/calculs.js, à côté de `periodes()`). **Une borne vide reste OUVERTE**
  (« depuis le 3 », « jusqu'au 12 ») : on ne force personne à saisir deux
  dates pour en chercher une seule. **Deux dates à l'envers sont remises dans
  l'ordre** — un filtre n'est pas un geste d'argent, et un refus n'apprendrait
  rien — ⚠ **mais jamais en silence** : l'écran ÉCRIT à côté la période
  réellement appliquée (« Du 12/09/2026 au 18/09/2026 »).
- ⚠⚠ **LE VRAI RISQUE N'EST PAS LA RÈGLE, C'EST LA DIVERGENCE** : le filtre
  vaut pour les ventes ET les proformas. Un seul calcul (`bornesPeriode`) est
  lu par les deux listes ; le banc compte les deux usages, et le contrôle a
  été éprouvé en ne filtrant qu'une des deux : il tombe.
- Le sélecteur d'origine (index numérique dans `periodes()`) n'a pas bougé :
  **rien ne change pour qui ne touche pas à la nouvelle option.**
- Écrite dans calculs.js pour que d'autres écrans puissent la reprendre —
  **mais posée dans 💰 Ventes SEULEMENT**, parce que c'est ce qui a été
  demandé. Le tableau de bord et 🔒 Caisse gardent leur sélecteur tel quel.
- **💰 LA RECETTE À CÔTÉ DES DATES** (le jour même : « à côté des dates,
  ajouter recette : total des ventes sur la période choisie »).
  `recetteDesVentes` / `totalDesProformas` (calculs.js).
  ⚠⚠ **ELLE PORTE SUR CE QUI EST AFFICHÉ**, jamais sur autre chose : elle suit
  donc AUSSI le moyen de paiement et la recherche, pas seulement la période
  (« recette espèces du 3 au 12 »). Un total qu'on ne peut pas retrouver en
  additionnant les lignes sous ses yeux est invérifiable — donc on cesse de
  s'y fier, et on cesse de se fier au reste. Le banc l'éprouve en la faisant
  porter sur la liste entière : il tombe.
  ⚠ **UNE REPRISE DONNE DEUX CHIFFRES, jamais un seul** : le brut correspond à
  la colonne TOTAL (ce que les clients ont payé), le net à ce qui est resté
  dans la caisse. Le net seul ferait mentir l'addition ; le brut seul ferait
  mentir la caisse. Le second ne s'affiche que s'il y a eu une reprise.
  ⚠ **« Recette » ne s'écrit JAMAIS sur les proformas** — une offre de prix
  n'est pas encaissée : c'est « Total des proformas », et une fonction
  SÉPARÉE, pour qu'on ne puisse pas les confondre par distraction.
  ⚠⚠ **Le premier contrôle de ce point NE PROTÉGEAIT PAS** : il cherchait deux
  textes et les trouvait tous les deux même quand on collait « Recette »
  devant le total des proformas. Refait le jour même — on compte les
  occurrences et on regarde LA LIGNE du total, pas le fichier entier (une
  recherche trop large retombait sur le nom des fonctions importées et criait
  à tort). **Un contrôle s'éprouve en remettant la faute, sinon on ne sait pas
  s'il tient.**

### 🏦 Les banques, et le moyen de paiement en BOUTONS (15/09/2026)
- Timo, dans l'ordre : **« et si ce mode était à sélectionner ? »** (la
  question « Moyen de paiement » se TAPAIT — un mot non reconnu retombait en
  silence sur « Espèces », taper « BTCI » enregistrait un virement comme du
  liquide) ; **« si banque, normalement dans la fiche de l'utilisateur, on
  devrait ajouter le nom de la banque ? »** ; **« une liste dans paramètres,
  lance »**.
- **Le moyen de paiement est un CHOIX** : `demanderMoyenPaiement` (ui.jsx)
  passe par `uChoix` avec `moyensProposes(defaut)` (core.js) — les quatre
  moyens de `MOYENS_ENCAISSEMENT` (constants.js, `PAIEMENTS` sans le crédit),
  **le moyen proposé en PREMIER bouton**. `LISTE_MOYENS_SAISIE` a été RETIRÉE
  (une règle qui ne commande plus rien ne reste pas). Les 13 questions de
  l'application suivent d'un coup.
- **UNE liste de banques, ⚙ Paramètres → 🏦 Banques** (admin) : règle pure
  `lib/banques.js` (sans import, lisible par Node), rangée sur les boutiques
  (champ `banques`, comme le prix du rail — **rien à coller**) ; ajout refusé
  si vide ou déjà présent (accents et majuscules ignorés), liste rangée par
  ordre alphabétique français. **Sans liste réglée, rien ne change** : le nom
  se tape comme avant.
- **Le versement vers BANQUE choisit dans cette liste** (🔒 Caisse), avec
  « ✏️ Autre banque… » pour un nom hors liste.
- **La fiche d'un employé porte sa banque** : 👥 Utilisateurs → ⋯ Gérer →
  **🏦 Banque** (admin), champs `banque` et `compte_bancaire`. Le numéro **ne
  s'affiche jamais en entier** (`compteMasque` : « …4321 »).
- **Quand on paie une personne**, la question rappelle sa banque sous le
  libellé, ou dit qu'elle manque et où la saisir ; **un paiement par virement
  GARDE la banque du jour sur la dépense** (`mentionVirement` : commission
  d'équipe, commission d'un filleul, avance sur salaire, prime d'installation
  via `construirePaiementPrime`). Espèces ou fiche sans banque n'écrivent rien.
- **Serveur : `securite-18`** — `banque` et `compte_bancaire` rejoignent la
  liste « gestion » de `users_regles_comptes` (admin seul). Sans lui, n'importe
  quel compte qui écrit pouvait changer la banque d'un collègue. `securite-9`
  (changer le rôle) vit dans une AUTRE fonction : il n'est pas touché.

### 💰 Ventes : le prix dans la fenêtre « Rechercher un article » (14/09/2026)
- Timo : « quand on clique sur l'article, à part la quantité en stock, on
  devrait aussi avoir le prix de vente » → chaque ligne du sélecteur
  (`components/SelecteurArticle.jsx`) montre « 12 000 F · dispo : 30 »
  quand l'écran passe une fonction `prix` ; Ventes passe le prix de vente,
  Commandes ne passe rien (rien ne s'affiche). **Le prix est en bleu de
  l'espace, en gras** (`text-sky-800`, violet en formation ; « pas gris »,
  option 1 choisie par Timo), le disponible reste gris. Le banc le vérifie.

### 🧾 Le reçu d'une dette (14/09/2026)
- Capture Timo (MR ERIC, 1 000 000 F dû, 0 F versé, titré « REÇU DE
  VERSEMENT ») : « si pas d'avance donné, il doit rester : reçu de dette
  jusqu'au jour où il y a un 1er versement… mais si le premier jour, il y a
  eu une avance, il peut être nommé reçu de versement en même temps ». UNE
  règle pure, `titreRecuDette` (lib/core.js, à côté du numéro de reçu),
  exercée par le banc : rien d'encaissé → **REÇU DE DETTE** (« Date : » du
  jour de la dette, « Établi par : », « Aucun versement à ce jour », pas de
  tableau vide) ; au moins un versement, l'avance du premier jour comprise →
  **REÇU DE VERSEMENT** ; tout versé → **REÇU DÉFINITIF — DETTE SOLDÉE**
  (inchangé). Le document (`imprimerRecuVersement`) lit la règle, n'écrit
  aucun titre à la main ; même fonction pour Dettes, Ventes et réservations.
  **« RESTE À PAYER » s'écrit en ROUGE** (14/09/2026), sur le reçu de dette
  et sur le reçu de vente à crédit (classe `reste`, `STYLE_RECU`).
- **Une vente à crédit remet le reçu de SA dette, jamais un « reçu de
  vente »** (14/09/2026, Timo devant le reçu sorti après un encaissement à
  crédit sans avance : « le document porte reçu de vente au lieu de reçu de
  dette, le motif a disparu » → « ta proposition ») : règle pure
  `documentDeVente` (core.js — crédit + dette liée par `vente_id` → la dette ;
  sinon le reçu de vente : comptant, ou vieille vente sans lien, on ne devine
  jamais une dette) ; UN chemin, `imprimerRecuDeVente` (impression.js), après
  l'encaissement (sur `next`, qui porte la dette neuve) et sur le bouton 🖨
  de la ligne. Le texte WhatsApp du reçu (`recuWhatsApp`) n'a pas changé.

### 💬 Messages : l'ordre des conversations (14/09/2026)
- Timo, deux captures (14 clients « Support » à défiler avant DJEDJE et ses
  2 non lus) : « je veux qu'un nouveau message apparaisse en tête, bien
  avant le support client — je l'avais déjà demandé ». Règle pure
  `lib/conversations.js` (`separerNonLues`), exercée par le banc : **UN bloc
  « 🔴 Nouveaux messages » tout en haut** avec TOUTE conversation qui porte
  un non lu, la plus récente en premier, quel que soit son bloc ; puis
  **Équipe, Groupes, Clients qui vous ont écrit, Mes clients (chef),
  Support clients** — une conversation n'apparaît qu'une fois (lue, elle
  redescend dans son bloc). UNE ligne, `LigneConversation` ; plus de tri
  maison par bloc. Le client connecté ne voit toujours que son fil.

- ⚠ **LE RÔLE RESTE VISIBLE DANS 💬 MESSAGES — « a », c'est-à-dire « laisse
  comme c'est » (20/09/2026).** Timo, capture de la liste des conversations :
  « masquer les rôles des utilisateurs pour les autres utilisateurs… sauf pour
  les admin », **puis « ou bien ce n'est pas une bonne idée ? »**, et enfin
  **« a »** devant quatre propositions. **Ne pas le reproposer.**
  - **Ce qui a été MESURÉ avant de répondre** (à ne pas re-chercher) : 👥
    Utilisateurs est **réservé à l'administrateur** (`ONGLETS_ROLE`), et 👑 Mon
    équipe **n'écrit pas les rôles** (juste 🔧 pour les techniciens). **💬
    Messages est donc bien le SEUL écran où un employé lit le rôle de toute
    l'équipe** — sa demande tenait debout, elle n'était pas une méprise.
  - **Pourquoi on ne le masque pas, quand même** : dans la liste, le rôle est
    un **panneau indicateur** — il dit à qui on écrit. Le retirer ferait partir
    des messages (dettes, clients, argent) à la mauvaise personne, sans
    protéger quoi que ce soit : chez BMI tout le monde sait déjà qui est
    gérant. **Ce qui méritait d'être protégé l'EST** (salaire, compte
    bancaire, pièce d'identité — table `paie`, 19/09/2026). Un rôle est une
    fonction de travail, pas une donnée sensible.
  - ⚠ **Si le sujet revient un jour**, le rôle s'écrit à **TROIS endroits**
    dans `screens/Messagerie.jsx` (`libelleRole` : la liste des
    conversations, le choix des membres d'un groupe, la nouvelle
    conversation) : les trois ou aucun, sinon la règle mentirait.

### Petites dépenses d'un chantier de devis (13/09/2026)
- Timo : « pour les chantiers nés d'un devis, les petites dépenses [carburant,
  nourriture] peuvent être rattachées au devis en question, et à la fin ces
  petites dépenses sont soustraites avant le partage » — précisé : **« je
  parle des frais d'installation, pas de la commission du commercial »** ;
  le geste : « au moment d'enregistrer la dépense… les chantiers en cours
  apparaissent et il rattache ». UNE règle pure, `lib/depensesChantier.js`.
- **Une dépense rattachée reste une dépense ordinaire** (seuil et validation
  du DG, avance à rembourser, versements exclus…) : elle porte seulement
  `chantier_id` / `chantier_nom`. Dans 📤 Dépenses : **la ligne « Chantier à
  rattacher », TOUJOURS présente à côté de « Payé avec »** (« — Aucun — »
  d'office ; sans chantier en cours elle le dit) — capture Timo, 13/09/2026 :
  « devant Payé avec, avoir la ligne : chantier à rattacher… pas sur la ligne
  de dépense » : **aucun lien sur les lignes du tableau**, la colonne
  « Chantier » ne fait que montrer (le rattachement après coup a été retiré).
  Rattachable = chantier de l'espace regardé, **pas réceptionné, frais pas
  déjà payés** ; revérifié DANS le geste.
- **La déduction** : dans 🏠 Clients installés, 🔧 Frais → parts des
  techniciens et part BMI calculées sur **frais facturés − dépenses
  rattachées qui COMPTENT** (ni en attente du DG, ni rejetées), jamais
  négatif (`fraisAPartager`) ; le panneau le dit, la confirmation aussi, et
  la fiche mémorise `depenses_deduites` / `frais_a_partager` (informatif : le
  serveur protège les parts de l'équipe, pas ces deux champs). La fiche du
  chantier montre « 🧾 Dépenses rattachées : X ». Aucune commission de
  commercial touchée. Rien à coller dans Supabase (une dépense se modifie
  déjà par tout compte non lecteur ; la répartition reste admin).

### 📤 Dépenses pour les techniciens (13/09/2026)
- Timo : « ouvrir l'onglet Dépenses au technicien, mais ils ne verront que
  leurs propres dépenses, pas toutes les dépenses ». Technicien ET technicien
  BMI ont l'onglet ; l'écran passe par `depensesVisibles` (validationDepenses.js :
  `par_id`, ou `par` = leur nom pour les anciennes), titre « Mes dépenses ».
  ⚠ La table des dépenses n'est pas cloisonnée par personne côté serveur :
  ce filtre est la seule barrière. Le serveur accepte déjà leur écriture
  (seul le compte en lecture seule est refusé) : rien à coller.

### Catégories de dépenses
- Timo (13/09/2026) : « ajouter Livraison, le manger, le carburant, commande
  en Chine » → `CATEGORIES` (constants.js) : Livraison, Carburant,
  Nourriture, Commande en Chine, insérées après Transport ; « Autre » reste
  en dernier. Le banc le vérifie.

### 🛠 Travaux à crédit (13/09/2026)
- Timo : « des chantiers qu'on exécute et au fur et à mesure on fait des
  dépenses… manger, carburant font partie de la prestation… câble, tuyau et
  autres s'additionnent aux articles sortis de la boutique sauf qu'eux sont
  des articles HB… la ligne de frais de prestation, en pourcentage ou à taper
  librement [sur TOUS les articles]… les articles sortis sont facturés au prix
  de la boutique… le jour où le client finit de payer, le travail à crédit
  quitte l'onglet pour rester dans Clients installés » ; nom choisi par lui :
  **« 🛠 Travaux à crédit »** (« Chantiers » prêtait à confusion) ; **option A
  = une TRACE** dans Clients installés (pas de PV, pas de réception, pas de
  commission). UNE règle pure, `lib/travaux.js` ; écran `screens/Travaux.jsx`
  MESURÉ dans Chromium (`verifier-ecran-travaux`).
- **Une fiche de travaux = une ligne de `clients_installes`** marquée
  `travaux: true`, statut fixe « travaux », boutique portée par la fiche
  (`boutiqueDuChantier` la lit) : rien à coller dans Supabase. Onglet pour
  admin, gérant, vendeur, magasinier ; ouvrir / HB / prestation = gérant,
  admin ; sortir un article = magasinier, gérant, admin ; facturer =
  vendeur, gérant, admin — revérifié DANS le geste.
- **Articles de la boutique : le stock baisse TOUT DE SUITE** (ajustement
  négatif `sortie_travaux`, `travaux_id`), facturés au prix de vente de la
  boutique, coût = prix d'achat ; retirer une ligne = ajustement
  `retour_travaux` (jamais d'effacement), refusé une fois facturé. **Articles
  HB** : pas de stock, prix payé + prix facturé. **Frais de prestation** :
  `{mode:"pct"|"montant", valeur}`, % de TOUS les articles (boutique + HB).
  **Coût** = articles au prix d'achat + petites dépenses rattachées qui
  comptent (chantier 1, même mécanisme : ligne « Chantier à rattacher »,
  libellé préfixé 🛠).
- **Facturer** envoie le panier à 💰 Ventes (`preRempliPourFacture`) : lignes
  de stock **`deja_sorti`** (le contrôle de stock les ignore, `stockVendu` et
  l'index aussi — jamais une seconde sortie), HB `hors_boutique`, prestation
  en ligne libre « Frais de prestation » (compte dans le chiffre d'affaires).
  L'encaissement reste celui de Ventes (espèces ou crédit avec avance) ; la
  vente porte `travaux_id` et **le reçu (et la dette) reviennent sur la
  fiche** (`lierFacture` : `vente_id`, `dette_id`, `facture_le`,
  `facture_numero`). **Soldé** (`travauxSolde`, calculs.js : facturé et dette
  à 0, ou comptant) = la fiche quitte l'onglet et apparaît dans 🏠 Clients
  installés, catégorie « 🛠 Travaux soldés », trace (facturé / coût / marge),
  sans Frais, Programmer, Entretien ni PV. Une fiche non soldée n'y est jamais.
- **Supprimer des travaux** (13/09/2026 : « tant qu'il n'y a pas d'article
  rattaché… l'admin principal… les dépenses liées resteront dans Dépenses
  pour traçabilité ») : principal seul, refusé s'il reste un article (les
  retirer d'abord, ils reviennent en stock) ou si c'est facturé ; la fiche
  part à la corbeille 30 jours ; les dépenses gardent leur `chantier_nom` et
  restent dans 📤 Dépenses. **L'équipe** (« choisir un technicien comme
  responsable d'équipe, comme dans Clients installés ») : techniciens de
  l'espace regardé cochés, un responsable ⭐, parts à 0 — admin (le serveur
  réserve la structure de l'équipe à l'admin / resp. commercial).
  Aucune répartition de frais sur des travaux.
- **L'article à sortir se choisit en TAPANT son nom** (capture Timo,
  13/09/2026 : « tous les articles apparaissent… un grand nombre dans lequel
  il faut chercher son article… saisie libre avec proposition à partir de la
  première lettre ») : plus de liste déroulante, LE champ commun
  `ChampSuggestions` avec `propositionsStock` (nom en entier, « N en stock ·
  prix » dessous, articles de la boutique regardée). Un CLIC lie l'article ;
  un nom tapé ne lie que s'il est EXACT (`produitSaisi`, sans accents ni
  majuscules), jamais par ressemblance ; sans article lié, « Sortir du
  stock » le dit. La ligne HB reste en saisie libre (voulu). Mesuré dans
  Chromium (« deye » → une seule proposition, clic → ✓ lié).
  **Les cases sont nommées** (captures Timo, 13/09/2026 : « les lignes ne
  sont pas nommées au-dessus… Article, Quantité. Même chose pour les
  articles HB ») : `Field` Article / Quantité pour la sortie, Article /
  Quantité / Prix payé (F) / Prix facturé (F) pour le HB ; **la ligne d'aide
  (« ✓ N en stock ») est SOUS la grille**, sinon la case Quantité s'étirait à
  sa hauteur (« la ligne de quantité s'élargit ») — le banc mesure la hauteur.

### 💧 LES POMPES : CE QU'ON EN SAIT, ET CE QU'ON NE PROMET PAS (20/09/2026)
- Timo : « j'ai mis les modèles de pompe mais **pour un commun des mortels,
  impossible de savoir la puissance, la profondeur, le débit et la tension** ».
  Puis : « il manque si la pompe est **hybride** ou non » (**case à cocher**,
  sa décision — la ligne à trois choix a été proposée et écartée), « **les 2** »
  (les deux étapes), « on part sur **A** ; avec le temps on peut implémenter le
  C, mais pas aujourd'hui », et « les pompes sont rangées dans **domaine
  forage, catégorie pompe** ». Règle pure `lib/pompes.js` (sans import).
- ⚠⚠ **CE QUI A ÉTÉ TROUVÉ EN CHERCHANT, ET QUI EST PIRE QUE LE MANQUE** : la
  fiche d'un article portait DÉJÀ **`tension`**, **`fiche_technique`** (un
  lien) et **`notes`** — **et AUCUN des trois ne s'affichait nulle part**. Ni
  dans le tableau 📦 Stocks, ni dans la fenêtre « Rechercher un article », ni
  sur un devis. On les remplissait **dans le vide** : on croit avoir noté.
  Les trois se lisent maintenant. `tension` est **RÉUTILISÉE**, jamais doublée.
- ⚠⚠ **LA DIFFICULTÉ QUI COMMANDE TOUT LE RESTE — LA COURBE.** Une pompe **ne
  donne PAS son débit maximal à sa profondeur maximale** : une « 60 m · 3 m³/h »
  fait 3 m³/h EN SURFACE, et peut-être 0,8 m³/h à 55 m. Dire au client « cette
  pompe vous donnera 3 m³/h à 56 m » serait un **mensonge**, et l'installation
  serait ratée. Donc : **l'application ne promet JAMAIS un débit à une hauteur
  donnée** — elle dit quelles pompes MONTENT assez haut et renvoie à la fiche
  du fabricant. Le banc interdit toute fonction qui prétendrait le calculer.
- **ÉTAPE 1 — les cinq renseignements** : puissance (kW), profondeur max (m),
  débit max (m³/h), tension (V), **case « hybride »**. ⚠ Ils n'apparaissent
  **QUE sur une pompe** — pas question de demander sa profondeur maximale à un
  tournevis. **C'est la CATÉGORIE qui décide**, jamais le nom : sinon un
  « tuyau de pompe » deviendrait une pompe (le banc l'éprouve). La fiche se lit
  **partout où on choisit un article** — tableau 📦 Stocks, fenêtre de 💰 Ventes,
  champ à suggestions — **et sur le devis du client**, sous la ligne.
  ⚠ Une ligne ordinaire ne porte rien et **ne grandit donc pas** dans le PDF :
  la mise en page du bas du devis est mesurée au millimètre, et elle est restée
  au vert.
- **ÉTAPE 2 — « 💧 Quelle pompe pour ce forage ? »** (option « A »), dans le
  volet du devis, **affiché seulement si le métier ouvert a des pompes en
  stock** : aucun réglage à faire, rien à l'écran là où ça n'a pas de sens.
  - Quatre questions : **niveau dynamique**, hauteur du réservoir, longueur de
    tuyau, besoin en litres/jour. ⚠⚠ **LE NIVEAU DYNAMIQUE, PAS LA PROFONDEUR
    DU FORAGE** — la profondeur à laquelle l'eau se stabilise PENDANT le
    pompage. **C'est le foreur qui le donne** ; sans lui on refuse de calculer,
    et le refus le DIT.
  - Le calcul : 45 m (l'eau) + 8 m (le réservoir) + 3 m (frottements) = **56 m**,
    et 3 000 L ÷ 6 h = **0,5 m³/h**. ⚠ Les frottements sont une **ESTIMATION**
    (ils dépendent du diamètre du tuyau, qu'on ne demande pas) : l'écran écrit
    « estimés », et le pourcentage se règle dans ⚙ Paramètres à côté du rail
    (`pertes_tuyau_pct`, admin — **rien à coller**).
  - ⚠ **Une pompe NON RENSEIGNÉE est invisible au calcul, et l'écran le DIT** —
    sinon le vendeur croit qu'aucune pompe ne convient. Celles qui sont trop
    courtes sont **écartées en le disant**, jamais escamotées.
  - **L'étude ne s'enregistre pas** : elle aide à choisir, le vendeur ajoute
    ensuite la pompe comme un article ordinaire.
- ⚠ **L'OPTION « C » RESTE OUVERTE, et c'est sa décision** : saisir 3 à 5 points
  de la vraie courbe par MODÈLE (à 20 m → 2,1 m³/h, à 40 m → 1,4…) permettrait
  d'annoncer un débit pour de bon. « Avec le temps on peut implémenter le C.
  **Mais pas aujourd'hui.** » Ne pas le construire sans sa demande.
- ⚠ **Un contrôle a été RETOURNÉ, pas assoupli** : la colonne figée de 📦 Stocks
  exigeait le TEXTE `…celluleFigee(…)}`}>{p.nom}</td>` — la cellule porte
  maintenant la fiche, le lien et les notes. Ce qui est MESURÉ n'a pas bougé
  (la cellule reste collée à gauche avec son fond), et **un contrôle de plus**
  vérifie que la fiche est DANS la cellule figée, donc qu'elle défile avec elle.
- **Rien à coller dans Supabase** : tous ces champs vivent sur la fiche d'un
  article et sur les boutiques, que l'administrateur écrit déjà.

### 🧰 Le matériel de travail (17/09/2026)
- Timo : « le matériel de travail… comment faire le suivi, pour éviter la
  perte des équipements de travail sur le terrain ». Puis, sur le marquage :
  « un code QR imprimé sur un outil peut s'abîmer en quelques heures
  d'utilisation… y a-t-il une alternative plus robuste ? » — **il a raison**,
  une étiquette papier ne tient pas une semaine sur un chantier. Le numéro se
  **GRAVE** sur l'outil et **se TAPE** (le champ accepte déjà un code scanné
  ou tapé) ; le NFC a été proposé et **mis de côté** (puce anti-métal
  nécessaire sur du métal, et **Web NFC n'existe que sur Chrome Android, pas
  sur iPhone** — non vérifié sur un vrai téléphone, à ne pas promettre).
  **Le registre ne dépend d'AUCUN marquage** : on choisit l'outil dans la
  liste, comme un article dans 🛠 Travaux. UNE règle pure, `lib/outillage.js`
  (sans import, comme lib/banques.js) ; écran `screens/Outillage.jsx`.
- ⚠ **CE N'EST PAS DU STOCK.** Le stock compte ce qui se VEND ; une échelle
  ne se vend pas, elle part et elle revient. Rangée dans 📦 Stocks, elle
  entrerait dans la valeur du stock et dans les alertes de
  réapprovisionnement, et une sortie ressemblerait à une vente. Le registre
  vit dans le champ **`outillage`** d'une boutique (`{ outils, appels }`),
  comme la liste des banques — **rien à coller pour créer une table**.
- ⚠⚠ **LE REGISTRE EST CELUI DE TOUTE LA MAISON, PAS D'UNE BOUTIQUE**
  (Timo, 18/09/2026, capture des pastilles : « pour l'outillage, ne pas
  classer par boutique… c'est une propriété générale de toute l'entreprise.
  C'est qui reçoit l'outil qui peut le faire classer : un gérant de boutique
  qui reçoit, c'est dans sa boutique ; un magasinier, c'est au magasin. Donc
  soit boutique, soit magasin »). Un marteau n'appartient pas à une boutique.
  - **Plus de pastille de boutique** en haut de 🧰 Outillage : UN registre,
    `registreUnifie(lieux)`, où `lieux` = les boutiques ET les magasins de
    l'espace regardé (`lieuxDuRegistre`, jamais TERRAIN). **Le mur tient** :
    « toute la maison » = tout l'espace REGARDÉ.
  - **OÙ un outil se trouve est DÉDUIT**, jamais choisi dans un menu :
    `lieuDeRangement` = le lieu posé par le dernier RETOUR, sinon celui de sa
    création, sinon (outil d'avant la règle) le nom de la fiche qui le garde ;
    `lieuOutil` dit « chez KOSSI » tant qu'il est dehors, et la colonne
    **« Où »** ajoute « revient à … ». Le retour porte donc un `lieu`.
  - **Celui qui reçoit classe** : sa boutique si c'en est une
    (`lieuDeLaPersonne`) ; **sinon on lui DEMANDE** (décision Timo — un
    administrateur « Toutes » n'a pas de boutique attitrée, et on ne range
    jamais au magasin d'office). « ➕ Ajouter un outil » a sa case
    **« Où est-il rangé ? »**.
  - ⚠ **Sous le capot, rien ne bouge de place** : chaque outil reste écrit
    dans la fiche de boutique qui le gardait — **rien à coller, rien à
    migrer**, et `securite-22` / `-23` / `-24` restent valables (ils lisent le
    RÔLE, pas la boutique). C'est l'écran qui réunit. Le registre unifié pose
    deux marques sur chaque outil (`_fiche`, `_lieu_defaut`) ; **`remplacerOutil`
    et `ajouterOutil` les retirent — le SEUL endroit à ne pas oublier**, et le
    banc le mesure.
  - **Un numéro gravé est unique dans TOUTE la maison**, plus seulement dans
    une boutique.
  - **UN FILTRE PAR LIEU** (demande Timo, 18/09/2026) : une liste déroulante
    « Tous les lieux (N) » sur la ligne du titre, qui vaut pour les CINQ vues,
    chaque lieu avec son compte. « Tous » d'office. **Sans le mot « Lieu »
    devant** (capture Timo : « supprimer le mot Lieu… Registre est déjà
    suffisant ») — le titre de la vue dit déjà ce qu'on regarde.
- **🏗 LE CHANTIER D'UN OUTIL SE CHANGE SANS LE RAMENER** (Timo, 18/09/2026 :
  « aujourd'hui il finit le chantier A, il n'a pas besoin de ramener l'outil
  avant d'aller sur le chantier B… il peut juste changer le chantier DANS SON
  ESPACE »).
  - **Un mouvement de type `chantier`**, qui s'inscrit au registre (la trace
    ne rétrécit jamais) mais qui est **TRANSPARENT** : l'outil reste sorti,
    chez la même personne, avec la même date de retour et le même lieu de
    rangement. ⚠ D'où `TYPES_ETAT` et `dernierMouvementEtat` : **l'état se lit
    sur le dernier mouvement qui le CHANGE**, plus sur le dernier tout court —
    sinon un changement de chantier ferait croire que l'outil est rentré.
    `chantierEnCours` = le dernier changement POSTÉRIEUR à la sortie en cours,
    sinon le chantier de la sortie ; une nouvelle sortie repart à zéro.
  - **QUI** : `peutChangerChantier` = celui qui DÉTIENT l'outil (bouton
    « 🏗 Changer le chantier » dans 🧰 Mes outils) **et** celui qui tient le
    registre (bouton rond 🏗 sur la ligne d'un outil sorti). Personne d'autre,
    et jamais sur un outil rangé.
  - ⚠ **« Dès que le chantier est déclaré terminé, plus possible d'assigner un
    chantier à un outil SAUF pour les chantiers saisie libre »** :
    `chantiersOuvertsPourOutil` (calculs.js) = chantiers de devis au statut
    `en_cours` (**terminé et réceptionné sont dehors**) + 🛠 travaux à crédit
    non soldés, de l'espace regardé, rangés par ordre alphabétique français.
    `critiqueChangementChantier` refuse un chantier CHOISI qui n'y est plus —
    et laisse **toujours** passer un nom TAPÉ (`libre`), la porte de sortie.
  - **La SORTIE aussi** (« saisie libre ET sélection de chantier en cours et
    chantier à crédit ») : le champ Chantier passe par LE champ commun
    `ChampSuggestions` avec la même liste — cliquer choisit, taper reste libre.
  - ⚠ **LE COUPLE : `securite-25`**. Le détenteur ne tient pas le registre :
    sans ce script son changement de chantier serait refusé et **tout le lot
    resterait coincé**. Il élargit sa porte d'UN cran — le registre débarrassé
    des justifications **et** des mouvements `chantier`
    (`outillage_sans_justifs_ni_chantiers`) doit rester IDENTIQUE : il dit où
    il travaille, il ne rend pas l'outil et ne repousse pas sa date de retour.
    Il REPREND `securite-24` (donc `-23`, `-22`) en entier : **c'est le seul à
    coller**. **Collé par Timo le 18/09/2026 (`true | true | true | true | true`).**
- **📤 PLUSIEURS OUTILS EN UNE SEULE SORTIE** (Timo, 20/09/2026, après
  « d'après le code, plusieurs outils peuvent être assignés à une personne à
  une seule sortie ? » — non, et il en voulait une : « on choisit plusieurs
  outils, ensuite qui le prend, quel chantier et retour prévu… en bas de la
  ligne outils, on ajoute une case outils assigné ; quand on choisit, l'outil
  s'ajoute dans cette case »).
  - ⚠⚠ **SEULE LA SAISIE EST GROUPÉE, JAMAIS LA TRACE** : le lot écrit **UN
    mouvement de sortie par outil, sur SA fiche**. C'est ce qui permet à la
    perceuse de rentrer pendant que l'échelle reste dehors, change de chantier
    toute seule ou part en réparation. Un lot d'un seul outil se comporte
    exactement comme avant. Un mouvement groupé aurait fait perdre, au premier
    retour, la réponse à « lequel est revenu ? ».
  - **La case « Outils assignés »** sous la ligne Outil : une pastille par
    outil (nom, numéro gravé, ✕ pour le retirer), l'avertissement rouge d'une
    boîte incomplète sur SA pastille. ⚠ **Elle ne s'affiche pas tant qu'elle
    est vide** et **n'impose aucune hauteur** — elle naît avec le premier outil
    et grandit avec eux (sa demande, le jour même). Le bouton reste éteint tant
    qu'elle est vide et compte les outils.
  - **Le refus se dit AU MOMENT où on ajoute** (`critiqueAjoutLot`) : déjà
    sorti, perdu, réformé, en réparation, ou déjà dans la case — jamais après
    avoir saisi la personne, le chantier et la date pour rien.
  - ⚠ **Revérifié DANS le geste sur l'état FRAIS de chaque outil**
    (`critiqueSortieLot`) : si un seul du lot n'est plus sortable, **rien ne
    part** et le refus le NOMME. ⚠ Le banc met l'outil fautif en **deuxième**
    position : un contrôle qui ne le regarde qu'en tête laisse passer une règle
    qui ne vérifie que le premier (éprouvé — elle tombe).
  - ⚠ **UNE seule écriture pour tout le lot**, même si les outils appartiennent
    à des fiches différentes (le registre est celui de toute la maison) ; et
    **UN seul message** à la personne, qui liste les outils — on ne fait pas
    vibrer cinq fois le même téléphone pour un geste. Le message et la ligne de
    journal les nomment au MÊME endroit (`nommerLot`).
  - ⚠ **La règle d'un outil seul N'EST PAS une copie** : `critiqueSortie`
    passe par `critiqueSortieLot`. Deux listes de refus finiraient par diverger.
  - **Rien à coller** : `securite-22` couvre déjà cette écriture.
- **LA RÈGLE QUI EMPÊCHE LA PERTE : un outil est TOUJOURS sous le nom de
  QUELQU'UN.** Pas « sur le chantier de MR ERIC » — un chantier ne perd pas
  une perceuse, une personne la perd ; le chantier est noté à côté. L'état
  (en boutique / sorti / en réparation / perdu / réformé) est **DÉRIVÉ du
  dernier mouvement**, jamais un champ écrit à la main, et **un mouvement ne
  s'efface jamais** (liste qui ne rétrécit pas, comme les reprises d'une
  vente). Deux gestes : **📤 Sortie** (qui le prend, pour quel chantier,
  quand il revient — la personne reçoit un message) et **📥 Retour** (bon
  état ou abîmé). Une sortie sans personne ou sans date de retour est refusée.
  ⚠ **À QUI L'OUTIL EST RENDU DOIT SE LIRE** (défaut trouvé par Timo,
  18/09/2026 : « à qui on rend l'outil n'est pas mentionné ») : la personne
  qui reçoit le retour était bien ENREGISTRÉE (`par`, celui qui fait le geste)
  mais ne s'affichait NULLE PART — **un registre dont la trace ne se lit pas
  ne sert à rien**. Depuis : `histoireOutil` rend chaque mouvement en une
  ligne lisible, **UN CLIC sur la ligne du registre l'ouvre** (la règle de
  dépliage de 💰 Ventes et 📋 Dettes), la colonne dit « Chez qui / **rendu
  à** », la question du retour et le journal nomment celui qui reçoit, et
  « Ce qui est dehors » dit qui a **remis** l'outil. ⚠ Les mots comptent :
  une sortie se lit « **pris par** KOSSI · remis par CHEF BMI » — une
  première version écrivait « remis par KOSSI », c'est-à-dire l'inverse.
- **QUI le tient** (décision Timo) : **le chef technicien, le magasinier,
  l'administrateur** — `peutTenirOutillage`, revérifié DANS le geste.
  ⚠ **« Chef technicien » = un technicien QUI PORTE L'ÉTOILE ⭐, à commission
  OU salarié** (Timo, 18/09/2026 : « technicien ordinaire veut dire technicien
  commission ? » — non : ce n'est pas le type de paie qui décide, c'est
  l'étoile). Un technicien SANS étoile ne s'enregistre donc pas lui-même
  (sinon la trace ne vaut rien), qu'il soit à commission ou salarié ; un chef
  d'équipe COMMERCIAL non plus (ce n'est pas son métier), et **le gérant n'a
  pas été nommé** : ne pas l'ajouter sans sa demande. Ajouter ou réformer un outil =
  administrateur (c'est du matériel acheté). ⚠ **LE COUPLE** :
  `peutTenirOutillage` (lib/outillage.js) et `a_pouvoir_outillage()`
  (serveur, **`securite-22`**) doivent dire la même chose — sans le SQL, la
  sortie enregistrée par le chef ou le magasinier serait REFUSÉE par la base
  et tout le lot resterait coincé. `securite-22` REPREND `securite-8` telle
  quelle et n'y ajoute que `outillage` à côté de `demandes` : `securite-8`
  reste entier (ravitaillement, écran de connexion et cachet au PRINCIPAL,
  piège de l'UPSERT).
- **UN OUTIL PERDU : décisions « b » ET « c »** (Timo, 17/09/2026). Motif
  obligatoire (« une perte sans motif ne s'explique à personne »), valeur
  proposée = le prix d'achat ; **la valeur entre dans les pertes** de la
  boutique (`pertesDe`, `valeurPerdue`, tableau 💸 Pertes) ; **et
  l'ADMINISTRATEUR peut poser une retenue sur le salaire** de la personne qui
  en répondait — proposée, **jamais imposée** (« la perte reste à la charge de
  BMI » si on refuse). La retenue passe par **le mécanisme qui existe déjà** :
  une **AVANCE du mois** (`u.avances`), que `paieMois` soustrait du net sans
  toucher à la base CNSS — **aucun champ neuf, rien à coller**. Une perte
  déclarée ne se défait pas ; la personne reçoit un message.
- **💵 UN OUTIL PERDU SE REMBOURSE PAR DEUX CHEMINS** (Timo, 18/09/2026 :
  « pour les salariés, c'est une retenue sur le salaire ; pour les techniciens
  commission, c'est retenu sur commission »), parce qu'il y a deux façons
  d'être payé chez BMI. `modeRetenue` (lib/outillage.js) : technicien à
  commission et commercial → **commission** ; tous les autres (technicien BMI,
  magasinier, gérant…) → **salaire**.
  - **L'ardoise vit SUR LA PERTE** : `a_rembourser` (ce qu'on demande — proposé
    = la valeur de l'outil, l'administrateur peut demander moins, **0 = à la
    charge de BMI**) et `retenues`, une liste qui ne rétrécit jamais.
    `resteARetenir = a_rembourser − dejaRetenu`. **Sans cette écriture,
    l'argent partait bien mais RIEN ne pouvait s'afficher** — c'est
    exactement ce qui manquait.
  - **SALAIRE** : le mécanisme qui existe déjà, une **AVANCE du mois**
    (`u.avances`, que `paieMois` soustrait du net sans toucher la base CNSS).
    Se pose à la déclaration, **puis mois après mois** depuis le carré
    « Perdus » (bouton 💵, administrateur seul).
  - **COMMISSION** : le technicien à commission n'a pas de salaire à amputer.
    Sa retenue se prend **sur sa PROCHAINE part d'installation**
    (`retenueOutilPourPrime` → `construirePaiementPrime`) : la dépense sort de
    la caisse **diminuée**, la fiche garde `retenue_outil` et `montant_verse`,
    **tout retenu = AUCUNE dépense** (rien ne sort de la caisse, une dépense de
    0 F ferait mentir le journal). On ne retient **jamais plus que ce qui est
    payé** — une part d'installation ne devient pas une dette — ni plus qu'il
    ne reste dû ; les pertes les plus **anciennes** se soldent en premier, dans
    **toutes** les boutiques. Elle est **ANNONCÉE** dans les deux écrans qui
    paient une part (🏠 Clients installés, 💰 Primes remises) : l'outil, le
    montant retenu, le net. Le bouton 💵 n'est **pas** proposé pour elle —
    l'écran DIT que ça se prend tout seul, il ne fait pas semblant.
  - ⚠⚠ **LE MUR (défaut trouvé le 18/09/2026 en répondant à « le cloisonnement
    comme tu le dis est bien fait ? »)** : `retenueSurPaiement` parcourait
    TOUTES les boutiques du chargement. Un vendeur réel ne télécharge que les
    siennes — mais **l'administrateur PRINCIPAL télécharge les deux espaces**,
    et c'est lui qui paie les parts depuis 🏠 Clients installés : une perte
    d'ENTRAÎNEMENT se retenait sur de l'argent RÉEL (30 000 F, **mesuré**).
    `retenueOutilPourPrime` reçoit donc la **CAISSE QUI PAIE**
    (`e.prime_boutique`) et ne regarde que les boutiques de SON espace :
    **c'est l'espace de l'ARGENT qui décide, jamais celui de la personne qui
    clique.** Leçon générale : le banc surveille les lectures brutes de
    `db.users`, **pas** celles de `db.boutiques` — une fonction pure qui reçoit
    `db.boutiques` en entier et le PARCOURT (au lieu d'y chercher un nom) est
    un passage de mur en puissance.
  - ⚠ **LE COUPLE : `securite-24`**. Le vendeur et le gérant PAIENT une part,
    et ne tiennent pas le registre : sans ce script leur écriture serait
    refusée par la base et **tout le lot resterait coincé**. Il leur ouvre
    EXACTEMENT une porte — le registre débarrassé des retenues
    (`outillage_sans_retenues`) doit rester IDENTIQUE : ils inscrivent ce qui
    a été retenu, ils ne sortent pas un outil, ne changent pas ce qui est dû.
    Il REPREND `securite-23` (donc `-22`) en entier : **c'est le seul à
    coller**. **Collé par Timo le 18/09/2026 (`true | true | true | true`).**
- **LE CARRÉ « PERDUS / HORS D'USAGE » S'OUVRE COMME LES QUATRE AUTRES**
  (18/09/2026 : « dans perdu quand on clique, la liste de tous les équipements
  perdus apparaît et qui l'a perdu, combien a déjà été retenu sur son salaire
  ou commission, combien il reste à payer etc… tout apparaît ») — il était le
  seul des cinq à ne pas être un bouton. Colonnes : **outil / qui (et sur quoi
  il est retenu) / le / pourquoi / valeur / à rembourser / déjà retenu / reste
  à payer** ; le détail de chaque retenue (montant, mois ou part, date, par
  qui) s'ouvre AU CLIC, avec l'histoire de l'outil.
  ⚠ **ET IL PORTE AUSSI LES OUTILS HORS D'USAGE — PAS DE SIXIÈME CARRÉ**
  (Timo, 18/09/2026 : « pas un 6e carré… grouper avec perdu. Donc carré
  perdu-hors d'usage. À l'intérieur on classe les perdus et les hors
  d'usage »). **Réformer** (bouton 🗑, administrateur seul, motif obligatoire)
  existait et faisait déjà son travail — l'outil sort des propositions de
  sortie, sort de l'appel, sort du carré « Outils » — mais **il ne se lisait
  NULLE PART** : il restait noyé dans le registre avec une pastille grise, et
  le carré comptait les perdus SEULS. Depuis : `outilsPerdus` /
  `outilsReformes` / `outilsHorsService` / `reformeDe` (lib/outillage.js), le
  carré compte les deux et dit la part de chacun dessous, et la vue affiche
  **DEUX blocs titrés — les perdus d'abord** (il y a de l'argent en jeu),
  **les hors d'usage ensuite** (usés ou cassés : les trois colonnes d'argent
  y valent « — », il n'y a rien à rembourser de personne ; on lit qui l'a
  décidé, quand, pourquoi, et le prix d'achat). Les deux premiers titres de
  colonne se sont élargis (« Qui / décidé par », « Le ») ; les colonnes
  d'argent n'ont pas bougé. Le banc mesure le classement, et le contrôle a
  été éprouvé en remettant la faute exprès : il tombe.
- **🧰 LES BOÎTES À OUTILS — SUIVRE CE QU'IL Y A DEDANS** (Timo, 18/09/2026 :
  « les boîtes à outils… comment suivre le matériel qui s'y trouve »). Une
  boîte ne rentre pas dans le registre comme une perceuse : **personne
  n'enregistrera quinze sorties chaque matin**, et on ne grave pas un numéro
  sur une pince à 2 000 F. Donc : **LA BOÎTE EST UN OUTIL, et elle porte SA
  LISTE** (champs `boite` et `contenu` sur la fiche de l'outil — **rien à
  coller**). ⚠ **Et ça se DIT À LA CRÉATION, par une case à cocher**
  (18/09/2026, le jour même : « c'est peu logique d'avoir cette caisse sur une
  perceuse… lors de la création d'un outil, ajouter une case à cocher si
  caisse ou boîte à outils. En ce moment-là caisse apparaît sur la fiche pour
  renseigner ce qu'elle contient. **Si pas coché, pas de caisse dans la
  fiche** ») : la première version faisait d'un outil une boîte dès qu'on lui
  posait une liste, donc le bouton 🧰 s'affichait sur TOUS les outils —
  RETOURNÉ. `estBoite` lit le drapeau `boite` ; le `|| contenuDe(...)` qui
  reste est un filet pour les boîtes nées avant la case, jamais une porte.
  ⚠ Une caisse oubliée à la création ne se rattrape pas : **on supprime la
  fiche et on la recrée** (voir le point suivant) — on ne transforme JAMAIS
  une perceuse en caisse après coup, c'est exactement ce qu'il a retiré.
  Elle
  sort et elle rentre en UN geste, comme avant ; **c'est AU RETOUR qu'on
  compte**, une fois et pas deux (elle a été comptée la fois d'avant, on sait
  donc ce qu'elle contient en partant). Règles pures dans `lib/outillage.js`
  (`contenuDe`, `estBoite`, `compterBoite`, `manquesDuComptage`…), panneau
  `PanneauComptage` écrit **UNE fois** dans `screens/Outillage.jsx` pour les
  deux interfaces.
  - **DÉCISION 1a — RIEN NE RENTRE SANS ÊTRE COMPTÉ** : `critiqueRetour`
    refuse le retour d'une boîte dont le comptage n'est pas posé APRÈS la
    sortie en cours, et le formulaire de retour s'OUVRE sur le comptage au
    lieu de crier un refus. Une perceuse, elle, rentre comme avant.
  - **DÉCISION 2b — CELUI QUI REND PEUT COMPTER** (« pour qu'il valide ce
    qu'il ramène ») : `peutCompterBoite` = celui qui tient le registre **et**
    le détenteur, personne d'autre. Le détenteur compte depuis 🧰 Mes outils ;
    **le RETOUR lui-même reste le geste de celui qui tient le registre** — un
    technicien ne s'enregistre pas lui-même, sinon la trace ne vaut rien.
  - ⚠ **Le comptage est TRANSPARENT** : `comptage` n'est PAS dans
    `TYPES_ETAT`, sinon compter une boîte ferait croire qu'elle est rentrée
    (exactement le piège du changement de chantier, réglé le matin même).
  - ⚠ **QUI en répondait ne se lit PAS sur `detenteurOutil`** : au retour la
    boîte est déjà rentrée, elle n'est plus chez personne. `responsableDuComptage`
    remonte à la SORTIE qui précède le comptage — et si la boîte était rangée,
    personne n'en répondait.
  - **CE QUI MANQUE SE VOIT** : la ligne du registre le dit, la boîte
    **repart INCOMPLÈTE et le formulaire de sortie l'annonce** tant que le
    matériel n'est pas remplacé. La liste, elle, ne baisse pas toute seule :
    le kit reste le kit (l'administrateur la corrige s'il renonce à remplacer).
  - **UN MANQUE DEVIENT UNE PERTE par le mécanisme qui EXISTE** : le matériel
    manquant naît comme **SA PROPRE fiche, déjà déclarée perdue**
    (`perteDuContenu`), sous le nom de qui détenait la boîte. Le carré
    « Perdus / Hors d'usage », l'ardoise, la retenue sur salaire et celle sur
    commission n'ont **pas une ligne de plus à apprendre** — et `outilsVivants`
    l'écarte du matériel de travail, de l'appel et des propositions de sortie.
    L'ardoise a donc été écrite **UNE fois** (`demanderCombienDu` +
    `poserArdoise`) : les deux pertes y passent. Une perte ne se déclare pas
    deux fois — le trio **boîte + ligne + comptage** (`manquesADeclarer`)
    l'empêche.
  - ⚠ **Ce que ça ne fait PAS, et Timo le sait** : le petit matériel n'a pas
    d'histoire individuelle. On saura « il manque 2 tournevis plats depuis le
    chantier de MR ERIC », jamais « c'est LE tournevis n° 7 ».
  - ⚠ **LE COUPLE : `securite-26`**. Le détenteur ne tient pas le registre :
    sans ce script son comptage serait refusé par la base et **tout le lot
    resterait coincé**. Il élargit sa porte d'UN cran — le registre débarrassé
    des justifications, des chantiers **et des comptages**
    (`outillage_sans_gestes_du_detenteur`) doit rester IDENTIQUE : il dit ce
    qu'il ramène, il ne rend pas l'outil et ne baisse pas la liste de ce que la
    boîte doit contenir. Il REPREND `securite-25` (donc `-24`, `-23`, `-22`)
    en entier : **c'est le seul à coller**.
    **Collé par Timo le 18/09/2026 (`true | true | true | true | true | true`).**

- **🗑 SUPPRIMER UN OUTIL, ✏️ CORRIGER UNE CAISSE — SEULEMENT QUAND ELLE EST
  RANGÉE** (Timo, 18/09/2026 : « pourquoi l'administrateur principal ne peut
  pas supprimer un outil ou modifier une caisse ? » puis, sur la condition :
  **« possible quand l'outil est en magasin ou boutique »**). Il manquait
  vraiment les deux : une fiche créée par erreur n'avait aucune sortie (la
  réformer aurait sali « Hors d'usage » avec un outil qui n'a jamais existé),
  et `changerLigneContenu` était écrite dans lib/outillage.js **sans qu'aucun
  écran ne l'appelle** — une règle qui ne commandait rien.
  - **LA CONDITION EST LA SIENNE, et elle est juste** : `outilRange` /
    `critiqueOutilRange` — un outil chez quelqu'un, chez un réparateur, perdu
    ou réformé ne se réécrit pas. On ne change pas ce qu'une caisse « doit
    contenir » pendant qu'elle est sur un chantier, sinon le comptage du
    retour mesurerait autre chose que ce qui est parti. Le refus NOMME l'état
    et le détenteur (« est dehors — chez KOSSI : vous pourrez le supprimer
    quand il sera rentré »).
  - **SUPPRIMER = administrateur PRINCIPAL seul**, motif obligatoire, et
    **rien n'est jeté** : la fiche passe dans `outillage.supprimes`, une liste
    qui ne rétrécit jamais (comme les reclôtures d'une caisse), avec qui,
    quand et pourquoi. Un cadre « 🗑 Fiches retirées du registre » sous le
    registre la remet d'un clic — **et la fiche revient PROPRE** (les quatre
    champs `supprime_*` et les marques du registre unifié sont retirés).
    La confirmation dit combien de mouvements partent avec elle.
  - **🔢 LE NUMÉRO GRAVÉ S'ATTRIBUE TOUT SEUL** (18/09/2026 : « je veux que
    les numéros s'attribuent d'une manière automatique… **pas à taper**.
    Déjà j'ai essayé 2 numéros identiques, c'est passé ») :
    `prochainNumeroOutil` = `BMI-` + le plus grand numéro déjà pris + 1, sur
    trois chiffres (`BMI-001`, `BMI-013`…). Le champ du formulaire l'AFFICHE
    en gras, **en lecture seule** ; c'est le geste qui l'écrit, jamais la
    frappe. Un numéro qu'on tape est un numéro qu'on peut répéter.
    ⚠⚠ **ET UNE FICHE RETIRÉE GARDE SON NUMÉRO RÉSERVÉ** : le compteur ET le
    contrôle d'unicité regardent `outils` **+ `supprimes`** (`toutesLesFiches`)
    — sinon remettre une fiche au registre ferait un doublon, trou ouvert le
    jour même par la suppression. Le compteur ne redescend jamais.
    ⚠ Le doublon vu par Timo n'a **pas** pu être reproduit sur la règle
    (elle refuse même à la casse et aux espaces près) ; la seule porte
    légitime restante est **le MUR** — le même numéro peut exister une fois
    en réel et une fois en formation, ce sont deux mondes.
  - **✏️ CORRIGER LA FICHE ELLE-MÊME = l'administrateur**, outil rangé
    (18/09/2026 : « sur la fiche elle-même aussi on doit pouvoir modifier…
    **si numéro gravé est faussé, on ne peut pas laisser comme ça** ») : nom,
    **numéro gravé** (resté corrigible : un outil mal gravé physiquement se
    rattrape), catégorie, date et prix d'achat (`corrigerOutil`,
    `critiqueCorrectionOutil`). Le numéro reste **UNIQUE dans toute la
    maison**, mais ⚠ **l'outil ne se gêne pas lui-même** (`o.id !== outil.id`
    — `critiqueNouvelOutil` l'aurait refusé, puisqu'il l'aurait trouvé).
    L'histoire, les mouvements et la liste ne bougent pas ; le journal DIT ce
    qui a changé, champ par champ (`diffFiche`). ⚠ **Le LIEU ne se corrige
    PAS ici** : il est DÉDUIT (dernier retour, sinon création) et la fiche vit
    physiquement dans la boutique qui la garde — le changer seul ferait mentir
    `lieuDeRangement`. Un retour le repose, et l'écran le dit.
  - **MODIFIER UNE CAISSE = l'administrateur**, caisse rangée : ✏️ sur chaque
    ligne (nom, quantité, valeur — `changerLigneContenu` enfin employée),
    ajout et retrait gardés par la même condition, et **« ↩ Ce n'est plus une
    caisse »**. ⚠ Décocher exige une **liste VIDE** : sinon le filet
    d'`estBoite` (« un outil qui porte une liste reste une boîte ») la
    rattraperait et la case mentirait.
  - ⚠ **La règle du 18/09 tient** : on ne transforme jamais une perceuse en
    caisse après coup. Le bouton 🧰 ne s'affiche que sur une caisse ; la porte
    de sortie d'une erreur, c'est la suppression puis une nouvelle fiche.
  - **Rien à coller** : `admin` est déjà dans `a_pouvoir_outillage`
    (`securite-22`) des deux côtés. Le banc le vérifie côté application ET
    dans le SQL.

- ⚠ **« RANGÉ », JAMAIS « EN BOUTIQUE »** (capture Timo, 18/09/2026, colonne
  État : « je ne comprends pas pourquoi on dit en boutique même si au
  magasin ») — l'étiquette MENTAIT : une échelle rangée au DÉPÔT MAISON
  s'affichait « En boutique », juste à côté d'une colonne « Où » qui disait
  DEPOT MAISON. Un outil est rangé dans un **LIEU** — boutique OU magasin —,
  et c'est « Où » qui le nomme. L'identifiant interne `en_boutique` ne bouge
  pas (l'état est DÉRIVÉ, rien n'est stocké) ; seuls les MOTS ont changé :
  l'étiquette, le refus d'un retour (« est déjà rentré : il est rangé à … »)
  et l'infobulle du 📥 (« Enregistrer le retour »). Le banc l'éprouve en
  remettant « En boutique » : il tombe.

- **📋 L'APPEL DE L'OUTILLAGE, CHAQUE SEMAINE ET PAR LIEU** (décision Timo,
  18/09/2026 : personne ne peut voir les outils de deux boutiques à la fois —
  **chaque boutique et le magasin font LEUR appel**, sur ce qui est rangé là).
  Une bande ambre nomme les lieux qui n'ont pas encore le leur, avec un bouton
  par lieu ; on coche ce qu'on a sous la main, **ce qui n'est pas coché reste
  dehors et SE VOIT** (`manquantsDuDernierAppel`, qui cherche l'outil dans TOUT
  le registre). **Un appel est une PHOTO : il ne se corrige pas**, il porte son
  `lieu` et se range dans la fiche de CE lieu. La semaine est nommée par son
  **LUNDI** (`lundiDe`) : deux personnes qui appellent le mardi et le jeudi
  parlent de la même semaine. Un outil sorti n'est pas coché d'office (il est
  chez quelqu'un), un outil perdu n'est jamais appelé. `appelAFaire` et
  `construireAppel` prennent la LISTE des outils du lieu, plus une fiche de
  boutique ; `lieuxSansAppel` rend les lieux en retard.
- **LES QUATRE CARRÉS S'OUVRENT** (Timo, 18/09/2026, capture : « dans les
  cases outils, dehors, en retard, en réparation, lorsqu'on clique dessus ») :
  chacun ouvre SA liste, avec les colonnes qui répondent à SA question —
  **Outils** = le registre entier (spécifications + l'histoire au clic),
  **Dehors** = chez qui, pour quel chantier, depuis quand, retour prévu,
  **En retard** = chez qui, la date promise, le retard en jours, **pourquoi**,
  **En réparation** = chez quel réparateur, **son numéro** (vrai logo
  WhatsApp, `envoyerWhatsApp`), la panne, le prix. `outilsDeLaVue` +
  `VUES_OUTILLAGE` ; « Dehors » d'office. Le carré regardé porte un cadre
  épais. Réparateur et panne sont EXIGÉS, le prix non (on ne le connaît pas
  toujours en déposant l'outil).
- **💸 LE PRIX D'UNE RÉPARATION EST UNE DÉPENSE** (Timo, 18/09/2026 : « oui,
  mets le prix de réparation dans les dépenses » — ~~la version du matin en
  faisait une simple information portée par l'outil~~, RETOURNÉ). Catégorie
  **`CATEGORIE_REPARATION_OUTIL`** = « Réparation d'outillage » (constants.js,
  insérée après « Achat marchandises », « Autre » reste en dernier) : c'est
  une VRAIE charge de BMI, donc **jamais** dans `CATEGORIES_HORS_CHARGES`.
  ⚠ **Elle passe par LA fabrique commune `construireDepenseSaisie`** — donc
  par TOUTES les règles de l'argent, sans qu'une seule soit recopiée dans
  l'écran : validation du DG au-delà de 5 000, « Payé avec » qui nomme chaque
  caisse, message aux principaux, blocage de clôture, et la limite du tiroir
  (`critiqueSortieTiroir`, tiroir + enveloppe) revérifiée comme à la saisie.
  **DEUX moments, jamais deux dépenses** : au dépôt si le prix est connu ;
  sinon **au retour**, où le 📥 ouvre un petit formulaire « Combien a coûté la
  réparation ? ». Le mouvement porte son `depense_id` — c'est lui qui empêche
  le doublon —, la dépense porte `outil_id`, `outil_nom`, `mouvement_id` et
  `auto: "reparation_outil"`, et sa description cite l'outil, son numéro, la
  panne et le réparateur. **0 F = rien n'est écrit** (garantie, geste du
  réparateur). Corriger un montant déjà dépensé passe par 📤 Dépenses.
- **⏱ LE RETARD SE JUSTIFIE, PAR CELUI QUI DÉTIENT L'OUTIL** (Timo,
  18/09/2026 : « celui qui a un outil et est en retard de retour doit
  justifier pourquoi l'outil n'est pas encore de retour, **dans son
  interface** »). `doitJustifier` : SON outil, en retard, pas encore
  expliqué ; `justifierRetard` empile la phrase sur la fiche
  (`justifications`), **rattachée à SA sortie** — une nouvelle sortie en
  redemandera une. Une justification vide est refusée. La vue « En retard »
  la montre, ou dit tout haut « ⏳ Pas encore justifié ».
  ⚠ **LE TECHNICIEN A DONC SON INTERFACE** : l'onglet 🧰 passe à TOUT
  technicien, mais celui qui ne tient pas le registre n'y voit QUE ce qu'il
  détient (`MesOutils`, `mesOutils` cherche dans TOUTES les boutiques de son
  espace — un technicien n'a pas de boutique) et la case pour expliquer. Son
  onglet s'appelle **« 🧰 Mes outils (N) »**, N = ses retards à justifier ;
  celui qui tient le registre lit « 🧰 Outillage ». ⚠ **C'est le DROIT
  (`peutTenirOutillage`) qui décide du libellé, jamais l'étoile seule** —
  l'administrateur et le magasinier ne sont pas chefs d'équipe.
  ⚠ **Serveur : `securite-23`** ouvre au détenteur **EXACTEMENT une porte** —
  le registre débarrassé des justifications (`outillage_sans_justifs`) doit
  rester IDENTIQUE. Il ajoute une phrase ; il ne sort pas un outil, ne le rend
  pas, ne le déclare pas perdu. `securite-22` n'est pas touché.
  **`securite-23` collé par Timo le 18/09/2026 (`true | true | true`) — il
  contient `securite-22`, qui n'a donc pas eu à être collé à part.**
  ⚠ Au premier essai, le tableau de bord Supabase a répondu **« JWT failed
  verification »** : ce n'est ni la base ni le script, c'est la SESSION de la
  page Supabase qui a expiré — la demande n'arrive jamais jusqu'à la base.
  On recharge la page (F5), on se reconnecte, on recolle : c'est passé. Tous
  nos scripts étant en `create or replace`, les relancer est sans danger.
- L'onglet **🧰 Outillage** est listé dans `ONGLETS_ROLE` pour admin,
  magasinier, technicien et technicien BMI (donc retirable dans 🔐 Pouvoirs —
  et le serveur lit ce retrait, `pouvoirs_off ? 'outillage'`). ~~Il ne
  s'affiche pour un technicien que s'il porte l'étoile ⭐~~ — **RETOURNÉ le
  18/09/2026** : tout technicien l'a, c'est l'ÉCRAN qui décide ce qu'il
  montre.

### 🔒 PROTECTION DES DONNÉES : LE DROIT À L'EFFACEMENT (18/09/2026)
- Timo : « protection des données à caractère personnel… mon app respecte
  déjà la législation togolaise sur cet aspect ? » — réponse honnête : **en
  partie**. L'article 18 de nos contrats (lib/impression.js, EspaceClient.jsx)
  promettait déjà, nommément, la **loi n° 2019-014** et « un droit d'accès, de
  rectification et, dans les conditions prévues par la loi, de suppression ».
  **L'application ne savait pas tenir la promesse de suppression** : supprimer
  le compte d'un client (👥 Utilisateurs) retirait son identifiant et son mot
  de passe, et laissait son nom et son numéro sur chaque vente, chaque dette,
  chaque chantier, chaque message et dans le journal. Rien n'était effacé,
  mais tout avait l'air fait. « Lance le point 1. » → `lib/effacementClient.js`,
  ⚙ **Paramètres → 🔒 Données personnelles** (administrateur PRINCIPAL seul,
  revérifié DANS le geste).
- ⚠ **ON NE DÉTRUIT PAS UNE FACTURE.** La loi commerciale oblige BMI à la
  garder — et le contrat le dit déjà (« dans les conditions prévues par la
  loi »). Donc **trois traitements, jamais un seul** :
  **ce qui n'appartient qu'à lui PART** (compte + ses devis, fiche de
  prospection, messages échangés) ; **ce que les livres gardent RESTE sans son
  nom** (ventes, dettes, proformas, commandes, chantiers : montants, articles,
  numéro de reçu, frais, équipe et matériel intacts) ; **son nom dans les
  textes libres est REMPLACÉ** (journal, observations de chantier, messages
  d'équipe).
- **La référence numérotée n'est pas un caprice** : `CLIENT EFFACÉ N° 3`
  (`pseudonyme`, `prochainNumeroEffacement` = le plus grand posé + 1, il ne
  redescend JAMAIS — même principe que le numéro gravé d'un outil). Sans elle,
  deux clients effacés deviendraient indiscernables et la comptabilité perdrait
  le groupement de leurs achats. Elle relie des lignes, elle ne désigne
  personne. Un client déjà effacé ne se propose plus (`clientsEffacables`).
- **DEUX PORTES FERMÉES** (`critiqueEffacement`, refus qui NOMME le montant) :
  une **dette non soldée** (sans son numéro, la dette ne se recouvre plus) et
  un **chantier non réceptionné** (on a besoin de le joindre). Garder ce qui
  sert un intérêt légitime EN COURS n'est pas refuser un droit, c'est
  l'appliquer quand il s'ouvre. **Avertissements, pas refus** : garantie encore
  en cours, client sans numéro (rapprochement sur le NOM seul — un homonyme
  partirait avec lui), devis qui partent avec le compte.
- ⚠⚠ **ON N'EFFACE JAMAIS LE NOM DE QUELQU'UN D'AUTRE.** À Lomé un prénom seul
  (KOSSI, AMA, KOFFI) est porté par plusieurs personnes : remplacer ce mot
  partout retirerait du journal le nom d'un VENDEUR — et **le journal est ce
  qui dit qui a fait quoi**. `motsSensibles(dossier, autresNoms)` écarte tout
  mot que porte encore quelqu'un d'autre (employé ou client resté), et **l'écart
  est DIT dans le rapport**, jamais nettoyé en silence. Mots d'au moins 4
  caractères, les plus LONGS d'abord (sinon « KOSSI » serait remplacé à
  l'intérieur de « KOSSI MENSAH » et le nom de famille resterait planté là).
  Un **numéro** disparaît derrière sa propre marque (`MARQUE_NUMERO`), pas
  derrière la référence : « (90112233) » ne doit pas se lire
  « (CLIENT EFFACÉ N° 1) ».
- ⚠⚠ **LE MUR (défaut trouvé AU BANC, le jour même)** : le nettoyage des textes
  libres parcourait `db.audits` et `db.messages` EN ENTIER. Un vendeur réel ne
  télécharge que son espace — mais **l'administrateur PRINCIPAL charge les
  DEUX**, et c'est lui qui efface : effacer un client d'ENTRAÎNEMENT aurait
  nettoyé des lignes de journal RÉELLES. **Même leçon que
  `retenueOutilPourPrime`** : une fonction pure qui reçoit une table entière et
  la PARCOURT est un passage de mur en puissance. Le dossier porte donc sa
  **`portee`** — les seules lignes que le geste a le droit de réécrire —, bâtie
  sur les listes déjà filtrées. L'écran, lui, passe par `utilisateursDeLEspace`
  (la table des comptes n'est PAS cloisonnée par le serveur),
  `filtreEspaceAffichage`, `chantiersDeLEspaceRegarde`, et filtre messages et
  journal par leur propre espace. Le contrôle a été éprouvé en remettant la
  faute : il tombe.
- **Ce qui part aussi, et qu'on oublierait** : le **jeton de signature** du PV
  (`contrat_jeton`) est une CLÉ d'accès à son dossier, pas une coordonnée ; la
  **position GPS** du chantier ; la **signature** du contrat et de l'avenant ;
  et **le chantier mis à la CORBEILLE**, qui porte encore son nom et
  ressortirait nommé à la restauration.
- **LA TRACE NE NOMME PERSONNE** (`journalEffacement`) : date, auteur, motif
  **obligatoire**, référence, nombre d'enregistrements — jamais le nom, ce
  serait exactement ce qu'on vient d'effacer. **La demande écrite du client se
  garde sur papier**, l'écran le dit. Un effacement ne se défait pas (ni
  corbeille, ni restauration d'une sauvegarde antérieure) : la confirmation
  l'annonce.
- **Rien à coller dans Supabase** : aucun de ces champs n'est protégé par un
  verrou, et l'administrateur principal les écrit déjà tous les jours.
- **CE QUE L'APPLICATION NE PEUT PAS FAIRE, et l'écran le DIT** : la
  **déclaration des traitements auprès de l'IPDCP** (l'autorité togolaise —
  une démarche, pas un réglage), la question de l'**hébergement hors du Togo**
  (Supabase et Vercel sont à l'étranger ; la loi encadre la sortie des
  données), et la **durée de conservation** (aujourd'hui rien ne s'efface tout
  seul). Ne jamais laisser croire que tout est réglé.

#### 📄 LE DROIT D'ACCÈS — le point 2 (18/09/2026, « lance le point 2 »)
- **Un bouton, un document** : ⚙ Paramètres → 🔒 Données personnelles, sur le
  client choisi, **« 🖨 Dossier personnel (PDF) »** et **« Exporter (CSV) »**.
  Répondre à « qu'est-ce que vous avez sur moi ? » demandait d'ouvrir cinq
  écrans et de recopier à la main : **une réponse incomplète n'est pas une
  réponse.** Règle pure `lib/dossierPersonnel.js`, PDF `genererDossierPersonnel`
  (src/pdf.js, **quatrième** document à passer par les briques communes —
  entête, bandeau de titre, pied de page).
- **UNE SEULE SOURCE** : le dossier vient du MÊME `dossierClient`
  (lib/effacementClient.js) que l'effacement — même mur, même façon de
  reconnaître le client. Deux sources finiraient par se contredire.
- **Neuf familles, aucune oubliée** : identité, achats, dettes et règlements,
  proformas, commandes, devis, chantiers, messages, prospection. **Une famille
  vide le DIT en toutes lettres** (« Aucune commande. ») au lieu de disparaître
  — sinon le client ne sait pas si on n'a rien, ou si on a oublié de regarder.
  Un message dit dans quel SENS il est parti (« vous → BMI »).
- ⚠⚠ **SON MOT DE PASSE N'Y EST JAMAIS — le point le plus important.**
  L'application sait le RECALCULER (`motDePasseConnu`) : c'est justement pour
  ça qu'il faut l'écrire. **Un dossier d'accès qui se promène ne doit pas être
  une clé.** `CHAMPS_INTERDITS` (pwd, pwd_hash2, pwd_salt, mdp_variante,
  `contrat_jeton` — le jeton de signature du PV est lui aussi une clé,
  `empreintes`). L'identifiant, lui, SE DIT : le client en a besoin pour se
  connecter. Le banc le vérifie sur la règle ET **dans le PDF fabriqué** ;
  éprouvé en remettant la faute : trois contrôles tombent.
- **Le document dit ses droits au client** (`MENTIONS_DOSSIER`, qui reprend le
  fond de l'article 18 — il change là-bas, il change ici) : loi n° 2019-014,
  accès / rectification / suppression, et **que factures et contrats se gardent
  par obligation comptable, le nom pouvant en être retiré**. Il dit aussi que
  le mot de passe ne figure nulle part en clair.
- **Le droit d'accès reste OUVERT quand l'effacement est refusé** : une dette
  non soldée n'empêche personne de demander ce qu'on a sur lui. Il est donc
  posé AVANT dans le panneau, comme dans le contrat. **Un client déjà effacé
  n'a plus de dossier** (`critiqueDossier`).
- ⚠ **Le document est un concentré de données personnelles** : l'écran et la
  confirmation disent qu'il ne se remet **qu'à lui**, en main propre ou sur SON
  numéro. **LA TRACE NOMME le client** (`journalDossier`, `save(db, …)` qui ne
  change rien d'autre) — au contraire de celle de l'effacement : on n'efface
  rien ici, il faut pouvoir dire à QUI on a remis.
- ⚠ Piège jsPDF : tout texte venu des données passe par `texteSurPdf`, le banc
  mesure qu'aucune ligne ne sort en lettres espacées.
- **Rien à coller dans Supabase** : on ne fait que lire.


#### 🔒 « VOS DONNÉES » DANS L'ESPACE CLIENT — le point 3 (18/09/2026)
- **Le client se sert LUI-MÊME.** Accorder un droit d'accès en obligeant le
  client à appeler la boutique, c'est ne l'accorder qu'à moitié. Panneau
  **🔒 Vos données personnelles** dans son espace : son résumé, le bouton
  **« 🖨 Télécharger mes données (PDF) »**, ses droits en toutes lettres, et
  deux boutons **« Demander une correction » / « Demander la suppression »**.
- **UNE SEULE SOURCE, trois écrans** : `dossierClient` → `dossierPersonnel` →
  `genererDossierPersonnel`, les mêmes que ⚙ Paramètres. **Les MÊMES
  `MENTIONS_DOSSIER` s'affichent à l'écran et s'impriment** — pas un second
  texte à maintenir. Sinon le client verrait la différence entre ce qu'il
  télécharge et ce que BMI lui remet.
- **Les familles VIDES ne s'affichent PAS à l'écran** (`resumePourLeClient`) :
  sur son écran, une liste de « aucun / aucune » n'apprend rien. **Elles
  restent dans le DOCUMENT**, où elles prouvent qu'on a regardé partout.
- **La demande part par la règle commune WhatsApp** (`texteDemandeDonnees`,
  texte qu'il RELIT avant d'envoyer — WhatsApp n'envoie jamais tout seul), vers
  **la boutique de son chantier, sinon de son dernier achat** ; **jamais un
  numéro codé en dur**. Sans numéro réglé, on le DIT et on renvoie vers
  💬 Messages au lieu de faire semblant. ⚠ Un `quoi` inconnu retombe sur la
  CORRECTION, jamais sur la suppression : devant un doute, on ne propose pas
  d'effacer.
- ⚠ **L'espace client ne refiltre RIEN** : sur son appareil la base ne contient
  que ses données, les politiques du serveur sont la seule barrière (règle
  posée depuis toujours) — et le code le DIT au lieu de le laisser deviner.
  Le document porte le **bandeau de formation** si son compte est
  d'entraînement.
- ⚠ **On n'écrit AUCUNE durée en années** : elle n'est pas tranchée (point 5).
  Un chiffre inventé serait pire que le silence.
- ⚠⚠ **« MES données », ET UN ONGLET À CÔTÉ DE 💬 MESSAGES** (Timo,
  19/09/2026 : « au lieu de vos données personnelles, dire mes données
  personnelles et ramener ça en onglet à côté de message »). **Les deux
  demandes se tiennent** : un PANNEAU au bas de 🏠 Mon espace, c'est BMI qui
  montre au client ce qu'elle détient (« VOS ») ; un ONGLET à lui, c'est le
  client qui vient chercher ce qui le concerne (« MES »). **Le mot suit la
  place.** Écran `screens/MesDonnees.jsx`, onglet `mes_donnees` = « 🔒 Mes
  données », placé **juste après Messages** dans `ONGLETS_ROLE.client` — donc
  retirable dans 🔐 Pouvoirs.
  - **Rien d'autre n'a bougé** : même `dossierClient` → `dossierPersonnel` →
    `genererDossierPersonnel`, mêmes mentions, même document. Seuls le titre
    et l'emplacement changent.
  - ⚠ **Dans les MENTIONS, « vous » RESTE** : là c'est BMI qui s'adresse à lui
    (« vous disposez d'un droit d'accès… »). Le titre est à LUI, le texte de
    loi est de NOUS.
  - **Le panneau a QUITTÉ 🏠 Mon espace**, et son bloc de calcul avec lui —
    une règle qui ne commande plus rien ne reste pas ; six imports devenus
    muets sont partis dans le même geste. Le banc vérifie qu'il n'est plus là
    en double.
  - **Le banc REND le nouvel écran** (base garnie et base nue) et MESURE le
    mot : « Mes », jamais « Vos ». Éprouvé en remettant « Vos » : il tombe.

- **Rien à coller dans Supabase.**

#### 👥 ET LES EMPLOYÉS ? (question de Timo, 18/09/2026)
- Mot pour mot : « je veux savoir et les employés dans cette histoire, leurs
  données ne sont-elles pas protégées… parmi les utilisateurs, le personnel
  n'y figure pas ». **Il a raison, et c'est un vrai trou** : les trois points
  livrés ne couvrent QUE les clients, alors qu'un employé est un sujet de
  données exactement comme eux — et que l'application en sait BIEN plus sur lui.
- **Ce qui EST déjà protégé, et solidement** : la fiche de **PAIE vit dans une
  table à part** (`lib/paie.js`, `supabase/paie-1-table.sql`) que seuls
  l'admin, le comptable et l'intéressé peuvent lire — salaire, primes, avances,
  virements, crédits, pièce d'identité, matricule CNSS. Un appareil qui n'y a
  pas droit ne la reçoit **pas du tout**. Mot de passe en PBKDF2, empreinte =
  une clé jamais un doigt, **année de naissance jamais demandée** (calculs.js :
  « publier l'âge de chacun »), champs de gestion réservés à l'admin
  (`securite-18`), rôle au principal (`securite-9`).
- ⚠⚠ **LE TROU, TROUVÉ ET FERMÉ (« lance le point 1 », 18/09/2026)** —
  `compte_bancaire` n'était PAS dans `CHAMPS_PAIE` : il restait sur la fiche
  employé, que TOUS les appareils connectés téléchargent. `securite-18` n'en
  protégeait que l'ÉCRITURE ; la LECTURE était ouverte. L'écran le masquait
  (`compteMasque`) — **mais masquer n'est pas protéger** : le numéro entier
  descendait quand même sur le téléphone de chacun.
  - ⚠⚠ **ET IL Y AVAIT UNE SECONDE PORTE, pire** : `mentionVirement`
    recopiait le numéro **EN ENTIER** sur la dépense — et la table des
    dépenses descend elle aussi sur tous les appareils (son filtre par
    personne est côté application, jamais côté serveur). **Fermer la fiche
    sans fermer ça n'aurait servi à rien.** Elle ne garde plus que les quatre
    derniers chiffres (`compteMasque`), ce que l'écran affichait déjà — et
    **rien ne lisait le numéro entier sur une dépense** : ni écran, ni export,
    ni document (le banc le mesure, il ne le présume pas).
  - ⚠ **LE NOM de la banque RESTE sur la fiche employé, volontairement** : ce
    n'est pas un secret, et Timo a demandé le 14/09/2026 qu'un virement écrive
    VERS QUELLE BANQUE l'argent part. Or **un gérant et un chef d'équipe
    paient aussi** (prime d'installation, commission d'équipe) : le leur
    retirer ferait tomber sa règle pour eux. Le numéro, lui, ne leur a jamais
    servi.
  - ⚠⚠ **UN CHANGEMENT DE CODE SEUL N'AURAIT RIEN DÉPLACÉ** : `sauvegarderDiff`
    passe `prev` ET `next` par `separerPaie` avant de comparer — les deux sont
    donc allégés à l'identique, la comparaison ne voit AUCUNE différence, et
    rien ne part au serveur. Les numéros déjà écrits seraient restés en place.
    D'où **`supabase/paie-2-compte-bancaire.sql`** : il déménage les numéros
    existants vers la table `paie` et raccourcit ceux des dépenses.
    ⚠ **L'horodatage y reste ACTIF**, à l'inverse de l'habitude : une ligne
    nettoyée doit REDESCENDRE sur les téléphones, sinon leur copie locale
    garderait le numéro. Quelques dizaines de lignes : négligeable.
  - **Aucune nouvelle table, aucune nouvelle règle** : `paie` et ses politiques
    existent depuis le 19/08/2026. **`npm run tester-paie`** (46 contrôles)
    rejoue le script sur base jetable et prouve la fuite AVANT, sa fermeture
    APRÈS, et qu'un vendeur ne voit plus le numéro de son collègue — mais
    toujours le sien.
    **`paie-2-compte-bancaire.sql` collé par Timo le 19/09/2026
    (`true | true | true`)** : plus aucun numéro sur une fiche employé, plus
    aucun numéro entier sur une dépense, la fiche de paie toujours protégée.
    **Le trou est fermé pour de bon, sur les données existantes comprises.**

#### 👥 LE DOSSIER D'ACCÈS D'UN EMPLOYÉ (19/09/2026, « lance le dossier d'accès pour les employés »)
- **Deuxième bloc de ⚙ Paramètres → 🔒 Données personnelles**, sous celui des
  clients : on cherche l'employé, on lit ses rubriques renseignées, on remet
  **« 🖨 Dossier personnel (PDF) »** ou **« Exporter (CSV) »**. Administrateur
  PRINCIPAL seul, revérifié DANS le geste. Règle pure `lib/dossierEmploye.js`.
- ⚠ **UN SEUL DESSINATEUR, DEUX DOCUMENTS** : `dossierEmploye` rend la MÊME
  forme que `dossierPersonnel` (`{ identite, sections, mentions }`), donc
  `genererDossierPersonnel` (PDF) et `lignesCsvDossier` (CSV) sont réutilisés
  **sans une ligne de plus**. Seules les données changent.
- **Onze rubriques** : rémunération, primes, avances, virements, crédits,
  déclaratif CNSS, banque, évaluations reçues, ce qu'il a enregistré,
  matériel de travail détenu, messages.
- ⚠⚠ **AUCUN SECRET N'Y ENTRE** — la MÊME liste que pour un client
  (`CHAMPS_INTERDITS`, importée, pas recopiée) : mot de passe, grain de sel, et
  **les CLÉS D'EMPREINTE**. Un document qui traîne sur un bureau ne doit jamais
  être une clé.
- ⚠ **LE NUMÉRO DE COMPTE N'Y FIGURE QUE MASQUÉ**, même vers son propriétaire
  (« …9012 ») — et **le document DIT qu'il est masqué**, sinon on laisserait
  croire qu'on ne détient que quatre chiffres. Suite directe du 19/09 : le
  numéro vit désormais dans la fiche de paie, il n'a pas à ressortir en entier
  sur un papier.
- **L'ANNÉE DE NAISSANCE n'est jamais demandée** : le document le DIT
  (« jour et mois seulement ») au lieu de laisser croire à un oubli.
- ⚠ **UNE ÉVALUATION DONNE LA NOTE, JAMAIS QUI L'A DONNÉE** : ce serait la
  donnée d'un CLIENT, pas la sienne. Et une évaluation sans aucun critère
  rempli vaut **« non notée »**, jamais zéro (`noteLisible`).
- ⚠⚠ **PAS DE BOUTON « EFFACER » DE CE CÔTÉ, ET CE N'EST PAS UN OUBLI** : la
  rémunération, les déclarations sociales et les pièces comptables se
  conservent par obligation légale. **`MENTIONS_DOSSIER_EMPLOYE` le DIT** —
  ce ne sont PAS les mentions des clients, laisser croire à un employé qu'il
  peut faire effacer sa paie serait malhonnête. L'écran l'explique aussi.
- **Une fiche de paie NON REÇUE ne fabrique pas de faux zéros** : « non
  renseigné », jamais 0 F. Un compte CLIENT est refusé ici et renvoyé vers son
  propre bloc.
- ⚠ **LE MUR** : les employés viennent de `comptesEff`
  (`utilisateursDeLEspace`), son activité est filtrée par l'espace regardé —
  jamais `db.users` ni `db.ventes` en entier.
- **LA TRACE NOMME l'employé** (`journalDossierEmploye`) : on n'efface rien
  ici, il faut pouvoir dire à qui on a remis.
- **Rien à coller dans Supabase** : on ne fait que lire. Le banc mesure la
  règle ET **le PDF fabriqué** ; éprouvé en remettant la faute (numéro entier
  + clé d'empreinte) : trois contrôles tombent.
- ⚠ **LE LIBRE-SERVICE DES EMPLOYÉS : « laisse comme c'est » (19/09/2026).**
  Proposé — un écran où l'employé téléchargerait son dossier LUI-MÊME, comme
  le client depuis son espace — et **refusé**. Un employé passe donc par la
  direction (⚙ Paramètres → 🔒 Données personnelles), et c'est très bien : sa
  fiche de paie est une donnée sensible, qu'elle sorte sous le contrôle de
  l'administrateur vaut mieux qu'un bouton cliquable sur un téléphone posé au
  comptoir. **La loi demande qu'il PUISSE l'obtenir, pas que ce soit en un
  clic** — BMI est en règle. C'est d'ailleurs ce que le mot d'information dit
  à l'employé : « Demandez-le à la direction ». **Ne pas le reproposer.**

#### 👋 LE MOT D'INFORMATION DE LA PREMIÈRE OUVERTURE (19/09/2026)
- Timo : « Le mot d'information à l'embauche pour personnel et même chose pour
  les clients pour la 1ère fois qu'il accède à l'app… **mais faire en sorte que
  le message ne mette pas mal à l'aise le client ni le personnel** ». Cette
  dernière phrase n'est pas une préférence de style, **c'est la demande** —
  donc elle SE MESURE (`npm run verifier-mot-information`). Règles pures
  `lib/motInformation.js` (sans import), fenêtre `components/MotInformation.jsx`
  écrite **UNE fois pour les deux** : seuls les MOTS changent.
- ⚠ **CE N'EST PAS UNE CASE À COCHER, ET C'EST TOUT LE POINT.** Un « J'accepte »
  demanderait un consentement qu'on n'a pas besoin de demander (on tient les
  livres d'un commerce, pas un fichier publicitaire) et ferait de l'accueil un
  contrat qu'on fait signer à la sauvette. **UN seul bouton, large :
  « J'ai compris »** — jamais « J'accepte », jamais une croix, jamais
  « Refuser ». On n'attend RIEN de la personne.
- **Le ton se mesure, pas se promet** : `MOTS_A_EVITER` (jargon —
  « responsable de traitement », « finalité », « sous-traitant » —, et les mots
  qui inquiètent — « surveill… », « obligatoire », « vous devez », « nous
  collectons ») ; `motRassurant` refuse un texte qui en porte un. Le mot
  **commence par CE QU'ON NE FAIT PAS** (on ne vend rien, on ne donne rien),
  parce que c'est ça qui rassure, jamais la liste de ce qu'on garde. Un 👋, pas
  un 🔒. Moins de 200 mots. Mesuré dans Chromium : **aucun rouge, aucun ⚠**,
  un bandeau d'alerte donnerait le ton avant qu'on ait lu un mot.
- ⚠ **Mais on ne rassure pas à tort** (règle du § 1) : les DEUX disent que la
  loi peut obliger à transmettre — « sauf si la loi nous y oblige » côté
  client, « sauf ce que la loi impose de déclarer, comme la CNSS » côté
  employé. Et l'employé n'apprend PAS que ses collègues ne voient rien du
  tout : **sa rémunération et ses déclarations sociales** seules sont
  réservées à la direction et au comptable (c'est ce que fait la table `paie`,
  rien de plus).
- **Il se montre UNE fois, et la marque est DOUBLE** : d'abord dans le
  navigateur (`CLE_VU_ICI` = `bmi_mot_donnees_vu:<id>`), **puis** sur la fiche
  (`info_donnees_le`, champ personnel comme `ordre_onglets` — **rien à
  coller**). ⚠ L'un sans l'autre échoue : la fiche seule le ferait revenir à
  chaque ouverture pour un compte en **LECTURE SEULE** (le comptable, dont le
  `save` ne persiste rien) ; le navigateur seul le reposerait sur chaque
  appareil. **Sans ligne de journal** : lire un mot n'est pas un geste de
  gestion.
- ⚠ **Il ne passe JAMAIS par-dessus le verrou** (`!verrouille`) : quelqu'un qui
  doit taper son mot de passe n'a pas à lire un mot d'accueil d'abord. Et il
  lit la fiche VIVANTE (`db.users`), pas l'étiquette de connexion — celle-ci
  n'est réécrite qu'à la connexion.
- ⚠ **Le banc DÉFILE vraiment** (piège de flexbox) : une carte plus haute que
  son cadre, centrée ou collée en bas, laisse son HAUT hors d'atteinte —
  `my-auto` est ce qui l'évite. Éprouvé en le retirant : le haut tombe à
  −53 px et le contrôle tombe. Mesurer une HAUTEUR n'aurait rien prouvé.
- **Rien à coller dans Supabase.**

#### ⏳ LA DURÉE DE CONSERVATION — 6 ANS (19/09/2026, le dernier point)
- Timo : **« 6 ans après le dernier achat. On peut à tout moment changer cette
  durée. »** Jusque-là l'application se TAISAIT exprès (un chiffre inventé
  aurait été pire que le silence) ; le document disait seulement « pour la
  durée de la relation commerciale ». Désormais la durée S'ÉCRIT — et une
  durée annoncée vaut mieux qu'un silence, c'est ce que la loi attend. Règle
  pure `lib/conservation.js` (sans import).
- ⚠⚠ **RIEN NE S'EFFACE TOUT SEUL** — sa décision, entre trois propositions :
  **l'application PROPOSE, l'administrateur CONFIRME.** Un effacement ne se
  défait pas ; un balayage automatique serait le premier geste de
  l'application à détruire des données sans que personne ne regarde, et les
  avertissements existants (un client sans numéro se rapproche sur le NOM
  seul : un homonyme partirait avec lui) n'auraient plus personne à avertir.
  `lib/conservation.js` ne contient donc **AUCUNE fonction qui efface** :
  elle DIT qui dépasse. La liste ouvre un client à la fois, par le MÊME
  chemin que l'effacement ordinaire — **aucun bouton « tout effacer »**. Le
  banc le mesure, et le contrôle a été éprouvé en remettant la faute : il
  tombe.
- ⚠ **L'ARTICLE 18 DU CONTRAT N'A PAS BOUGÉ** (sa décision le même jour) : il
  garde « conservées pour la durée nécessaire à cette finalité ». Ce n'est pas
  faux, et un contrat SIGNÉ ne se met pas à jour — il garderait le chiffre du
  jour de la signature alors que la durée est réglable. **Ne pas l'y écrire
  sans qu'il le redemande.**
- **Le réglage** : ⚙ Paramètres → 🔒 Données personnelles, administrateur
  PRINCIPAL seul, champ `duree_conservation_ans` sur les boutiques comme le
  mot de fidélité — **rien à coller**. ⚠ Il n'est **PAS cloisonné**, et c'est
  voulu : ce n'est pas une donnée mais une POLITIQUE, et la lecture prend « la
  première boutique qui le porte » — si le réel disait 6 et la formation 4, le
  papier d'un client afficherait l'un ou l'autre selon l'ordre du chargement.
- **UNE phrase, trois endroits** (`phraseConservation`) : le dossier imprimé,
  l'espace du client, ⚙ Paramètres. ⚠ `MENTIONS_DOSSIER` est devenue la
  FONCTION `mentionsDossier(duree)` — une constante aurait figé le chiffre ;
  l'espace client affiche `maVue.mentions`, c'est-à-dire LITTÉRALEMENT le
  texte du document qu'il télécharge. ⚠ Elle **ne promet pas une disparition
  totale** : les factures restent (la loi commerciale l'oblige), le nom en est
  retiré.
- **Le mot d'accueil du client la dit aussi** (jeton `{duree}`, rempli par
  `motPour(role, duree)`). ⚠⚠ **L'EMPLOYÉ N'EN A PAS, et ce n'est pas un
  oubli** : sa rémunération et ses déclarations sociales se conservent par
  OBLIGATION LÉGALE, pas par ce réglage — lui annoncer la durée des clients
  serait faux.
- **« Dernier achat »** vient de `clientsEffacables` (déjà écrit) : la plus
  récente de ses ventes, dettes et chantiers — et, pour un compte créé JAMAIS
  utilisé, **la date de création**. Sans ce repli il ne serait jamais
  concerné. Un client sans aucune date n'est jamais emporté.
- ⚠ **LE MUR** : `clientsDepasses` reçoit la LISTE déjà filtrée, jamais `db` —
  une fonction pure qui reçoit une table entière et la PARCOURT est un passage
  de mur en puissance (leçon payée deux fois le 18/09).
- **Personne n'est concerné avant 2032** : l'application a commencé en 2026.
  L'écran le DIT quand la liste est vide, au lieu de laisser croire à un
  balayage.
- **Rien à coller dans Supabase.**

- **La protection des données est COMPLÈTE** : effacement, dossier d'accès
  (client et employé), libre-service du client, fuite du numéro de compte
  fermée, mot d'information, durée de conservation. Ne restent que les deux
  démarches HORS application, déjà dites à Timo et affichées dans l'écran :
  la déclaration à l'**IPDCP**, et l'**hébergement hors du Togo**.

### 👥 DEUX COMPTES DU MÊME NOM — L'HISTOIRE DES DEUX ESSO (20/09/2026)
- Timo, capture de l'écran de connexion (« Ce compte n'existe plus, ou le mot
  de passe a changé ») : **« je suis souvent confronté à ce problème… il y a
  un client qui s'appelle ESSO mais ce n'est pas le même mot de passe »**. Son
  technicien ESSO ne pouvait plus entrer. Ce n'était pas son mot de passe.
- ⚠⚠ **LA CAUSE : la connexion prenait LE PREMIER compte de ce nom et ne
  testait QUE son mot de passe.** L'autre ESSO ne pouvait donc **jamais**
  entrer, quel que soit son mot de passe. Et la requête du serveur n'imposant
  **aucun ordre**, ce n'était même pas toujours le même des deux qui gagnait :
  d'où le « souvent », qui ressemblait à un défaut capricieux.
- **LE TROU QUI L'A PERMIS, et il était net** : un **CLIENT** vérifiait que
  son nom était libre (`identifiantClient`, sept endroits, et fabrique
  « ESSO99 » si besoin) ; un **EMPLOYÉ** ne vérifiait **RIEN DU TOUT**. On
  créait ESSO par-dessus ESSO sans un mot.
- **LE REMÈDE, deux gestes** (« lance 1 et 2 ») :
  - **C'est le MOT DE PASSE qui départage**, des DEUX côtés : `candidats` =
    tous les comptes de cet identifiant, puis celui dont le mot de passe est
    le bon (`api/chercher-compte.js` et `screens/Connexion.jsx`). ⚠ Le nombre
    d'essais est **borné** (`MAX_HOMONYMES` = 5) : vérifier un mot de passe
    coûte 150 000 tours, une boucle sans limite serait une porte pour épuiser
    le serveur. ⚠ La réponse du serveur reste **identique que le compte
    existe ou non** — cette fonction ne doit jamais devenir un annuaire.
  - **Un identifiant d'employé ne se prend plus deux fois**
    (`critiqueIdentifiantEmploye`, revérifié DANS le geste) : le refus **NOMME
    qui le détient** et **propose un nom libre** (`propositionIdentifiant` —
    le PRÉNOM d'abord, « ESSO KOSSI », sinon les chiffres du numéro).
- ⚠⚠ **LE MUR NE PROTÈGE PAS DE ÇA, ET C'EST VOULU DES DEUX FAÇONS** : un ESSO
  de FORMATION et un ESSO réel se gêneraient pour de vrai, puisque la connexion
  cherche dans toute la maison. Donc (a) le garde-fou regarde les DEUX espaces,
  (b) la connexion, elle, ne cloisonne pas — sinon elle ne retrouverait pas le
  bon des deux. Le banc mesure les deux points.
- ⚠ **UNE RECOPIE RETIRÉE AU PASSAGE** : `String(nom).trim().toLowerCase()`
  vivait en double, dans l'écran ET dans la fonction serveur, avec un
  commentaire disant « EXACTEMENT comme l'écran de connexion » — c'est-à-dire
  l'aveu qu'une divergence était possible. `cleIdentifiant` / `memeIdentifiant`
  vivent maintenant dans **`lib/identiteClient.js`**, qui est déjà chargé des
  deux côtés (et **ne doit toujours rien importer**).
- ⚠ **Un contrôle a été RETOURNÉ, pas supprimé** : « efface la copie périmée
  gardée sur l'appareil » décrivait `if (u) await oublierCompteLocal(u.id)` —
  avec deux homonymes, ç'aurait jeté la fiche de quelqu'un d'autre. On n'oublie
  plus que la copie qui aurait **vraiment** laissé entrer.
- **🧑 LE PRÉNOM À LA CRÉATION D'UN EMPLOYÉ** (demandé le même jour) : une
  ligne « Prénom » dans 👥 Utilisateurs, employés seulement. ⚠ **Ce n'est PAS
  un champ de plus** : il remplit **`nom_complet`**, qui existe déjà et qui
  commande DÉJÀ le bulletin de paie, la déclaration CNSS (`separerNomPrenoms` :
  premier mot = nom, le reste = prénoms) et le dossier personnel. Un second
  champ serait une deuxième source pour la même chose, et les deux finiraient
  par se contredire. 🆔 Identité continue de le corriger, et la liste
  l'affichait déjà sous le nom. ⚠ **Il ne change PAS l'identifiant de
  connexion** : on tape toujours son nom — c'est le garde-fou ci-dessus qui
  règle les doublons, pas le prénom.
- **Rien à coller dans Supabase** : `nom_complet` est déjà dans la liste
  « gestion » que l'administrateur écrit tous les jours.
- ⚠ **Ce que ça ne fait PAS** : les doublons DÉJÀ créés restent en place. Ils
  fonctionnent (le mot de passe départage), mais deux ESSO dans une liste
  restent une confusion pour l'équipe. **Renommer l'un des deux touche ses
  vraies données : c'est sa décision, à sa demande explicite.**

### 📲 WHATSAPP DEPUIS LE NUMÉRO BMI — L'ENVOI (étape 1, 19/09/2026)
- Timo, après avoir raccordé le numéro **+228 99 96 84 88** chez YCloud
  (coexistence, le téléphone garde tout) et fait approuver les modèles :
  **« lance l'étape 1 »**. L'étape 1 est l'**ENVOI** — le message part du
  numéro BMI sans que personne n'ouvre WhatsApp, et la trace reste sur le
  devis. La RÉCEPTION (les réponses dans 💬 Messages, la fenêtre de 24 h) est
  l'étape 2 : **elle n'est pas construite, et ne démarre pas sans sa demande.**
- **Hors de la fenêtre de 24 h ouverte par le client, Meta n'accepte QUE des
  MODÈLES approuvés.** Nos relances partent quand NOUS le décidons : elles
  passent donc toutes par un modèle. `lib/whatsappModeles.js` (sans import)
  les liste, avec **l'ORDRE EXACT de leurs trous** — intervertir deux lignes
  enverrait le montant à la place du nom, et Meta ne s'en plaindrait pas.
  ⚠ **LE COUPLE** : `api/whatsapp.js` **IMPORTE** ce fichier ; deux listes
  finiraient par diverger en silence. Le banc mesure les deux côtés.
- **CE QUE TROIS REFUS DE META ONT APPRIS**, et qu'on ne réapprendra pas :
  **(1) un DEVIS est une OFFRE → catégorie *marketing***, jamais *utility*
  (`INCORRECT_CATEGORY`) ; un contrat SIGNÉ, lui, est de l'utility.
  **(2) UN MOT DE PASSE NE VOYAGE JAMAIS DANS UN MODÈLE** : Meta range tout
  identifiant de connexion dans sa catégorie *authentication* (format rigide,
  un code et rien d'autre) et refuse, **quelle que soit la case cochée**. Le
  soupçon du départ était bon ; c'est la façon dont Meta le DIT qui trompait.
  **(3) le nom ET la catégorie se figent à la création** — *Edit* ne rouvre
  que le contenu. Se tromper oblige à un NOUVEAU modèle sous un NOUVEAU nom,
  et **on ne supprime pas le refusé** (Meta réserve son nom ~1 mois ; un
  modèle refusé n'envoie rien et ne coûte rien). Seule exception : un modèle
  mal NOMMÉ (YCloud pré-remplit le champ) se supprime et se recrée.
- **Les quatre modèles** : `devis_disponible` (marketing, 3 trous),
  `relance_devis` (marketing, 4), `devis_valide_paiement` (utility, 4),
  `rappel_echeance` (utility, 5). ⚠ **`rappel_echeance` est approuvé mais PAS
  en service** (`MODELES_EN_SERVICE`) : une dette ordinaire n'a pas de date
  d'échéance (le retard se compte à 30 jours, lib/rappels.js). Il servira le
  jour où on relancera sur un PLAN DE RÈGLEMENT, qui a de vraies échéances.
  Le banc vérifie qu'aucun écran ne l'emploie d'ici là.
- **UN SEUL CHEMIN : `src/whatsapp.js`** (`envoyerModele`), comme `src/push.js`
  pour les notifications — aucun écran n'appelle le serveur lui-même, le banc
  l'interdit. ⚠ Il charge `supabaseClient` **au moment de l'envoi** (import
  dynamique) : en statique, il entraînait `import.meta.env` dans la suite de
  Partages.jsx et **le banc ne pouvait plus monter l'écran** — or un écran que
  le banc ne peut pas monter est un écran blanc en puissance (19/09/2026).
- **RIEN N'EST JAMAIS PERDU EN SILENCE** : tout refus, toute panne, tout
  numéro illisible RAMÈNE l'ouverture WhatsApp d'aujourd'hui, avec son texte
  complet (`texteRepli`, celui de `texteRelanceDevis` mot pour mot). ⚠ **Pas
  de file d'attente, et c'est VOULU** — contrairement aux notifications : une
  notification en retard reste juste, une relance partie trois jours plus
  tard, alors que le client est déjà passé payer, est une faute.
- ⚠⚠ **LE MUR, DEUX BARRIÈRES QUI NE PROTÈGENT PAS LA MÊME CHOSE.** L'écran
  passe **l'espace du DEVIS** (`espaceDuDevis`, calculs.js — la marque de la
  fiche, sinon l'espace REGARDÉ), jamais celui de la personne qui clique :
  l'administrateur principal est un compte RÉEL même quand il regarde la
  formation (leçon de `retenueOutilPourPrime`, 18/09). Le serveur, lui,
  revérifie ce qu'EST le compte appelant (`estCompteFormation`) et refuse un
  compte client ou bloqué. **La barrière qui compte pour le principal est
  celle de l'écran** — on le dit plutôt que de laisser croire que le serveur
  suffit.
- ⚠ **LE PREMIER MESSAGE D'UN CLIENT PART TOUJOURS À LA MAIN**
  (`clientDejaContacte`) : il porte ses IDENTIFIANTS, qu'un modèle ne peut pas
  porter. « Il les a déjà » se lit sur deux traces, une suffit — il porte un
  AUTRE devis, ou il a déjà ouvert l'application (`info_donnees_le`). Sans
  cette règle, un nouveau client recevrait un lien vers un espace où il ne
  saurait pas entrer.
- **LA TRACE NE DIT QUE CE QU'ELLE SAIT** (`traceEnvoi`, `libelleTrace`,
  champ `envoi_whatsapp` sur le devis) : qui, quand, quel modèle — **jamais
  « livré » ni « lu »**. Le savoir demande que Meta nous rappelle (une adresse
  de retour qui n'existe pas encore) ; l'écrire serait rassurer à tort. Et
  elle ne s'écrit **que si le message est parti du numéro BMI** : une
  ouverture WhatsApp ne prouve rien (personne ne sait si le vendeur a appuyé).
  La pastille de 📋 Tous les devis passe au vert et dit « du n° BMI ».
- ⚠⚠ **UN REPLI MUET RESSEMBLE À UNE PANNE** (Timo, 19/09/2026, dès le
  premier essai : « quand je clique sur relancer, ça ouvre le WhatsApp sur
  l'ordinateur »). Le repli FAISAIT son travail — mais le motif était calculé
  **puis JETÉ** : impossible de savoir si c'était voulu ou si quelque chose
  n'allait pas. Depuis, `motifAttendu` sépare les deux : **formation et
  premier contact ne dérangent personne** (c'est la règle qui joue) ; **tout
  le reste SE DIT** (`messageRepli` : serveur pas configuré, modèle pas encore
  approuvé, réseau, numéro illisible), avec ce qui s'est passé à la place.
  ⚠ **Et l'écran ne décrit jamais autre chose que ce qui vient de se passer** :
  « WhatsApp s'ouvre avec ses identifiants » était écrit en dur à DEUX endroits
  (le volet et Mes brouillons) plus dans une ligne d'aide — faux dès que le
  message part du numéro BMI. UNE phrase, `messageDevisEnvoye(nom, auto)`, et
  `envoyerDevisEtOuvrirWhatsApp` rend `{ ok, auto }` au lieu de `true`.
- **RIEN À COLLER DANS SUPABASE.** Deux variables Vercel, côté serveur
  seulement : **`YCLOUD_API_KEY`** et **`WHATSAPP_NUMERO_BMI`**. ⚠ **Jamais
  préfixées `VITE_`** (Vite les embarquerait dans le paquet du navigateur) —
  le banc le mesure. Sans elles, l'application se replie sur l'ouverture
  WhatsApp d'aujourd'hui et ne casse rien.
- ⚠⚠ **LE REFUS DE WHATSAPP SE DIT EN FRANÇAIS** (20/09/2026, « lance la
  traduction des motifs en français »). Meta refuse EN ANGLAIS et tel quel
  (« The template is unavailable, status: PENDING ») : une vendeuse de Lomé
  n'a aucune raison de le comprendre, et **un message qu'on ne comprend pas
  ressemble à une panne** — la leçon du repli muet, d'un cran plus loin.
  `MOTIFS_WHATSAPP` / `traduireMotifWhatsApp` (lib/whatsappModeles.js).
  - **DEUX façons de reconnaître un refus, et la première vaut mieux** : le
    **CODE** de Meta (132001, 131050…), un FAIT qui ne bouge pas quand Meta
    réécrit ses phrases ; puis les **MOTS**, repli pour YCloud (qui a ses
    propres messages) et pour les refus sans code. Le code PRIME. ⚠ Une
    règle à mots exige **TOUS** ses mots : « template » seul attraperait
    n'importe quoi et on traduirait de travers.
  - ⚠⚠ **CE QU'ON NE CONNAÎT PAS RESTE EN ANGLAIS, EN ENTIER**, précédé de
    « WhatsApp a refusé le message : ». Deviner la traduction d'un motif
    inconnu, ce serait **inventer une explication**. ⚠ Et le préfixe ne ment
    pas : il n'est posé que sur un **502** (WhatsApp a répondu et a refusé) —
    une panne de réseau vient de chez nous, elle ne s'annonce pas comme un
    refus de WhatsApp.
  - **La phrase anglaise part TOUJOURS dans la console**, jamais à l'écran
    (le diagnostic affiché a déjà été retiré une fois : Timo, 16/09/2026).
  - ⚠ **LE CODE TRAVERSE TROIS FICHIERS** : `api/whatsapp.js` le rend
    (`code_whatsapp`), `appelAvecJeton` ne le jette plus (`{ ...resultat }`
    — `error` et `statut` restent les seuls champs sur lesquels on compte),
    `src/whatsapp.js` le passe à la règle. Jeté en route, la traduction
    retomberait sur les mots **sans que personne le voie** : le banc mesure
    les trois maillons, et le contrôle a été éprouvé en remettant la faute.
  - ⚠ **La liste ne s'allonge qu'avec un motif VU pour de vrai** (capture,
    journal) : une règle écrite « au cas où » est une règle jamais éprouvée.
  - ⚠ **Deux fautes de rédaction ont été trouvées PAR LE BANC** le jour même :
    « n'a pas délivré » portait le mot « livré » (on ne dit jamais livré ni
    lu — on ne le sait pas), et une phrase nommait la variable Vercel
    `YCLOUD_API_KEY` à l'écran (jargon, et le contrôle « la clé n'existe que
    dans la fonction serveur » est tombé). **Les deux contrôles existaient
    déjà** : ils n'ont pas été assouplis, les phrases ont été réécrites.
- **CE QUE ÇA COÛTE, et il faut le dire** : environ **14 F** un message
  marketing (devis, relance), **4 F** un utility. C'était gratuit avant (le
  forfait du vendeur). Quelques centaines de francs par mois au volume de BMI.
  ⚠ **LE CHANGEMENT DE TARIF DU 1er OCTOBRE 2026 NE TOUCHE PAS L'ÉTAPE 1**
  (vérifié le 20/09/2026 sur la documentation Meta et trois sources
  indépendantes, le blog YCloud étant inaccessible depuis ici) : les modèles
  *marketing* et *utility* gardent leur tarif, ils étaient déjà payants. Ce
  qui devient payant, c'est la **réponse libre dans la fenêtre de 24 h**
  (message dit « de service »), au tarif d'un *utility*, avec **1 000 par
  numéro et par mois offerts**. L'application n'envoie que des MODÈLES :
  **rien ne change pour elle.** ⚠ **Mais ça chiffre l'ÉTAPE 2** (la
  réception) : répondre à un client dans 💬 Messages ne sera plus gratuit —
  à dire à Timo le jour où il la demandera. Au volume de BMI les 1 000
  offerts couvrent large. ⚠ Et **un moyen de paiement doit être en place
  avant le 30/09/2026**, sinon Meta cesse de délivrer les messages de service
  — chez nous c'est le crédit YCloud, à recharger dans sa console.

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
- **📊 RÉSUMÉ des caisses, dans 🔒 Caisse — PAS dans le tableau de bord**
  (13/09/2026 : « ajouter un carré présentant le total versé… dans Caisse à
  côté des boutiques, un bouton RÉSUMÉ dans lequel on reprend les carrés »,
  puis « Dans caisse (résumé)… pas dans tableau de bord ») : un carré
  **« Total versé »** à côté de « Fonds à verser » (rejetés exclus, « ce
  mois » et « en attente » dessous — `totalVerse`), et le bouton **📊 RÉSUMÉ**
  dans la rangée des boutiques (`extra` de `BoutiqueTabs`) : une ligne par
  boutique de l'espace regardé (vente + TERRAIN) avec **les quatre carrés**
  Fonds à verser / Total versé / Entrées / Sorties, le retard de clôture en
  rouge, la ligne TOTAL en bas (`resumeCaisses`, lib/versements.js, exercé
  par le banc). Une lecture, rien d'écrit ; depuis le début, comme le solde.
  **En mode RÉSUMÉ, rien d'autre ne s'affiche** (13/09/2026 : « je vois encore
  verser les fonds, avances de frais, clôture… ça devrait disparaître ») : tout
  le reste de l'écran est sous `!resume`.
  **Un clic sur une boutique REFERME le résumé** (13/09/2026, « constat
  amer » : « dès qu'on quitte le résumé pour revenir sur les boutiques,
  l'écran ne se recouvre pas… on voit toujours les données du résumé »).
  **En mode RÉSUMÉ, aucune pastille de boutique n'est allumée** (capture
  Timo, 13/09/2026 : « même sur résumé, la boutique est toujours
  sélectionnée ») : `value={resume ? "" : bq}`, la boutique mémorisée reste
  en place pour le retour.
  **Une période, sur la même ligne, À DROITE de RÉSUMÉ** (13/09/2026 :
  « ajouter période dans résumé devant résumé, appliquée aussi aux
  boutiques » ; d'abord posée à gauche, Timo : « ramener période devant
  résumé » → option 1, à droite — pour lui, « devant » = après) : la
  liste du tableau de bord (`periodes()`), **« Depuis le début » d'office**
  (rien ne change tant qu'on n'y touche pas) ; elle commande les quatre
  carrés de la boutique regardée, le tableau du résumé ET l'historique des
  versements. Avec une période : entrées, sorties, versé = ceux DE la
  période ; **« Fonds à verser » = LE TIROIR À LA FIN de la période** (la
  recette — depuis le 15/09/2026 le fonds de caisse n'y est plus, il est dans
  l'enveloppe), comme le relevé des caisses centrales, et le libellé le dit.
  ⚠ **Le montant ATTENDU par le formulaire de versement reste TOUJOURS le
  tiroir depuis le début** (`aVerser` sans période ; un solde ne dépend pas
  d'une période),
  le banc le vérifie. `fondsAVerser` / `totalVerse` / `resumeCaisses`
  acceptent `periode = { du, au }` facultative.
  **Le sélecteur porte la mention « Période : »** et la même liste déroulante
  que le tableau de bord (capture Timo, 13/09/2026 : « avec mention période
  comme c'est fait dans le tableau de bord »).
- **📁 L'ARCHIVAGE des historiques : UNE règle, `lib/archivage.js`**
  (13/09/2026 : « au plus 10 lignes, au-delà on doit défiler ; après 3 mois,
  au-delà de 20 lignes, les anciennes sont archivées automatiquement, pour
  les voir il faut remonter dans les archives… avec le temps on va
  implémenter cette règle pour d'autres écrans, mais que ça soit LA SEULE
  règle qui gère ça »). `LIGNES_VISIBLES` = 10, `MOIS_AVANT_ARCHIVE` = 3,
  `MINIMUM_RECENTES` = 20 : une ligne est archivée quand elle est ancienne
  ET au-delà des 20 plus récentes (`separerArchives`) ; archives rangées par
  mois (`parMois`). **Rien n'est effacé ni déplacé : « archivé » est une façon
  d'afficher.** UN composant, `components/HistoriqueArchive.jsx` (cadre de 10
  lignes qui défile, bouton « 📁 … (N) ▾ Remonter dans les archives »), le
  SEUL à appeler la règle — le banc l'impose (liste des importeurs) et MESURE
  le cadre dans Chromium (`verifier-ecran-ventes`). Premier usage : **l'historique
  des versements** sous le tableau du RÉSUMÉ de 🔒 Caisse (toutes les
  boutiques du résumé, statut validé / en attente / rejeté). Un autre écran
  qui veut s'archiver PASSE PAR CE COMPOSANT, jamais un `slice` à lui.
  **Deuxième usage : la liste de 📤 Dépenses** (13/09/2026, « appliquer la
  règle d'archivage aussi à l'historique des dépenses ») : `TableauDepenses`
  (écrit une fois, boutique et « Chez le comptable ») passe par le composant,
  plus de pagination ; l'en-tête reste collé en haut du cadre.
- **💼 LE FONDS DE CAISSE EST DANS UNE ENVELOPPE, PAS DANS LE TIROIR**
  (15/09/2026 — **la règle en vigueur** ; elle RETOURNE celles du 13 et du
  14/09, rappelées à la fin du point parce qu'elles expliquent le chemin).
  Timo, dans l'ordre : « pourquoi tu veux toujours impliquer le fonds de
  caisse dans les totaux ?… fais appel au fonds de caisse QUE s'il n'y a pas
  de vente et qu'il faut une dépense » ; puis, à la question « ces 50 000, ils
  sont où physiquement ? », **réponse B : à part** — une enveloppe, pas le
  tiroir. Tout ce qui suit découle de là.
  - **DEUX POCHES, jamais additionnées.** Règle pure `deuxPoches`
    (lib/versements.js) : une marche dans l'ordre du temps sur les mouvements
    d'espèces d'une boutique. **LE TIROIR** = ventes et règlements en espèces,
    moins ce qu'ils ont payé, moins les versements. **L'ENVELOPPE** = ce que
    le DG y a mis, moins ce qu'on y a pris. Dans cet ordre : (1) une ENTRÉE
    rembourse d'abord l'enveloppe si elle est entamée, le reste va au tiroir
    (« fonds de caisse entamé, les ventes viennent rembourser ») ; (2) une
    DÉPENSE se paie sur le tiroir, l'enveloppe ne complète que ce qu'il ne
    couvre pas — et jamais au-delà de ce qu'elle contient (au-delà, c'est le
    tiroir qui se creuse) ; (3) un VERSEMENT ne sort QUE du tiroir ; (4) une
    REMISE du DG va dans l'enveloppe, jamais dans le tiroir.
  - **Le « montant attendu dans le tiroir » = la recette seule.**
    `fondsAVerser` rend `montant` (le tiroir) et `aVerser` (la même chose : il
    n'y a plus rien à retrancher), plus `fondsPlafond`, `resteFonds`,
    `fondsEntame`, `depensesSurFonds`. Le carré « Fonds à verser » dit « le
    fonds de caisse est gardé à part : il n'est pas là-dedans » ; les Entrées
    n'additionnent plus le fonds remis.
  - **L'enveloppe est INFORMÉE à la clôture, jamais demandée** (15/09/2026 —
    un comptage obligatoire a été posé puis RETIRÉ le jour même : « enlève
    cette restriction de compter l'enveloppe… tant qu'elle a été entamée,
    l'information suffit déjà. Elle est compensée automatiquement quand il y a
    vente, et à la clôture le système informe combien a été restitué dans
    l'enveloppe. C'est déjà suffisant. »). La clôture dit l'état (intacte, ou
    entamée de X avec ce qu'il doit rester) **et le mouvement du jour** (ce
    qui y a été pris, ce que les recettes ont restitué). Aucun champ, aucun
    écart d'enveloppe, aucun blocage. ⚠ Conséquence assumée par Timo :
    **l'enveloppe n'est jamais comptée physiquement.**
  - **Le réglage de ⚙ Paramètres COMMANDE le fonds, à la hausse comme à la
    baisse** (15/09/2026 : « le réglage dans les paramètres doit rester utile,
    car à tout moment je peux augmenter ou diminuer le fonds de caisse et ça
    devrait passer par les paramètres »). ⚙ Paramètres → Boutiques → 💼 Fonds
    de caisse : on saisit **le NOUVEAU montant**. Règle pure
    `planFondsCaisse`, qui REMPLACE `planRemiseFonds` (retirée) : à la hausse
    le DG **apporte** la différence, à la baisse il la **reprend**. Une remise
    porte un `fonds_caisse.montant` POSITIF (ligne négative, une entrée
    d'enveloppe) ; une reprise un montant NÉGATIF (ligne positive, une
    sortie). La caisse centrale suit : **si j'augmente, la caisse du DG
    diminue ; si je diminue, c'est reversé sur la caisse du DG** (ou la
    BANQUE, au choix — « Chez le DG » d'office). Administrateur PRINCIPAL
    seul, revérifié dans le geste. **Le tiroir des ventes n'est jamais
    touché**, ni par une remise ni par une reprise, et la fenêtre le dit.
  - **Serveur** : `securite-16` (créer = le DG seul, montant forcé à
    − `fonds_caisse.montant`), puis **`securite-19`** (seule la DATE se
    corrige, par le DG) et **`securite-20`** (le montant peut être NÉGATIF :
    la reprise ; zéro reste refusé). Le -20 contient le -19 en entier : c'est
    le seul à coller. Collé par Timo le 15/09/2026 (`true | true | true`).
  - **La DATE d'un mouvement se corrige** (`corrigerDateRemise`, bouton
    « 📅 Date » sur chaque ligne de la fenêtre, principal seul) — parce que
    « Régulariser » pré-remplissait la date à AUJOURD'HUI alors qu'une
    régularisation parle d'un argent remis dans le PASSÉ : 50 000 F sont ainsi
    tombés dans la clôture du 14/09 à DEMAKPOE (capture Timo, écart −40 800).
    La date part maintenant VIDE en régularisation, avec un mot en rouge.
    Seule la date bouge ; montant, origine et fonds restent gravés.
  - **« Payé avec : Le fonds de caisse »** (15/09/2026 — RETOURNE le « laisse »
    du 14/09, qui valait quand le fonds était DANS le tiroir) : « de sorte que
    si pas d'argent et il faut effectuer une dépense, fonds de caisse apparaît
    (gérant) ». Règle pure `fondsProposable` : l'option n'apparaît **JAMAIS
    « au cas où »** — il faut le rôle (`ROLES_FONDS_CAISSE` = gérant, admin),
    une enveloppe non vide, un montant saisi, un **TIROIR QUI NE SUFFIT PAS**,
    et une enveloppe capable de couvrir ce qui manque. Mot pour mot :
    « 20 000 dans la caisse alors que la dépense doit être 30 000 : la dépense
    prend les 20 000 de la caisse et on passe avec 10 000 de fonds de caisse…
    pour des dépenses où il n'y a même pas la caisse, c'est le fonds de caisse
    qui sera utilisé ». DEUX cas, **UNE règle d'affectation** : le tiroir paie
    ce qu'il peut, l'enveloppe complète. Le choix ne change pas le partage, il
    le rend voulu et visible ; pour le reste c'est une dépense de caisse
    ordinaire (même `sortDuTiroir`, même validation du DG, même blocage de
    clôture). Un mot en ambre annonce le partage, la confirmation le répète.
  - **On ne sort pas du tiroir plus qu'il ne contient** (15/09/2026 : « si
    dépense dépasse fonds de caisse, impossible de dépenser » ; sur deux
    dépenses en attente : « si on valide la première, la seconde refuse
    jusqu'à ce que le tiroir contienne l'argent nécessaire » ; sur l'argent
    avancé de sa poche : « elle attendra que le tiroir soit capable et après
    validation elle reprend son argent »). Règle pure `critiqueSortieTiroir` :
    **la limite est le tiroir PLUS ce qu'il reste dans l'enveloppe**, pas le
    fonds seul. Posée aux TROIS moments où l'argent sort hors versement : la
    saisie (mesurée sur la caisse QUI PAIE), la validation du DG, et le
    remboursement d'une avance de frais en espèces. Le refus nomme les
    montants et la porte de sortie (« une avance personnelle »).
    ⚠ **UNE BOUTIQUE À ZÉRO VENTE PEUT TOUJOURS CHOISIR SA CAISSE** —
    vérifié à sa demande le 19/09/2026 (« vérifie voir si une boutique avec
    zéro vente peut toujours choisir la caisse de la boutique pour les
    dépenses »), en exerçant les vraies règles : `optionsPayeAvec` **ne
    regarde JAMAIS le tiroir**, « La caisse de X » est donc toujours dans la
    liste ; c'est le GESTE qui refuse. Zéro vente et aucun fonds → refus
    (« … : 0 F. Attendez une recette. Sinon, choisissez une avance
    personnelle ») ; zéro vente avec un fonds de 50 000 → une dépense de
    3 000 **passe**, prise sur l'enveloppe ; 60 000 → refus. C'est exactement
    la règle du 15/09, rien à corriger.
    **« Laisse comme c'est » (19/09/2026)** : proposé de GRISER l'option sur
    une caisse vide — refusé. Le refus explique mieux qu'une option absente,
    et il donne la porte de sortie. **Ne pas le reproposer.**
    ⚠ À savoir, et c'est voulu : le choix explicite « Le fonds de caisse »
    reste réservé au gérant et à l'admin (`fondsProposable`), mais **l'argent
    de l'enveloppe sort quand même** pour les autres rôles qui saisissent une
    dépense — « le choix ne change pas le partage, il le rend voulu et
    visible ».
  - ⚠ **Un fonds réglé sans remise enregistrée ne retient rien** :
    `manqueRemises` le mesure, le RÉSUMÉ de 🔒 Caisse le dit en rouge
    (« réglé X, jamais remis »), et « Régulariser » comble le trou de
    traçabilité SANS toucher au montant du fonds.
  - **Ce qui a été RETOURNÉ, et qu'il ne faut pas reconstruire** : le réglage
    du 13/09 (« le versement attendu = solde − fonds fixe », le fonds
    « conservé » dans le tiroir) ; et la décision du 14/09 (« chaque remise
    AUGMENTE le fonds ET entre dans son tiroir », `fondsRemisDuJour` compté
    dans la recette de la clôture). Les deux venaient d'un fonds rangé dans le
    tiroir. Leur histoire reste utile : c'est en cherchant un écart de
    −40 800 F sur la clôture du 14/09 à DEMAKPOE que Timo a tranché
    l'enveloppe. Ce qui n'a PAS bougé du 14/09 : le fonds est toujours de
    l'argent de BMI venu du DG ou de la banque, **jamais « laissé sur les
    ventes »** (« il ne doit y avoir AUCUN lien entre le fonds de caisse et
    les ventes. Le seul lien, c'est la compensation »), il n'est ni vente ni
    charge (`CATEGORIES_HORS_CHARGES`), et **on ne le verse jamais**.

- **« Payé avec : la caisse du comptable »** (13/09/2026) : quatrième origine
  (`PAYE_AVEC_COMPTABLE`), **réel seulement** (`optionsPayeAvec(…, {
  avecComptable: !afficheChiffresFormation })`, « Chez le comptable » n'a pas
  de jumelle). Charge de la boutique ; **sortie de la caisse « Chez le
  comptable » quand le comptable la pointe « Remis »** (`mouvementsComptable`
  lit aussi `payeeParLeComptable`, le panneau du comptable la liste « à
  remettre » avec « dépense de X, payée avec ma caisse ») ; ne touche pas le
  tiroir (`sortDuTiroir` faux), ne bloque pas la clôture. Le serveur accepte
  déjà le pointage du comptable sur toute dépense existante (champs
  `decaisse_le` / `decaisse_par` seulement) : rien à coller. **« De l'argent
  remis par le DG » = l'argent de BMI qui est chez le DG**, pas son argent
  personnel ; un apport personnel n'existe pas encore dans l'application.
  **« Laisse » (14/09/2026)** à trois propositions. Deux tiennent toujours, ne
  pas les reproposer : restreindre « remis par le DG » à l'admin ou le faire
  valider quel que soit le montant ; un « apport de départ » pour la caisse
  Chez le DG (elle part de zéro, et Timo le sait). ~~Un choix « fonds de
  caisse » dans « Payé avec » (le fonds EST dans le tiroir : c'est « la caisse
  de la boutique »)~~ — **RETOURNÉ le 15/09/2026** : le fonds n'est plus dans
  le tiroir mais dans une enveloppe, et Timo a DEMANDÉ ce choix (voir le point
  « Payé avec : Le fonds de caisse » plus haut). Le « laisse » du 14/09 ne
  valait que tant que le fonds vivait dans le tiroir.
- **Un versement n'est JAMAIS une dépense** (10/09/2026, capture : « pourquoi
  il pense que le versement est une dépense ? » — résultat du jour à
  −252 299). Il n'est une sortie que pour la caisse (fonds à verser,
  clôture). Tableau de bord (cartes, graphique, synthèse par période),
  export « Dépenses », journal comptable **et l'écran 💰 Dépenses lui-même —
  sa liste ET son « Ce mois »** (11/09/2026 : « pourquoi jusqu'à lors les
  versements sont considérés comme dépense ? » — cet écran avait été oublié,
  un écran oublié fait mentir la règle) passent par `horsVersements`
  (`lib/constants.js`, où vit `CATEGORIE_VERSEMENT`, réexportée par
  lib/versements.js) ; les versements ont leur export « Versements », et
  l'écran DIT où les retrouver (🔒 Caisse) plutôt que de les faire disparaître
  en silence.
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

### Validation des dépenses par le DG (12/09/2026)
- Timo : « ce n'est pas mieux de mettre en place un système de validation
  des dépenses par l'administrateur ? » puis « on met un seuil : **à partir
  de 5 mil, il faut valider ; moins de 5 mil, pas besoin** », « **seules les
  dépenses validées comptent** », « **la clôture impossible s'il y a des
  dépenses liées à la caisse qui ne sont pas validées** ». UNE règle pure,
  `lib/validationDepenses.js` ; serveur `securite-15`.
- **Qui valide : le DG = administrateur PRINCIPAL** (comme les versements),
  dans 📤 Dépenses, encadré permanent « ⏳ Dépenses à valider par le DG »,
  **la boutique regardée seule** (« Ailleurs, en attente : … » dit où il en
  reste). Une dépense saisie par le DG lui-même est validée d'office. Le
  rejet : motif obligatoire, **montant ramené à 0** (l'origine reste dans
  `validation.montant`, description « ✖ REJETÉE (motif) — … »), l'auteur
  reçoit un message ; si l'argent était sorti du tiroir, **le manque se voit
  à la clôture** (« Dépenses rejetées par le DG ce jour-là », dû par la
  personne qui l'a saisi). Une décision ne se défait pas.
- **En attente = ne compte nulle part** : tiroir et fonds à verser
  (`compteDansLaCaisse`), tableau de bord, journal, export, « Ce mois » de
  l'écran Dépenses (`depensesComptees`, constants.js — et non plus
  `horsVersements` seul). L'écran le dit à côté du « Ce mois ».
- **L'origine des fonds est demandée à la saisie** (« Payé avec », les trois
  propositions acceptées : « la caisse de la boutique », « une avance
  personnelle », « de l'argent remis par le DG »). **« Payé avec » nomme
  CHAQUE caisse** (capture Timo, 13/09/2026 : « il peut recevoir dans une
  boutique et valider pour une boutique… même si le haut est BMI DEMAKPOE, il
  a la possibilité de choisir BMI APESSITO comme boutique qui a sorti
  l'argent ») : « La caisse de X » pour chaque boutique visible de l'espace
  regardé, la regardée en tête (`optionsPayeAvec`) ; **la dépense est
  enregistrée sur la boutique dont la caisse a payé** (`interpreterPayeAvec`
  → origine + boutique ; sa clôture et ses fonds à verser la voient), la
  confirmation le dit et le message final dit où la retrouver. Seule la caisse de la
  boutique, en espèces, sort du tiroir ; l'avance et l'argent du DG sont des
  charges qui ne touchent jamais la clôture. Une ligne sans `paye_avec`
  (anciennes, dépenses automatiques) = caisse de la boutique.
- **Avance personnelle = somme à rembourser** dès qu'elle compte (validée, ou
  sous le seuil) : encadré « 💼 Avances de frais à rembourser » dans 🔒 Caisse,
  trois façons — **en espèces depuis la caisse (gérant, admin)** : une sortie
  « Remboursement d'avance de frais » (`CATEGORIES_HORS_CHARGES`, la charge
  est déjà comptée) qui sort du tiroir le jour du remboursement ; **avec le
  salaire (admin)** : une prime `hors_cnss` sur la paie du mois (`paieMois`
  l'ajoute au net, pas à la base CNSS, `remunerationCNSS`) ; **par le DG
  (admin)** : rien ne bouge. Jamais soi-même (sauf admin). L'employé suit
  ses avances dans 💵 Mon salaire (« Mes avances de frais »). Un
  remboursement ne se défait pas.
- **La clôture est bloquée** (`depensesBloquantCloture` / `motifBlocageCloture`,
  message en rouge, bouton grisé, refus DANS le geste) tant qu'une dépense en
  espèces payée avec la caisse de la boutique attend, **jusqu'au jour clôturé
  inclus** ; Flooz, avances et argent du DG ne bloquent pas (ils ne touchent
  pas le tiroir). À dire aux vendeuses : une grosse dépense en espèces se fait
  valider AVANT la fermeture, sinon la caisse ne se clôture pas.

### 🏦 DG, BANQUE, COMPTABLE : trois pastilles du tableau de bord (12/09/2026)
- Timo : « les dépenses de chez le DG et du comptable sont déduites d'où
  alors ? » — le comptable avait sa caisse, le DG et la banque non : l'argent
  versé chez le DG sortait du suivi. Décisions, dans l'ordre : **« DG et
  banque sur le même modèle que le comptable »** ; **« ramener cet onglet
  dans le tableau de bord, comme Chez le comptable s'y retrouve »** (l'onglet
  à part de 2.101.158 a été retiré) ; **« séparer chacun… avoir les onglets
  DG, BANQUE et COMPTABLE »**. Donc **trois pastilles** dans la rangée du
  tableau de bord (`libellePastille` : « 👤 DG », « 🏦 BANQUE », « 🧾
  COMPTABLE »), réelles seulement ; **DG et BANQUE n'existent que pour
  l'admin PRINCIPAL** (`principal` dans `PASTILLES`, revérifié à l'affichage)
  et ne montrent RIEN d'autre que leur caisse (`caisseSeule` : ni ventes, ni
  dépenses, ni stock, ni exports) ; COMPTABLE garde en plus ses sorties comme
  avant (valeur interne « Chez le comptable » inchangée).
- **Trois caisses LUES, rien d'écrit** (`lib/caissesCentrales.js`, UNE carte
  `components/CarteCaisse.jsx`, exercé par le banc) : **Chez le DG** —
  entrées = versements « Chez le DG » VALIDÉS ; sorties = dépenses « payées
  avec de l'argent remis par le DG » qui comptent + avances de frais
  remboursées par le DG. **BANQUE** — entrées = versements BANQUE validés
  (banque, bordereau) ; sorties = dépenses payées par **virement bancaire**
  qui comptent. **Chez le comptable** — entrées = versements pointés
  « Encaissé », sorties = remises pointées « Remis », ce qui attend son
  pointage est dit à part. En attente et rejeté n'y sont jamais. Boutiques
  de l'espace regardé (+ TERRAIN). **Les dépenses restent des charges de
  leur boutique** : le résultat ne change pas, on suit seulement d'où
  l'argent est parti. Pas de montant de départ (proposé, pas demandé).
- **Chaque caisse se lit en RELEVÉ** (12/09/2026 : « ce sont les totaux ou
  sur une période ? » → « Relevé… lance ») : **le sélecteur de période du
  tableau de bord** (écrit UNE fois, `selecteurPeriode`, affiché aussi pour
  les trois pastilles) commande quatre lignes — **solde au début** (tout ce
  qui précède la période), **+ entrées de la période**, **− sorties de la
  période**, **solde à la fin** — et la liste des mouvements de la période
  seulement. Règle pure `releve(bilan, du, au)` (lib/caissesCentrales.js),
  exercée par le banc (septembre : 250 000 + 300 000 − 45 000 = 505 000).
  Une période passée ignore ce qui suit ; « Depuis le début » = solde de
  début 0. Dates retenues : validation d'un versement, pointage du
  comptable, date de la dépense. **Sous le relevé, rien d'autre** (capture
  Timo, 12/09/2026 : « Total des dépenses 0 F », un second « Période » et
  « Dépenses — cette semaine 0 F » répétaient le relevé du comptable) : les
  trois pastilles n'ont que leur relevé (`caisseChoisie`), COMPTABLE garde
  ses exports (sorties, journal).
- **Le relevé s'imprime et s'exporte** (12/09/2026 : « vous avez dit que c'est
  comme un relevé… pourquoi c'est impossible d'exporter pour imprimer ? » →
  « Lance ») : sur chaque carte, **« 🖨 Imprimer le relevé (PDF) »**
  (`genererReleve`, src/pdf.js — les briques communes : entête, bandeau de
  titre « RELEVÉ — caisse », pied de page ; période en clair, les quatre
  lignes en grandes cases, les mouvements dans l'ordre des dates avec
  colonnes Entrée / Sortie et le total de la période ; fichier « Relevé -
  caisse - du au ») et **« Exporter (CSV) »** (mouvements puis les trois
  soldes). Le PDF reprend l'écran tel quel, même période, mêmes chiffres ;
  le banc MESURE le texte écrit.

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
  théorique contre montant du tiroir ») : **ce qu'il y avait DANS LE TIROIR
  hier soir** + recette du jour − sorties justifiées (dépenses + versements,
  **qui ne créent jamais d'écart** : « une dépense n'est pas un manque »),
  − ce que la recette a rendu à l'enveloppe = attendu dans le tiroir.
  ⚠ **Le fonds de caisse n'y entre PAS** (15/09/2026, voir § « l'enveloppe »
  plus bas) : la première ligne dit « Dans le tiroir hier soir — la recette,
  le fonds de caisse n'est pas dedans ». L'ancienne formule disait « fonds de
  caisse d'hier soir » et comptait le fonds : RETOURNÉE ; le champ s'appelle **« Montant du tiroir »** (14/09/2026,
  capture : « trop de commentaire » — le libellé long du 09/09 est RETOURNÉ).
  **La remarque tient sur UNE case et GRANDIT avec le texte** (« la ligne de
  la remarque aussi trop longue, la raccourcir, et si le texte augmente, la
  case aussi augmente de taille ») : `ChampQuiGrandit` (components/ui.jsx,
  écrit UNE fois, une ligne au départ, 6 au plus, sans barre ni poignée) —
  tout champ de texte libre de l'application y passera. Saisir la recette du jour à la place du tiroir est
  signalé en rouge avec le calcul (`alerteSaisieRecette`, écart 1 400 de sa
  capture). Blocage côté application seulement (règle de travail, pas de rôle).
  **Plusieurs vendeurs, UNE caisse, UNE clôture** (11/09/2026 : « que ce soit
  l'admin, le gérant ou le vendeur qui a vendu, c'est la même caisse ») : la
  clôture montre « Recette du jour par vendeur » (ventes tout moyen, espèces
  encaissées ventes + dettes, autres moyens ; `recetteParPersonne`), une
  lecture, jamais une clôture par personne. Le tiroir par vendeur (option 3)
  n'a pas été demandé : ne pas le construire sans sa demande explicite.
- **🔁 Une clôture DÉPASSÉE se signale et se refait** (11/09/2026, trouvé en
  remontant avec Timo un « 880 000 » qu'il ne comprenait pas — clôture du
  10/09 à 410 000, puis une vente espèces de 225 000 à 17h10, APRÈS la
  clôture : le tiroir contenait 635 000, l'écart affiché disait 0, personne ne
  pouvait le savoir). **Le SOLDE reste juste** — le fonds d'hier soir est
  toujours RECALCULÉ, jamais lu dans la clôture (635 000 + 250 000 − 5 000 =
  880 000, son chiffre exact). C'est la CLÔTURE qui devient une photo périmée.
  **Décision Timo (option « b ») : on ne bloque PAS la vente** (refuser un
  client à 17h10 parce que la caisse a fermé à 16h serait pire) — 🔒 Caisse
  porte un **bandeau orange** listant les journées dont la caisse a bougé
  après coup, avec ce qui a bougé, ce qui avait été compté, ce qu'il faut
  trouver ; le formulaire ROUVRE sur ces journées et la **reclôture REMPLACE**
  la fiche du jour en gardant l'ancienne dans `precedentes` (liste qui ne
  rétrécit jamais). Règles pures `clotureDepassee` / `cloturesDepassees` /
  `messageClotureDepassee` (lib/cloture.js), le banc rejoue SON cas. À dire
  aux vendeuses : **clôturer en dernier, à la fermeture, jamais avant**.

### Retours / SAV
- **↩ Reprise de l'article par BMI** (10/09/2026, « un article vendu
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
  **Les mots (14/09/2026, capture : « Reprise d'un article par BMI ou par le
  client ? » → « Reprise de l'article par BMI ») : c'est BMI qui REPREND, le
  client REND — fenêtre, infobulle, journal ; jamais « par le client ».**
- **🧾 Bon de reprise et bon de retour** (14/09/2026 : « ce n'est pas
  judicieux de sortir un reçu ? comment ça se passe avec les grands
  logiciels ? » → un avoir / bon à part, **jamais le reçu de vente
  réimprimé** ; puis « bon de reprise et bon de retour, les deux ») : règle
  pure `lib/bons.js` (`bonReprise`, `retoursDeVente`, `bonRetour`,
  `texteBon`), mise en page `imprimerBon` / `bonWhatsApp` (lib/impression.js,
  **le style du reçu écrit UNE fois**, `STYLE_RECU`). **Un document de plus,
  jamais une écriture** : numéro DÉRIVÉ du reçu (`REP-<n° reçu>-<rang>`,
  `RET-<n° reçu>-<rang>` — d'abord BR / BT, changés le jour même : « tous BR,
  ça va pas porter confusion ? » ; aucun compteur, rien à coller, pas de
  collision hors ligne), reçu d'origine, article, quantité, motif ; reprise → valeur
  reprise, **rendu au client** (et comment) ou dette réduite, case « Le
  client reconnaît avoir reçu … » ; retour → remplacement remis, défectueux
  repris, frais facturés (dette `retour_ref`) ou GRATUIT, case « … reçu
  l'article de remplacement et remis le défectueux ». **Proposé juste après
  le geste** (🖨 Imprimer / WhatsApp si téléphone / Plus tard — UN chemin,
  `proposerBon`) et réimprimable depuis la ligne de la vente (bouton rond 🧾,
  choix parmi plusieurs). Bandeau de formation comme tout document. **Le
  motif a SA ligne, bien visible** (« MOTIF DE LA REPRISE » / « MOTIF DU
  RETOUR (panne constatée) » — Timo : « la raison devrait figurer sur les
  reçus là »), pas un petit texte sous l'article.
- **Un échange n'est JAMAIS une vente** : ajustement négatif
  (`echange_garantie`), aucun CA, aucune commission ; logique dans
  `construireRetour()`. Le défectueux entre dans un **stock SAV à part**
  (« renvoyé au fournisseur » ou « rebut »). Les frais passent par une
  **dette du montant saisi**. Geste réservé à tout admin.

### Stocks
- **📦 Transfert de STOCK : la boutique qui reçoit VALIDE, l'article ne bouge
  pas avant** (14/09/2026, Timo mot pour mot : « lorsqu'un gérant ou admin
  transfère vers une autre boutique, le gérant de la boutique de réception
  doit valider dans Transfert — bien mentionné transfert de STOCK, différent
  de transfert de vente ; tant que cette validation n'est pas faite,
  l'article ne bouge pas »). Règle pure `lib/transfertsStock.js`, exercée
  par le banc : ⇄ Transfert dans 📦 Stocks pose une fiche `transfert_stock`
  dans les `demandes` de la boutique qui REÇOIT (rien à coller : ce champ
  est libre, securite-8) et n'écrit AUCUN ajustement ; la boutique qui
  envoie voit « ⏳ Transferts envoyés, en attente » (annulable) ; dans
  🔁 Transfert (ou 📦 Stocks pour l'admin / magasinier), « 📦 Transferts de
  stock à valider » : **Valider la réception** (magasinier, gérant, admin,
  revérifié dans le geste) écrit les deux mouvements avec un numéro TRF-…
  à cet instant ; **Refuser** (motif) ne bouge rien. L'article restant
  vendable chez l'envoyeur, la validation REVÉRIFIE le stock et refuse s'il
  a été vendu entre-temps. Les badges 🔁 Transfert (gérant) et 📦 Stocks
  (admin) comptent ces fiches ; notification « pour information » à la
  boutique qui reçoit, puis à l'envoyeur (reçu / refusé). La demande de
  transfert depuis 💰 Ventes (type `transfert`) reste ce qu'elle est.
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
  colonne Article collée à gauche pendant le défilement horizontal**
  (« figer le nom de l'article », 10/09/2026 ; depuis le 13/09/2026 sur
  ordinateur aussi — voir la règle commune ci-dessous).
- **Les catégories de 📦 Stocks sont UNE liste déroulante** (capture Timo,
  13/09/2026 : « les catégories sont affichées en totalité, ce n'est plus
  esthétique… sur la même ligne entre la boutique et Faire l'inventaire, une
  liste Catégorie, classée par ordre alphabétique, mais tout afficher par
  défaut ») : « Catégorie : Toutes (N) » sur la ligne du titre, **« Toutes »
  d'office**, ordre alphabétique français (`localeCompare("fr", base)` :
  « éclairage » entre « disjoncteur » et « etiquetteuse », pas à la fin) ;
  plus de mur de pastilles. La recherche reste « toutes catégories
  confondues ». Le banc le rend et le lit.
  **La PREMIÈRE colonne d'un tableau reste FIGÉE pendant le défilement
  horizontal, téléphone ET ordinateur** (13/09/2026 : « figer les articles
  du stock… comme dans Réapprovisionnement », puis « faire pareil dans
  Dépenses et Dettes ; cette règle doit aussi s'appliquer sur Windows » —
  le « téléphone exclusivement » du 10/09 est levé). UNE règle, écrite une
  fois dans ui.jsx : `enTeteFige(fond)` / `celluleFigee(fond, deplie)` —
  la cellule porte le fond de sa ligne (rouge pâle en alerte ou rejetée,
  ambre en attente, bleu soutenu et barre bleue si dépliée :
  `fondLigneDepliable`). Appliquée aux quatre tableaux : Stocks (tableau
  et « À réapprovisionner », colonne Article), Dépenses et Dettes (colonne
  Date). Le banc interdit `lg:static` et tout `sticky left-0` hors ui.jsx.
- Présélectionner un article remplit le formulaire d'ajout ; la correction
  ne passe que par ✏️ Corriger. Importation Excel : une feuille par boutique,
  colonnes nom, fournisseur, domaine, catégorie, initial, seuil, prix
  d'achat, prix de vente ; deux modes (nouveaux articles / entrées).

### Rapports
- **Le rapport de stocks est classé par boutique, par catégorie et par
  seuil** (capture Timo, 12/09/2026) : `trierPourRapportStocks`
  (lib/calculs.js) — boutique, catégorie (sans accents ni majuscules), puis
  **le plus urgent d'abord** (reste − seuil croissant : au seuil ou en
  dessous en tête), puis le nom. L'export « Stocks » du tableau de bord (CSV
  et son PDF) y passe.

### Apparence et étiquettes
- **La liste des ventes est lisible** (capture Timo, 12/09/2026 : « cet
  affichage ne semble pas trop professionnel »… « c'est pour les ventes ») :
  date sur une ligne et l'heure dessous, N° de reçu jamais coupé, **un
  article par ligne, deux au plus puis « + N autres »** (liste complète au
  survol, `ArticlesVente`), client en gras (« Client non renseigné » → tiret),
  quantité et total à droite avec **la remise sous le total** (plus de colonne
  Remise), paiement en **pastille** (vert espèces, ambre crédit, bleu mobile
  money, gris virement — `PastillePaiement`), et **des boutons d'action ronds,
  l'icône seule, le libellé au survol** (`boutonAction`) ; les trois mots
  distincts 📋 Devis / 🔁 Retour / ↩ Reprise vivent dans les `title`. Mêmes
  colonnes de fond, mêmes gestes, mêmes droits, aucune règle pure touchée.
  **La suite des articles se voit au CLIC sur la ligne** (12/09/2026, seconde
  capture : « +1 autre ou +3 autres ne s'affiche pas… lorsqu'on clique sur la
  ligne, la suite apparaît, on clique encore, même ligne ou ailleurs, ça
  revient à 2 lignes par défaut ») : le survol (`title`) ne se voit pas
  partout, donc `venteDepliee` — UNE vente dépliée à la fois ; **un clic sur
  une AUTRE ligne la déplie directement** (12/09/2026 : « un seul clic pour
  sélectionner une autre… c'est le second clic qui sélectionne » — corrigé),
  seul un clic sur la ligne ouverte la referme ; la cellule des boutons ne
  déplie pas (`stopPropagation`). **La ligne dépliée se voit fort** (12/09/2026 : « une
  sélection forte bien visible pour la ligne sélectionnée ») : fond bleu
  soutenu et barre épaisse à gauche, couleur de l'espace (violet en formation). **Le bouton WhatsApp porte le VRAI logo**
  (`IconeWhatsApp`, components/ui.jsx, SVG vert #25D366, écrit une fois) :
  « remplacer l'icône de WhatsApp par le vrai icône WhatsApp » — plus d'emoji
  💬. Les deux sont MESURÉS dans Chromium (`verifier-ecran-ventes`).
  **📋 Dettes suit la même règle** (capture Timo, 13/09/2026 : « appliquer la
  même règle que dans Ventes pour restructurer les dettes ») : date (numéro
  dessous), client en gras (téléphone dessous), **un article par ligne, deux
  au plus puis « + N autres », la suite au CLIC** (`detteDepliee`), montants à
  droite (reste en orange), statut en pastille avec l'ancienneté dessous
  (retard ⚠ rouge), boutons ronds 🖨 / 💵 Paiement / Relancer (logo WhatsApp)
  / 🗑 admin. **Les briques sont écrites UNE fois dans ui.jsx** :
  `ListeArticles` (Ventes l'habille avec les repris), `boutonAction` (aussi
  le bouton rond des Utilisateurs), `classeLigneDepliable` ; **`lignesDette`
  (core.js)** rend les articles d'une dette, ou redécoupe un motif
  « 2× A, 2× B » (seulement si CHAQUE morceau a cette forme — une virgule dans
  un motif libre n'est pas une liste). Mêmes gestes, mêmes droits.
- **La liste des utilisateurs est lisible** (capture Timo, 12/09/2026 :
  vingt gestes soulignés par ligne ; « lance les corrections pour les 2 ») :
  rôle, boutique (« Toutes ») et statut en **pastilles** (+ 🎓 Formation),
  identité manquante en ⚠ discret ; **quatre boutons ronds** toujours
  visibles (🔐 Pouvoirs, 🆔 Identité, 🔑 Mot de passe = principal, ⛔ Bloquer /
  ✅ Réactiver hors sa fiche) et **« ⋯ Gérer »** qui ouvre un panneau SOUS la
  ligne (jamais un voile), rangé par thème — Compte, Paie, Commercial,
  Client — avec les MÊMES gardes qu'avant. **Un thème = UNE ligne** (capture
  Timo, 12/09/2026 : « classer les actions par ligne et non par colonne ») :
  son nom à gauche, ses boutons à la suite ; Timo a dit « laisse » à l'idée
  d'en faire une fenêtre — ne pas la reproposer. Les deux gestes graves (formation
  en masse, retirer Historique + Paramètres) sont en bas dans « ⚠ Actions
  groupées ». Aucune règle pure touchée ; le banc vérifie que chaque geste
  est toujours là avec sa garde.
  **Le NUMÉRO se voit sous le nom, et se cherche** (16/09/2026 : « un client
  créé par un utilisateur, l'administrateur principal n'a pas la possibilité de
  voir son numéro de téléphone ») : il était ENREGISTRÉ (il fabrique
  l'identifiant du client) mais affiché nulle part — pas de colonne ici, et
  📋 Clients ne liste que ceux qui ont DÉJÀ ACHETÉ, donc un client créé sans
  achat n'avait aucun chemin. Ligne « 📞 numéro » sous le nom pour tous les
  rôles, avec le vrai logo WhatsApp (`envoyerWhatsApp`, jamais `wa.me`) ; la
  recherche y passe par **la règle commune** `correspond` nourrie de
  `motsDuNumero` (lib/clientsConnus.js, cinquième importeur) — « 90112233 »,
  « +228 90 11 22 33 » et « 228 » trouvent le même compte. ⚠ **Corriger** un
  numéro n'est PAS fait pour un CLIENT : son identifiant et son mot de passe en
  dérivent, le changer le déconnecte (à traiter à part, avec renvoi des codes) ;
  le geste le refuse en le disant.
  **Le numéro d'un EMPLOYÉ était JETÉ** (16/09/2026, « pourquoi la règle n'est
  pas applicable à tous les utilisateurs ? ») : demandé à la création, il
  servait UNE fois à envoyer les identifiants par WhatsApp et n'était écrit
  nulle part — la règle s'appliquait donc sur du vide. Il est **gardé** sur la
  fiche, et **se saisit ou se corrige** par **📞 dans ⋯ Gérer** (admin ; sans
  risque : un employé se connecte avec SON mot de passe, pas avec son numéro).
  Serveur : `tel` est déjà dans la liste « gestion » de `securite-18` — rien à
  coller.
- **💬 Le mot de fidélité au client** (16/09/2026, « proposer un message aussi à
  envoyer quand on clique sur l'icône WhatsApp ») : texte **écrit par Timo, mot
  pour mot** (`MESSAGE_FIDELITE_DEFAUT`, lib/comptesClients.js — 6 lignes, de
  « Bonjour {client}.. » à « Consultez aussi notre site Web bmitogo.com »).
  **EXCLUSIVEMENT pour les clients** : sur la fiche d'un employé le clic ouvre
  une conversation vide, comme avant. Trois mots se remplacent — `{client}`,
  `{auteur}`, `{role}` — et **l'article est DANS le rôle** (`roleAvecArticle` :
  « le vendeur », « l'administrateur »), donc le modèle écrit `{role}`, jamais
  « le {role} ». **Réglable dans ⚙ Paramètres → 💬 Mot de fidélité** (admin ;
  champ `message_fidelite` sur les boutiques, comme la liste des banques —
  **rien à coller**), avec l'aperçu de ce que le client recevra et « ↺ Rétablir
  le texte d'origine » ; un modèle vidé rouvre une conversation vide. Le mot
  part par `envoyerWhatsApp`, et **WhatsApp n'envoie jamais tout seul** : le
  texte arrive dans la case de saisie.
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
- **🔍 UNE SEULE RÈGLE POUR TOUTE LIGNE DE RECHERCHE** (capture Timo,
  18/09/2026, 🧰 Outillage : « réduire la ligne rechercher un outil, trop
  long… mais est-ce que ce n'est pas mieux d'avoir une seule règle qui gère ce
  côté de ligne de recherche ? Ailleurs c'est bon, mais dans les autres écrans
  cette ligne apparaît trop longue ») — il avait raison : **HUIT largeurs**
  coexistaient pour le même geste (`w-48`, `w-52`, `w-56`, `w-64`, `max-w-xs`,
  `max-w-[220px]` et trois en pleine largeur). `champRecherche`
  (components/ui.jsx, à côté d'`inputCls`) = **pleine largeur sur téléphone**
  — c'est là qu'on en a besoin — **et bridée sur ordinateur** (`sm:w-80`,
  320 px **mesurés dans Chromium**) : une ligne de recherche ne traverse pas
  l'écran. ⚠ **`sm:max-w-xs` a été essayé et NE MARCHAIT PAS** (voir le piège
  du `max-width` au § 5) : Timo l'a vu tout de suite — « la ligne de recherche
  est toujours trop longue… rien n'est fait ». Les **10** lignes de
  l'application y passent (Clients, Clients installés, Historique, Outillage,
  Prospects, Stocks, Tous les devis, Utilisateurs, Ventes, sélecteur
  d'article) ; **le banc compte les usages et interdit toute largeur écrite à
  la main** sur une ligne de recherche. ⚠ Le fichier qui l'emploie doit
  l'IMPORTER : le build ne voit pas un nom manquant (écran blanc 2.101.59).
  ⚠ **SAUF DANS UNE FENÊTRE DÉJÀ ÉTROITE**, et c'est la même règle qui le dit
  (`champRechercheFenetre`, à côté de l'autre dans ui.jsx) : le sélecteur
  d'article s'ouvre dans un panneau de 448 px — la ligne n'a rien à traverser,
  c'est le cadre qui la bride. Bridée à 320 px elle laissait **104 px de blanc
  à sa droite** pendant que la liste dessous courait sur tout le panneau
  (mesuré dans Chromium, 18/09/2026 — défaut introduit le jour même par la
  règle de largeur, réparé aussitôt). Le banc MESURE les deux cas, et le
  contrôle a été éprouvé en remettant la faute exprès : il tombe.
  ⚠ **La ligne « Rechercher un outil… » de 🧰 Outillage n'a jamais proposé de
  liste**, et c'est voulu : elle FILTRE le tableau au fur et à mesure (règle
  commune `correspond`). Les propositions d'outils enregistrés vivent sur le
  champ **« Outil » de 📤 Sortir un outil** (`ChampSuggestions` +
  `propositionsOutils`) — intactes.
- **🖥 LA LARGEUR DE L'ÉCRAN : 1600 px, PAS 1152** (capture Timo, 20/09/2026,
  💰 Ventes sur son XPS : « pourquoi ces marges des 2 côtés ? », puis « ces
  marges c'est sur ordinateur », puis **« b »** entre quatre propositions).
  **UNE ligne**, le cadre de l'application dans `App.jsx` : `max-w-6xl`
  bridait TOUT à 1152 px et `mx-auto` partageait le reste en deux marges —
  la liste des ventes se tassait pendant qu'il y avait ~300 px de blanc de
  chaque côté. ⚠ **Le TÉLÉPHONE n'a jamais été concerné**, par construction :
  son écran fait moins que la limite, elle ne l'a donc jamais rogné — c'est
  ce qui rendait le changement sans risque pour l'équipe.
  ⚠ **La limite RESTE** (elle n'est pas retirée) : sur un moniteur de
  2560 px, un formulaire à quatre colonnes ne doit pas s'étaler d'un bord à
  l'autre. Les options « plein écran » et « pleine largeur sur les écrans à
  tableaux seulement » ont été proposées et écartées.
  ⚠ **Ici `max-w-*` COMMANDE** — c'est un bloc ; le piège du § 5 ne vaut que
  pour les **champs de saisie**. Et le banc **MESURE la largeur obtenue dans
  Chromium** (`verifier-champs`, qui LIT la classe dans App.jsx au lieu de la
  recopier) : 1600 px sur un grand écran, tout l'écran sur 1400 px, **rien de
  changé sur téléphone et tablette**. Éprouvé en remettant `max-w-6xl` : deux
  contrôles tombent, et ils affichent « mesuré : 1152 px ».
- Étiquettes **60 × 30 mm**, boutique en haut, article en bas, code-barres
  11 mm ; `LONGUEUR_MAX_CODE = 17` (barre fine jamais sous 0,25 mm).
- **Les icônes `public/icone-bmi-192-v2.png` / `icone-bmi-512-v2.png` ont un fond TRANSPARENT**
  (capture Timo, 12/09/2026 : « le logo de lancement est toujours dans un
  carré blanc… il devrait être sans fond ») : Android pose l'icône du
  manifeste telle quelle sur `background_color`. Une nouvelle icône se
  livre en RGBA, blanc retiré, **et sous un NOUVEAU NOM** (-v3, -v4…) : le
  téléphone garde l'image prise à l'installation tant que le manifeste ne
  change pas (12/09/2026, « rien n'a changé » après la première correction).
  Le banc lit l'en-tête PNG, le premier pixel, et le nom cité par le manifeste.

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
- **Un banc Chromium écrit sa page AVEC `<meta charset="utf-8">`** : sans
  lui, le « × » d'une expression régulière du bundle est lu en deux
  caractères et la règle échoue dans le navigateur alors qu'elle passe en
  Node (13/09/2026, `lignesDette`). Dans le code, un caractère non ASCII
  d'une expression régulière s'écrit `\u00d7`.
- **La police de base du PDF ne connaît ni « → », ni « − », ni l'espace fine
  de `fmt()`** : devant un caractère inconnu, jsPDF change d'encodage pour
  toute la chaîne et le texte sort en lettres espacées (capture Timo,
  12/09/2026, « Rapport — versements » : « V e r s e m e n t … ! C h e z »,
  « 50/000 F »). Tout texte venu des données passe par `texteSurPdf`
  (src/pdf.js) avant d'être écrit : rapports génériques, relevé. Les accents
  restent.
- ⚠⚠ **`max-w-*` NE COMMANDE RIEN SUR UN CHAMP DE SAISIE** (18/09/2026, Timo,
  deux fois : « réduire la ligne rechercher un outil, trop long », puis
  **« la ligne de recherche est toujours trop longue… rien n'est fait. Ou bien
  tu as fait autre chose que ce que je demande ? »**). `src/index.css` porte,
  depuis longtemps et pour une VRAIE raison (un champ qui débordait d'une
  grille), la règle globale `input, select, textarea { max-width: 100%; }`,
  écrite **APRÈS `@import "tailwindcss"`** — donc plus forte que toute classe
  utilitaire. **DIX `max-w-*` posés sur des champs ne commandaient rien** et
  personne ne s'en était aperçu. Sur un champ, on pose une **LARGEUR**
  (`sm:w-80`, `sm:w-44`…), jamais un plafond. Ne pas retirer la règle globale :
  elle empêche un vrai débordement.
  ⚠ **Et la leçon plus large** : le premier correctif POSAIT la bonne classe,
  et un contrôle du banc vérifiait qu'elle était là. Elle était là. **Un
  contrôle qui lit une CLASSE ne mesure pas un EFFET.** Depuis,
  `npm run verifier-champs` monte le vrai CSS construit dans Chromium et LIT
  LA VALEUR OBTENUE — avec des **témoins** qui prouvent à chaque passage que
  ces pièges existent toujours.
- ⚠⚠ **`transition-*` NE COMMANDE RIEN SUR UN BOUTON** (trouvé le 18/09/2026
  en répondant à Timo : « vérifie si d'autres classes ne commandent rien comme
  celle-là » — la bonne question). Même cause : `src/index.css` donne à CHAQUE
  bouton actif son retour visuel (demande Timo, 20/08/2026) avec
  `button:not(:disabled) { transition: filter 120ms, transform 80ms; }`, une
  **propriété raccourcie écrite hors layer** — elle remet donc à zéro les trois
  longhands que pose une classe Tailwind. **DOUZE `transition-colors` /
  `transition-all` / `transition-transform`, toutes sur des boutons, toutes
  mortes** : elles ont été RETIRÉES (aucun changement à l'écran, c'est bien la
  preuve). Le banc en interdit une treizième, et son témoin le mesure.
  ⚠ **Un témoin doit être INDÉPENDANT de l'application** : le premier se
  servait de `transition-colors`, et le jour où plus personne ne l'écrivait,
  Tailwind cessait de la générer — le témoin ne prouvait plus rien. Il pose
  maintenant sa propre classe.
- **Les TROIS autres règles globales d'`index.css` ont été passées au crible le
  même jour et sont SAINES** — inutile de refaire l'audit : `.grid > * {
  min-width: 0 }` (aucun `min-w-*` n'est enfant DIRECT d'une grille : ils sont
  tous sur un `<table>` dans un cadre qui défile) ; `button:active { transform }`
  (aucun `active:scale-*` écrit) ; `:focus-visible { outline }` (les trois
  `outline-none` sont sur des `<input>`). Et **aucune** classe écrite dans le
  code ne manque du CSS construit (597 jetons vérifiés un par un).
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
- ⚠⚠ **UN ARGUMENT OUBLIÉ = ÉCRAN BLANC, ET LE BANC PEUT EXIGER LA FAUTE**
  (capture Timo, 19/09/2026 : un client tape son mot de passe et tombe sur du
  BLANC ; ça durait depuis la 2.101.267). `boutiquesVisibles(db, profile,
  **liste**)` était appelée à DEUX arguments à deux endroits (l'espace client,
  et ⚙ Paramètres sur le dossier d'un employé — celui-là pas encore vu) :
  `undefined.filter(...)` lève au rendu, React ne dessine rien. `npm run
  verifier-imports` ne voit RIEN (le nom existe), `npm run build` non plus.
  ⚠ **Et le contrôle du banc EXIGEAIT la forme fautive** : il cherchait le
  TEXTE `/boutiquesVisibles\(db, profile\)/` et le trouvait — il garantissait
  donc le défaut. **Le pire cas possible.** Depuis : `scripts/_rendu-espace-client.jsx`
  MONTE et REND l'écran du client dans le banc, avec **deux bases** — une
  garnie, et **la vraie base d'un téléphone de client** (les politiques du
  serveur ne lui descendent QUE ses données : ni boutiques, ni produits) ;
  le banc interdit tout appel à deux arguments ; et `boutiquesVisibles` rend
  une liste vide au lieu de lever — **le banc attrape l'oubli, l'utilisateur
  ne le paie pas**. Six contrôles tombent quand on remet la faute.
  **Règle générale : un écran qui PRÉSUME une table est un écran blanc en
  puissance** ; et le seul contrôle qui attrape un écran blanc est celui qui
  REND l'écran.

---

## 6. Ce qui reste ouvert — voir `docs/`

Un fichier par sujet, à lire **quand le sujet revient**. Chacun dit où l'on
s'est arrêté, mot pour mot.

| Sujet | État | Fichier |
|---|---|---|
| Chantiers en attente du feu vert de Timo : **mots de passe clients** (3 voies proposées, pas tranché), **mode superviseur** (cadré, « pas pour le moment »), **corbeille** (faite pour les chantiers ; prospects / articles / ventes possibles) | À sa demande | `docs/etat-chantiers-en-attente.md` |
| **WhatsApp depuis le numéro BMI** — **RACCORDÉ le 19/09/2026** : numéro +228 99 96 84 88 « ● Connected » chez YCloud (coexistence, WABA 885440708797061, limite 250 clients/jour). ⚠ **Rien n'est construit côté application**, et les **modèles de messages validés par Meta** sont le passage obligé avant tout envoi | Raccordé ; suite à sa demande | `docs/etat-whatsapp-numero-bmi.md` |
| **Doublons** : les 17 points du relevé (A1–A12, B1–B5) sont unifiés, 2.101.64 → 2.101.81 (« lance tout », 08/09/2026) ; le fichier dit où vit chaque règle | Clos | `docs/doublons-2026-09.md` |
| Vague 3 — verrous serveur entre employés | Terminée, tout collé | `docs/etat-vague-3-verrous-serveur.md` |
| Vague 2 — lecture des comptes clients (histoire ESSO close) | Terminée, tout collé | `docs/etat-vague-2-lecture-client.md` |
| Suites de l'audit du 29/08 (graves fermés, hygiène, 3 projets sur la base) | Fermé, ne pas rouvrir | `docs/etat-audit-2026-08.md` |
| Inventaire des verrous (cases cochées par Timo) | Référence | `docs/inventaire-verrous-employes-2026-09.md` |
| Audit complet du 29/08 (22 279 lignes lues) | Référence | `docs/audit-complet-2026-08.md` |
| **Carte du code** : où vit chaque règle, chaque composant, chaque écran. Une ligne par fichier — le SUJET, jamais le fonctionnement. Écrite le 15/09/2026 (« comment essayer de te donner une mémoire ») ; **le banc tombe si un fichier de `src/lib` ou `src/components` n'y figure pas** | À lire EN PREMIER quand on cherche où toucher | `docs/carte-du-code.md` |
| L'ancien CLAUDE.md complet (659 lignes), tel qu'il était avant le rangement du 06/09 — pour retrouver un détail condensé ici | Référence | `docs/CLAUDE-avant-rangement-2026-09-05.md` |
| **Répétition générale en formation** (44 lignes à cocher, deux téléphones, tiroir et dette sur montants ronds ; écrite le 12/09/2026 à la demande de Timo, PDF remis) : à rejouer avant un GO définitif, puis après tout gros chantier | À faire par Timo | `docs/scenario-test-formation.html` |
| **🔔 Notifications** (2.101.197) : en service depuis le 14/09/2026 (SQL collé, variables Vercel posées, cron visible, testé sur Android : « ça a vibré ») ; tournée du matin à 7 h validée par Timo | En service | `docs/etat-notifications-push.md` |
| Cloisonnement **par boutique** (au-delà de l'espace) | Reporté | — |

Quand un chantier avance, on met à jour SON fichier dans `docs/`, et ce
tableau seulement si l'état change.
