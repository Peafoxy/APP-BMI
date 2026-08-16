# Cloisonnement formation / réel — ce qui est fait, et ce qui reste

## Où en est-on

Depuis la 2.100.25, la séparation entre l'espace **réel** et l'espace
**formation** est tenue par l'application, à trois niveaux :

1. **Les sélecteurs** ne proposent que les boutiques de l'espace du compte
   (`boutiquesVisibles`) — vente, caisse à débiter, destination de
   transfert, cible de ravitaillement, catalogue du magasin, client
   destinataire d'un devis.
2. **Un verrou d'écriture unique**, posé dans `save()` (`App.jsx`), refuse
   **toute** écriture portant sur une boutique de l'autre espace, quel que
   soit l'écran ou le circuit emprunté (`verifierEcritureEspace`, dans
   `lib/calculs.js`). C'est ce verrou qui protège aussi les écrans qu'on
   n'a pas pensé à filtrer — et ceux qui seront ajoutés plus tard.
3. **Une marque d'espace** (`formation: true`) sur les enregistrements qui
   n'appartiennent à aucune boutique et que le verrou ne peut donc pas
   rattraper : devis, comptes clients, prospects.

`node scripts/verifier-cloisonnement.mjs` (ou `npm run
verifier-cloisonnement`) rejoue 38 scénarios qui doivent rester vrais.
**À lancer après toute modification touchant aux boutiques, aux comptes ou
aux écritures.**

## Ce qui reste ouvert : la base de données elle-même

Le cloisonnement vit **entièrement dans le code de l'interface**. Côté
serveur, il n'existe aucune barrière :

- La politique RLS actuelle (`activer-rls.sql`, `durcir_securite.sql`)
  accorde à **tout compte connecté** un accès complet à toutes les tables :
  `USING (true) WITH CHECK (true)`.
- La synchronisation fonctionne **en miroir complet** : à chaque connexion,
  l'appareil retélécharge l'intégralité des tables.

Conséquence concrète : **le téléphone d'un stagiaire détient une copie
complète des données réelles**, disponible hors ligne. Quelqu'un qui
contournerait l'interface (outil tiers, console du navigateur) pourrait
lire et écrire n'importe où.

Le verrou applicatif empêche les mélanges **accidentels** — c'est-à-dire
tout ce qui se produit dans l'usage normal, et c'est la totalité du risque
réel au quotidien. Il n'empêche pas une action **délibérée** menée hors de
l'application.

## Les deux façons de fermer ce dernier point

**Recommandation : l'option B.** Cette préconisation repose sur trois
constats propres à ce projet, vérifiés dans le code :

1. **La partie coûteuse de l'option B est déjà construite.**
   `api/sync-auth.js` est une fonction serveur Vercel qui détient déjà la
   clé `service_role`, lit déjà la fiche de l'utilisateur dans la table
   `users` (donc son drapeau `formation`) et crée déjà son compte
   d'authentification Supabase. Y poser la revendication d'espace est une
   modification de quelques lignes, au seul endroit qui en a le droit.
2. **Le mécanisme de calcul côté serveur existe aussi.** `updated_at` est
   déjà imposé par un déclencheur posé sur les dix-huit tables
   (`horodatage-serveur.sql`). La colonne `espace` se remplit exactement
   de la même manière — sans aucune modification du code d'envoi.
3. **L'option A contredit la façon de travailler retenue.** Basculer les
   comptes entre formation et réel, en masse puis un par un, n'a de sens
   que dans une base unique. Avec deux projets, il faudrait des comptes en
   double, deux adresses, deux installateurs Windows et deux routines de
   sauvegarde — et la bascule disparaîtrait purement et simplement.

L'option A reste le repli si l'option B s'avérait trop risquée à
déployer : elle est plus lourde à vivre, mais elle est imparable.

### Option A — deux projets Supabase distincts (repli)

Un second projet Supabase, avec sa propre URL et sa propre clé, réservé à
la formation. L'application de formation pointe dessus (variables
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).

- **Avantage** : la séparation devient physique. Aucune fuite possible,
  dans aucun sens, quel que soit le code. Les stagiaires n'ont jamais la
  moindre copie des données réelles sur leur appareil.
- **Coût** : un second projet à administrer, et un déploiement distinct
  (une seconde URL Vercel, ou un second raccourci Windows).
- **Effet de bord** : les comptes de formation cessent d'exister dans la
  base réelle — la bascule formation ↔ réel d'un compte n'a plus lieu
  d'être. C'est un changement d'organisation, pas seulement technique.

### Option B — une colonne d'espace en RLS (recommandée)

Trois pièces, dont deux calquées sur des mécanismes déjà en place :

1. **La revendication.** Dans `api/sync-auth.js`, à la création comme à la
   mise à jour du compte Auth, ajouter
   `app_metadata: { espace: champs.formation ? "formation" : "reel" }`.
   `app_metadata` fait partie du jeton et n'est modifiable qu'avec la clé
   `service_role` : un appareil ne peut donc pas se l'attribuer lui-même.
2. **La colonne.** Une colonne `espace` sur les tables portant une
   boutique, remplie par un déclencheur `BEFORE INSERT OR UPDATE` qui lit
   `data->>'boutique'` et le rapproche de la table `boutiques` — le même
   procédé que `horodatage_serveur`. Le code d'envoi n'est pas modifié :
   il continue d'envoyer `{ id, data, updated_at }`.
3. **La politique.** `espace = coalesce(auth.jwt() -> 'app_metadata' ->>
   'espace', 'reel')`. Le `coalesce` est essentiel : une session sans
   revendication doit retomber sur `reel`, jamais sur « rien ». Sans lui,
   un utilisateur dont le jeton date d'avant le déploiement ne verrait
   plus aucune donnée.

Effet secondaire majeur, et c'est le vrai gain : la synchronisation en
miroir ne descend plus que les lignes autorisées. **L'appareil d'un
stagiaire cesse de détenir une copie des données réelles**, au lieu de
simplement s'interdire d'y toucher.

#### Ordre de déploiement — il n'y a pas de base de test, la prudence est donc dans la procédure

| # | Action | Effet immédiat | Réversible |
|---|---|---|---|
| 1 | `espace-1-colonne.sql` | **Aucun** | Oui, bloc en fin de fichier |
| 2 | Déployer sur Vercel, faire reconnecter tout le monde | **Aucun** | Sans objet |
| 3 | `espace-2-verifier.sql` | **Aucun** — lecture seule | Sans objet |
| 4 | `espace-3-politiques.sql` avec `vague = 1` | 3 tables sans enjeu comptable | Oui, bloc en tête |
| 5 | *(une journée d'activité normale)* | | |
| 6 | Le même, avec `vague = 2` | Les 11 tables | Oui, même bloc |

**`espace-2-verifier.sql` remplace la base de test.** Il ne modifie rien,
se relance à volonté, et répond à la seule question qui compte : *qui
perdrait accès à quoi si je lançais l'étape suivante ?* Il termine par un
feu 🟢 / 🟡 / ⛔ — **tant qu'il affiche ⛔, on ne passe pas à l'étape 4.**

Le seul cas ⛔ possible est un compte **réel** portant par erreur la
revendication `formation` : c'est le seul qui perdrait quelque chose (sa
copie locale des vraies données ; le serveur, lui, garde tout). Il se
corrige en le faisant se reconnecter.

**Les deux vagues.** La vague 1 ne porte que sur `proformas`, `prospects`
et `commandes` — ni argent encaissé, ni stock, ni écriture remise au
comptable. Si quelque chose se passe mal, il ne se passe rien de grave, et
vous l'aurez appris sans rien risquer. La vague 2 contient la vague 1 : il
suffit de relancer le même script avec `vague = 2`.

#### Une protection à connaître, elle joue en votre faveur

`reconcilierMiroir` (voir `src/sync.js`) **ne s'exécute jamais tant que
l'appareil a des opérations en attente d'envoi**. Un poste qui a travaillé
hors ligne ne peut donc pas voir ses ventes du matin effacées par le
miroir : elles partent d'abord. Demandez tout de même à chacun de
synchroniser avant l'opération — c'est gratuit et ça ferme le sujet.

#### Les trois pièges à connaître

- **`users` doit rester lisible sans filtre d'espace.** C'est déjà le cas
  (`durcir_securite.sql`) : un appareil neuf doit pouvoir retrouver son
  compte pour se connecter. Cette table ne contient pas d'argent.
- **La revendication ne se rafraîchit qu'à la connexion.** Après une
  bascule, la personne doit se reconnecter pour que le serveur suive —
  l'application, elle, applique le changement immédiatement.
- **`reconcilierMiroir` supprime les lignes locales que le serveur ne
  renvoie plus.** C'est voulu, et c'est ce qui purge l'autre espace des
  appareils. Mais si une revendication était fausse, un utilisateur réel
  perdrait son cache local (les données restent intactes sur le serveur).
  D'où l'ordre de déploiement ci-dessus, qui vérifie les revendications
  avant d'activer quoi que ce soit.
- **Réglages rangés dans les fiches boutiques.** Le logo, le message du
  reçu, le taux de parrainage et la note de dimensionnement sont stockés
  sur les lignes `boutiques` (`tauxParrainageDefaut`, `noteDimensionnement`
  cherchent la première boutique qui porte le champ). Une fois les
  boutiques filtrées, il faut que ces réglages existent aussi sur une
  boutique de formation, sinon l'espace d'entraînement retombera sur les
  valeurs par défaut.

#### Les scripts, et leur banc d'essai

| Fichier | Rôle | Effet immédiat |
|---|---|---|
| `espace-1-colonne.sql` | Colonne, déclencheur, remplissage | **Aucun** — rien n'est restreint |
| `api/sync-auth.js` | Pose la revendication (déjà déployé dans le code) | **Aucun** tant que l'étape 3 n'est pas passée |
| `espace-3-politiques.sql` | La couche de cloisonnement | C'est ici que ça devient réel |

`bash scripts/tester-cloisonnement-sql.sh` monte un PostgreSQL local
jetable qui reproduit l'environnement Supabase (mêmes tables, mêmes rôles,
même `auth.jwt()`, mêmes politiques permissives de départ), y exécute les
deux scripts, vérifie le cloisonnement dans les deux sens, **puis rejoue
les blocs d'annulation extraits des fichiers eux-mêmes**. Aucun contact
avec votre base Supabase.

Ce qu'il établit, et qui a été constaté :

- le classement des lignes est correct, y compris « Chez le comptable » et
  TERRAIN, traités comme réels ;
- le remplissage de l'historique **ne fait pas remonter `updated_at`** —
  aucun appareil ne retéléchargera la base ;
- une session sans revendication se comporte comme un compte réel : jamais
  de blocage ;
- les écritures croisées sont refusées dans les deux sens, les écritures
  normales passent ;
- les politiques d'origine sont toujours là après l'étape 3 ;
- le bloc d'urgence rend l'accès complet immédiatement, et l'annulation de
  l'étape 1 ne touche à aucune donnée.

Cela ne remplace pas une exécution prudente sur votre base : lancez-les un
jour calme, dans l'ordre, en vérifiant entre chaque étape.
