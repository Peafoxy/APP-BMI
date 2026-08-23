-- ============================================================
-- ÉCRITURE GROUPÉE — « tout passe, ou rien ne passe »
-- ============================================================
--
-- POUR TIMO — LE DÉFAUT QUE CECI CORRIGE
--
-- Beaucoup d'opérations de l'application en écrivent DEUX à la fois. Un
-- versement, par exemple, enregistre la sortie de caisse ET met à jour la
-- dette. Jusqu'ici ces deux écritures partaient SÉPARÉMENT vers le serveur.
--
-- Si la première passe et que la seconde est refusée, on obtient une
-- incohérence qui ne se répare jamais toute seule : l'argent est noté en
-- caisse, mais la dette n'a pas bougé.
--
-- Cette fonction permet d'envoyer les deux ensemble. PostgreSQL les applique
-- dans un même mouvement : si l'une échoue, l'autre est annulée aussi. On ne
-- peut plus se retrouver à moitié enregistré.
--
-- ⚠ CE QUE CETTE FONCTION NE FAIT PAS : elle n'accorde AUCUN droit
-- supplémentaire. Elle s'exécute avec les droits de celui qui l'appelle
-- (« security invoker »), donc toutes vos règles — cloisonnement
-- formation/réel, interdictions par rôle, anti-escalade — s'appliquent
-- exactement comme pour une écriture ordinaire. Une opération refusée
-- aujourd'hui le restera, à la différence près qu'elle entraînera ses
-- compagnes dans son refus au lieu de les laisser passer.
--
-- ⚠ LA LISTE BLANCHE EST ESSENTIELLE. Sans elle, cette fonction deviendrait
-- une porte d'écriture vers N'IMPORTE QUELLE table du schéma public — y
-- compris celles d'autres projets, ou une table sans protection. Seules les
-- tables de l'application sont acceptées ; tout autre nom est refusé net.
--
-- ⚠⚠ EN CAS DE PROBLÈME, TOUT ANNULER ⚠⚠
-- Copiez la ligne ci-dessous — SANS les tirets de début de ligne. L'app
-- repasse alors d'elle-même en envois séparés, comme avant :
--
--   drop function if exists public.appliquer_lot(jsonb);
--
-- ============================================================

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
    'clients_installes', 'proformas', 'groupes', 'paie'
  ];
  op jsonb;
  nom_table text;
  faites integer := 0;
begin
  if jsonb_typeof(operations) <> 'array' then
    raise exception 'appliquer_lot attend une liste d''operations';
  end if;
  -- Garde-fou : un lot démesuré signalerait une erreur d'appel, pas un
  -- usage normal (une opération de l'application en produit deux ou trois).
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

-- Les comptes connectés peuvent l'appeler ; le visiteur anonyme, non.
revoke all on function public.appliquer_lot(jsonb) from public;
grant execute on function public.appliquer_lot(jsonb) to authenticated;


-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — à lancer juste après
-- ══════════════════════════════════════════════════════════════════
-- Doit renvoyer une ligne : appliquer_lot, invoker = true, anonyme = false.
select
  p.proname as fonction,
  not p.prosecdef as s_execute_avec_les_droits_de_l_appelant,
  has_function_privilege('anon', p.oid, 'execute') as anonyme_peut_appeler,
  has_function_privilege('authenticated', p.oid, 'execute') as connecte_peut_appeler
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'appliquer_lot';
