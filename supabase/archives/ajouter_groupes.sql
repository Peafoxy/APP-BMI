-- ═══════════════════════════════════════════════════════════════
-- AJOUT DE LA TABLE groupes (groupes de discussion internes)
-- À exécuter UNE SEULE FOIS dans Supabase → SQL Editor.
-- Sans elle, la synchronisation échoue avec « Could not find the table groupes ».
-- ═══════════════════════════════════════════════════════════════

create table if not exists groupes (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists groupes_updated_at on groupes (updated_at);

-- Accès ouvert (même politique que les autres tables, base actuellement non durcie)
alter table groupes enable row level security;
drop policy if exists "acces_total_groupes" on groupes;
create policy "acces_total_groupes" on groupes for all using (true) with check (true);
