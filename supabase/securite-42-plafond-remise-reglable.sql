-- ============================================================
-- SÉCURITÉ 42 — LA LIMITE DE REMISE SANS ADMINISTRATEUR EST RÉGLABLE
-- (Timo, 29/10/2026 : « Ramener la limite de 3 % d'un gérant dans
-- paramètres.. Ou on peut augmenter ou diminuer à tout moment. »)
--
-- JUSQU'ICI, la limite de 3 % était un chiffre GRAVÉ dans ce script
-- (securite-14, repris par securite-33, securite-34, securite-40). Elle se
-- règle désormais depuis ⚙ Paramètres (champ `plafond_remise_pct`, posé sur
-- CHAQUE boutique — comme la durée de stock visée, `reappro_couverture_jours`
-- : rien à coller pour le réglage lui-même, l'administrateur l'écrit déjà).
--
-- ⚠ LE COUPLE : l'application (lib/calculs.js, `plafondRemise(db)`) et ce
-- script doivent lire la MÊME limite. Sans lui, l'écran laisserait passer
-- une remise que la base refuse encore à 3 %, et tout le lot resterait
-- coincé derrière un refus que personne ne comprendrait.
--
-- CE QUE CE SCRIPT CHANGE : `remise_ligne_excessive` reçoit désormais le
-- PLAFOND en second argument (3 par défaut, pour un appel qui ne le
-- donnerait pas) ; `ventes_regles_roles` (remplace securite-40) et
-- `proformas_regles_remise` (remplace securite-34) LISENT ce plafond sur la
-- boutique de la vente / de la proforma (`plafond_remise_boutique`), au lieu
-- du chiffre 3 écrit en dur. RIEN D'AUTRE ne change : les reprises,
-- l'échange, la remise d'une proforma reprise telle quelle, la modification
-- d'une proforma — tout le reste est repris MOT POUR MOT.
--
-- À coller dans Supabase → SQL Editor → Run. Banc : tester-argent-sql.sh.
-- ============================================================

-- La limite réglée sur la boutique (par son NOM), 3 % si rien n'est réglé.
-- `max()` garantit toujours UNE ligne, même si aucune boutique ne correspond
-- (boutique supprimée, « BANQUE », « Chez le DG »…).
create or replace function public.plafond_remise_boutique(nom text)
returns numeric language sql stable set search_path = public as $$
  select coalesce(max((b.data ->> 'plafond_remise_pct')::numeric), 3)
  from public.boutiques b where b.data ->> 'nom' = nom;
$$;
revoke all on function public.plafond_remise_boutique(text) from public, anon;
grant execute on function public.plafond_remise_boutique(text) to authenticated, service_role;

-- `remise_ligne_excessive` prend désormais le plafond en second argument
-- (3 % par défaut). L'ANCIENNE forme à un seul argument est retirée : la
-- garder aurait rendu tout appel à un argument AMBIGU entre les deux formes.
drop function if exists public.remise_ligne_excessive(jsonb);
create or replace function public.remise_ligne_excessive(lignes jsonb, plafond numeric default 3)
returns boolean language sql immutable as $$
  select coalesce(bool_or(
    coalesce((l ->> 'remise_ligne')::numeric, 0) > 0
    and coalesce((l ->> 'remise_ligne')::numeric, 0) * 100
        > plafond * coalesce((l ->> 'qte')::numeric, 0) * coalesce((l ->> 'pu')::numeric, 0) + 0.5), false)
  from jsonb_array_elements(coalesce(case when jsonb_typeof(lignes) = 'array' then lignes end, '[]'::jsonb)) l;
$$;
revoke all on function public.remise_ligne_excessive(jsonb, numeric) from public, anon;
grant execute on function public.remise_ligne_excessive(jsonb, numeric) to authenticated, service_role;

-- `a_remise_sur_article` ne regarde pas le pourcentage : elle ne change pas
-- (déjà posée par securite-14, reprise ici en grant pour mémoire — inchangée).

-- ══ 1. VENTES (remplace securite-40, identique + le plafond réglable) ══
create or replace function public.ventes_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); pct numeric; pct_commande numeric; avant jsonb; remises_changees boolean; plafond numeric;
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if r <> 'admin' then perform public.refus_role('Supprimer une vente', 'l''administrateur'); end if;
    return old;
  end if;
  if tg_op = 'INSERT' then select v.data into avant from public.ventes v where v.id = new.id; else avant := old.data; end if;
  plafond := public.plafond_remise_boutique(new.data ->> 'boutique');
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
  -- ⚙ securite-42 : la limite est désormais celle réglée sur la boutique.
  remises_changees := avant is null
    or (avant -> 'articles') is distinct from (new.data -> 'articles')
    or (avant -> 'remise_pct') is distinct from (new.data -> 'remise_pct')
    or (avant -> 'remise') is distinct from (new.data -> 'remise');
  if remises_changees then
    if public.a_remise_sur_article(new.data -> 'articles')
       and (coalesce((new.data ->> 'remise_pct')::numeric, 0) > 0 or coalesce((new.data ->> 'remise')::numeric, 0) > 0) then
      perform public.refus_role('Remise sur un article ET remise générale sur la même vente', 'personne (l''une ou l''autre)');
    end if;
    if r <> 'admin' and public.remise_ligne_excessive(new.data -> 'articles', plafond)
       and not public.panier_de_la_proforma(new.data) then
      perform public.refus_role(format('Remise supérieure à %s %% sur un article', plafond), 'l''administrateur');
    end if;
  end if;
  pct := coalesce((new.data ->> 'remise_pct')::numeric, 0);
  if pct > plafond and r <> 'admin'
     and (avant is null or coalesce((avant ->> 'remise_pct')::numeric, 0) is distinct from pct) then
    if new.data ->> 'commande_id' is not null then
      select coalesce((c.data ->> 'remise_pct')::numeric, 0) into pct_commande
        from public.commandes c where c.id = new.data ->> 'commande_id';
      if pct_commande is not null and pct_commande = pct then return new; end if;
    end if;
    -- 🧾 securite-33 : la remise d'une proforma reprise TELLE QUELLE.
    if public.panier_de_la_proforma(new.data) then return new; end if;
    perform public.refus_role(format('Remise supérieure à %s %% sur une vente', plafond), 'l''administrateur');
  end if;
  return new;
end;
$$;
drop trigger if exists ventes_regles_roles_trg on public.ventes;
create trigger ventes_regles_roles_trg
  before insert or update or delete on public.ventes
  for each row execute function public.ventes_regles_roles();

-- ══ 2. PROFORMAS (remplace securite-34, identique + le plafond réglable) ══
create or replace function public.proformas_regles_remise()
returns trigger language plpgsql security definer set search_path = public as $$
declare avant jsonb; r text := public.role_jeton(); remises_changees boolean; plafond numeric;
begin
  if public.jeton_de_service() then return new; end if;
  if tg_op = 'INSERT' then select p.data into avant from public.proformas p where p.id = new.id; else avant := old.data; end if;
  plafond := public.plafond_remise_boutique(new.data ->> 'boutique');
  remises_changees := avant is null
    or (avant -> 'lignes') is distinct from (new.data -> 'lignes')
    or (avant -> 'remise_pct') is distinct from (new.data -> 'remise_pct')
    or (avant -> 'remise_montant') is distinct from (new.data -> 'remise_montant');
  if remises_changees and public.a_remise_sur_article(new.data -> 'lignes')
     and (coalesce((new.data ->> 'remise_pct')::numeric, 0) > 0 or coalesce((new.data ->> 'remise_montant')::numeric, 0) > 0) then
    perform public.refus_role('Remise sur un article ET remise générale sur le même proforma', 'personne (l''une ou l''autre)');
  end if;
  if r = 'admin' then return new; end if;
  -- ✏️ securite-34 : une proforma dont la remise dépasse la limite (générale
  -- ou sur un article) ne se modifie que par l'administrateur.
  if avant is not null and remises_changees
     and (coalesce((avant ->> 'remise_pct')::numeric, 0) > plafond or public.remise_ligne_excessive(avant -> 'lignes', plafond)) then
    perform public.refus_role(format('Modifier une proforma dont la remise dépasse %s %%', plafond), 'l''administrateur');
  end if;
  if remises_changees and public.remise_ligne_excessive(new.data -> 'lignes', plafond) then
    perform public.refus_role(format('Remise supérieure à %s %% sur un article (proforma)', plafond), 'l''administrateur');
  end if;
  if coalesce((new.data ->> 'remise_pct')::numeric, 0) > plafond
     and (avant is null or (avant ->> 'remise_pct') is distinct from (new.data ->> 'remise_pct')) then
    perform public.refus_role(format('Remise supérieure à %s %% sur un proforma', plafond), 'l''administrateur');
  end if;
  return new;
end;
$$;
drop trigger if exists proformas_regles_remise_trg on public.proformas;
create trigger proformas_regles_remise_trg
  before insert or update on public.proformas
  for each row execute function public.proformas_regles_remise();

-- VÉRIFICATION — doit afficher : true | true | true | true | true
select
  (select prosrc like '%plafond_remise_boutique%' from pg_proc where proname = 'ventes_regles_roles') as ventes_lit_le_reglage,
  (select prosrc like '%plafond_remise_boutique%' from pg_proc where proname = 'proformas_regles_remise') as proformas_lit_le_reglage,
  (select pronargs = 2 from pg_proc where proname = 'remise_ligne_excessive') as fonction_a_deux_arguments,
  (select count(*) = 1 from pg_proc where proname = 'remise_ligne_excessive') as une_seule_forme,
  exists (select 1 from pg_trigger where tgname = 'ventes_regles_roles_trg') as declencheur_en_place;
