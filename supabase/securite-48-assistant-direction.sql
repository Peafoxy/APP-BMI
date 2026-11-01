-- ═══════════════════════════════════════════════════════════
-- securite-48-assistant-direction.sql — L'ASSISTANT(E) DE DIRECTION
-- ═══════════════════════════════════════════════════════════
-- POUR TIMO — CE QUE FAIT CE SCRIPT (01/11/2026, « D a », « B a », « Lance »)
--
-- Un nouveau rôle : « assistant_direction » (Assistant ou Assistante de
-- direction, selon le sexe de la fiche). Ce script dit à la base deux choses :
--
--   1. Elle / il peut DONNER DES TÂCHES (aux gérants). Sans ça, l'écran
--      laisserait partir la tâche, la base dirait non, et tout son envoi
--      resterait coincé dans la file d'attente.
--
--   2. Elle / il ne touche JAMAIS à l'argent ni au stock (« D a ») : la base
--      refuse franchement toute écriture de sa part sur les ventes, dépenses,
--      dettes, articles, mouvements de stock, clôtures, commandes, proformas,
--      boutiques, prospects, chantiers, fournisseurs, commerciaux, groupes et
--      catégories de prospects. L'application le refuse déjà ; la base le
--      redit, comme pour tous les autres rôles.
--
-- Ce qui reste permis : ses messages, ses rendez-vous, les tâches, sa propre
-- fiche, et la confirmation de SON salaire — les règles d'avant s'appliquent.
-- La paie des autres reste fermée (« B a pour le moment ») : rien n'est
-- changé de ce côté.
--
-- Effet à la prochaine connexion de la personne. Le relancer deux fois est
-- sans danger.
--
-- EN CAS DE PROBLÈME, TOUT ANNULER : demandez-moi le script inverse.
-- ═══════════════════════════════════════════════════════════

-- 1. Le pouvoir « tâches » — securite-21 repris tel quel, un rôle de plus.
--    ⚠ LE COUPLE : ROLES_TACHES (src/lib/calculs.js) nomme les MÊMES rôles.
create or replace function public.a_pouvoir_taches()
returns boolean language sql stable set search_path = public as $$
  select public.role_jeton() in ('admin', 'resp_commercial', 'commercial', 'technicien', 'technicien_bmi', 'assistant_direction')
     and not coalesce(auth.jwt() -> 'app_metadata' -> 'pouvoirs_off' ? 'act_taches', false);
$$;

-- 2. Aucune écriture sur l'argent ni sur le stock.
--    Un déclencheur (et non une simple règle de lecture) : le refus est
--    FRANC — l'application le voit et le dit, rien ne disparaît en silence.
--    Le serveur (clé de service) n'a pas de rôle : il n'est jamais gêné.
create or replace function public.refuser_assistant_direction()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.role_jeton() = 'assistant_direction' then
    raise exception 'Assistant(e) de direction : lecture seule sur %', tg_table_name
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'ventes', 'depenses', 'dettes', 'produits', 'ajustements', 'clotures',
    'commandes', 'proformas', 'boutiques', 'prospects', 'clients_installes',
    'fournisseurs', 'commerciaux', 'groupes', 'categories_prospects'
  ]
  loop
    execute format('drop trigger if exists assistant_direction_lecture_seule on public.%I;', t);
    execute format(
      'create trigger assistant_direction_lecture_seule before insert or update or delete on public.%I '
      'for each row execute function public.refuser_assistant_direction();', t);
  end loop;
end $$;

-- ═════════════════════════════════════════════════
-- VÉRIFICATION — doit afficher : true | true | true
-- ═════════════════════════════════════════════════
select
  (select prosrc like '%assistant_direction%' from pg_proc where proname = 'a_pouvoir_taches') as taches_ouvertes,
  exists (select 1 from pg_proc where proname = 'refuser_assistant_direction') as refus_en_place,
  (select count(*) = 15 from pg_trigger where tgname = 'assistant_direction_lecture_seule') as quinze_tables_gardees;
