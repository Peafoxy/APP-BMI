-- ============================================================
-- L'HEURE DE LA BASE, LUE À CHAQUE SYNCHRONISATION (15/10/2026)
-- ============================================================
-- Timo : « pourquoi les synchronisations de chaque 20 secondes ne
-- peuvent pas lire l'heure au lieu d'attendre 10 min ? » → « oui lance ».
--
-- Une fonction qui ne fait QUE dire l'heure de la base. Elle ne lit
-- aucune table, n'écrit rien, ne connaît personne. L'application
-- l'appelle à chaque synchronisation (src/horloge.js, mesurerParLaBase)
-- pour recaler son heure : la base répond avec sa propre horloge, sans
-- relais qui garde une copie (le piège du 15/10 au matin, l'en-tête
-- « Age » de Vercel).
--
-- clock_timestamp() et non now() : now() est l'heure du DÉBUT de la
-- transaction ; clock_timestamp() est l'instant exact de la réponse.
--
-- Ouverte au visiteur non connecté aussi : une heure n'est pas une donnée
-- de BMI, et l'écran de connexion d'un appareil neuf peut s'en servir.
-- Relancer ce script est sans danger (create or replace).
-- ============================================================

create or replace function public.heure_serveur()
returns timestamptz
language sql
volatile
as $$ select clock_timestamp() $$;

revoke all on function public.heure_serveur() from public;
grant execute on function public.heure_serveur() to anon, authenticated, service_role;

-- Vérification : doit répondre true | true
select
  exists (select 1 from pg_proc where proname = 'heure_serveur') as fonction_en_place,
  abs(extract(epoch from (public.heure_serveur() - clock_timestamp()))) < 5 as heure_juste;
