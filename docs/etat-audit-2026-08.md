# Suites de l'audit du 29/08/2026 — état au 06/09/2026

Déplacé de CLAUDE.md le 06/09/2026, mot pour mot. Les constats graves sont TOUS fermés ; on garde la trace pour ne pas les rouvrir.

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
   ⚠ Sauf ceci : le déclencheur plantait sur une vente **sans** apporteur
   (« cannot delete from scalar ») — toute signature de PV sans parrain était
   refusée par le serveur. Trouvé le 31/08/2026 par le banc de l'étape 3 (le
   banc d'écriture ne testait que des ventes AVEC apporteur). Corrigé dans le
   fichier `client-2` et posé sur la vraie base via le collage de `client-4`.
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
connecté. **22 sur 22 depuis la 2.101.54** : le dernier trou (un employé qui
écrivait `salaire_base` dans `users.data`) est fermé par
`securite-5-comptes.sql`, que le banc charge désormais.

⚠ **Leçon du 29/08/2026 : un banc qui lit mal est pire qu'un banc absent.**
Celui-ci décidait « accepté / refusé » en lisant la dernière ligne de psql —
or psql annonce « SET » pour chaque commande réussie, et ces « SET » étaient
pris pour un résultat. Toutes les portes fermées par un déclencheur étaient
annoncées grandes ouvertes, et j'ai alerté Timo à tort. On ne lit plus la
sortie : on regarde si la base a levé une objection.


- ~~Un employé peut encore écrire `salaire_base` dans `users.data`~~ — fermé
  par `securite-5-comptes.sql` (vague 3, étape 3), collé par Timo le
  05/09/2026.

- Les trois scripts d'hygiène (`avis-supabase-0`, `securite-1-audits-
  et-tombstones`, `avis-supabase-1-search-path`) ont TOUS été collés par
  Timo le 31/08/2026 : journal cloisonné (14 tables, 93 lignes réelles /
  2 formation), tombstones fermées aux anonymes, chemin de recherche figé
  sur TOUTES les fonctions (site vitrine compris). Plus rien en attente
  côté hygiène serveur.

- **La base Supabase héberge TROIS projets** (vu sur l'état des lieux du
  31/08/2026) : BMI-Gestion, le site vitrine bmitogo.com (galerie, kits,
  realisations, temoignages, contenu_site, produit_*, commandes_en_ligne,
  demandes_devis, messages_contact — leurs règles « lecture publique » et
  « depot public » sont VOULUES, ne pas les fermer), et un projet WIFI
  (~18 tables `wifi_*`, RLS actif sans aucune règle : verrouillées ;
  demander à Timo si cette app tourne encore avant d'y toucher).
  ⚠ Les règles `acces_authentifie_*` affichent le profil {public} mais
  exigent `auth.role() = 'authenticated'` : pas des portes.
  Les deux SEULES vraies portes publiques trouvées (`groupes_all`,
  `proformas_all`, condition true, toutes actions) ont été fermées par
  Timo le 31/08/2026 (drop policy).
