\set ON_ERROR_STOP on
\pset pager off
\t on

-- Jeu de rôle : on se met dans la peau d'un poste connecté.
create or replace function public.incarner(espace text) returns void language plpgsql as $$
begin
  if espace is null then
    perform set_config('request.jwt.claims', '{"role":"authenticated"}', false);
  else
    perform set_config('request.jwt.claims',
      json_build_object('role','authenticated','app_metadata', json_build_object('espace', espace))::text, false);
  end if;
  execute 'set role authenticated';
end $$;
create or replace function public.redevenir_admin() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims','',false); end $$;

\echo '--- classement calculé par l étape 1 ---'
select 'ventes ' || id || ' -> ' || coalesce(espace,'(non classé)') from public.ventes order by id;
select 'depenses ' || id || ' -> ' || coalesce(espace,'(non classé)') from public.depenses order by id;
select 'boutiques ' || id || ' -> ' || coalesce(espace,'(non classé)') from public.boutiques order by id;
select 'prospects ' || id || ' -> ' || coalesce(espace,'(non classé)') from public.prospects order by id;
select 'chantiers ' || id || ' -> ' || coalesce(espace,'(non classé)') from public.clients_installes order by id;

\echo ''
\echo '--- updated_at a-t-il ete touche par le remplissage ? ---'
select case when max(updated_at) < (select valeur from public.temoin) + interval '1 second'
            then 'NON — aucun appareil ne retelechargera la base'
            else 'OUI — PROBLEME : updated_at a bouge' end
from (select updated_at from public.ventes union all select updated_at from public.depenses
      union all select updated_at from public.produits union all select updated_at from public.boutiques) x;

\echo ''
\echo '=== COMPTE REEL ==='
select public.incarner('reel');
select 'ventes visibles : ' || string_agg(id, ', ' order by id) from public.ventes;
select 'depenses visibles : ' || string_agg(id, ', ' order by id) from public.depenses;
select 'boutiques visibles : ' || string_agg(data->>'nom', ', ' order by id) from public.boutiques;
select 'chantiers visibles : ' || string_agg(id, ', ' order by id) from public.clients_installes;
select public.redevenir_admin();

\echo ''
\echo '=== COMPTE FORMATION ==='
select public.incarner('formation');
select 'ventes visibles : ' || coalesce(string_agg(id, ', ' order by id), '(aucune)') from public.ventes;
select 'depenses visibles : ' || coalesce(string_agg(id, ', ' order by id), '(aucune)') from public.depenses;
select 'boutiques visibles : ' || coalesce(string_agg(data->>'nom', ', ' order by id), '(aucune)') from public.boutiques;
select 'chantiers visibles : ' || coalesce(string_agg(id, ', ' order by id), '(aucun)') from public.clients_installes;
select public.redevenir_admin();

\echo ''
\echo '=== SESSION SANS REVENDICATION (jeton anterieur au deploiement) ==='
select public.incarner(null);
select 'ventes visibles : ' || string_agg(id, ', ' order by id) || '  (doit valoir le compte REEL)' from public.ventes;
select public.redevenir_admin();

\echo ''
\echo '=== ECRITURES CROISEES ==='
select public.incarner('formation');
\echo 'stagiaire -> vente sur une VRAIE boutique (doit etre REFUSEE) :'
do $$ begin
  insert into public.ventes (id, data) values ('vX', '{"boutique":"APESSITO"}');
  raise exception 'ECHEC DU TEST : l ecriture est passee';
exception
  when insufficient_privilege then raise notice 'refusee (correct)';
  when others then if sqlstate = '42501' then raise notice 'refusee (correct)'; else raise; end if;
end $$;
\echo 'stagiaire -> depense sur la caisse du comptable (doit etre REFUSEE) :'
do $$ begin
  insert into public.depenses (id, data) values ('eX', '{"boutique":"Chez le comptable","montant":1}');
  raise exception 'ECHEC DU TEST : l ecriture est passee';
exception when others then
  if sqlstate = '42501' then raise notice 'refusee (correct)'; else raise; end if;
end $$;
\echo 'stagiaire -> vente sur SA boutique de formation (doit PASSER) :'
insert into public.ventes (id, data) values ('vF', '{"boutique":"APESSITO FORMATION"}');
select 'ecrite, classee : ' || espace from public.ventes where id = 'vF';
\echo 'stagiaire -> modifier une VRAIE vente (doit etre sans effet : elle lui est invisible) :'
update public.ventes set data = data || '{"pirate":true}' where id = 'v1';
select 'lignes reellement modifiees : ' || count(*)::text from public.ventes where data ? 'pirate';
select public.redevenir_admin();

select public.incarner('reel');
\echo 'compte reel -> vente sur une boutique de FORMATION (doit etre REFUSEE) :'
do $$ begin
  insert into public.ventes (id, data) values ('vY', '{"boutique":"APESSITO FORMATION"}');
  raise exception 'ECHEC DU TEST : l ecriture est passee';
exception when others then
  if sqlstate = '42501' then raise notice 'refusee (correct)'; else raise; end if;
end $$;
\echo 'compte reel -> vente sur SA boutique (doit PASSER) :'
insert into public.ventes (id, data) values ('vR', '{"boutique":"APESSITO"}');
select 'ecrite, classee : ' || espace from public.ventes where id = 'vR';
select public.redevenir_admin();

\echo ''
\echo '=== LA CLE service_role RESTE TOUJOURS MAITRESSE (voie de secours) ==='
set role service_role;
select 'ventes vues par service_role : ' || count(*)::text || ' (toutes)' from public.ventes;
reset role;

\echo ''
\echo '=== LES POLITIQUES D ORIGINE SONT-ELLES INTACTES ? ==='
select tablename || ' : ' || policyname || ' (' || permissive || ')'
from pg_policies where schemaname='public' and tablename in ('ventes','boutiques')
order by tablename, permissive desc, policyname;
