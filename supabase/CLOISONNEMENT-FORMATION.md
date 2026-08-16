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

### Option A — deux projets Supabase distincts (recommandée)

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

### Option B — une colonne d'espace en RLS

Ajouter une colonne `espace` aux tables concernées et une politique RLS qui
la compare à une revendication (*claim*) portée par la session Supabase de
l'utilisateur.

- **Avantage** : une seule base, la bascule d'un compte reste possible.
- **Coût réel** : il faut poser la revendication sur chaque compte Auth
  (fonction d'administration ou déclencheur), la maintenir à chaque
  bascule, et remplir `espace` sur l'historique existant. Une politique
  mal posée **bloque tous les appareils en écriture** — c'est exactement ce
  qui s'est produit lors d'une tentative de durcissement précédente (voir
  l'avertissement en tête de `durcir_securite.sql`).
- **À ne pas tenter** sans un projet Supabase de test et une fenêtre calme.

Aucun script n'est fourni ici pour l'option B : le publier sans avoir pu
l'éprouver sur la vraie base serait plus dangereux que le problème qu'il
corrige.
