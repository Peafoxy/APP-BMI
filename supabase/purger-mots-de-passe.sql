-- ══════════════════════════════════════════════════════════════════
-- PURGE DES MOTS DE PASSE EN CLAIR — table users (BMI Gestion, v2.99.43)
-- ══════════════════════════════════════════════════════════════════
--
-- POURQUOI : la table "users" doit rester lisible publiquement (un appareil
-- neuf doit pouvoir retrouver son compte pour se connecter — voir
-- durcir_securite.sql). Or les comptes créés avant le passage au hachage
-- gardent leur mot de passe EN CLAIR dans data->>'pwd' : n'importe qui
-- possédant la clé publique (visible dans le code du site) peut donc les
-- lire. Ce script retire ces mots de passe en clair — et les anciens
-- hachages faibles — SANS JAMAIS priver un compte de son dernier moyen de
-- connexion.
--
-- RÈGLES DE PURGE (prudentes par construction) :
--   • data - 'pwd'       : retiré SEULEMENT si un hachage existe déjà
--                          (pwd_hash OU pwd_hash2) — sinon on ne touche pas.
--   • data - 'pwd_hash'  : retiré SEULEMENT si le hachage FORT est présent
--                          (pwd_salt + pwd_hash2) — sinon on ne touche pas.
--   • Un compte "en clair seulement" (pwd sans aucun hachage) n'est JAMAIS
--     modifié : cette personne doit d'abord se reconnecter UNE FOIS (en
--     ligne) avec la version ≥ 2.99.43 — la connexion migre son compte au
--     hachage fort — puis vous relancez l'ÉTAPE 3. Le script est
--     réexécutable autant de fois que nécessaire, sans danger.
--   • updated_at = now() sur chaque ligne purgée : la modification se
--     propage ainsi à tous les appareils par la synchronisation normale.
--
-- MODE D'EMPLOI : Supabase → SQL Editor. Exécutez les étapes DANS L'ORDRE,
-- une par une (sélectionnez le bloc, Run). L'étape 3 ne se lance qu'après
-- avoir lu le résultat de l'étape 1 et vérifié dans l'application
-- (Paramètres → Sécurité → « 🔑 Format des mots de passe ») que les comptes
-- 🔴 « en clair » se sont reconnectés.
--
-- ══════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════
-- ÉTAPE 1 — CONTRÔLE : où en est chaque compte ? (ne modifie RIEN)
-- ══════════════════════════════════════════════════════════════════
-- Classement en 5 états :
--   🟢 FORT ET PROPRE   : hachage fort, aucun reste — rien à faire
--   👻 FORT AVEC RESTES : hachage fort + résidus pwd/pwd_hash — À PURGER
--   🟠 ANCIEN HACHAGE   : ancien hachage (faible) sans hachage fort
--                          → purge du clair possible, mais une reconnexion
--                            migrera le compte au format fort
--   🔴 EN CLAIR SEUL    : mot de passe en clair, AUCUN hachage
--                          → NON TOUCHÉ ; reconnexion obligatoire d'abord
--   ⚫ AUCUN MOYEN       : ni clair ni hachage — anomalie à examiner
SELECT
  id,
  data->>'nom'  AS nom,
  data->>'role' AS role,
  COALESCE(data->>'actif', 'true') AS actif,
  CASE
    WHEN data ? 'pwd_hash2' AND data ? 'pwd_salt'
         AND NOT data ? 'pwd' AND NOT data ? 'pwd_hash' THEN '🟢 FORT ET PROPRE'
    WHEN data ? 'pwd_hash2' AND data ? 'pwd_salt'       THEN '👻 FORT AVEC RESTES — à purger (étape 3)'
    WHEN data ? 'pwd_hash'                              THEN '🟠 ANCIEN HACHAGE' ||
         CASE WHEN data ? 'pwd' THEN ' + clair résiduel — le clair sera purgé (étape 3)' ELSE '' END
    WHEN data ? 'pwd'                                   THEN '🔴 EN CLAIR SEUL — NON touché : reconnexion requise d''abord'
    ELSE '⚫ AUCUN MOYEN DE CONNEXION — anomalie à examiner'
  END AS etat
FROM users
ORDER BY etat, data->>'nom';


-- ══════════════════════════════════════════════════════════════════
-- ÉTAPE 2 — SAUVEGARDE : copie intégrale AVANT toute purge
-- ══════════════════════════════════════════════════════════════════
-- Une ligne par exécution et par compte, horodatée : relancer le script
-- plus tard n'écrase jamais une sauvegarde précédente.
CREATE TABLE IF NOT EXISTS users_sauvegarde_avant_purge (
  sauvegarde_le timestamptz NOT NULL DEFAULT now(),
  id text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz
);

INSERT INTO users_sauvegarde_avant_purge (id, data, updated_at)
SELECT id, data, updated_at
FROM users
WHERE (data ? 'pwd'      AND (data ? 'pwd_hash' OR data ? 'pwd_hash2'))
   OR (data ? 'pwd_hash' AND  data ? 'pwd_hash2' AND data ? 'pwd_salt');

-- Vérification : combien de comptes viennent d'être sauvegardés ?
SELECT count(*) AS comptes_sauvegardes, max(sauvegarde_le) AS quand
FROM users_sauvegarde_avant_purge;


-- ══════════════════════════════════════════════════════════════════
-- ÉTAPE 3 — PURGE (réexécutable sans danger)
-- ══════════════════════════════════════════════════════════════════
-- 3a) Retirer le mot de passe EN CLAIR partout où un hachage existe déjà.
UPDATE users
SET data = data - 'pwd',
    updated_at = now()
WHERE data ? 'pwd'
  AND (data ? 'pwd_hash' OR data ? 'pwd_hash2');

-- 3b) Retirer l'ANCIEN hachage (faible) partout où le hachage FORT existe.
UPDATE users
SET data = data - 'pwd_hash',
    updated_at = now()
WHERE data ? 'pwd_hash'
  AND data ? 'pwd_hash2'
  AND data ? 'pwd_salt';


-- ══════════════════════════════════════════════════════════════════
-- ÉTAPE 4 — RE-CONTRÔLE : plus aucun 👻, plus aucun clair purgeable
-- ══════════════════════════════════════════════════════════════════
-- Attendu après l'étape 3 :
--   • zéro ligne « 👻 FORT AVEC RESTES »
--   • zéro ligne « 🟠 … + clair résiduel »
--   • les 🔴 restants sont EXACTEMENT les personnes qui ne se sont pas
--     encore reconnectées : faites-les se reconnecter, puis relancez
--     l'étape 3 (puis celle-ci).
SELECT
  CASE
    WHEN data ? 'pwd_hash2' AND data ? 'pwd_salt'
         AND NOT data ? 'pwd' AND NOT data ? 'pwd_hash' THEN '🟢 FORT ET PROPRE'
    WHEN data ? 'pwd_hash2' AND data ? 'pwd_salt'       THEN '👻 FORT AVEC RESTES (ne devrait plus exister)'
    WHEN data ? 'pwd_hash' AND data ? 'pwd'             THEN '🟠 ANCIEN + clair (ne devrait plus exister)'
    WHEN data ? 'pwd_hash'                              THEN '🟠 ANCIEN HACHAGE (reconnexion migrera au fort)'
    WHEN data ? 'pwd'                                   THEN '🔴 EN CLAIR SEUL (reconnexion requise, puis étape 3)'
    ELSE '⚫ AUCUN MOYEN DE CONNEXION'
  END AS etat,
  count(*) AS nombre,
  string_agg(data->>'nom', ', ' ORDER BY data->>'nom') AS comptes
FROM users
GROUP BY 1
ORDER BY 1;


-- ══════════════════════════════════════════════════════════════════
-- EN CAS DE PROBLÈME — RESTAURATION (à n'utiliser que si nécessaire)
-- ══════════════════════════════════════════════════════════════════
-- Restaure chaque compte sauvegardé dans l'état exact où il était AVANT la
-- toute première purge (la sauvegarde la plus ancienne de chaque compte),
-- et horodate à now() pour que la restauration se propage aussi par la
-- synchronisation. Retirez les « -- » des lignes ci-dessous pour l'exécuter.
--
-- UPDATE users u
-- SET data = s.data,
--     updated_at = now()
-- FROM (
--   SELECT DISTINCT ON (id) id, data
--   FROM users_sauvegarde_avant_purge
--   ORDER BY id, sauvegarde_le ASC
-- ) s
-- WHERE u.id = s.id;
--
-- Puis relancez l'ÉTAPE 1 pour vérifier l'état restauré.
