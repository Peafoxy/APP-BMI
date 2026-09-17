-- ═══════════════════════════════════════════════════════════
-- securite-21-chef-technicien-bmi.sql — LE CHEF DES TECHNICIENS
-- ═══════════════════════════════════════════════════════════
-- Timo, 17/09/2026 : « ouvre le rôle technicien BMI ».
--
-- Le chef des techniciens de BMI est un SALARIÉ : le seul rôle qui lui
-- convienne est « technicien BMI ». Il peut désormais être nommé chef
-- d'équipe (⭐), et il reçoit les onglets 👑 Mon équipe et ✅ Mes tâches.
--
-- SANS ce script, l'application le laisserait assigner une tâche à l'un de
-- ses hommes et le SERVEUR refuserait l'écriture : le geste partirait, la
-- base dirait non, et TOUT le lot resterait coincé dans la file d'attente.
-- La liste des rôles de `a_pouvoir_taches()` doit dire la même chose que
-- ROLES_TACHES dans src/lib/calculs.js.
--
-- Ce script REPREND la fonction de securite-5 telle quelle et ajoute un
-- seul rôle. Rien d'autre ne bouge : le déclencheur `users_regles_comptes`
-- (securite-18) appelle cette fonction sans savoir ce qu'elle contient, et
-- `chef_equipe` est DÉJÀ dans sa liste « gestion » — nommer un chef reste
-- réservé à l'administrateur, comme avant. Le relancer deux fois est sans
-- danger.
-- ═══════════════════════════════════════════════════════════

-- Le pouvoir « tâches » : rôle qui l'a d'office, et pas retiré par l'admin
-- (l'étiquette pouvoirs_off est posée à la connexion depuis 2.101.51 ; sans
-- étiquette, on considère qu'aucun pouvoir n'a été retiré).
create or replace function public.a_pouvoir_taches()
returns boolean language sql stable set search_path = public as $$
  select public.role_jeton() in ('admin', 'resp_commercial', 'commercial', 'technicien', 'technicien_bmi')
     and not coalesce(auth.jwt() -> 'app_metadata' -> 'pouvoirs_off' ? 'act_taches', false);
$$;

-- ═════════════════════════════════════════════════
-- VÉRIFICATION — doit afficher : true | true
-- ═════════════════════════════════════════════════
select
  (select prosrc like '%technicien_bmi%' from pg_proc where proname = 'a_pouvoir_taches') as chef_technicien_bmi_reconnu,
  exists (select 1 from pg_trigger where tgrelid = 'public.users'::regclass
            and tgname = 'users_regles_comptes_trg') as declencheur_toujours_en_place;
