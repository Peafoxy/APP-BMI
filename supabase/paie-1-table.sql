-- ============================================================
-- ÉTAPE 1 — SORTIR LES SALAIRES DE LA FICHE EMPLOYÉ
-- ============================================================
--
-- POUR TIMO — CE QUE FAIT CE SCRIPT, EN CLAIR
--
-- Aujourd'hui, tout ce qui concerne un compte tient dans UNE seule fiche :
-- le nom, le rôle, la boutique… mais aussi le salaire, les virements, les
-- crédits, les avances, le numéro de pièce d'identité et le matricule
-- CNSS. Et cette fiche est lisible très largement — y compris, tant que la
-- lecture publique n'est pas refermée (étape 2), par quiconque possède la
-- clé publique de votre site.
--
-- Dans cette base, la fiche entière est rangée dans UNE seule case. On ne
-- peut donc pas dire au serveur « montre le nom mais cache le salaire » :
-- c'est tout ou rien. La seule solution est de DÉPLACER ces champs dans
-- une table à part, avec ses propres règles.
--
-- Ce script fait exactement cela, en trois temps :
--   1. il crée la table « paie » ;
--   2. il y RECOPIE les champs sensibles de chaque fiche employé ;
--   3. il les EFFACE de la fiche employé.
-- Puis il pose les règles : seul l'administrateur voit tout, le comptable
-- lit, et chaque employé ne voit QUE la sienne. Personne d'autre. Et le
-- visiteur anonyme n'y a aucun accès, même en lecture.
--
-- ⚠⚠ ORDRE DE DÉPLOIEMENT — IMPORTANT ⚠⚠
-- Lancez ce script D'ABORD, PUIS rechargez l'application (version 2.100.62
-- ou plus récente). Entre les deux, l'écran Salaires affichera des cases
-- vides : c'est normal et sans gravité, rien n'est perdu — les données
-- sont dans la nouvelle table, l'ancienne version de l'application ne sait
-- simplement pas encore où les chercher. Un rechargement suffit.
--
-- ⚠⚠ EN CAS DE PROBLÈME, TOUT ANNULER ⚠⚠
-- Copiez le bloc ci-dessous — SANS les tirets de début de ligne. Il remet
-- les champs dans les fiches employés et supprime la nouvelle table :
-- vous revenez EXACTEMENT à l'état d'avant.
--
--   update public.users u
--      set data = u.data || (p.data - 'id')
--     from public.paie p
--    where p.id = u.id;
--   drop trigger if exists interdire_escalade_paie_trg on public.paie;
--   drop function if exists public.interdire_escalade_paie();
--   drop table if exists public.paie;
--
-- ============================================================


-- ══════════════════════════════════════════════════════════════════
-- 1. LA TABLE
-- ══════════════════════════════════════════════════════════════════
-- Même forme que toutes les autres tables de l'application.
create table if not exists public.paie (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists paie_updated_at on public.paie (updated_at);

-- ⚠ Le visiteur ANONYME n'est volontairement PAS dans cette liste : la clé
-- publique du site n'ouvre donc rien ici, même avant toute règle.
grant select, insert, update, delete on public.paie to authenticated;
grant select, insert, update, delete on public.paie to service_role;

-- Horodatage serveur et signalement des suppressions, comme les autres
-- tables. On ne les pose que si la fonction correspondante existe déjà :
-- ainsi ce script reste lançable sur une base où l'un de ces mécanismes
-- n'aurait pas été installé, au lieu de s'arrêter en erreur.
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'horodatage_serveur') then
    drop trigger if exists horodatage_serveur_trg on public.paie;
    create trigger horodatage_serveur_trg
      before insert or update on public.paie
      for each row execute function public.horodatage_serveur();
  else
    raise notice 'horodatage_serveur absent : declencheur non pose sur paie.';
  end if;

  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'tombstone_sur_suppression') then
    drop trigger if exists tombstone_suppression_trg on public.paie;
    create trigger tombstone_suppression_trg
      after delete on public.paie
      for each row execute function public.tombstone_sur_suppression();
  else
    raise notice 'tombstone_sur_suppression absent : declencheur non pose sur paie.';
  end if;
end $$;


-- ══════════════════════════════════════════════════════════════════
-- 2. LE DÉMÉNAGEMENT
-- ══════════════════════════════════════════════════════════════════
-- Relancer ce script est sans danger : la recopie écrase proprement, et
-- l'effacement ne trouve alors plus rien à effacer.
do $$
declare
  champs constant text[] := array[
    'salaire_base', 'taux_avancement', 'evolutions_salaire', 'primes', 'avances',
    'virements', 'credits',
    'piece_type', 'piece_num',
    'cnss_assujetti', 'cnss_matricule', 'cnss_numero_assurance', 'cnss_mensuel',
    'cnss_code_type', 'cnss_date_embauche', 'cnss_date_sortie', 'cnss_code_motif_sortie'
  ];
  deplacees int;
  nettoyees int;
begin
  -- 2a. Recopier dans la nouvelle table (uniquement les fiches concernées).
  with extrait as (
    select u.id,
           (select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
              from jsonb_each(u.data) e
             where e.key = any(champs)) as contenu
      from public.users u
     where u.data ?| champs
  )
  insert into public.paie (id, data)
  select id, contenu from extrait
  on conflict (id) do update set data = excluded.data;
  get diagnostics deplacees = row_count;

  -- 2b. Les effacer de la fiche employé.
  update public.users
     set data = data - champs
   where data ?| champs;
  get diagnostics nettoyees = row_count;

  raise notice 'Fiches de paie créées ou mises à jour : %', deplacees;
  raise notice 'Fiches employés allégées : %', nettoyees;
end $$;


-- ══════════════════════════════════════════════════════════════════
-- 3. QUI A LE DROIT DE VOIR QUOI
-- ══════════════════════════════════════════════════════════════════
-- Une règle par action, jamais deux qui se chevauchent — pour éviter
-- justement les remarques « plusieurs règles permissives » de Supabase.
--
--   • LIRE    : administrateur, comptable, ou SA PROPRE fiche.
--   • CRÉER   : administrateur seulement.
--   • MODIFIER: administrateur, ou SA PROPRE fiche (l'employé confirme un
--               virement reçu, demande un crédit).
--   • EFFACER : administrateur seulement.
alter table public.paie enable row level security;

do $$
declare
  role_jeton constant text := 'coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''')';
  -- L'identifiant du compte connecté : c'est la partie avant « @ » de son
  -- adresse technique (voir roles-2-vague2.sql, même procédé).
  moi constant text := 'split_part(coalesce(auth.jwt() ->> ''email'', ''''), ''@'', 1)';
begin
  drop policy if exists "paie_lecture"    on public.paie;
  drop policy if exists "paie_creation"   on public.paie;
  drop policy if exists "paie_maj"        on public.paie;
  drop policy if exists "paie_suppression" on public.paie;

  execute format(
    'create policy "paie_lecture" on public.paie for select to authenticated '
    'using (%s in (''admin'', ''comptable'') or id = %s);', role_jeton, moi);

  -- ⚠ « ou sa propre fiche » n'est PAS un relâchement — c'est indispensable.
  -- L'application enregistre par « upsert » (insère, et bascule en
  -- modification si la ligne existe déjà) : PostgreSQL contrôle alors
  -- D'ABORD cette règle d'insertion, même quand la ligne existe. Sans cette
  -- ouverture, un employé confirmant un virement reçu se serait vu refuser
  -- l'enregistrement — exactement la panne du 18/08/2026 sur les fiches
  -- employés, retrouvée ici par le banc d'essai (scripts/tester-paie-sql.sh).
  -- La VRAIE création reste bloquée juste en dessous, par le déclencheur :
  -- lui sait distinguer une ligne qui existe déjà d'une ligne nouvelle.
  execute format(
    'create policy "paie_creation" on public.paie for insert to authenticated '
    'with check (%s = ''admin'' or id = %s);', role_jeton, moi);

  -- ⚠ « using » ET « with check » : sans le second, un employé pourrait
  -- réécrire l'identifiant de la ligne et repartir avec la fiche d'un
  -- autre. Le premier dit quelles lignes il peut toucher, le second ce
  -- qu'elles ont le droit de devenir.
  execute format(
    'create policy "paie_maj" on public.paie for update to authenticated '
    'using (%s = ''admin'' or id = %s) with check (%s = ''admin'' or id = %s);',
    role_jeton, moi, role_jeton, moi);

  execute format(
    'create policy "paie_suppression" on public.paie for delete to authenticated '
    'using (%s = ''admin'');', role_jeton);

  -- Un compte CLIENT n'a rien à faire ici, en aucune circonstance.
  -- Règle « restrictive » : elle ne fait que retrancher.
  drop policy if exists "role_client_interdit" on public.paie;
  execute format(
    'create policy "role_client_interdit" on public.paie as restrictive for all '
    'to authenticated using (%s <> ''client'') with check (%s <> ''client'');',
    role_jeton, role_jeton);
end $$;


-- ══════════════════════════════════════════════════════════════════
-- 4. UN EMPLOYÉ NE S'AUGMENTE PAS TOUT SEUL
-- ══════════════════════════════════════════════════════════════════
-- L'employé a le droit de modifier SA fiche — c'est ce qui lui permet de
-- confirmer un virement reçu ou de demander un crédit. Rien ne
-- l'empêcherait, sans ce garde-fou, d'y écrire aussi un salaire de base de
-- deux millions, de s'accorder une prime, ou d'approuver son propre
-- crédit. Le serveur le refuse désormais lui-même.
create or replace function public.interdire_escalade_paie()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_jeton text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
begin
  -- L'éditeur SQL (et les scripts de maintenance) n'ont pas de jeton :
  -- sans cette sortie, ce déclencheur vous verrouillerait vous-même.
  if auth.jwt() is null or auth.jwt() = '{}'::jsonb then
    return new;
  end if;

  -- L'administrateur fait ce qu'il veut : c'est lui qui fixe les salaires.
  if role_jeton = 'admin' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- ⚠ Leçon de la vague 1 : l'application enregistre par « upsert », et
    -- PostgreSQL déclenche la branche INSERT même quand la ligne existe
    -- déjà. Sans cette sortie, toute modification légitime d'un employé
    -- sur sa propre fiche serait refusée. La branche UPDATE, elle, fera
    -- les vraies vérifications.
    if exists (select 1 from public.paie p where p.id = new.id) then
      return new;
    end if;
    raise exception 'Creation d''une fiche de paie refusee : reserve a l''administrateur';
  end if;

  -- ---- À partir d'ici : un employé modifie SA fiche. ----

  -- Les montants décidés par l'employeur ne bougent pas.
  if coalesce(new.data -> 'salaire_base', 'null'::jsonb)
       is distinct from coalesce(old.data -> 'salaire_base', 'null'::jsonb)
     or coalesce(new.data -> 'taux_avancement', 'null'::jsonb)
       is distinct from coalesce(old.data -> 'taux_avancement', 'null'::jsonb)
     or coalesce(new.data -> 'evolutions_salaire', 'null'::jsonb)
       is distinct from coalesce(old.data -> 'evolutions_salaire', 'null'::jsonb)
     or coalesce(new.data -> 'primes', 'null'::jsonb)
       is distinct from coalesce(old.data -> 'primes', 'null'::jsonb)
     or coalesce(new.data -> 'avances', 'null'::jsonb)
       is distinct from coalesce(old.data -> 'avances', 'null'::jsonb)
  then
    raise exception 'Modification refusee : salaire, primes et avances sont fixes par l''administrateur';
  end if;

  -- On ne s'invente pas un virement : leur nombre ne peut pas augmenter.
  -- (En changer le statut — « reçu, confirmé » — reste permis.)
  if jsonb_array_length(coalesce(new.data -> 'virements', '[]'::jsonb))
     > jsonb_array_length(coalesce(old.data -> 'virements', '[]'::jsonb))
  then
    raise exception 'Ajout d''un virement refuse : seul l''administrateur en enregistre';
  end if;

  -- On ne s'approuve pas son propre crédit : aucun crédit ne peut PASSER à
  -- « approuve » ou « solde ». En demander un (« en_attente ») reste permis.
  if exists (
    select 1
      from jsonb_array_elements(coalesce(new.data -> 'credits', '[]'::jsonb)) n
     where n ->> 'statut' in ('approuve', 'solde')
       and not exists (
         select 1
           from jsonb_array_elements(coalesce(old.data -> 'credits', '[]'::jsonb)) o
          where o ->> 'id' = n ->> 'id'
            and o ->> 'statut' = n ->> 'statut'
       )
  ) then
    raise exception 'Approbation de credit refusee : seul l''administrateur decide';
  end if;

  return new;
end $$;

drop trigger if exists interdire_escalade_paie_trg on public.paie;
create trigger interdire_escalade_paie_trg
  before insert or update on public.paie
  for each row execute function public.interdire_escalade_paie();


-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — à lancer juste après
-- ══════════════════════════════════════════════════════════════════
-- 1) Les fiches de paie ont bien été créées, et les fiches employés
--    ne contiennent plus AUCUN champ d'argent. La deuxième colonne doit
--    valoir 0.
select
  (select count(*) from public.paie) as fiches_de_paie,
  (select count(*) from public.users
    where data ?| array['salaire_base','virements','credits','avances','primes',
                        'piece_num','cnss_matricule']) as fiches_employes_encore_sensibles;

-- 2) Les règles en place : doit renvoyer 5 lignes
--    (paie_lecture, paie_creation, paie_maj, paie_suppression, role_client_interdit).
select policyname, cmd, permissive
  from pg_policies
 where schemaname = 'public' and tablename = 'paie'
 order by policyname;
