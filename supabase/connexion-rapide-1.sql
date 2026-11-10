-- ============================================================
-- LA CONNEXION RAPIDE — RETROUVER LE COMPTE SÉCURISÉ DIRECTEMENT (10/11/2026)
-- ============================================================
-- Timo : « faire en sorte que la connexion dure à peine 2 secondes sans
-- rien casser côté sécurité » → « les 4… si un souci se passe à l'usage,
-- on revient à la vieille méthode ».
--
-- À chaque connexion, le serveur (api/_compteSecurise.js) doit retrouver le
-- compte sécurisé de la personne (adresse « identifiant@bmi.internal »).
-- L'outil que Supabase donne au serveur ne sait pas chercher une adresse :
-- il lisait la liste des comptes par paquets de 1 000. Cette fonction pose
-- UNE question à la base : « quel compte porte cette adresse ? ».
--
-- ⚠ SÉCURITÉ :
--   • seul le SERVEUR (clé de service, chez Vercel) peut l'appeler — ni un
--     visiteur, ni un compte connecté, ni un téléphone ;
--   • elle ne rend qu'un numéro de compte : ni mot de passe, ni rôle ;
--   • elle ne modifie rien ;
--   • search_path vide : elle ne lit que auth.users, rien ne peut s'y glisser.
-- ⚠ La vieille méthode reste : si cette fonction est absente ou ne répond
--   pas, le serveur relit la liste comme avant. Personne n'est bloqué.
-- Relancer ce script est sans danger (create or replace).
-- ============================================================

create or replace function public.compte_securise_par_email(adresse text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u
  where lower(u.email) = lower(adresse)
  limit 1
$$;

revoke all on function public.compte_securise_par_email(text) from public;
revoke all on function public.compte_securise_par_email(text) from anon, authenticated;
grant execute on function public.compte_securise_par_email(text) to service_role;

-- Vérification : doit répondre true | true | true
select
  exists (select 1 from pg_proc where proname = 'compte_securise_par_email') as fonction_en_place,
  not has_function_privilege('anon', 'public.compte_securise_par_email(text)', 'execute') as visiteur_refuse,
  not has_function_privilege('authenticated', 'public.compte_securise_par_email(text)', 'execute') as connecte_refuse;
