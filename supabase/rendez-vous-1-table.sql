-- ============================================================
-- 📅 RENDEZ-VOUS — LA TABLE ET SES RÈGLES (12/10/2026)
-- ============================================================
--
-- POUR TIMO — CE QUE FAIT CE SCRIPT, EN CLAIR
--
-- L'onglet 📅 Rendez-vous range ses rendez-vous dans une table À PART,
-- « rendez_vous », parce qu'un rendez-vous PRIVÉ doit le rester pour de
-- bon (décision « A a ») : rangé sur la fiche de l'employé, il descendrait
-- sur le téléphone de TOUT le personnel — l'écran le cacherait, mais il
-- serait dedans. Masquer n'est pas protéger.
--
-- Les règles, posées par la BASE elle-même :
--   • un rendez-vous PRIVÉ n'est lu, modifié, supprimé QUE par celui qui
--     l'a créé — personne d'autre, administrateur compris (décision
--     « A2 a ») ;
--   • un rendez-vous PRO est lu par tout le personnel de l'espace ; le
--     modifient : celui qui l'a créé et l'administrateur ; un participant
--     peut seulement le marquer « fait » et écrire le compte rendu ;
--   • tout employé peut en créer (décision « E a »), toujours à SON nom ;
--   • un compte CLIENT n'a rien à faire ici ; le comptable (lecture seule)
--     lit les rendez-vous pro mais n'écrit pas ;
--   • le mur formation / réel : un compte de formation ne voit jamais un
--     vrai rendez-vous, et inversement (l'administrateur principal voit
--     les deux espaces, mais jamais les rendez-vous PRIVÉS des autres).
--
-- Le script ajoute aussi « rendez_vous » à la liste des tables que
-- l'écriture groupée accepte (appliquer_lot) : sans ça, l'application ne
-- pourrait rien y enregistrer.
--
-- Relancer ce script est sans danger : tout est en « create or replace »
-- ou « if not exists ».
--
-- ⚠⚠ EN CAS DE PROBLÈME, TOUT ANNULER ⚠⚠
-- Copiez le bloc ci-dessous — SANS les tirets de début de ligne. Il retire
-- la table (et les rendez-vous déjà saisis) ; appliquer_lot garde le mot
-- « rendez_vous » dans sa liste, ce qui ne gêne rien.
--
--   drop trigger if exists rendez_vous_regles_trg on public.rendez_vous;
--   drop function if exists public.rendez_vous_regles();
--   drop table if exists public.rendez_vous;
--
-- ============================================================


-- ══════════════════════════════════════════════════════════════════
-- 1. LA TABLE — même forme que toutes les autres
-- ══════════════════════════════════════════════════════════════════
create table if not exists public.rendez_vous (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists rendez_vous_updated_at on public.rendez_vous (updated_at);

grant select, insert, update, delete on public.rendez_vous to authenticated;
grant select, insert, update, delete on public.rendez_vous to service_role;
-- ⚠ Supabase accorde AUTOMATIQUEMENT les droits sur toute nouvelle table au
-- visiteur anonyme : il faut les RETIRER nommément (leçon du 19/08/2026).
revoke all on public.rendez_vous from anon;

do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'horodatage_serveur') then
    drop trigger if exists horodatage_serveur_trg on public.rendez_vous;
    create trigger horodatage_serveur_trg
      before insert or update on public.rendez_vous
      for each row execute function public.horodatage_serveur();
  else
    raise notice 'horodatage_serveur absent : declencheur non pose sur rendez_vous.';
  end if;

  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'tombstone_sur_suppression') then
    drop trigger if exists tombstone_suppression_trg on public.rendez_vous;
    create trigger tombstone_suppression_trg
      after delete on public.rendez_vous
      for each row execute function public.tombstone_sur_suppression();
  else
    raise notice 'tombstone_sur_suppression absent : declencheur non pose sur rendez_vous.';
  end if;
end $$;


-- ══════════════════════════════════════════════════════════════════
-- 2. QUI VOIT QUOI
-- ══════════════════════════════════════════════════════════════════
alter table public.rendez_vous enable row level security;

do $$
declare
  role_jeton constant text := 'coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''')';
  espace_jeton constant text := 'coalesce(auth.jwt() -> ''app_metadata'' ->> ''espace'', ''reel'')';
  peut_ecrire constant text := 'coalesce((auth.jwt() -> ''app_metadata'' ->> ''ecriture'')::boolean, true)';
  -- L'identifiant du compte connecté : la partie avant « @ » de son adresse
  -- technique (même procédé que la table paie).
  moi constant text := 'split_part(coalesce(auth.jwt() ->> ''email'', ''''), ''@'', 1)';
  -- Un rendez-vous pro, ou le mien.
  pro_ou_mien constant text := '(data ->> ''type'' = ''pro'' or data ->> ''par_id'' = %s)';
begin
  drop policy if exists "rendez_vous_lecture"      on public.rendez_vous;
  drop policy if exists "rendez_vous_creation"     on public.rendez_vous;
  drop policy if exists "rendez_vous_maj"          on public.rendez_vous;
  drop policy if exists "rendez_vous_suppression"  on public.rendez_vous;
  drop policy if exists "role_client_interdit"     on public.rendez_vous;
  drop policy if exists "espace_cloisonnement"     on public.rendez_vous;
  drop policy if exists "role_lecture_seule"       on public.rendez_vous;
  drop policy if exists "role_lecture_seule_maj"   on public.rendez_vous;
  drop policy if exists "role_lecture_seule_suppr" on public.rendez_vous;

  -- LIRE : un rendez-vous pro, ou le sien. Un privé ne descend QUE chez lui.
  execute format('create policy "rendez_vous_lecture" on public.rendez_vous '
    'for select to authenticated using (%s);', format(pro_ou_mien, moi));

  -- CRÉER : même porte. ⚠ L'application enregistre par « upsert » : cette
  -- règle est vérifiée MÊME quand la ligne existe déjà (un administrateur
  -- qui corrige le rendez-vous pro d'un autre). La vraie création — « à
  -- SON nom seulement » — est vérifiée par le déclencheur plus bas.
  execute format('create policy "rendez_vous_creation" on public.rendez_vous '
    'for insert to authenticated with check (%s);', format(pro_ou_mien, moi));

  -- MODIFIER : « using » dit quelles lignes on peut toucher, « with check »
  -- ce qu'elles ont le droit de devenir (sans lui, un privé pourrait être
  -- réécrit au nom d'un autre). Le détail — qui modifie un pro — est au
  -- déclencheur.
  execute format('create policy "rendez_vous_maj" on public.rendez_vous '
    'for update to authenticated using (%s) with check (%s);',
    format(pro_ou_mien, moi), format(pro_ou_mien, moi));

  -- SUPPRIMER : le sien ; un rendez-vous pro, aussi l'administrateur.
  execute format('create policy "rendez_vous_suppression" on public.rendez_vous '
    'for delete to authenticated using (data ->> ''par_id'' = %s '
    'or (data ->> ''type'' = ''pro'' and %s = ''admin''));', moi, role_jeton);

  -- Un compte CLIENT : jamais, en rien.
  execute format('create policy "role_client_interdit" on public.rendez_vous '
    'as restrictive for all to authenticated using (%s <> ''client'') '
    'with check (%s <> ''client'');', role_jeton, role_jeton);

  -- LE MUR formation / réel. Le rendez-vous porte son espace dans ses
  -- données (« formation » : vrai), comme un prospect. La dérogation
  -- ''tous'' (l'administrateur principal) y est, comme dans CHAQUE
  -- politique espace_cloisonnement.
  execute format('create policy "espace_cloisonnement" on public.rendez_vous '
    'as restrictive for all to authenticated '
    'using (%s = ''tous'' or (coalesce((data ->> ''formation'')::boolean, false) = (%s = ''formation''))) '
    'with check (%s = ''tous'' or (coalesce((data ->> ''formation'')::boolean, false) = (%s = ''formation'')));',
    espace_jeton, espace_jeton, espace_jeton, espace_jeton);

  -- Un compte en LECTURE SEULE (le comptable) n'écrit pas. Même formule que
  -- roles-1-vague1.sql : la condition dans « with check » pour une
  -- modification, sinon elle « réussirait » en ne touchant rien.
  execute format('create policy "role_lecture_seule" on public.rendez_vous '
    'as restrictive for insert to authenticated with check (%s);', peut_ecrire);
  execute format('create policy "role_lecture_seule_maj" on public.rendez_vous '
    'as restrictive for update to authenticated using (true) with check (%s);', peut_ecrire);
  execute format('create policy "role_lecture_seule_suppr" on public.rendez_vous '
    'as restrictive for delete to authenticated using (%s);', peut_ecrire);
end $$;


-- ══════════════════════════════════════════════════════════════════
-- 3. CE QUE LES RÈGLES CI-DESSUS NE PEUVENT PAS DIRE
-- ══════════════════════════════════════════════════════════════════
-- Une règle de lecture ne compare pas l'ancienne et la nouvelle version
-- d'une ligne : c'est le travail d'un déclencheur.
create or replace function public.rendez_vous_regles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_jeton text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  moi text := split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1);
  avant jsonb;
  cle text;
begin
  -- L'éditeur SQL et le serveur (tournées du matin et du soir, avec la clé
  -- de service) n'ont pas de jeton de compte : ils passent.
  if auth.jwt() is null or auth.jwt() = '{}'::jsonb or moi = '' then
    return new;
  end if;

  if coalesce(new.data ->> 'type', '') not in ('pro', 'prive') then
    raise exception 'Rendez-vous refuse : le type doit etre pro ou prive';
  end if;

  -- ⚠ UN UPSERT N'EST PAS UNE CRÉATION : PostgreSQL déclenche la branche
  -- INSERT même quand la ligne existe. On relit donc la ligne d'abord.
  if tg_op = 'INSERT' then
    select r.data into avant from public.rendez_vous r where r.id = new.id;
    if avant is null then
      -- Une VRAIE création : toujours à son propre nom.
      if coalesce(new.data ->> 'par_id', '') <> moi then
        raise exception 'Creation refusee : un rendez-vous se cree a son propre nom';
      end if;
      return new;
    end if;
  else
    avant := old.data;
  end if;

  -- ---- À partir d'ici : une MODIFICATION. ----

  -- Ni l'auteur, ni le type, ni l'espace ne changent jamais.
  if coalesce(new.data ->> 'par_id', '') is distinct from coalesce(avant ->> 'par_id', '')
     or coalesce(new.data ->> 'type', '') is distinct from coalesce(avant ->> 'type', '')
     or coalesce((new.data ->> 'formation')::boolean, false)
        is distinct from coalesce((avant ->> 'formation')::boolean, false) then
    raise exception 'Modification refusee : l''auteur, le type et l''espace d''un rendez-vous ne changent pas';
  end if;

  -- Un privé : lui seul.
  if avant ->> 'type' = 'prive' then
    if avant ->> 'par_id' <> moi then
      raise exception 'Modification refusee : ce rendez-vous prive n''est pas le votre';
    end if;
    return new;
  end if;

  -- Un pro : son auteur, ou l'administrateur, change ce qu'il veut.
  if avant ->> 'par_id' = moi or role_jeton = 'admin' then
    return new;
  end if;

  -- Un PARTICIPANT : seulement le marquer fait et écrire le compte rendu.
  if coalesce(avant -> 'participants', '[]'::jsonb) ? moi then
    for cle in
      select k from (
        select jsonb_object_keys(new.data) as k
        union select jsonb_object_keys(avant) as k
      ) cles
    loop
      if cle not in ('statut', 'compte_rendu', 'fait_le', 'fait_par', 'updated_at')
         and (new.data -> cle) is distinct from (avant -> cle) then
        raise exception 'Modification refusee : un participant ne peut que marquer le rendez-vous fait (champ %)', cle;
      end if;
    end loop;
    if coalesce(new.data ->> 'statut', '') is distinct from coalesce(avant ->> 'statut', '')
       and new.data ->> 'statut' <> 'fait' then
      raise exception 'Modification refusee : un participant ne peut que marquer le rendez-vous fait';
    end if;
    return new;
  end if;

  raise exception 'Modification refusee : ce rendez-vous se modifie par son auteur ou l''administrateur';
end $$;

revoke all on function public.rendez_vous_regles() from public;
revoke all on function public.rendez_vous_regles() from anon;

drop trigger if exists rendez_vous_regles_trg on public.rendez_vous;
create trigger rendez_vous_regles_trg
  before insert or update on public.rendez_vous
  for each row execute function public.rendez_vous_regles();


-- ══════════════════════════════════════════════════════════════════
-- 4. L'ÉCRITURE GROUPÉE ACCEPTE LA NOUVELLE TABLE
-- ══════════════════════════════════════════════════════════════════
-- Reprise MOT POUR MOT de lot-1-ecriture-groupee.sql : seule la liste des
-- tables permises gagne « rendez_vous ».
create or replace function public.appliquer_lot(operations jsonb)
returns integer
language plpgsql
-- Volontairement SANS « security definer » : les règles de l'appelant
-- doivent s'appliquer. C'est tout l'intérêt.
set search_path = public
as $$
declare
  -- Les seules tables que cette fonction accepte de toucher.
  permises constant text[] := array[
    'boutiques', 'users', 'produits', 'ventes', 'depenses', 'dettes',
    'fournisseurs', 'ajustements', 'clotures', 'commerciaux', 'audits',
    'prospects', 'categories_prospects', 'commandes', 'messages',
    'clients_installes', 'proformas', 'groupes', 'paie', 'rendez_vous'
  ];
  op jsonb;
  nom_table text;
  faites integer := 0;
begin
  if current_user = 'anon' or session_user = 'anon' then
    raise exception 'Ecriture groupee reservee aux comptes connectes';
  end if;

  if jsonb_typeof(operations) <> 'array' then
    raise exception 'appliquer_lot attend une liste d''operations';
  end if;
  if jsonb_array_length(operations) > 200 then
    raise exception 'Lot trop grand (% operations)', jsonb_array_length(operations);
  end if;

  for op in select * from jsonb_array_elements(operations)
  loop
    nom_table := op ->> 'table';
    if nom_table is null or not (nom_table = any(permises)) then
      raise exception 'Table non autorisee : %', coalesce(nom_table, '(vide)');
    end if;
    if op ->> 'id' is null then
      raise exception 'Operation sans identifiant sur %', nom_table;
    end if;

    if coalesce(op ->> 'op', 'upsert') = 'delete' then
      execute format('delete from public.%I where id = $1', nom_table) using op ->> 'id';
      insert into public.tombstones (id, table_name, record_id, deleted_at)
      values (nom_table || ':' || (op ->> 'id'), nom_table, op ->> 'id', now())
      on conflict (id) do update set deleted_at = now();
    else
      execute format(
        'insert into public.%I (id, data, updated_at) values ($1, $2, $3) '
        'on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at',
        nom_table
      ) using op ->> 'id', op -> 'data', coalesce((op ->> 'updated_at')::timestamptz, now());
    end if;
    faites := faites + 1;
  end loop;

  return faites;
end $$;

revoke all on function public.appliquer_lot(jsonb) from public;
revoke all on function public.appliquer_lot(jsonb) from anon;
grant execute on function public.appliquer_lot(jsonb) to authenticated;


-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — doit répondre « true | true | true | true »
-- ══════════════════════════════════════════════════════════════════
-- 1. la table est protégée par ses règles ;
-- 2. le visiteur anonyme ne peut pas la lire ;
-- 3. le déclencheur des règles est en place ;
-- 4. l'écriture groupée accepte la table.
-- (⚠ aucune apostrophe dans les morceaux cherchés : leçon du 24/09/2026.)
select
  (select relrowsecurity from pg_class where oid = 'public.rendez_vous'::regclass) as table_protegee,
  not has_table_privilege('anon', 'public.rendez_vous', 'select') as anonyme_refuse,
  exists (select 1 from pg_trigger where tgname = 'rendez_vous_regles_trg') as regles_en_place,
  (select prosrc like '%rendez_vous%' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'appliquer_lot') as ecriture_groupee_ok;
