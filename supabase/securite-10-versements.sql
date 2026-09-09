-- ============================================================
-- SÉCURITÉ 10 — LE VERSEMENT DES FONDS : LA VALIDATION DU DG
-- (demande Timo, 09/09/2026 : « le versement des fonds par les vendeurs
--  et gérants… Chez le DG, BANQUE ou Chez le comptable… toujours à être
--  validé par le DG », et « DG, c'est l'admin principal »)
--
-- CE QUE POSE L'APPLICATION (2.101.112) : un versement est une dépense de
-- la boutique (catégorie « Versement de fonds », champ `versement`). Pour
-- « Chez le comptable », une entrée miroir chez le comptable, que le
-- comptable pointe « Encaissé » (règle déjà en place, securite-4/8). Pour
-- « Chez le DG » et « BANQUE », le DG valide en écrivant
-- `versement_valide_le` / `versement_valide_par` sur la dépense.
--
-- CE QUE CE SCRIPT VERROUILLE : ces deux champs de validation ne
-- s'écrivent, ne se changent et ne s'effacent que par l'ADMINISTRATEUR
-- PRINCIPAL (est_admin_principal, securite-5). Un vendeur ne peut donc pas
-- déclarer lui-même son versement « validé ». Upsert compris (la ligne
-- existante est relue avant de comparer).
--
-- À coller dans Supabase → SQL Editor → Run. Banc : scripts/tester-argent-sql.sh.
-- ============================================================

create or replace function public.depenses_regles_versement()
returns trigger language plpgsql security definer set search_path = public as $$
declare avant jsonb;
begin
  if public.jeton_de_service() then return new; end if;
  if tg_op = 'INSERT' then
    select d.data into avant from public.depenses d where d.id = new.id;
  else
    avant := old.data;
  end if;
  if (coalesce(avant, '{}'::jsonb) -> 'versement_valide_le') is distinct from (new.data -> 'versement_valide_le')
     or (coalesce(avant, '{}'::jsonb) -> 'versement_valide_par') is distinct from (new.data -> 'versement_valide_par') then
    if not public.est_admin_principal() then
      perform public.refus_role('Valider un versement de fonds (Chez le DG, BANQUE)', 'l''administrateur principal (le DG)');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists depenses_regles_versement_trg on public.depenses;
create trigger depenses_regles_versement_trg
  before insert or update on public.depenses
  for each row execute function public.depenses_regles_versement();

-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — doit afficher : true | true
-- ══════════════════════════════════════════════════════════════════
select
  exists (select 1 from pg_trigger where tgrelid = 'public.depenses'::regclass and tgname = 'depenses_regles_versement_trg') as verrou_versement,
  exists (select 1 from pg_proc where proname = 'est_admin_principal') as principal_reconnu;
