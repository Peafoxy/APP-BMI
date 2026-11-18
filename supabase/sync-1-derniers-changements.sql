-- ============================================================
-- UN SEUL CONTRÔLE AU LIEU DE VINGT-HUIT LECTURES (18/11/2026)
-- ============================================================
-- Timo : « Log ingestion peut me conduire au mode payant ? » → les
-- journaux de Supabase étaient remplis à 90 % par la synchronisation :
-- à chaque passage, l'application interrogeait CHAQUE table (25 lectures
-- + l'heure), même quand rien n'avait changé.
--
-- Cette fonction répond à une seule question : « quelle est la dernière
-- modification de chaque table ? ». L'application ne relit une table que
-- si sa date a avancé (et, par prudence, au moins une fois toutes les
-- 10 minutes — la même marge qu'avant).
--
-- • Elle ne REND que des dates (en microsecondes), jamais une ligne.
-- • Elle ne modifie RIEN : lecture seule.
-- • SECURITY INVOKER : elle s'exécute avec les droits de la personne
--   connectée, donc avec les MÊMES règles de lecture (le mur formation /
--   réel, la paie, les conversations confiées…). Chaque appareil ne voit
--   que la date des lignes qu'il a le droit de lire — exactement ce que
--   sa synchronisation lisait déjà.
-- • Fermée au visiteur non connecté (anon).
-- • Une table absente ou illisible est simplement OMISE de la réponse :
--   l'application la lit alors comme avant.
-- Relancer ce script est sans danger (create or replace).
-- ============================================================

create or replace function public.dernieres_modifs()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  t text;
  v numeric;
  r jsonb := '{}'::jsonb;
begin
  foreach t in array array[
    'boutiques','users','produits','ventes','depenses','dettes','fournisseurs',
    'ajustements','clotures','commerciaux','audits','prospects',
    'categories_prospects','commandes','messages','clients_installes',
    'proformas','groupes','paie','rendez_vous'
  ] loop
    if to_regclass('public.' || t) is not null then
      begin
        execute format('select extract(epoch from max(updated_at)) * 1000000 from public.%I', t) into v;
        r := r || jsonb_build_object(t, v::bigint);
      exception when others then
        null; -- illisible pour ce compte : omise, l'application la lira comme avant
      end;
    end if;
  end loop;

  -- Les suppressions (faire-part) : leur date s'appelle deleted_at.
  if to_regclass('public.tombstones') is not null then
    begin
      select extract(epoch from max(deleted_at)) * 1000000 into v from public.tombstones;
      r := r || jsonb_build_object('tombstones', v::bigint);
    exception when others then
      null;
    end;
  end if;

  return r;
end
$$;

revoke all on function public.dernieres_modifs() from public;
revoke all on function public.dernieres_modifs() from anon;
grant execute on function public.dernieres_modifs() to authenticated, service_role;

-- Vérification : doit répondre true | true | true
select
  exists (select 1 from pg_proc where proname = 'dernieres_modifs') as fonction_en_place,
  not has_function_privilege('anon', 'public.dernieres_modifs()', 'execute') as fermee_au_visiteur,
  has_function_privilege('authenticated', 'public.dernieres_modifs()', 'execute') as ouverte_aux_comptes;
