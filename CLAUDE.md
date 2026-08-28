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
npm run verifier-cloisonnement   # 492 contrôles : la séparation formation / réel
npm run tester-verrouillage      # 41  : le blocage des connexions
npm run tester-reglement         # 35  : les échéanciers client
npm run tester-parrainage        # 23  : la création de filleuls
npm run verifier-ecran-stocks    # 8   : l'écran Stocks
```

Puis on incrémente `VERSION` dans `src/lib/constants.js` (une version par
envoi, sans exception : c'est ce qui déclenche la mise à jour chez lui).

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
- Le plan de règlement se choisit **à la signature du contrat**, pas du PV.
  **L'administrateur principal seul** accepte ou refuse. La date de première
  échéance est **libre**.
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

- **Vague 2 de la fermeture de l'annuaire client** : `dettes`, `ventes`,
  `clients_installes` sont encore lisibles par tous les comptes clients.
  Il faut d'abord poser un champ « propriétaire » sur ces lignes.
- Scripts SQL peut-être jamais exécutés :
  `securite-1-audits-et-tombstones.sql`, `avis-supabase-0-etat-des-lieux.sql`,
  `avis-supabase-1-search-path.sql`.
- Trois fonctions `api/` renvoient encore le message d'erreur interne brut.
- Un employé connecté peut encore recalculer le mot de passe d'un client.
- Cloisonnement **par boutique** (au-delà de l'espace) : reporté.
- 25 des 29 écrans n'ont jamais été audités.
