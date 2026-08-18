# Ce qu'il reste à exécuter dans Supabase

À jour au 17/08/2026 — version de l'application : **2.100.41**

Tout se fait au même endroit : **Supabase → SQL Editor → New query → coller → Run**.

**Faites-les dans l'ordre.** Chaque script est indépendant : vous pouvez vous
arrêter entre deux et reprendre plus tard, même des semaines après.

---

## Ordre d'exécution

| # | Fichier | Ce que ça fait | Risque |
|---|---------|----------------|--------|
| 1 | `purger-pwd-visible.sql` | Efface les mots de passe restés en clair | Nul |
| 2 | `espace-1-colonne.sql` | Pose l'étiquette formation/réel — sans rien bloquer | Quasi nul |
| 3 | `espace-2-verifier.sql` | Vérifie que l'étiquette est juste — ne modifie rien | Aucun (lecture) |
| 4 | `espace-3-politiques.sql` | Active la barrière côté serveur — **en deux vagues** | Réel, réversible |

---

## 1. `purger-pwd-visible.sql` — les mots de passe en clair

**Le problème :** la table des comptes est volontairement lisible par tout le
monde (un téléphone neuf doit pouvoir retrouver son compte pour se connecter).
Un champ y gardait le mot de passe **en clair**. N'importe quel visiteur du site
pouvait donc les télécharger, le vôtre compris.

**Avant de lancer :** assurez-vous que **tout le monde** est passé en version
2.100.32 ou plus récente. Sinon un ancien appareil réécrira le champ après la
purge. (Demandez à chacun de rafraîchir, et vérifiez le numéro de version
affiché en bas de son écran.)

**Sans danger :** ce champ n'a jamais servi à se connecter — la connexion
s'appuie sur d'autres champs, qui ne sont pas touchés. Personne ne perd son accès.

Le script est en 3 temps : compter, purger, recompter. **À la fin, le compte
doit être 0.**

**Ensuite, et c'est important :** changez les mots de passe des comptes qui
étaient exposés. Ils ont circulé en clair, il faut les considérer comme connus.

---

## 2. `espace-1-colonne.sql` — poser l'étiquette

Ajoute une étiquette « formation » ou « réel » sur chaque ligne, remplie
automatiquement à chaque écriture.

**Après ce script, absolument rien ne change pour personne.** L'étiquette est
simplement là. C'est volontaire : elle doit pouvoir être vérifiée
tranquillement avant qu'on s'appuie dessus.

**Retour en arrière :** en bas du fichier. L'étiquette est calculée, jamais
saisie — la supprimer ne perd aucune donnée.

---

## 3. `espace-2-verifier.sql` — vérifier avant de fermer

**Ce script ne modifie rien. Il lit et il rapporte.**

Il répond à une seule question : *si on activait la barrière maintenant,
est-ce que quelqu'un perdrait l'accès à quelque chose ?*

**Lisez le résultat. Ne passez à l'étape 4 que si tout est vert.**

S'il signale des lignes mal classées ou des comptes sans espace, corrigez-les
d'abord dans l'application (👥 Utilisateurs, ⚙ Paramètres) — puis relancez ce
script jusqu'à ce qu'il soit propre.

---

## 4. `espace-3-politiques.sql` — la barrière, en deux vagues

C'est le seul qui change vraiment quelque chose. Il se lance **deux fois**.

### Vague 1 — trois tables sans enjeu comptable

En haut du fichier, laissez la ligne :

```
vague constant int := 1;
```

Lancez. Le cloisonnement — lecture **et** écriture — s'applique alors à
**trois tables seulement** : `proformas`, `prospects`, `commandes`.

Ce sont les trois où une erreur ne coûterait ni argent ni stock. C'est la mise
en service : on vérifie que le mécanisme fonctionne là où il ne peut rien
casser de grave.

**Laissez tourner au moins une journée complète.**

### Vague 2 — les onze tables

Quand vous êtes tranquille, rouvrez le **même fichier**, changez la ligne en :

```
vague constant int := 2;
```

Relancez le fichier entier. Le cloisonnement couvre alors les **onze** tables,
comptabilité et stock compris : ventes, dépenses, dettes, produits,
ajustements, clôtures, commandes, proformas, boutiques, prospects,
clients installés.

### Retour en arrière

En bas du fichier. Il rend l'accès exactement comme avant, en une exécution.
J'ai testé cette annulation sur une base PostgreSQL jetable : elle repart
proprement.

---

## Ce que ces scripts ne font PAS

Ils ne remplacent pas les protections déjà dans l'application (le verrou
d'écriture de la version 2.100.26, renforcé en 2.100.37). Ils ajoutent une
**deuxième serrure, côté serveur** : même quelqu'un qui contournerait
l'application serait arrêté.

C'est la différence entre « l'application refuse » et « le serveur refuse ».

---

## Si un script renvoie une erreur

**Ne relancez pas en boucle.** Envoyez-moi le message d'erreur exact, tel
qu'il s'affiche.

Une erreur déjà rencontrée : `syntax error at or near "?"`. Elle vient d'un
copier-coller qui a perdu les retours à la ligne. Ouvrez le fichier, copiez-le
en entier d'un coup, et vérifiez que le texte collé dans Supabase a bien
plusieurs lignes.

---

## Encore en attente, non écrit à ce jour

La **faille n° 3** de l'audit général — les droits par rôle côté serveur
(aujourd'hui, le serveur ne distingue pas un vendeur d'un administrateur).
Vous ne m'avez pas encore dit quand vous vouliez qu'on s'y mette.
