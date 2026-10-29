-- ============================================================
-- SÉCURITÉ 45 — LA CARTE DE FIDÉLITÉ
-- (Timo, 29/10/2026 : « D la remise assignée à la carte est autorisée chez
-- le vendeur même hors de sa limite », « F l'admin principal met tout en
-- place », « 2 oui » — la remise est fixe, sans remise d'article en plus)
--
-- CE QUE POSE L'APPLICATION (lib/carteFidelite.js) : la carte vit sur la
-- fiche du client (`fidelite` : numéro FID-…, pourcentage, active) ; une
-- carte remplacée ou retirée part dans `fidelite_passees`. La vente scannée
-- porte `carte_fidelite.numero`.
--
-- CE QUE CE SCRIPT AJOUTE :
--   • `users_regles_fidelite` (un déclencheur À PART, qui ne touche pas
--     users_regles_comptes) : poser, changer, remplacer ou retirer une carte
--     = l'administrateur PRINCIPAL seul, création de fiche comprise ;
--   • `remise_de_la_carte` : vrai si la vente cite une carte ACTIVE, avec
--     SON pourcentage exact, et aucune remise sur un article ;
--   • `ventes_regles_roles` : reprend securite-44 EN ENTIER et laisse passer
--     cette remise au-delà de la limite.
--
-- ⚠ LE COUPLE : sans ce script, l'écran laisse passer la remise de la carte
-- et la base la refuse — tout le lot reste coincé.
-- À coller dans Supabase → SQL Editor → Run. Banc : tester-argent-sql.sh.
-- ============================================================

-- ══ 1. LA CARTE SUR LA FICHE : LE PRINCIPAL SEUL ══
create or replace function public.users_regles_fidelite()
returns trigger language plpgsql security definer set search_path = public as $$
declare avant jsonb;
begin
  if public.jeton_de_service() then return new; end if;
  if tg_op = 'INSERT' then
    select u.data into avant from public.users u where u.id = new.id;
  else
    avant := old.data;
  end if;
  if ((coalesce(avant, '{}'::jsonb) -> 'fidelite') is distinct from (new.data -> 'fidelite')
      or (coalesce(avant, '{}'::jsonb) -> 'fidelite_passees') is distinct from (new.data -> 'fidelite_passees'))
     and not public.est_admin_principal() then
    perform public.refus_role('Mettre en place une carte de fidélité', 'l''administrateur principal');
  end if;
  return new;
end;
$$;
drop trigger if exists users_regles_fidelite_trg on public.users;
create trigger users_regles_fidelite_trg
  before insert or update on public.users
  for each row execute function public.users_regles_fidelite();

-- ══ 2. LA REMISE D'UNE CARTE ACTIVE, TELLE QUELLE ══
create or replace function public.remise_de_la_carte(vente jsonb)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare f jsonb; num text := vente -> 'carte_fidelite' ->> 'numero';
begin
  if coalesce(num, '') = '' then return false; end if;
  select u.data -> 'fidelite' into f from public.users u
   where u.data -> 'fidelite' ->> 'numero' = num
     and coalesce((u.data -> 'fidelite' ->> 'active')::boolean, true)
   limit 1;
  if f is null then return false; end if;
  if coalesce((f ->> 'pct')::numeric, -1) <> coalesce((vente ->> 'remise_pct')::numeric, 0) then return false; end if;
  if public.a_remise_sur_article(vente -> 'articles') then return false; end if;
  return true;
end;
$$;
revoke all on function public.remise_de_la_carte(jsonb) from public, anon;
grant execute on function public.remise_de_la_carte(jsonb) to authenticated, service_role;

-- ══ 3. VENTES (remplace securite-44, identique + la carte) ══
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
  -- ✏️ securite-43 : la remise après-vente — gérant, administrateur, jamais
  -- en arrière (une entrée posée reste posée, comme une reprise).
  if (coalesce(avant, '{}'::jsonb) -> 'remises_apres_vente') is distinct from (new.data -> 'remises_apres_vente') then
    if r not in ('gerant', 'admin') then
      perform public.refus_role('Accorder une remise après-vente', 'le gérant, l''administrateur');
    end if;
    if coalesce(jsonb_array_length(new.data -> 'remises_apres_vente'), 0) < coalesce(jsonb_array_length(coalesce(avant, '{}'::jsonb) -> 'remises_apres_vente'), 0) then
      perform public.refus_role('Effacer une remise après-vente', 'personne');
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
       and not public.panier_de_la_proforma(new.data)
       and not public.remise_autorisee_par_admin(new.id, new.data) then
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
    -- 🏷 securite-44 : la remise ACCORDÉE à distance par un administrateur.
    if public.remise_autorisee_par_admin(new.id, new.data) then return new; end if;
    -- 💳 securite-45 : la remise d'une CARTE DE FIDÉLITÉ active, telle quelle.
    if public.remise_de_la_carte(new.data) then return new; end if;
    perform public.refus_role(format('Remise supérieure à %s %% sur une vente', plafond), 'l''administrateur');
  end if;
  return new;
end;
$$;
drop trigger if exists ventes_regles_roles_trg on public.ventes;
create trigger ventes_regles_roles_trg
  before insert or update or delete on public.ventes
  for each row execute function public.ventes_regles_roles();

-- VÉRIFICATION — doit afficher : true | true | true | true
select
  exists (select 1 from pg_trigger where tgname = 'users_regles_fidelite_trg') as carte_reservee_au_principal,
  exists (select 1 from pg_proc where proname = 'remise_de_la_carte') as remise_de_la_carte_lue,
  (select prosrc like '%remise_de_la_carte%' from pg_proc where proname = 'ventes_regles_roles') as ventes_ouvertes_a_la_carte,
  (select prosrc like '%remise_autorisee_par_admin%' from pg_proc where proname = 'ventes_regles_roles') as accord_a_distance_intact;
