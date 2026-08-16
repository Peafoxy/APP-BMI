-- Reproduit l'environnement Supabase de BMI : mêmes tables (id, data jsonb,
-- updated_at), mêmes rôles, même auth.jwt(), même déclencheur d'horodatage,
-- et les politiques permissives telles que durcir_securite.sql les pose.
create schema if not exists auth;
-- Supabase accorde ces droits par defaut ; on les reproduit.

do $$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if;
end $$;
grant usage on schema auth to authenticated, anon, service_role;

-- auth.jwt() : exactement l'implémentation Supabase.
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', current_setting('role', true));
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'boutiques','users','produits','ventes','depenses','dettes','fournisseurs',
    'ajustements','clotures','commerciaux','audits','prospects',
    'categories_prospects','commandes','messages','clients_installes',
    'proformas','groupes'
  ]
  loop
    execute format('create table public.%I (id text primary key, data jsonb, updated_at timestamptz default now());', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated, anon, service_role;', t);
    -- horodatage-serveur.sql
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy "acces_authentifie_%s" on public.%I for all '
      'using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'');', t, t);
  end loop;
end $$;

create or replace function public.horodatage_serveur() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array[
    'boutiques','users','produits','ventes','depenses','dettes','fournisseurs',
    'ajustements','clotures','commerciaux','audits','prospects',
    'categories_prospects','commandes','messages','clients_installes',
    'proformas','groupes'
  ]
  loop
    execute format('create trigger horodatage_serveur_trg before insert or update on public.%I for each row execute function public.horodatage_serveur();', t);
  end loop;
end $$;

-- ---- Données : deux boutiques réelles, une de formation, un dépôt de chaque
insert into public.boutiques (id, data) values
  ('b1', '{"nom":"APESSITO"}'),
  ('b2', '{"nom":"HEDZRANAWOE"}'),
  ('b3', '{"nom":"APESSITO FORMATION","formation":true}'),
  ('d1', '{"nom":"DEPOT","depot":true}'),
  ('d2', '{"nom":"DEPOT FORMATION","depot":true,"formation":true}'),
  ('bt', '{"nom":"TERRAIN","terrain":true}');

insert into public.ventes (id, data) values
  ('v1', '{"boutique":"APESSITO","client":"VRAI CLIENT"}'),
  ('v2', '{"boutique":"APESSITO FORMATION","client":"ESSAI"}');

insert into public.depenses (id, data) values
  ('e1', '{"boutique":"APESSITO","montant":1000}'),
  ('e2', '{"boutique":"APESSITO FORMATION","montant":999999}'),
  ('e3', '{"boutique":"Chez le comptable","montant":5000}');

insert into public.dettes (id, data) values
  ('t1', '{"boutique":"APESSITO","client":"X"}');

insert into public.produits (id, data) values
  ('p1', '{"boutique":"DEPOT","nom":"Panneau 550W"}'),
  ('p2', '{"boutique":"DEPOT FORMATION","nom":"Panneau 550W"}');

insert into public.prospects (id, data) values
  ('q1', '{"nom":"VRAI PROSPECT"}'),
  ('q2', '{"nom":"PROSPECT ESSAI","formation":true}');

-- Chantiers : un rattaché à une vraie vente, un à une vente de formation,
-- un orphelin (ni vente ni dette retrouvable) — le cas « non classé ».
-- Témoin : sert à vérifier que le remplissage de l'étape 1 n'a pas
-- fait remonter updated_at (voir verifier.sql).
create table public.temoin as select now() as valeur;

insert into public.clients_installes (id, data) values
  ('c1', '{"nom":"CHANTIER REEL","vente_id":"v1"}'),
  ('c2', '{"nom":"CHANTIER ESSAI","vente_id":"v2"}'),
  ('c3', '{"nom":"CHANTIER ORPHELIN"}');
