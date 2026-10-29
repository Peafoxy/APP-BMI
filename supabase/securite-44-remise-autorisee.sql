-- ============================================================
-- SÉCURITÉ 44 — LA REMISE PONCTUELLE AUTORISÉE À DISTANCE
-- (Timo, 29/10/2026 : « donner la possibilité ponctuelle à un gérant ou
-- vendeur d'appliquer une remise à un client » → « A a », « 1 tout admin »)
--
-- CE QUE POSE L'APPLICATION (lib/autorisationRemise.js) :
--   • le vendeur ou le gérant DEMANDE une remise au-delà de la limite : la
--     demande se range sur SA boutique, dans `demandes_remise` ;
--   • tout administrateur ACCORDE : l'accord se range dans
--     `remises_autorisees` de la boutique — un champ que SEUL un
--     administrateur peut écrire (rien à changer pour ça : tout champ de la
--     boutique hors `demandes`/`outillage` est déjà réservé à l'admin) ;
--   • la vente porte `remise_autorisee.id`.
--
-- CE QUE CE SCRIPT AJOUTE :
--   • `remise_autorisee_par_admin` : vrai si la vente cite un accord rangé
--     sur SA boutique, pour le MÊME panier (panier_normalise), le MÊME %,
--     le MÊME client (8 derniers chiffres), et qu'aucune AUTRE vente ne l'a
--     déjà utilisé ;
--   • `ventes_regles_roles` : reprend securite-43 EN ENTIER et ouvre la
--     limite (générale et par article) quand cet accord existe ;
--   • `boutiques_regles_roles` : reprend securite-26 EN ENTIER et laisse
--     écrire `demandes_remise` comme `demandes`.
--
-- ⚠ LE COUPLE : sans ce script, l'écran laisse passer une remise accordée
-- et la base la refuse — tout le lot reste coincé.
-- À coller dans Supabase → SQL Editor → Run. Banc : tester-argent-sql.sh.
-- ============================================================

-- ══ 1. L'ACCORD D'UN ADMINISTRATEUR, LU SUR LA BOUTIQUE DE LA VENTE ══
create or replace function public.remise_autorisee_par_admin(vente_id text, vente jsonb)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare a jsonb; cle text := vente -> 'remise_autorisee' ->> 'id';
begin
  if coalesce(cle, '') = '' then return false; end if;
  select x into a
    from public.boutiques b,
         jsonb_array_elements(case when jsonb_typeof(b.data -> 'remises_autorisees') = 'array' then b.data -> 'remises_autorisees' else '[]'::jsonb end) x
   where b.data ->> 'nom' = vente ->> 'boutique' and x ->> 'id' = cle
   limit 1;
  if a is null then return false; end if;
  if coalesce((a ->> 'remise_pct')::numeric, 0) <> coalesce((vente ->> 'remise_pct')::numeric, 0) then return false; end if;
  if public.panier_normalise(a -> 'lignes') <> public.panier_normalise(vente -> 'articles') then return false; end if;
  if right(regexp_replace(coalesce(a ->> 'tel', ''), '[^0-9]', '', 'g'), 8)
     <> right(regexp_replace(coalesce(vente ->> 'tel', ''), '[^0-9]', '', 'g'), 8) then return false; end if;
  -- Une seule vente par accord.
  if exists (select 1 from public.ventes v where v.id <> vente_id and v.data -> 'remise_autorisee' ->> 'id' = cle) then return false; end if;
  return true;
end;
$$;
revoke all on function public.remise_autorisee_par_admin(text, jsonb) from public, anon;
grant execute on function public.remise_autorisee_par_admin(text, jsonb) to authenticated, service_role;

-- ══ 2. VENTES (remplace securite-43, identique + l'accord à distance) ══
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
    perform public.refus_role(format('Remise supérieure à %s %% sur une vente', plafond), 'l''administrateur');
  end if;
  return new;
end;
$$;
drop trigger if exists ventes_regles_roles_trg on public.ventes;
create trigger ventes_regles_roles_trg
  before insert or update or delete on public.ventes
  for each row execute function public.ventes_regles_roles();

-- ══ 3. BOUTIQUES (remplace securite-26, identique + `demandes_remise`) ══
create or replace function public.boutiques_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); champ text; avant jsonb; reste_old jsonb; reste_new jsonb;
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if r <> 'admin' then perform public.refus_role('Supprimer une boutique', 'l''administrateur'); end if;
    return old;
  end if;
  -- ⚠ UPSERT : AVANT INSERT se déclenche même si la ligne existe déjà.
  if tg_op = 'INSERT' then
    select b.data into avant from public.boutiques b where b.id = new.id;
    if avant is null then
      if r <> 'admin' and not coalesce((new.data ->> 'terrain')::boolean, false) then
        perform public.refus_role('Créer une boutique', 'l''administrateur');
      end if;
      return new;
    end if;
  else
    avant := old.data;
  end if;
  -- 🏷 securite-44 : `demandes_remise` s'écrit comme `demandes` (le vendeur
  -- y pose sa demande) ; `remises_autorisees` reste à l'administrateur.
  reste_old := avant - 'demandes' - 'demandes_remise' - 'updated_at' - 'outillage';
  reste_new := new.data - 'demandes' - 'demandes_remise' - 'updated_at' - 'outillage';
  if reste_old is distinct from reste_new then
    if r <> 'admin' then perform public.refus_role('Modifier une boutique', 'l''administrateur'); end if;
    for champ in select k from jsonb_object_keys(reste_old || reste_new) k loop
      if (champ like 'accueil\_%' or champ like 'cachet%') and public.champ_change(reste_old, reste_new, champ)
         and not public.est_admin_principal() then
        perform public.refus_role('Personnaliser l''écran de connexion ou le cachet', 'l''administrateur principal');
      end if;
    end loop;
  end if;
  -- 🧰 Le registre de l'outillage : le chef technicien, le magasinier, l'admin.
  if (avant -> 'outillage') is distinct from (new.data -> 'outillage')
     and not public.a_pouvoir_outillage() then
    -- ⏱🏗🧰 PREMIÈRE EXCEPTION : le technicien qui DÉTIENT l'outil justifie son
    -- retard (securite-23), dit sur quel chantier il part (securite-25) et
    -- compte la boîte qu'il ramène (securite-26).
    -- 💵 SECONDE EXCEPTION : celui qui paie une part d'installation INSCRIT la
    -- retenue pour un outil perdu (securite-24). Dans les deux cas, tout le
    -- reste du registre doit être identique — sinon c'est un autre geste.
    if not (r in ('technicien', 'technicien_bmi')
            and public.outillage_sans_gestes_du_detenteur(avant -> 'outillage')
                is not distinct from public.outillage_sans_gestes_du_detenteur(new.data -> 'outillage'))
       and not (public.a_pouvoir_retenue_outil()
            and public.outillage_sans_retenues(avant -> 'outillage')
                is not distinct from public.outillage_sans_retenues(new.data -> 'outillage')) then
      perform public.refus_role('Tenir le registre de l''outillage',
        'le chef des techniciens, le magasinier ou l''administrateur');
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists boutiques_regles_roles_trg on public.boutiques;
create trigger boutiques_regles_roles_trg
  before insert or update or delete on public.boutiques
  for each row execute function public.boutiques_regles_roles();

-- VÉRIFICATION — doit afficher : true | true | true | true
select
  exists (select 1 from pg_proc where proname = 'remise_autorisee_par_admin') as accord_lu,
  (select prosrc like '%remise_autorisee_par_admin%' from pg_proc where proname = 'ventes_regles_roles') as ventes_ouvertes_a_l_accord,
  (select prosrc like '%demandes_remise%' from pg_proc where proname = 'boutiques_regles_roles') as boutiques_demande_permise,
  (select prosrc like '%outillage_sans_gestes_du_detenteur%' from pg_proc where proname = 'boutiques_regles_roles') as outillage_intact;
