-- ═══════════════════════════════════════════════════════════════════
--  BMI-GESTIONS BOUTIQUES — REMISE À ZÉRO COMPLÈTE DE LA BASE
-- ═══════════════════════════════════════════════════════════════════
--
--  ⚠ AVANT DE LANCER CE SCRIPT :
--    1. Faites une sauvegarde  (⚙ Paramètres → Exporter une sauvegarde)
--    2. Cette opération est DÉFINITIVE. Supabase (plan gratuit) ne
--       conserve AUCUNE sauvegarde automatique : rien ne sera récupérable.
--
--  À exécuter dans : Supabase → SQL Editor → coller → Run
--
--  ⚠ LE POINT LE PLUS IMPORTANT :
--    Vider les tables NE SUFFIT PAS. Chaque téléphone et chaque PC garde
--    une copie locale des données. Sans le marqueur posé à l'étape 3,
--    le premier appareil qui se synchronise REPOUSSE tout sur le serveur,
--    et vos données réapparaissent.
-- ═══════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────
--  ÉTAPE 1 — Vider toutes les données d'exploitation
--  (les COMPTES UTILISATEURS sont conservés : sans eux,
--   plus personne ne pourrait se connecter)
-- ─────────────────────────────────────────────────────────────
truncate table
  ventes,
  depenses,
  dettes,
  produits,
  ajustements,
  clotures,
  fournisseurs,
  commerciaux,
  prospects,
  categories_prospects,
  commandes,
  messages,
  groupes,
  clients_installes,
  audits,
  boutiques;


-- ─────────────────────────────────────────────────────────────
--  ÉTAPE 2 — Nettoyer les certificats de suppression
--  (ils ne servent plus à rien : tout est vide)
-- ─────────────────────────────────────────────────────────────
truncate table tombstones;


-- ─────────────────────────────────────────────────────────────
--  ÉTAPE 3 — LE MARQUEUR (ne surtout pas l'oublier)
--  Chaque appareil qui le reçoit VIDE sa base locale et sa file
--  d'attente, au lieu de repousser ses vieilles données.
-- ─────────────────────────────────────────────────────────────
insert into tombstones (id, table_name, record_id, deleted_at)
values ('__RESET_GLOBAL__', '*', '__RESET_GLOBAL__', now());


-- ─────────────────────────────────────────────────────────────
--  ÉTAPE 4 (FACULTATIVE) — Effacer aussi les comptes,
--  SAUF l'administrateur. Ne décommentez que si vous voulez
--  repartir de zéro côté personnel.
--
--  ⚠ Remplacez 'ADMIN' par VOTRE identifiant exact,
--     sinon vous ne pourrez plus vous connecter du tout.
-- ─────────────────────────────────────────────────────────────
-- delete from users
-- where data->>'nom' <> 'ADMIN';


-- ─────────────────────────────────────────────────────────────
--  VÉRIFICATION — tout doit renvoyer 0 (sauf users)
-- ─────────────────────────────────────────────────────────────
select 'boutiques' as table, count(*) from boutiques
union all select 'produits',          count(*) from produits
union all select 'ventes',            count(*) from ventes
union all select 'depenses',          count(*) from depenses
union all select 'dettes',            count(*) from dettes
union all select 'ajustements',       count(*) from ajustements
union all select 'clotures',          count(*) from clotures
union all select 'fournisseurs',      count(*) from fournisseurs
union all select 'commerciaux',       count(*) from commerciaux
union all select 'prospects',         count(*) from prospects
union all select 'commandes',         count(*) from commandes
union all select 'messages',          count(*) from messages
union all select 'groupes',           count(*) from groupes
union all select 'clients_installes', count(*) from clients_installes
union all select 'audits',            count(*) from audits
union all select 'users (conservés)', count(*) from users;


-- ═══════════════════════════════════════════════════════════════════
--  APRÈS LE SCRIPT — LES 3 GESTES INDISPENSABLES
--
--  1. Sur VOTRE appareil : videz les données du site
--     Chrome → F12 → Application → Storage → « Clear site data »
--     (ou : Paramètres → Confidentialité → Effacer les données de navigation)
--
--  2. Sur CHAQUE téléphone / PC d'employé : ouvrir l'application une fois,
--     EN LIGNE. Le marqueur de l'étape 3 videra leur base automatiquement.
--     Tant qu'un appareil ne l'a pas fait, il garde une copie locale.
--
--  3. Reconnectez-vous et recréez vos boutiques :
--     ⚙ Paramètres → Ajouter une boutique
--
--  Sans l'étape 2, un seul appareil oublié suffit à tout ramener.
-- ═══════════════════════════════════════════════════════════════════
