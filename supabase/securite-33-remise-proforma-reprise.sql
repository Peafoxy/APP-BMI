-- ============================================================
-- securite-33 — LA REMISE D'UNE PROFORMA SUIT SA VENTE, SI LE PANIER N'A PAS BOUGÉ
--
-- Timo, 30/09/2026 (capture : une proforma à 7 % faite par l'administrateur,
-- reprise par le gérant, refusée à l'encaissement) → décision « b ».
-- Une remise au-delà de 3 % (générale, ou sur un article) est acceptée pour
-- TOUT vendeur quand la vente reprend une proforma (proforma_id) et que son
-- panier est RESTÉ LE MÊME : mêmes articles, mêmes quantités, mêmes prix,
-- mêmes remises de ligne, même pourcentage. Un article ajouté, une quantité
-- ou un prix changé → la limite de 3 % revient (administrateur seul).
-- Seul un administrateur peut émettre une proforma au-delà de 3 %
-- (proformas_regles_remise, securite-14) : la remise a donc déjà été accordée.
--
-- Il REPREND la fonction des ventes de securite-14 en entier et n'y ajoute
-- que cette porte (deux lignes). Rien d'autre ne change. C'est le seul à coller.
-- Le relancer est sans danger (create or replace).
-- ============================================================

-- Le panier d'une liste de lignes, rangé et regroupé (même article au même
-- prix = une ligne), pour comparer sans dépendre de l'ordre.
create or replace function public.panier_normalise(lignes jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_build_object('p', p, 'pu', pu, 'q', q, 'r', r) order by p, pu), '[]'::jsonb)
  from (
    select coalesce(l ->> 'produit_id', '') as p,
           coalesce((l ->> 'pu')::numeric, 0) as pu,
           sum(coalesce((l ->> 'qte')::numeric, 0)) as q,
           sum(coalesce((l ->> 'remise_ligne')::numeric, 0)) as r
    from jsonb_array_elements(coalesce(lignes, '[]'::jsonb)) l
    group by 1, 2
  ) t
$$;

-- Vrai si la vente reprend SA proforma sans rien y changer.
create or replace function public.panier_de_la_proforma(vente jsonb)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare pf jsonb;
begin
  if coalesce(vente ->> 'proforma_id', '') = '' then return false; end if;
  select p.data into pf from public.proformas p where p.id = vente ->> 'proforma_id';
  if pf is null or coalesce(jsonb_array_length(pf -> 'lignes'), 0) = 0 then return false; end if;
  -- Une vieille proforma sans produit_id sur chaque ligne n'ouvre rien.
  if exists (select 1 from jsonb_array_elements(pf -> 'lignes') l where coalesce(l ->> 'produit_id', '') = '') then return false; end if;
  if coalesce((pf ->> 'remise_pct')::numeric, 0) <> coalesce((vente ->> 'remise_pct')::numeric, 0) then return false; end if;
  return public.panier_normalise(pf -> 'lignes') = public.panier_normalise(vente -> 'articles');
end;
$$;
revoke all on function public.panier_normalise(jsonb) from public, anon;
revoke all on function public.panier_de_la_proforma(jsonb) from public, anon;
grant execute on function public.panier_normalise(jsonb), public.panier_de_la_proforma(jsonb) to authenticated, service_role;

-- ══ VENTES (remplace securite-14, identique + la porte de la proforma) ══
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
    if r <> 'admin' and public.remise_ligne_excessive(new.data -> 'articles')
       and not public.panier_de_la_proforma(new.data) then
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
    -- 🧾 securite-33 : la remise d'une proforma reprise TELLE QUELLE.
    if public.panier_de_la_proforma(new.data) then return new; end if;
    perform public.refus_role('Remise supérieure à 3 % sur une vente', 'l''administrateur');
  end if;
  return new;
end;
$$;
drop trigger if exists ventes_regles_roles_trg on public.ventes;
create trigger ventes_regles_roles_trg
  before insert or update or delete on public.ventes
  for each row execute function public.ventes_regles_roles();

-- Vérification (⚠ sans apostrophe dans le morceau cherché — piège du 24/09) :
-- attendu : true | true | true
select
  (select prosrc like '%panier_de_la_proforma%' from pg_proc where proname = 'ventes_regles_roles') as porte_proforma,
  exists (select 1 from pg_proc where proname = 'panier_normalise') as regle_posee,
  exists (select 1 from pg_trigger where tgname = 'ventes_regles_roles_trg') as declencheur_en_place;
