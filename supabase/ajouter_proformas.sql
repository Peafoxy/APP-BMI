-- ═══════════════════════════════════════════════════════════════
-- AJOUT DE LA TABLE proformas (offres de prix non comptabilisées)
-- À exécuter UNE SEULE FOIS dans Supabase → SQL Editor.
-- Sans elle, la synchronisation échoue avec « Could not find the table proformas ».
-- ═══════════════════════════════════════════════════════════════

create table if not exists proformas (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists proformas_updated_at on proformas (updated_at);

-- Accès ouvert (même politique que les autres tables, base actuellement non durcie)
alter table proformas enable row level security;
drop policy if exists "proformas_all" on proformas;
create policy "proformas_all" on proformas for all using (true) with check (true);
