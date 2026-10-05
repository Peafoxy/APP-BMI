-- Schéma Supabase pour BMI-Gestions Boutiques
-- À exécuter dans : Supabase -> SQL Editor -> New query -> coller -> Run

create table if not exists boutiques (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists boutiques_updated_at on boutiques (updated_at);

create table if not exists users (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists users_updated_at on users (updated_at);

create table if not exists produits (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists produits_updated_at on produits (updated_at);

create table if not exists ventes (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists ventes_updated_at on ventes (updated_at);

create table if not exists depenses (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists depenses_updated_at on depenses (updated_at);

create table if not exists dettes (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists dettes_updated_at on dettes (updated_at);

create table if not exists fournisseurs (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists fournisseurs_updated_at on fournisseurs (updated_at);

create table if not exists ajustements (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists ajustements_updated_at on ajustements (updated_at);

create table if not exists clotures (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists clotures_updated_at on clotures (updated_at);

create table if not exists commerciaux (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists commerciaux_updated_at on commerciaux (updated_at);

-- Journal des suppressions (pour les propager aux autres appareils)
create table if not exists tombstones (
  id text primary key,
  table_name text not null,
  record_id text not null,
  deleted_at timestamptz not null default now()
);
create index if not exists tombstones_deleted_at on tombstones (deleted_at);

-- Politiques d'accès : ouvertes à la clé anon (usage interne privé).
-- ⚠ Ne partagez jamais votre clé anon publiquement.
-- Pour plus de sécurité, vous pourrez plus tard ajouter Supabase Auth
-- et restreindre ces politiques.

alter table boutiques enable row level security;
drop policy if exists "acces_total_boutiques" on boutiques;
create policy "acces_total_boutiques" on boutiques for all using (true) with check (true);

alter table users enable row level security;
drop policy if exists "acces_total_users" on users;
create policy "acces_total_users" on users for all using (true) with check (true);

alter table produits enable row level security;
drop policy if exists "acces_total_produits" on produits;
create policy "acces_total_produits" on produits for all using (true) with check (true);

alter table ventes enable row level security;
drop policy if exists "acces_total_ventes" on ventes;
create policy "acces_total_ventes" on ventes for all using (true) with check (true);

alter table depenses enable row level security;
drop policy if exists "acces_total_depenses" on depenses;
create policy "acces_total_depenses" on depenses for all using (true) with check (true);

alter table dettes enable row level security;
drop policy if exists "acces_total_dettes" on dettes;
create policy "acces_total_dettes" on dettes for all using (true) with check (true);

alter table fournisseurs enable row level security;
drop policy if exists "acces_total_fournisseurs" on fournisseurs;
create policy "acces_total_fournisseurs" on fournisseurs for all using (true) with check (true);

alter table ajustements enable row level security;
drop policy if exists "acces_total_ajustements" on ajustements;
create policy "acces_total_ajustements" on ajustements for all using (true) with check (true);

alter table clotures enable row level security;
drop policy if exists "acces_total_clotures" on clotures;
create policy "acces_total_clotures" on clotures for all using (true) with check (true);

alter table commerciaux enable row level security;
drop policy if exists "acces_total_commerciaux" on commerciaux;
create policy "acces_total_commerciaux" on commerciaux for all using (true) with check (true);

alter table tombstones enable row level security;
drop policy if exists "acces_total_tombstones" on tombstones;
create policy "acces_total_tombstones" on tombstones for all using (true) with check (true);

-- v2 : journal d'audit
create table if not exists audits (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists audits_updated_at on audits (updated_at);
alter table audits enable row level security;
drop policy if exists "acces_total_audits" on audits;
create policy "acces_total_audits" on audits for all using (true) with check (true);

-- v3 : prospection commerciale
create table if not exists prospects (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists prospects_updated_at on prospects (updated_at);
alter table prospects enable row level security;
drop policy if exists "acces_total_prospects" on prospects;
create policy "acces_total_prospects" on prospects for all using (true) with check (true);

create table if not exists categories_prospects (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists categories_prospects_updated_at on categories_prospects (updated_at);
alter table categories_prospects enable row level security;
drop policy if exists "acces_total_categories_prospects" on categories_prospects;
create policy "acces_total_categories_prospects" on categories_prospects for all using (true) with check (true);

-- v4 : commandes des commerciaux (à valider par un vendeur avant encaissement)
create table if not exists commandes (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists commandes_updated_at on commandes (updated_at);
alter table commandes enable row level security;
drop policy if exists "acces_authentifie_commandes" on commandes;
create policy "acces_authentifie_commandes" on commandes for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- v5 : messagerie interne (messages en différé)
create table if not exists messages (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists messages_updated_at on messages (updated_at);
alter table messages enable row level security;
drop policy if exists "acces_total_messages" on messages;
create policy "acces_total_messages" on messages for all using (true) with check (true);

-- v5 : fiches des clients installés (parc client)
create table if not exists clients_installes (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists clients_installes_updated_at on clients_installes (updated_at);
alter table clients_installes enable row level security;
drop policy if exists "acces_total_clients_installes" on clients_installes;
create policy "acces_total_clients_installes" on clients_installes for all using (true) with check (true);

create table if not exists proformas (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists proformas_updated_at on proformas (updated_at);

-- v7 : groupes de discussion (créés par l'admin, membres choisis)
create table if not exists groupes (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists groupes_updated_at on groupes (updated_at);
alter table groupes enable row level security;
drop policy if exists "acces_total_groupes" on groupes;
create policy "acces_total_groupes" on groupes for all using (true) with check (true);
