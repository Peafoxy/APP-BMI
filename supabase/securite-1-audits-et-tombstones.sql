-- ============================================================
-- DEUX TABLES OUBLIÉES : LE JOURNAL, ET LES FAIRE-PART DE SUPPRESSION
-- ============================================================
--
-- POUR TIMO — DEUX POINTS SANS RAPPORT ENTRE EUX, MAIS TOUS DEUX PETITS.
--
-- 1) LE JOURNAL (`audits`) MÉLANGE LES DEUX ESPACES.
--    Treize tables sont cloisonnées entre formation et réel. Le journal, non :
--    les gestes d'entraînement apparaissent donc dans votre historique réel,
--    avec de vrais montants dans leur libellé. Gênant à lire, sans danger
--    pour les chiffres. (Point 13 de l'audit du 20/08/2026.)
--
--    Le journal n'appartient à aucune boutique : il porte sa propre marque,
--    comme les prospects et les fournisseurs. L'application la pose depuis la
--    version 2.100.76 ; les lignes plus anciennes, sans marque, sont
--    considérées comme RÉELLES — le doute profite aux vraies données.
--
-- 2) LES FAIRE-PART DE SUPPRESSION (`tombstones`) N'ONT AUCUNE PROTECTION.
--    Cette table dit aux appareils « cet enregistrement a été supprimé,
--    effacez-le ». Elle n'a jamais eu de règle d'accès. Y déposer un faux
--    faire-part suffit donc à faire effacer n'importe quel enregistrement sur
--    TOUS les appareils.
--
--    Trouvé le 20/08/2026 en corrigeant l'écriture groupée : c'était le seul
--    chemin par lequel un visiteur anonyme pouvait réellement nuire.
--
-- ⚠⚠ EN CAS DE PROBLÈME, TOUT ANNULER ⚠⚠
-- Copiez le bloc ci-dessous — SANS les tirets de début de ligne :
--
--   drop policy if exists "espace_cloisonnement" on public.audits;
--   drop trigger if exists espace_ligne_trg on public.audits;
--   alter table public.audits drop column if exists espace;
--   drop policy if exists "tombstones_connectes" on public.tombstones;
--   alter table public.tombstones disable row level security;
--   grant select, insert, update, delete on public.tombstones to anon;
--
-- ============================================================


-- ══════════════════════════════════════════════════════════════════
-- 1. LE JOURNAL REJOINT LE CLOISONNEMENT
-- ══════════════════════════════════════════════════════════════════
create or replace function public.espace_de_ligne(nom_table text, d jsonb)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case nom_table
    when 'boutiques' then
      case when coalesce((d->>'formation')::boolean, false) then 'formation' else 'reel' end
    when 'prospects' then
      case when coalesce((d->>'formation')::boolean, false) then 'formation' else 'reel' end
    when 'fournisseurs' then
      case when coalesce((d->>'formation')::boolean, false) then 'formation' else 'reel' end
    when 'commerciaux' then
      case when coalesce((d->>'formation')::boolean, false) then 'formation' else 'reel' end
    when 'audits' then
      case when coalesce((d->>'formation')::boolean, false) then 'formation' else 'reel' end
    when 'clients_installes' then coalesce(
      public.espace_de_boutique((select v.data->>'boutique' from public.ventes v where v.id = d->>'vente_id')),
      public.espace_de_boutique((select t.data->>'boutique' from public.dettes t where t.id = d->>'dette_id'))
    )
    else public.espace_de_boutique(d->>'boutique')
  end;
$$;

alter table public.audits add column if not exists espace text;
drop trigger if exists espace_ligne_trg on public.audits;
create trigger espace_ligne_trg before insert or update on public.audits
  for each row execute function public.espace_ligne();
update public.audits set espace = public.espace_de_ligne('audits', data);
create index if not exists audits_espace on public.audits (espace);

do $$
declare revendication constant text := 'coalesce(auth.jwt() -> ''app_metadata'' ->> ''espace'', ''reel'')';
begin
  drop policy if exists "espace_cloisonnement" on public.audits;
  execute format(
    'create policy "espace_cloisonnement" on public.audits '
    'as restrictive for all to authenticated '
    'using (espace is null or espace = %s) '
    'with check ('
    '  public.espace_de_ligne(''audits'', data) is null'
    '  or public.espace_de_ligne(''audits'', data) = %s'
    ');', revendication, revendication);
end $$;


-- ══════════════════════════════════════════════════════════════════
-- 2. LES FAIRE-PART DE SUPPRESSION SE FERMENT AU VISITEUR ANONYME
-- ══════════════════════════════════════════════════════════════════
-- Tous les comptes CONNECTÉS continuent d'y lire et d'y écrire : c'est
-- indispensable au fonctionnement de la synchronisation, et ce n'est pas le
-- sujet. Ce qu'on ferme, c'est l'accès SANS COMPTE.
alter table public.tombstones enable row level security;

drop policy if exists "tombstones_connectes" on public.tombstones;
create policy "tombstones_connectes" on public.tombstones
  for all to authenticated
  using (true) with check (true);

revoke all on public.tombstones from anon;


-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — à lancer juste après
-- ══════════════════════════════════════════════════════════════════
-- tables_cloisonnees doit valoir 14 (13 + le journal).
-- anonyme_touche_les_faire_part doit valoir FALSE.
select
  (select count(*) from pg_policies
    where schemaname = 'public' and policyname = 'espace_cloisonnement') as tables_cloisonnees,
  has_table_privilege('anon', 'public.tombstones', 'select')
    or has_table_privilege('anon', 'public.tombstones', 'insert') as anonyme_touche_les_faire_part,
  (select count(*) from public.audits where espace = 'formation') as lignes_de_formation,
  (select count(*) from public.audits where espace = 'reel') as lignes_reelles;
