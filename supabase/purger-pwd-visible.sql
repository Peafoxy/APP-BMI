-- ============================================================
-- PURGE DES MOTS DE PASSE EN CLAIR — champ pwd_visible
-- ============================================================
-- ⚠ À EXÉCUTER APRÈS avoir mis en ligne la version ≥ 2.100.32.
--
-- POURQUOI : la table « users » est volontairement lisible par tout le
-- monde — un appareil neuf doit pouvoir retrouver son compte pour se
-- connecter (voir le cas particulier dans durcir_securite.sql). Or la clé
-- qui permet cette lecture est visible dans le code du site. Tout ce qui
-- se trouve dans cette table est donc PUBLIC.
--
-- Le champ `pwd_visible` y conservait le mot de passe EN CLAIR, pour
-- alimenter le bouton « 👁 Voir ». N'importe quel visiteur pouvait donc
-- télécharger tous les mots de passe, celui de l'administrateur principal
-- compris.
--
-- C'est EXACTEMENT le défaut déjà corrigé en 2.99.43 pour l'ancien champ
-- `pwd` (purger-mots-de-passe.sql). `pwd_visible`, ajouté ensuite, le
-- réintroduisait — et ce script-là ne le nettoie pas.
--
-- SANS DANGER : `pwd_visible` n'a JAMAIS servi à se connecter. La
-- connexion s'appuie uniquement sur `pwd_salt` + `pwd_hash2` (PBKDF2,
-- 150 000 tours), qui ne sont pas touchés. Personne ne perd son accès.
--
-- À exécuter dans Supabase → SQL Editor → coller → Run.
--
-- ⚠ NOTE D'ÉCRITURE : on écrit ici jsonb_exists(data, 'pwd_visible') et non
-- data ? 'pwd_visible'. Les deux font la même chose, mais l'éditeur SQL de
-- Supabase prend parfois le « ? » pour un emplacement de paramètre et
-- renvoie une erreur de syntaxe. jsonb_exists() passe toujours.
-- ============================================================

-- ─── ÉTAPE 1 : combien de comptes sont concernés ? (lecture seule) ───
select count(*) as comptes_avec_mot_de_passe_en_clair
from public.users
where jsonb_exists(data, 'pwd_visible');

-- ─── ÉTAPE 2 : la purge ───
-- `updated_at` remonte volontairement : la correction se propage ainsi à
-- tous les appareils par la synchronisation normale.
update public.users
set data = data - 'pwd_visible',
    updated_at = now()
where jsonb_exists(data, 'pwd_visible');

-- ─── ÉTAPE 3 : vérification — doit renvoyer 0 ───
select count(*) as reste_a_purger
from public.users
where jsonb_exists(data, 'pwd_visible');

-- ============================================================
-- PAS DE RETOUR EN ARRIÈRE, ET C'EST VOULU
-- ============================================================
-- Ce script supprime un secret qui n'aurait jamais dû être stocké.
-- Le rétablir reviendrait à rouvrir la faille. Si vous devez redonner un
-- accès à quelqu'un : 👥 Utilisateurs → « Mot de passe » → attribuez-lui
-- en un nouveau. C'est la seule manière, désormais.
