-- ============================================================
-- SÉCURITÉ 14 — LES REMISES PAR ARTICLE
-- (décision Timo, 10/09/2026 : « même sur la remise sur un article, au-delà
--  de 3 % ça devrait refuser » et « si la remise est offerte même sur un
--  article, plus possible d'offrir une remise générale »)
--
-- CE QUE POSE L'APPLICATION (2.101.131) : sur une vente comme sur une
-- proforma, chaque ligne peut porter `remise_ligne` (en F) ; la remise
-- générale est `remise_pct` (et `remise` / `remise_montant` en F).
--
-- CE QUE CE SCRIPT VERROUILLE (quand les lignes ou la remise changent ;
-- une ligne existante reprise telle quelle n'est pas concernée — upsert relu) :
--   • une remise de ligne au-delà de 3 % du prix de la ligne → administrateur seul ;
--   • une remise sur au moins un article ET une remise générale → refusé,
--     pour TOUT LE MONDE (l'une ou l'autre, jamais les deux).
-- Remplace ventes_regles_roles (securite-13) et proformas_regles_remise (securite-8).
--
-- À coller dans Supabase → SQL Editor → Run. Banc : scripts/tester-argent-sql.sh.
-- ============================================================

-- Les deux lectures d'une liste de lignes (ventes : `articles`, proformas : `lignes`).
create or replace function public.a_remise_sur_article(lignes jsonb)
returns boolean language sql immutable as $$
  select coalesce(bool_or(coalesce((l ->> 'remise_ligne')::numeric, 0) > 0), false)
  from jsonb_array_elements(coalesce(case when jsonb_typeof(lignes) = 'array' then lignes end, '[]'::jsonb)) l;
$$;
create or replace function public.remise_ligne_excessive(lignes jsonb)
returns boolean language sql immutable as $$
  select coalesce(bool_or(
    coalesce((l ->> 'remise_ligne')::numeric, 0) > 0
    and coalesce((l ->> 'remise_ligne')::numeric, 0) * 100
        > 3 * coalesce((l ->> 'qte')::numeric, 0) * coalesce((l ->> 'pu')::numeric, 0) + 0.5), false)
  from jsonb_array_elements(coalesce(case when jsonb_typeof(lignes) = 'array' then lignes end, '[]'::jsonb)) l;
$$;
revoke all on function public.a_remise_sur_article(jsonb) from public, anon;
revoke all on function public.remise_ligne_excessive(jsonb) from public, anon;
grant execute on function public.a_remise_sur_article(jsonb), public.remise_ligne_excessive(jsonb) to authenticated, service_role;

-- ══ 1. VENTES (remplace securite-13) ══
create or replace function public.ventes_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); pct numeric; pct_commande numeric; avant jsonb; remises_changees boolean;
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if r <> 'admin' then perform public.refus_role('Supprimer une vente', 'l''administrateur'); end if;
    return old;
  end if;
  if tg_op = 'INSERT' then select v.data into avant from public.ventes v where v.id = new.id; else avant := old.data; end if;
  -- La reprise d'un article (securite-13) : le principal seul, et jamais en arrière.
  if (coalesce(avant, '{}'::jsonb) -> 'reprises') is distinct from (new.data -> 'reprises') then
    if not public.est_admin_principal() then
      perform public.refus_role('Reprendre un article vendu', 'l''administrateur principal');
    end if;
    if coalesce(jsonb_array_length(new.data -> 'reprises'), 0) < coalesce(jsonb_array_length(coalesce(avant, '{}'::jsonb) -> 'reprises'), 0) then
      perform public.refus_role('Effacer une reprise', 'personne');
    end if;
  end if;
  -- Les remises par article (10/09/2026), quand les lignes ou la remise changent.
  remises_changees := avant is null
    or (avant -> 'articles') is distinct from (new.data -> 'articles')
    or (avant -> 'remise_pct') is distinct from (new.data -> 'remise_pct')
    or (avant -> 'remise') is distinct from (new.data -> 'remise');
  if remises_changees then
    if public.a_remise_sur_article(new.data -> 'articles')
       and (coalesce((new.data ->> 'remise_pct')::numeric, 0) > 0 or coalesce((new.data ->> 'remise')::numeric, 0) > 0) then
      perform public.refus_role('Remise sur un article ET remise générale sur la même vente', 'personne (l''une ou l''autre)');
    end if;
    if r <> 'admin' and public.remise_ligne_excessive(new.data -> 'articles') then
      perform public.refus_role('Remise supérieure à 3 % sur un article', 'l''administrateur');
    end if;
  end if;
  pct := coalesce((new.data ->> 'remise_pct')::numeric, 0);
  if pct > 3 and r <> 'admin'
     and (avant is null or coalesce((avant ->> 'remise_pct')::numeric, 0) is distinct from pct) then
    if new.data ->> 'commande_id' is not null then
      select coalesce((c.data ->> 'remise_pct')::numeric, 0) into pct_commande
        from public.commandes c where c.id = new.data ->> 'commande_id';
      if pct_commande is not null and pct_commande = pct then return new; end if;
    end if;
    perform public.refus_role('Remise supérieure à 3 % sur une vente', 'l''administrateur');
  end if;
  return new;
end;
$$;
drop trigger if exists ventes_regles_roles_trg on public.ventes;
create trigger ventes_regles_roles_trg
  before insert or update or delete on public.ventes
  for each row execute function public.ventes_regles_roles();

-- ══ 2. PROFORMAS (remplace securite-8) ══
create or replace function public.proformas_regles_remise()
returns trigger language plpgsql security definer set search_path = public as $$
declare avant jsonb; r text := public.role_jeton(); remises_changees boolean;
begin
  if public.jeton_de_service() then return new; end if;
  if tg_op = 'INSERT' then select p.data into avant from public.proformas p where p.id = new.id; else avant := old.data; end if;
  remises_changees := avant is null
    or (avant -> 'lignes') is distinct from (new.data -> 'lignes')
    or (avant -> 'remise_pct') is distinct from (new.data -> 'remise_pct')
    or (avant -> 'remise_montant') is distinct from (new.data -> 'remise_montant');
  if remises_changees and public.a_remise_sur_article(new.data -> 'lignes')
     and (coalesce((new.data ->> 'remise_pct')::numeric, 0) > 0 or coalesce((new.data ->> 'remise_montant')::numeric, 0) > 0) then
    perform public.refus_role('Remise sur un article ET remise générale sur le même proforma', 'personne (l''une ou l''autre)');
  end if;
  if r = 'admin' then return new; end if;
  if remises_changees and public.remise_ligne_excessive(new.data -> 'lignes') then
    perform public.refus_role('Remise supérieure à 3 % sur un article (proforma)', 'l''administrateur');
  end if;
  if coalesce((new.data ->> 'remise_pct')::numeric, 0) > 3
     and (avant is null or (avant ->> 'remise_pct') is distinct from (new.data ->> 'remise_pct')) then
    perform public.refus_role('Remise supérieure à 3 % sur un proforma', 'l''administrateur');
  end if;
  return new;
end;
$$;
drop trigger if exists proformas_regles_remise_trg on public.proformas;
create trigger proformas_regles_remise_trg
  before insert or update on public.proformas
  for each row execute function public.proformas_regles_remise();

-- VÉRIFICATION — doit afficher : true | true | true
select
  (select prosrc like '%Remise supérieure à 3 % sur un article%' from pg_proc where proname = 'ventes_regles_roles') as article_vente,
  -- ⚠ Pas d'apostrophe dans un motif LIKE : dans prosrc elles sont doublées (« false » à tort chez Timo, 10/09/2026).
  (select prosrc like '%sur le même proforma%' from pg_proc where proname = 'proformas_regles_remise') as exclusive_proforma,
  exists (select 1 from pg_proc where proname = 'remise_ligne_excessive') as regle_posee;
