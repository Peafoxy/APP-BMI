# BMI-Gestions Boutiques — Application installable avec mode hors ligne

Application de gestion des boutiques DEMAKPOE et APESSITO, conçue pour
fonctionner **même sans connexion internet** :

- Toutes les données sont enregistrées dans une **base locale** sur l'appareil
  (IndexedDB) — les ventes, dépenses, dettes, stocks, etc. s'enregistrent
  instantanément, avec ou sans réseau.
- Dès que la connexion revient, les modifications en attente sont
  **synchronisées automatiquement avec Supabase** (toutes les 20 secondes,
  et à chaque enregistrement).
- Les modifications faites sur les autres appareils (autre vendeur, admin)
  sont récupérées automatiquement.
- Deux façons de l'installer :
  - **Application Windows (.exe)** via Electron — installateur classique à
    double-cliquer, icône BMI sur le Bureau (voir section 4 bis) ;
  - **PWA** installable depuis le navigateur — pratique pour les téléphones
    des vendeurs (voir section 6).

L'en-tête affiche l'état en permanence : 🟢 En ligne / 🔌 Hors ligne,
avec le nombre de modifications en attente d'envoi.

---

## 1. Prérequis

- Node.js 18 ou plus récent : https://nodejs.org
- Un compte Supabase (gratuit) : https://supabase.com

## 2. Créer la base Supabase

1. Créez un projet sur https://supabase.com/dashboard
2. Ouvrez **SQL Editor** → **New query**
3. Copiez tout le contenu du fichier `supabase/schema.sql` et cliquez **Run**
4. Allez dans **Settings → API** et notez :
   - **Project URL** (ex : `https://abcd1234.supabase.co`)
   - **anon public key**

## 3. Configurer le projet

```bash
# dans le dossier du projet
cp .env.example .env
```

Ouvrez `.env` et remplissez :

```
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre_cle_anon
```

> Sans fichier `.env`, l'application fonctionne quand même, mais en mode
> 100 % local (aucune synchronisation entre appareils).

## 4. Lancer en développement

```bash
npm install
npm run dev          # version navigateur (http://localhost:5173)
npm run electron:dev # version application de bureau (fenêtre Windows)
```

## 4 bis. Créer l'installateur Windows (.exe)

⚠ Important : remplissez d'abord le fichier `.env` (étape 3), car les
identifiants Supabase sont intégrés dans l'application au moment de la
construction.

Sur un PC Windows :

```bash
npm install
npm run dist
```

À la fin, l'installateur se trouve dans le dossier `release/` :

```
release/BMI-Gestions Boutiques Setup 1.0.0.exe
```

Copiez ce fichier (clé USB, WhatsApp...) sur chaque machine et
double-cliquez pour installer. L'application apparaît sur le Bureau et
dans le menu Démarrer avec l'icône BMI, et fonctionne **entièrement hors
ligne** : la synchronisation Supabase se fait automatiquement dès qu'une
connexion est détectée.

> Windows SmartScreen peut afficher un avertissement au premier lancement
> (application non signée). Cliquez sur « Informations complémentaires »
> puis « Exécuter quand même ». La signature de code est payante et
> facultative pour un usage interne.

> Pour mettre à jour l'application plus tard : changez `version` dans
> `package.json`, relancez `npm run dist` et réinstallez le nouveau .exe
> (les données locales sont conservées).

## 5. Déployer sur Vercel

1. Poussez le projet sur GitHub
2. Sur https://vercel.com : **New Project** → importez le dépôt
3. Dans **Environment Variables**, ajoutez `VITE_SUPABASE_URL` et
   `VITE_SUPABASE_ANON_KEY`
4. **Deploy** — Vercel détecte Vite automatiquement

## 6. Installer l'application sur les machines

Une fois le site déployé (ou en local) :

- **PC (Chrome / Edge)** : ouvrez le site → cliquez sur l'icône
  **« Installer »** dans la barre d'adresse (ou menu ⋮ → *Installer
  l'application*). L'app apparaît dans le menu Démarrer avec l'icône BMI.
- **Android (Chrome)** : menu ⋮ → **« Ajouter à l'écran d'accueil »** /
  **« Installer l'application »**.
- **iPhone (Safari)** : bouton Partager → **« Sur l'écran d'accueil »**.

Après la première visite, l'application s'ouvre et fonctionne **même sans
internet** (les fichiers sont mis en cache sur l'appareil).

## 7. Comment fonctionne la synchronisation

```
  Vendeur (hors ligne)                    Supabase                 Admin
  ────────────────────                    ────────                 ─────
  Vente enregistrée ──► base locale
                        + journal d'envoi
  ... connexion revient ...
  journal d'envoi ─────────────────────►  tables ◄──────────────── lit/écrit
  récupère les nouveautés ◄─────────────  tables
```

- Chaque enregistrement porte une date de modification (`updated_at`).
- En cas de conflit (même fiche modifiée sur 2 appareils hors ligne),
  **la modification la plus récente gagne**.
- Les suppressions sont propagées via la table `tombstones`.
- Rien n'est jamais perdu tant que l'appareil n'a pas envoyé son journal :
  le badge « X en attente » indique ce qui reste à envoyer.

## 8. Sécurité — à savoir

- Les politiques SQL fournies donnent un accès complet à toute personne
  possédant la clé `anon`. C'est acceptable pour un usage interne privé,
  mais **ne publiez jamais cette clé** en dehors de l'équipe.
- Les mots de passe des utilisateurs de l'app (admin/vendeurs) sont un
  contrôle d'accès *interne à l'application*, pas une sécurité forte.
- Évolution recommandée plus tard : Supabase Auth + politiques RLS par rôle.

## 9. Données de démonstration

Au premier lancement, l'application contient des données d'exemple
(produits, ventes, comptes de démonstration). Comptes :

| Utilisateur        | Mot de passe   |
|--------------------|----------------|
| Administrateur     | ADMIN2026      |
| Vendeur DEMAKPOE   | DEMAKPOE-2026  |
| Vendeur APESSITO   | APESSITO-2026  |

⚠ Changez ces mots de passe dès la mise en service (onglet Utilisateurs),
et supprimez les ventes/produits de démonstration.
