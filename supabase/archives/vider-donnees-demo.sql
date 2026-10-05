-- ============================================================
-- NETTOYAGE DES DONNÉES DE DÉMO — avant mise en production
-- ============================================================
-- À utiliser UNE SEULE FOIS, juste avant de construire (npm install /
-- npm run build) et de déployer pour de vrai. Vide toutes les tables
-- de données sur Supabase. Ne touche PAS aux comptes d'authentification
-- (auth.users) — voir la note à la fin pour ça.
--
-- ⚠ Cette opération est IRRÉVERSIBLE. Vérifiez bien que c'est de la
-- démo et pas de vraies données avant de lancer.
--
-- À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

TRUNCATE TABLE
  public.boutiques,
  public.users,
  public.produits,
  public.ventes,
  public.depenses,
  public.dettes,
  public.fournisseurs,
  public.ajustements,
  public.clotures,
  public.commerciaux,
  public.audits,
  public.prospects,
  public.categories_prospects,
  public.commandes,
  public.messages,
  public.clients_installes,
  public.proformas,
  public.groupes,
  public.tombstones;

-- ============================================================
-- NOTE 1 — Comptes d'authentification (connexion réelle)
-- ============================================================
-- Les comptes de démo créés dans Supabase Auth (adresses du type
-- identifiant@bmi.internal) ne sont PAS supprimés par ce script — ils
-- vivent dans un schéma séparé (auth.users) que Supabase gère à part.
-- Pour les supprimer : Supabase → Authentication → Users → sélectionner
-- tout → Delete. Quelques clics, plus sûr que de le faire en SQL.
--
-- ============================================================
-- NOTE 2 — Sur CHAQUE appareil/navigateur qui a servi pour la démo
-- ============================================================
-- La base locale (IndexedDB) de chaque poste garde encore les données
-- de démo tant qu'on ne la vide pas. Si un poste ayant des données non
-- encore synchronisées se reconnecte après ce nettoyage, il risque de
-- RENVOYER ses données de démo vers Supabase.
-- Sur chaque poste utilisé pour la démo, avant la remise en production :
--   - Le plus simple : dans les paramètres du navigateur (ou d'Electron),
--     effacer les données du site / vider le stockage local.
--   - Ou, si le poste doit continuer à servir : ouvrir l'app, écran
--     Paramètres → vérifier qu'il n'y a plus rien "à envoyer" avant de
--     lancer ce script, pour être sûr qu'aucun envoi ne reparte après.
-- ============================================================
