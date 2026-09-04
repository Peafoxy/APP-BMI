-- ============================================================
-- SÉCURITÉ 3 — LES FAIRE-PART DE SUPPRESSION NE MENTENT PLUS
-- (vague 3, étape 0 — demande Timo du 04/09/2026 : « tout devrait
-- normalement être verrouillé »)
--
-- Collez ce fichier tel quel dans l'éditeur SQL de Supabase.
-- Il ne touche à aucune donnée : il pose deux règles et un déclencheur.
--
-- ⚠ CE QU'ON FERME
-- La table `tombstones` (les faire-part qui disent à tous les appareils
-- « cette ligne a été effacée ») était ouverte en ÉCRITURE à tout compte
-- connecté, clients compris (securite-1 : `tombstones_connectes`,
-- using(true) with check(true)). Mesuré dans src/sync.js :
--   • un faire-part sur une vente → elle disparaît de la copie locale de
--     TOUS les appareils (la ligne serveur reste, invisible) ;
--   • un faire-part `__TRUNCATE__` → chaque appareil vide toute la table ;
--   • le marqueur `*` → chaque appareil vide sa base locale ET sa file
--     d'attente (les ventes hors ligne non envoyées sont PERDUES).
-- N'importe quel compte client pouvait déposer ces lignes avec son jeton.
--
-- ⚠ CE QUI CONTINUE DE MARCHER (rejoué par scripts/tester-faire-part-sql.sh)
--   • la suppression normale par un employé : la ligne est effacée PUIS le
--     faire-part déposé (déclencheur AFTER DELETE, appliquer_lot, et
--     l'upsert de l'application) — la ligne n'existe plus, le faire-part
--     passe ;
--   • la réinitialisation par l'administrateur (marqueur `*`) ;
--   • le TRUNCATE depuis l'éditeur SQL (jeton vide) ;
--   • la LECTURE des faire-part par tout compte connecté, clients compris :
--     indispensable à la synchronisation, inchangée.
-- ============================================================

-- ══════════════════════════════════════════════════════════════════
-- 1. UN COMPTE CLIENT N'ÉCRIT JAMAIS DE FAIRE-PART
-- ══════════════════════════════════════════════════════════════════
-- Un client n'a aucun droit de suppression (roles-2 : role_client_sans_
-- suppression sur 16 tables) : il n'a donc jamais rien à annoncer. Règles
-- RESTRICTIVES : elles retranchent à `tombstones_connectes` sans la
-- remplacer. La lecture n'est pas touchée.
drop policy if exists "faire_part_pas_de_client_insert" on public.tombstones;
create policy "faire_part_pas_de_client_insert" on public.tombstones
  as restrictive for insert to authenticated
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'client');

drop policy if exists "faire_part_pas_de_client_update" on public.tombstones;
create policy "faire_part_pas_de_client_update" on public.tombstones
  as restrictive for update to authenticated
  using (true)
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'client');

drop policy if exists "faire_part_pas_de_client_delete" on public.tombstones;
create policy "faire_part_pas_de_client_delete" on public.tombstones
  as restrictive for delete to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'client');

-- ══════════════════════════════════════════════════════════════════
-- 2. UN FAIRE-PART N'ANNONCE QU'UNE SUPPRESSION RÉELLE
-- ══════════════════════════════════════════════════════════════════
-- Déclencheur BEFORE INSERT OR UPDATE sur tombstones :
--   • jeton vide (éditeur SQL) ou service_role : on laisse passer ;
--   • marqueur global (`*` ou `__TRUNCATE__`) : réservé au rôle admin
--     (et, quand l'étiquette existera, à l'administrateur principal) ;
--   • table hors de la liste de l'application : refusé ;
--   • la ligne annoncée existe ENCORE : refusé — un faire-part sur une
--     ligne vivante est un mensonge.
-- `security definer` : la vérification d'existence doit voir la ligne
-- quel que soit le mur d'espace du compte (sinon un employé du réel
-- pourrait « annoncer » une ligne de formation qu'il ne voit pas). La
-- fonction ne renvoie qu'un oui/non : rien ne fuit.
create or replace function public.faire_part_sincere()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_session text := coalesce(auth.jwt() ->> 'role', '');
  role_jeton   text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  existe       boolean;
begin
  if role_session = '' or role_session = 'service_role' then
    return new;
  end if;

  if new.table_name = '*' or new.record_id = '__TRUNCATE__' or new.record_id = new.id then
    if role_jeton <> 'admin' then
      raise exception 'Faire-part global (%/%) réservé à l''administrateur', new.table_name, new.record_id
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.table_name not in ('boutiques','users','produits','ventes','depenses','dettes',
      'fournisseurs','ajustements','clotures','commerciaux','audits','prospects',
      'categories_prospects','commandes','messages','clients_installes','proformas',
      'groupes','paie') then
    raise exception 'Faire-part sur une table inconnue : %', new.table_name
      using errcode = '42501';
  end if;

  execute format('select exists (select 1 from public.%I where id = $1)', new.table_name)
    into existe using new.record_id;
  if existe then
    raise exception 'Faire-part refusé : la ligne % de % existe encore', new.record_id, new.table_name
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.faire_part_sincere() from public, anon;

drop trigger if exists faire_part_sincere_trg on public.tombstones;
create trigger faire_part_sincere_trg
  before insert or update on public.tombstones
  for each row execute function public.faire_part_sincere();

-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — à lancer juste après (résultat attendu : 3 / true / true)
-- ══════════════════════════════════════════════════════════════════
select
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'tombstones'
      and policyname like 'faire_part_pas_de_client_%') as regles_client,
  exists (select 1 from pg_trigger where tgname = 'faire_part_sincere_trg') as declencheur_pose,
  exists (select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tombstones'
      and policyname = 'tombstones_connectes') as lecture_connectee_intacte;

-- ══════════════════════════════════════════════════════════════════
-- POUR DÉSACTIVER (si un geste légitime était refusé) — une ligne :
--   alter table public.tombstones disable trigger faire_part_sincere_trg;
-- et pour les règles client :
--   drop policy "faire_part_pas_de_client_insert" on public.tombstones;
--   drop policy "faire_part_pas_de_client_update" on public.tombstones;
--   drop policy "faire_part_pas_de_client_delete" on public.tombstones;
-- ══════════════════════════════════════════════════════════════════
