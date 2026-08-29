# BMI-Gestion — ce qui a déjà été tranché

Ce fichier est lu automatiquement au début de chaque session. Il existe pour
une raison précise : **Timo ne doit pas avoir à réexpliquer ce qu'il a déjà
décidé.** Tout ce qui est écrit ici a été tranché par lui, ou appris à la
dure sur ce dépôt.

Une règle ici ne se contourne pas et ne se « réinterprète » pas. Si elle
gêne, on le dit à Timo et on attend sa réponse.

---

## 1. À qui on parle

Timo dirige BMI Togo (vente de matériel solaire, Lomé). Il **n'est pas
développeur**. Il connaît son métier mieux que quiconque et repère les
défauts que les tests ne voient pas — plusieurs corrections importantes sont
parties d'une de ses captures d'écran.

- **On lui écrit en français**, toujours, y compris les phrases courtes
  entre deux actions.
- **Pas de jargon.** « La base refuse la ligne » et non « violation RLS ».
  Quand un mot technique est inévitable, on l'explique en passant.
- **On explique AVANT de construire.** Il l'a demandé mot pour mot :
  « tu veux implémenter quoi ? dis-moi d'abord ». On décrit ce qu'on va
  faire, il valide, on construit.
- **On ne le rassure pas à tort.** Un test qui ne teste rien est pire qu'un
  test absent : il rassure sans protéger. Si quelque chose n'est pas
  vérifié, on le dit.

**Seule exception accordée par lui :** « Si je casse quelque chose, je
répare immédiatement sans attendre votre feu vert — mais je vous le dis tout
de suite après. »

---

## 2. Les interdits absolus

| Interdit | Pourquoi |
|---|---|
| **Exécuter du SQL sur sa base Supabase** | On l'écrit, on l'explique, **il le colle lui-même**. Le SQL se met **directement dans le message**, jamais « voir tel fichier ». |
| **Demander ou accepter un `.env`, une clé `service_role`** | Elle ne doit exister que comme variable d'environnement Vercel, côté serveur. |
| **Préfixer une clé secrète par `VITE_`** | Vite l'embarque dans le paquet envoyé au navigateur : la clé devient publique. |
| **`npm run dist`** | Déploiement **web uniquement**. La partie Electron n'est plus utilisée. |
| **Pousser sur une autre branche** que celle demandée | — |
| **Mettre un nom de modèle d'IA** dans un commit, un commentaire, une PR | — |

---

## 3. Avant chaque envoi

```
npm run build                    # refuse de passer si le JSX est cassé
npm run verifier-cloisonnement   # 578 contrôles : la séparation formation / réel
npm run tester-verrouillage      # 41  : le blocage des connexions
npm run tester-reglement         # 35  : les échéanciers client
npm run tester-parrainage        # 23  : la création de filleuls
npm run verifier-ecran-stocks    # 8   : l'écran Stocks
npm run verifier-ecran-ventes    # 36  : l'argent dans l'écran Ventes
```

Puis on incrémente `VERSION` dans `src/lib/constants.js` (une version par
envoi, sans exception : c'est ce qui déclenche la mise à jour chez lui).

**⚠ POUSSER SUR LA BRANCHE NE DÉPLOIE RIEN.** Vercel envoie `main`, et rien
d'autre. Tant que la branche n'est pas fusionnée dans `main`, le téléphone de
Timo reste sur l'ancienne version — quoi qu'on lui ait annoncé.
Le 29/08/2026, dix versions ont été écrites, testées et « annoncées
déployées » alors qu'aucune n'était en ligne. C'est lui qui l'a vu :
« Version 23 déployé, mais sur téléphone toujours le 13 ».
On ne dit donc **jamais « déployée »** après un `git push` sur la branche —
le mot ne vaut qu'après `git push origin HEAD:main`.

**LA FUSION FAIT PARTIE DE L'ENVOI. On ne la demande pas.** Sa remarque du
29/08/2026 : « depuis qu'on a commencé tu déploies automatiquement et tu
fusionnes ; maintenant tu attends que j'ordonne la fusion d'abord ». C'était
vrai, et l'incohérence venait de moi. Le déroulé est donc, à chaque fois et
sans qu'il ait à le redemander :

```
les 6 bancs au vert  →  VERSION incrémentée  →  push sur la branche
                     →  git push origin HEAD:main   ← toujours
```

On ne s'arrête avant la fusion que dans deux cas : un banc en échec, ou une
correction dont on lui a annoncé qu'elle changerait ses habitudes et qu'il
n'a pas encore validée. Dans ces deux cas, on le DIT — on ne se contente pas
de ne rien faire.

**Le banc est la mémoire du projet.** Un défaut fermé reste fermé parce
qu'un contrôle le surveille, pas parce qu'on s'en souvient.

Quand un contrôle décrit un comportement qui n'a plus cours, **on le
retourne, on ne le supprime pas** : ce qui était toléré doit devenir
impossible, et le banc doit le dire dans ce sens-là.

---

## 4. Les règles métier qu'il a posées

### Formation / réel — le mur
- Une boutique, un compte, une donnée appartiennent à **un espace et un
  seul** : le réel, ou l'entraînement.
- **Seul l'administrateur principal traverse le mur.** Mot pour mot :
  « Je suis le seul admin principal qui peut voir les 2 espaces à la fois.
  Le reste, soit tu es admin formation, soit admin réel. »
- Il bascule d'un espace à l'autre avec le sélecteur « Je regarde ».
  Ce réglage **survit au F5 et à une nouvelle version**, et **meurt à la
  déconnexion** (retour au réel).
- **Les écrans d'administration suivent le sélecteur, eux aussi.** Relevé par
  Timo le 29/08/2026 : ⚙ Paramètres et 👥 Utilisateurs listaient les DEUX
  espaces mêlés. Le cloisonnement avait été posé partout où l'on compte de
  l'argent, pas là où l'on bloque un compte ou supprime une boutique. Toute
  liste de boutiques passe par `boutiquesVisibles`, toute liste de personnes
  par `utilisateursDeLEspace`. **Les 28 listes déroulantes ont été balayées
  une par une** (2.101.23).
- **« Je vois les deux espaces » ne veut jamais dire « je les affiche
  ensemble ».** C'est l'espace REGARDÉ qui décide, y compris pour
  l'administrateur principal. Toute condition de la forme
  `voitLesDeuxEspaces(...) || ...` dans un filtre d'affichage est un défaut :
  elle rouvre le mur pour lui seul, silencieusement.
- La caisse **« Chez le comptable » est réelle et n'a pas de jumelle** : elle
  n'est proposée que lorsqu'on regarde le réel. Le verrou d'écriture la laisse
  passer sans vérifier, justement pour cette raison. Seul le contrôle d'unicité d'un nom de boutique
  regarde les deux espaces — sinon le serveur ne saurait plus classer la ligne.
- **Ce qu'on crée naît dans l'espace qu'on regarde** — plus aucune case
  « formation » à cocher à la création d'un utilisateur, d'une boutique ou
  d'un magasin.
- **L'espace du compte prime sur le réglage.** Un administrateur placé dans
  la formation ne voit jamais les chiffres réels, quel que soit son réglage.
  (C'est la fuite mesurée le 26/08/2026 : il voyait le chiffre d'affaires,
  les dettes et les marges de la vraie entreprise.)
- La dérogation `'tous'` doit apparaître dans **chaque** politique
  `espace_cloisonnement` côté Supabase.
- **L'application et le serveur doivent dire la même chose.** Si seule
  l'application se restreint, la base reste ouverte et l'écran ne fait que
  *cacher* ce qui est encore autorisé. `api/sync-auth.js` et
  `voitLesDeuxEspaces()` de `lib/calculs.js` sont un couple : on ne touche
  jamais l'un sans l'autre. Un contrôle du banc vérifie leur accord.
- **L'espace formation est VIOLET, le réel est BLEU** (demande du 29/08/2026).
  La couleur suit l'espace REGARDÉ. Elle se change en redonnant une valeur aux
  variables `--color-sky-*` et `--color-blue-*` de Tailwind dans
  `src/index.css`, sous `html[data-espace="formation"]` — **jamais** classe par
  classe : le bleu est écrit 291 fois. Le vert, le rouge et l'ambre ne changent
  pas : ils veulent dire payé, refusé, en attente.
- L'étiquette d'espace n'est réécrite **qu'à la connexion**. Un changement
  de règle ne prend effet qu'à la prochaine reconnexion de chacun — il faut
  le dire à Timo à chaque fois.

### Boutique de travail
- « **NE JAMAIS CHANGER DE BOUTIQUE APRÈS UNE SÉRIE D'ACTUALISATIONS DE LA
  PAGE.** » La boutique choisie est mémorisée **par écran**
  (`bmi_boutique:<id>:<écran>`), pas globalement.
- Enregistrer un stock dans la mauvaise boutique était trop facile : on
  aide par **présélection**, jamais par une question de confirmation. Ses
  boutiques vendent le même matériel — une alerte se déclencherait sur le
  cas normal et on apprendrait à l'ignorer.

### Clients
- Un numéro de téléphone se compare sur ses **8 derniers chiffres**
  (`memeNumero`). `+228 90 11 22 33` et `90112233` sont le même client :
  les comparer bruts créait des doublons et une seconde prime de parrainage.
- **Une commission n'est due qu'après DEUX choses** : la réception des travaux
  **et** le solde de la dette du client. Sa décision du 29/08/2026, après avoir
  remarqué qu'un client pouvait signer son PV en ayant versé 30 % : « un franc
  ne sort pas de la caisse avant d'y être entré ». La **part du parrain** suit
  la même règle — « c'est lorsque le client (filleul) a soldé sa dette ».
  Le lien `dette.vente_id` est posé à l'encaissement ; les dettes créées avant
  la 2.101.19 ne l'ont pas, leurs ventes gardent l'ancienne règle.
- Le plan de règlement se choisit **à la signature du contrat**, pas du PV.
  **L'administrateur principal seul** accepte ou refuse — sa réponse du
  29/08/2026, mot pour mot : « moi seul ». La date de première échéance est
  **libre**.
- L'appareil d'un client ne doit télécharger **que ses propres données**.
  `lireTout()` récupère tout ce que le serveur laisse passer : **les
  politiques RLS sont la seule barrière**, il n'y a aucun filtre par
  utilisateur côté application.

### Étiquettes
- Format **60 × 30 mm**, nom de la boutique **en haut**, nom de l'article
  **en bas**, code-barres de hauteur fixe (11 mm).
- Une barre fine ne descend jamais sous 0,25 mm, sinon aucune douchette ne
  lit. D'où `LONGUEUR_MAX_CODE = 17` caractères.

---

## 5. Les pièges rencontrés — ne pas y retomber

- **`export { x } from "y"` ne crée PAS de variable locale.** Le module
  réexporte `x` mais ne peut pas s'en servir. Il faut **importer ET
  réexporter**. Ce piège a été touché deux fois.
- **Aucun hook React après un `return` anticipé.** `App.jsx` contient
  `if (!db) return <LoadingSpinner/>` vers la ligne 622 : tout `useState`
  ou `useEffect` placé après plante l'application.
- **Supabase donne les droits par défaut à `anon` sur toute nouvelle table
  ET toute nouvelle fonction.** `revoke from public` ne suffit pas.
- **`src/lib/identiteClient.js` ne doit rien importer.** Il est lu par le
  navigateur *et* par Node (les fonctions `api/`), et Node ne sait pas
  résoudre les imports sans extension de Vite.
- **Une expression régulière trop large casse le JSX en silence.** Deux
  fichiers ont été abîmés ainsi. Après toute retouche en masse :
  `npm run build`, et `git checkout --` sans hésiter si c'est parti de
  travers.
- **Un pouvoir, un bouton ou une alerte qui ne commande plus rien doit être
  retiré**, pas laissé en place. Une case à cocher qui ne fait rien fait
  croire à Timo qu'il a réglé quelque chose.

---

## 6. Ce qui reste ouvert

**L'audit complet du 29/08/2026 est dans `docs/audit-complet-2026-08.md`**
(22 279 lignes lues). Rien n'en a été corrigé : c'était un audit, pas un
chantier. Les constats, par ordre de gravité.

### Graves
1. ~~Un compte client peut écrire dans `dettes`, `ventes` et `produits`~~ —
   **FERMÉ, et vérifié sur la vraie base le 29/08/2026** (capture de Timo) :
   `role_client_pas_de_produits`, `role_client_ne_modifie_pas_les_dettes`,
   `role_client_ne_cree_pas_de_vente` et le déclencheur
   `client_ventes_reception_seule_trg`. Son espace continue de créer la dette
   d'un devis « pose seule » et de signer son PV — mais il ne peut plus gonfler
   la prime de son parrain au passage. **Ne pas rouvrir ce sujet.**
   ⚠ L'escalade de privilège, elle, est **fermée, et vérifié sur la vraie base
   le 29/08/2026** (capture de Timo) : `interdire_escalade` sur `users`,
   `interdire_escalade_paie_trg` sur `paie`. Je l'avais annoncée ouverte —
   c'était mon banc qui lisait mal. **Ne pas rouvrir ce sujet.**
2. ~~Restaurer une sauvegarde efface tout ce qui a été créé depuis~~ —
   **corrigé en 2.101.18**. Le geste reste destructeur par nature (le
   garde-fou anti-état-périmé de `save()` ne peut pas s'appliquer à un
   fichier, qui n'a pas de `__v`), mais il compte et nomme désormais ce qui
   serait perdu, exporte l'état actuel avant, exige un code tiré au hasard,
   et n'appartient qu'à l'administrateur principal.
3. ~~Refuser une vente à crédit l'enregistre quand même~~ — **corrigé en
   2.101.16**, surveillé par `npm run verifier-ecran-ventes`.
4. ~~Les frais de pose ne sont jamais mis à la dette~~ — **corrigé en
   2.101.16** : la dette réclame désormais ce que le reçu annonce.
5. ~~Un employé peut se remettre `actif: true`~~ — **fermé le 29/08/2026** :
   `refuser_elevation_de_soi_trg` est posé sur la vraie base (capture de
   Timo), et l'écran Utilisateurs a été mis d'accord avec lui en 2.101.17.

### Réels

### Bancs
`npm run tester-ecriture-sql` mesure ce que la base laisse écrire à un compte
connecté. **Il ne reste qu'un échec sur 21** — un employé qui écrit
`salaire_base` dans `users.data`, inerte dès que la fiche de paie existe dans la table `paie`, qui
fait foi.

⚠ **Leçon du 29/08/2026 : un banc qui lit mal est pire qu'un banc absent.**
Celui-ci décidait « accepté / refusé » en lisant la dernière ligne de psql —
or psql annonce « SET » pour chaque commande réussie, et ces « SET » étaient
pris pour un résultat. Toutes les portes fermées par un déclencheur étaient
annoncées grandes ouvertes, et j'ai alerté Timo à tort. On ne lit plus la
sortie : on regarde si la base a levé une objection.

### Chantiers plus anciens, toujours ouverts
- **Vague 2 — la LECTURE** : `dettes`, `ventes`, `clients_installes` restent
  lisibles par tous les comptes clients (l'écriture, elle, est traitée par
  `client-2-fermer-ecriture.sql`). Il faut poser un champ « propriétaire »
  sur ces lignes pour aller plus loin.
- Un employé peut encore écrire `salaire_base` dans `users.data` — inerte dès
  que la fiche de paie correspondante existe dans la table `paie`, qui fait
  foi, mais à fermer un jour.
- Scripts SQL peut-être jamais exécutés :
  `securite-1-audits-et-tombstones.sql`, `avis-supabase-0-etat-des-lieux.sql`,
  `avis-supabase-1-search-path.sql`.
- **Cinq** fonctions `api/` renvoient le message d'erreur interne brut (et non
  trois comme le relevé précédent le disait).
- Cloisonnement **par boutique** (au-delà de l'espace) : reporté.

