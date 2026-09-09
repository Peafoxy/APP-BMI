-- ============================================================
-- SÉCURITÉ 11 — LE VERSEMENT DES FONDS : LE GÉRANT, PAS LE VENDEUR ;
--               LA CLÔTURE DE CAISSE : LE VENDEUR AUSSI
-- (décision Timo, 09/09/2026 : « on va restreindre le versement au vendeur
--  pour le moment… c'est au gérant de faire le versement »)
--
-- Remplace la fonction de securite-10 (même déclencheur) en y ajoutant UNE
-- règle : créer une dépense de catégorie « Versement de fonds » — la sortie
-- de la boutique comme l'entrée miroir chez le comptable — est réservé au
-- gérant et à l'administrateur. La validation du DG (versement_valide_le /
-- _par → administrateur principal seul) est reprise telle quelle.
-- Upsert compris : une ligne qui existe déjà n'est pas une création.
--
-- À coller dans Supabase → SQL Editor → Run. Banc : scripts/tester-argent-sql.sh.
-- ============================================================

create or replace function public.depenses_regles_versement()
returns trigger language plpgsql security definer set search_path = public as $$
declare avant jsonb; r text := public.role_jeton();
begin
  if public.jeton_de_service() then return new; end if;
  if tg_op = 'INSERT' then
    select d.data into avant from public.depenses d where d.id = new.id;
  else
    avant := old.data;
  end if;
  -- Créer un versement de fonds : gérant ou administrateur.
  if avant is null and coalesce(new.data ->> 'categorie', '') = 'Versement de fonds' and r not in ('gerant', 'admin') then
    perform public.refus_role('Verser les fonds', 'le gérant, l''administrateur');
  end if;
  -- Valider un versement (Chez le DG, BANQUE) : l'administrateur principal.
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

-- ══ LA CLÔTURE DE CAISSE : LE VENDEUR AUSSI ══
-- Timo, 09/09/2026 : « comment la clôture de la caisse peut être impossible
-- à un vendeur ? » — la règle du 04/09 (gérant, admin) était un malentendu.
-- Remplace la fonction de securite-4 (même déclencheur).
create or replace function public.clotures_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if public.role_jeton() not in ('vendeur', 'gerant', 'admin') then perform public.refus_role('Clôturer la caisse', 'le vendeur, le gérant, l''administrateur'); end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists clotures_regles_roles_trg on public.clotures;
create trigger clotures_regles_roles_trg
  before insert or update or delete on public.clotures
  for each row execute function public.clotures_regles_roles();

-- VÉRIFICATION — doit afficher : true | true | true
select
  exists (select 1 from pg_trigger where tgrelid = 'public.depenses'::regclass and tgname = 'depenses_regles_versement_trg') as verrou_versement,
  (select prosrc like '%Verser les fonds%' from pg_proc where proname = 'depenses_regles_versement') as gerant_seul,
  (select prosrc like '%''vendeur'', ''gerant'', ''admin''%' from pg_proc where proname = 'clotures_regles_roles') as cloture_vendeur;
