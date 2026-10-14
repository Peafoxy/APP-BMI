-- ============================================================
-- securite-40 — 🔄 L'ÉCHANGE D'UN ARTICLE : LE GÉRANT ET L'ADMINISTRATEUR
--
-- Timo, 14/10/2026 : « est-ce possible de ramener un article et prendre un
-- autre à sa place ? Le client ajoute l'argent si le nouvel article est plus
-- cher, ou BMI restitue l'argent s'il est moins cher » → « A c, B c, C b,
-- D non, lance ». « C b » = le gérant et l'administrateur.
--
-- L'application note l'article rendu sur l'ANCIENNE vente, comme une reprise
-- marquée `echange` (aucun argent rendu : il paie le nouvel article), et crée
-- une NOUVELLE vente qui porte `avoir_echange` (la part déjà payée). Sans ce
-- script, la base refuserait au gérant de toucher aux reprises (securite-13 :
-- l'administrateur principal seul) — et tout le lot resterait coincé.
--
-- Il REPREND la fonction des ventes de securite-33 en entier et n'y change que
-- deux choses :
--   1. les reprises : le principal comme avant ; le gérant et l'administrateur
--      peuvent AJOUTER des lignes marquées `echange` (sans argent rendu), sans
--      toucher aux anciennes — rien d'autre ;
--   2. `avoir_echange` : posé à la CRÉATION de la vente seulement, par le
--      gérant ou l'administrateur ; il ne se modifie jamais ensuite (il fait
--      baisser ce que le tiroir doit contenir).
-- Les mouvements de stock (echange_client, retour_defectueux) et la sortie
-- « Rendu sur échange » passent déjà par les règles existantes.
-- C'est le seul à coller. Le relancer est sans danger (create or replace).
-- ============================================================

-- Vrai si `apres` = `avant` + des lignes d'ÉCHANGE (echange = true, rien rendu).
create or replace function public.reprises_ajout_echange(avant jsonb, apres jsonb)
returns boolean language plpgsql immutable as $$
declare na int; nn int; i int;
begin
  if apres is null or jsonb_typeof(apres) <> 'array' then return false; end if;
  if avant is not null and jsonb_typeof(avant) <> 'array' then return false; end if;
  na := coalesce(jsonb_array_length(avant), 0);
  nn := jsonb_array_length(apres);
  if nn <= na then return false; end if;
  for i in 0 .. na - 1 loop
    if (avant -> i) is distinct from (apres -> i) then return false; end if;
  end loop;
  for i in na .. nn - 1 loop
    if (apres -> i -> 'echange') is distinct from 'true'::jsonb then return false; end if;
    if coalesce(apres -> i -> 'rembourse', '0'::jsonb) is distinct from '0'::jsonb then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.reprises_ajout_echange(jsonb, jsonb) from public, anon;
grant execute on function public.reprises_ajout_echange(jsonb, jsonb) to authenticated, service_role;

-- ══ VENTES (remplace securite-33, identique + l'échange) ══
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
  -- 🔄 securite-40 : le gérant et l'administrateur AJOUTENT une ligne d'échange.
  if (coalesce(avant, '{}'::jsonb) -> 'reprises') is distinct from (new.data -> 'reprises') then
    if not public.est_admin_principal()
       and not (r in ('gerant', 'admin') and public.reprises_ajout_echange(coalesce(avant, '{}'::jsonb) -> 'reprises', new.data -> 'reprises')) then
      perform public.refus_role('Reprendre un article vendu', 'l''administrateur principal (un échange : le gérant, l''administrateur)');
    end if;
    if coalesce(jsonb_array_length(new.data -> 'reprises'), 0) < coalesce(jsonb_array_length(coalesce(avant, '{}'::jsonb) -> 'reprises'), 0) then
      perform public.refus_role('Effacer une reprise', 'personne');
    end if;
  end if;
  -- 🔄 securite-40 : l'avoir d'un échange, à la création seulement.
  if (coalesce(avant, '{}'::jsonb) -> 'avoir_echange') is distinct from (new.data -> 'avoir_echange') then
    if avant is not null then
      perform public.refus_role('Modifier l''avoir d''un échange', 'personne');
    end if;
    if r not in ('gerant', 'admin') then
      perform public.refus_role('Enregistrer un échange d''article', 'le gérant, l''administrateur');
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
-- attendu : true | true | true | true
select
  (select prosrc like '%reprises_ajout_echange%' from pg_proc where proname = 'ventes_regles_roles') as echange_ouvert,
  (select prosrc like '%avoir_echange%' from pg_proc where proname = 'ventes_regles_roles') as avoir_garde,
  (select prosrc like '%panier_de_la_proforma%' from pg_proc where proname = 'ventes_regles_roles') as porte_proforma_gardee,
  exists (select 1 from pg_trigger where tgname = 'ventes_regles_roles_trg') as declencheur_en_place;
