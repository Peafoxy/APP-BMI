-- ============================================================
-- securite-53 — LE PRIX SOUS LE STOCK, LA DETTE PROTÉGÉE, LA VENTE FIGÉE
-- (Timo, 16/11/2026 : « 1, 2 et 3 », après l'audit « les données reçues de
-- l'appareil sont-elles contrôlées par la base ? »)
--
-- CE QUI ÉTAIT OUVERT
--   1. Le prix unitaire d'une vente, d'une proforma ou d'une commande se
--      tapait librement : la limite de remise se contournait en tapant un
--      prix plus bas. Rien ne le comparait au prix du stock.
--   2. Une dette n'était protégée que contre la suppression : son montant,
--      ce qui est payé et ses versements pouvaient être réécrits.
--   3. Une vente déjà encaissée n'était surveillée que pour ses remises,
--      ses reprises et ses échanges : articles, prix, moyen de paiement,
--      vendeur pouvaient être réécrits après coup.
--
-- CE QUE CE SCRIPT POSE — CINQ RÈGLES NOUVELLES, À PART.
--   Il ne remplace AUCUNE fonction existante (ventes_regles_roles,
--   proformas_regles_remise, dettes_regles_roles… restent telles quelles).
--
--   a. produits : la base retient l'ANCIEN prix de vente pendant 7 jours
--      (prix_vente_avant, prix_change_le). Sans cela, une vendeuse hors
--      connexion au moment où l'administrateur monte un prix verrait sa
--      vente, faite à l'ancien prix, refusée à la synchronisation — et tout
--      son lot resterait coincé. Personne ne peut écrire ces deux champs à
--      la main : c'est la base qui les pose.
--   b. ventes, à la CRÉATION : hors administrateur, un article du stock ne
--      se vend pas sous son prix. Pour baisser : la case Remise (limite,
--      autorisation à distance). Ne sont pas concernées : une vente née
--      d'une commande, d'un devis (caisse DÉPÔT CHANTIER), de travaux,
--      d'une réservation, d'une remise accordée par un administrateur ; une
--      proforma reprise garde SES prix.
--   c. ventes, APRÈS : hors administrateur, articles, prix, remises,
--      paiement, date, boutique, caisse, vendeur, commercial ne changent
--      plus. Les gestes prévus (reprise, échange, remise après-vente,
--      commission, corbeille…) écrivent d'autres champs : ils passent.
--   d. proformas et commandes : même règle de prix qu'à la vente (une ligne
--      déjà présente à ce prix avant la modification reste permise).
--   e. dettes : hors administrateur, un versement inscrit ne s'efface ni ne
--      se modifie ; « payé » ne baisse pas et ne monte qu'avec sa ligne de
--      versement ; le montant ne change que par une remise après-vente
--      (gérant) ou par un devis de pose seule corrigé avant tout versement.
--
-- RETOUR EN ARRIÈRE : tout en bas.
-- À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

-- Un nombre lu sans jamais lever (une case vide vaut 0).
create or replace function public.nombre_ou_zero(t text)
returns numeric language sql immutable as $$
  select case when t ~ '^-?[0-9]+(\.[0-9]+)?$' then t::numeric else 0 end;
$$;
revoke all on function public.nombre_ou_zero(text) from public, anon;
grant execute on function public.nombre_ou_zero(text) to authenticated, service_role;

-- jsonb « null » et champ absent : la même chose.
create or replace function public.champ_ou_rien(d jsonb, champ text)
returns jsonb language sql immutable as $$
  select nullif(d -> champ, 'null'::jsonb);
$$;
revoke all on function public.champ_ou_rien(jsonb, text) from public, anon;
grant execute on function public.champ_ou_rien(jsonb, text) to authenticated, service_role;


-- ══════════════════════════════════════════════════════════════════
-- a. LA MÉMOIRE DU PRIX DE VENTE (7 jours)
-- ══════════════════════════════════════════════════════════════════
create or replace function public.produits_memoire_prix()
returns trigger language plpgsql security definer set search_path = public as $$
declare avant jsonb; ancien numeric; garde numeric; limite text;
begin
  if tg_op = 'INSERT' then
    select p.data into avant from public.produits p where p.id = new.id;
    -- Un upsert sur une ligne qui existe : la branche UPDATE fait le travail.
    if avant is not null then return new; end if;
    new.data := new.data - 'prix_vente_avant' - 'prix_change_le';
    return new;
  end if;
  avant := old.data;
  limite := to_char((now() at time zone 'UTC') - interval '7 days', 'YYYY-MM-DD');
  if public.nombre_ou_zero(avant ->> 'prix_vente') is distinct from public.nombre_ou_zero(new.data ->> 'prix_vente') then
    ancien := public.nombre_ou_zero(avant ->> 'prix_vente');
    -- Deux changements rapprochés : on garde le plus BAS des anciens prix.
    if coalesce(avant ->> 'prix_change_le', '') >= limite then
      garde := least(ancien, public.nombre_ou_zero(avant ->> 'prix_vente_avant'));
    else
      garde := ancien;
    end if;
    new.data := new.data || jsonb_build_object(
      'prix_vente_avant', garde,
      'prix_change_le', to_char(now() at time zone 'UTC', 'YYYY-MM-DD'));
  else
    -- Le prix ne bouge pas : la mémoire reste CE QUE LA BASE AVAIT POSÉ.
    new.data := (new.data - 'prix_vente_avant' - 'prix_change_le')
      || case when avant ? 'prix_change_le'
              then jsonb_build_object('prix_vente_avant', avant -> 'prix_vente_avant', 'prix_change_le', avant -> 'prix_change_le')
              else '{}'::jsonb end;
  end if;
  return new;
end;
$$;
revoke all on function public.produits_memoire_prix() from public, anon;
drop trigger if exists produits_memoire_prix_trg on public.produits;
create trigger produits_memoire_prix_trg
  before insert or update on public.produits
  for each row execute function public.produits_memoire_prix();

-- Le prix sous lequel un article ne se vend pas : son prix de vente, ou
-- l'ancien s'il a changé depuis moins de 7 jours et qu'il était plus bas.
-- Article inconnu → null (aucune contrainte).
create or replace function public.prix_plancher(produit text)
returns numeric language sql stable security definer set search_path = public as $$
  select case
    when coalesce(p.data ->> 'prix_change_le', '') >= to_char((now() at time zone 'UTC') - interval '7 days', 'YYYY-MM-DD')
      then least(public.nombre_ou_zero(p.data ->> 'prix_vente'), public.nombre_ou_zero(p.data ->> 'prix_vente_avant'))
    else public.nombre_ou_zero(p.data ->> 'prix_vente') end
  from public.produits p where p.id = produit;
$$;
revoke all on function public.prix_plancher(text) from public, anon;
grant execute on function public.prix_plancher(text) to authenticated, service_role;

-- Le NOM du premier article vendu sous son prix, ou null. `toleres` : des
-- lignes qui portaient déjà ce prix (la version d'avant, la proforma reprise).
create or replace function public.ligne_sous_le_prix(lignes jsonb, toleres jsonb default '[]'::jsonb)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(l ->> 'article', ''), nullif(l ->> 'nom', ''), 'un article')
  from jsonb_array_elements(case when jsonb_typeof(lignes) = 'array' then lignes else '[]'::jsonb end) l
  where coalesce(l ->> 'produit_id', '') <> ''
    and coalesce(l ->> 'hors_boutique', '') <> 'true'
    and public.nombre_ou_zero(l ->> 'pu') + 0.5 < public.prix_plancher(l ->> 'produit_id')
    and not exists (
      select 1 from jsonb_array_elements(case when jsonb_typeof(toleres) = 'array' then toleres else '[]'::jsonb end) t
      where t ->> 'produit_id' = l ->> 'produit_id'
        and public.nombre_ou_zero(t ->> 'pu') <= public.nombre_ou_zero(l ->> 'pu') + 0.5)
  limit 1;
$$;
revoke all on function public.ligne_sous_le_prix(jsonb, jsonb) from public, anon;
grant execute on function public.ligne_sous_le_prix(jsonb, jsonb) to authenticated, service_role;


-- ══════════════════════════════════════════════════════════════════
-- b + c. LES VENTES : le prix à la création, puis la vente figée
-- ══════════════════════════════════════════════════════════════════
create or replace function public.ventes_regles_prix_gel()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); avant jsonb; champ text; fautif text; toleres jsonb := '[]'::jsonb;
begin
  if public.jeton_de_service() or r = 'admin' then return new; end if;
  if tg_op = 'INSERT' then select v.data into avant from public.ventes v where v.id = new.id; else avant := old.data; end if;

  -- c. Une vente qui EXISTE : ce qui a été encaissé ne se réécrit pas.
  if avant is not null then
    foreach champ in array array['articles','paiement','remise','remise_pct','rabais','frais_installation','frais_transport',
                                 'boutique','caisse','date','par','commercial','responsable'] loop
      if public.champ_ou_rien(avant, champ) is distinct from public.champ_ou_rien(new.data, champ) then
        perform public.refus_role(
          format('Modifier une vente déjà encaissée (%s)', champ),
          'l''administrateur (sinon : Reprise, Échange ou Remise après-vente)');
      end if;
    end loop;
    return new;
  end if;

  -- b. Une vente NEUVE : aucun article du stock sous son prix.
  if coalesce(new.data ->> 'reservation_id', '') <> '' then return new; end if;
  if coalesce(new.data ->> 'commande_id', '') <> ''
     and exists (select 1 from public.commandes c where c.id = new.data ->> 'commande_id') then return new; end if;
  if coalesce(new.data ->> 'travaux_id', '') <> ''
     and exists (select 1 from public.clients_installes c where c.id = new.data ->> 'travaux_id') then return new; end if;
  if coalesce(new.data ->> 'caisse', '') <> ''
     and (new.data ->> 'caisse') is distinct from (new.data ->> 'boutique') then return new; end if;
  if public.remise_autorisee_par_admin(new.id, new.data) then return new; end if;
  if coalesce(new.data ->> 'proforma_id', '') <> '' then
    select coalesce(p.data -> 'lignes', '[]'::jsonb) into toleres from public.proformas p where p.id = new.data ->> 'proforma_id';
  end if;
  fautif := public.ligne_sous_le_prix(new.data -> 'articles', coalesce(toleres, '[]'::jsonb));
  if fautif is not null then
    perform public.refus_role(format('Vendre « %s » sous le prix du stock', fautif),
                              'l''administrateur (sinon : la case Remise)');
  end if;
  return new;
end;
$$;
revoke all on function public.ventes_regles_prix_gel() from public, anon;
drop trigger if exists ventes_regles_prix_gel_trg on public.ventes;
create trigger ventes_regles_prix_gel_trg
  before insert or update on public.ventes
  for each row execute function public.ventes_regles_prix_gel();


-- ══════════════════════════════════════════════════════════════════
-- d. LES PROFORMAS ET LES COMMANDES : le même prix plancher
-- ══════════════════════════════════════════════════════════════════
create or replace function public.proformas_regles_prix()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); avant jsonb; fautif text;
begin
  if public.jeton_de_service() or r = 'admin' then return new; end if;
  if tg_op = 'INSERT' then select p.data into avant from public.proformas p where p.id = new.id; else avant := old.data; end if;
  if avant is not null and (avant -> 'lignes') is not distinct from (new.data -> 'lignes') then return new; end if;
  fautif := public.ligne_sous_le_prix(new.data -> 'lignes', coalesce(avant -> 'lignes', '[]'::jsonb));
  if fautif is not null then
    perform public.refus_role(format('Proposer « %s » sous le prix du stock (proforma)', fautif),
                              'l''administrateur (sinon : la case Remise)');
  end if;
  return new;
end;
$$;
revoke all on function public.proformas_regles_prix() from public, anon;
drop trigger if exists proformas_regles_prix_trg on public.proformas;
create trigger proformas_regles_prix_trg
  before insert or update on public.proformas
  for each row execute function public.proformas_regles_prix();

create or replace function public.commandes_regles_prix()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); avant jsonb; fautif text;
begin
  if public.jeton_de_service() or r = 'admin' then return new; end if;
  -- Une commande née d'un DEVIS porte les prix du devis (le rail au mètre…).
  if public.champ_ou_rien(new.data, 'origine_devis') is not null then return new; end if;
  if tg_op = 'INSERT' then select c.data into avant from public.commandes c where c.id = new.id; else avant := old.data; end if;
  if avant is not null and (avant -> 'articles') is not distinct from (new.data -> 'articles') then return new; end if;
  fautif := public.ligne_sous_le_prix(new.data -> 'articles', coalesce(avant -> 'articles', '[]'::jsonb));
  if fautif is not null then
    perform public.refus_role(format('Commander « %s » sous le prix du stock', fautif), 'l''administrateur');
  end if;
  return new;
end;
$$;
revoke all on function public.commandes_regles_prix() from public, anon;
drop trigger if exists commandes_regles_prix_trg on public.commandes;
create trigger commandes_regles_prix_trg
  before insert or update on public.commandes
  for each row execute function public.commandes_regles_prix();


-- ══════════════════════════════════════════════════════════════════
-- e. LES DETTES : versements, « payé » et montant
-- ══════════════════════════════════════════════════════════════════
create or replace function public.somme_paiements(p jsonb)
returns numeric language sql immutable as $$
  select coalesce(sum(public.nombre_ou_zero(x ->> 'montant')), 0)
  from jsonb_array_elements(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) x;
$$;
revoke all on function public.somme_paiements(jsonb) from public, anon;
grant execute on function public.somme_paiements(jsonb) to authenticated, service_role;

create or replace function public.dettes_regles_argent()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); avant jsonb; pa numeric; pn numeric; ma numeric; mn numeric; la jsonb; ln jsonb;
begin
  if public.jeton_de_service() or r = 'admin' then return new; end if;
  if tg_op = 'INSERT' then select d.data into avant from public.dettes d where d.id = new.id; else avant := old.data; end if;
  if avant is null then return new; end if;

  la := case when jsonb_typeof(avant -> 'paiements') = 'array' then avant -> 'paiements' else '[]'::jsonb end;
  ln := case when jsonb_typeof(new.data -> 'paiements') = 'array' then new.data -> 'paiements' else '[]'::jsonb end;
  if not (ln @> la) then
    perform public.refus_role('Effacer ou modifier un versement déjà inscrit sur une dette', 'l''administrateur');
  end if;

  pa := public.nombre_ou_zero(avant ->> 'paye'); pn := public.nombre_ou_zero(new.data ->> 'paye');
  if pn < pa - 0.5 then
    perform public.refus_role('Diminuer ce qui a été payé sur une dette', 'l''administrateur');
  end if;
  if pn - pa > public.somme_paiements(ln) - public.somme_paiements(la) + 0.5 then
    perform public.refus_role('Augmenter ce qui a été payé sur une dette sans la ligne du versement', 'l''administrateur');
  end if;

  ma := public.nombre_ou_zero(avant ->> 'montant'); mn := public.nombre_ou_zero(new.data ->> 'montant');
  if abs(mn - ma) > 0.5 then
    -- ✏️ Remise après-vente (gérant) : le montant BAISSE et l'entrée s'ajoute.
    if r = 'gerant' and mn < ma
       and coalesce(jsonb_array_length(public.champ_ou_rien(new.data, 'remises_apres_vente')), 0)
         > coalesce(jsonb_array_length(public.champ_ou_rien(avant, 'remises_apres_vente')), 0) then
      return new;
    end if;
    -- 🔧 Devis de pose seule corrigé : la dette suit, tant que rien n'est versé.
    if (avant ->> 'pose_seule') = 'true' and pa = 0 and r <> 'client' then return new; end if;
    perform public.refus_role('Changer le montant d''une dette',
      'l''administrateur (une remise après-vente : le gérant)');
  end if;
  return new;
end;
$$;
revoke all on function public.dettes_regles_argent() from public, anon;
drop trigger if exists dettes_regles_argent_trg on public.dettes;
create trigger dettes_regles_argent_trg
  before insert or update on public.dettes
  for each row execute function public.dettes_regles_argent();


-- VÉRIFICATION — doit afficher : true | true | true | true | true
select
  exists (select 1 from pg_trigger where tgname = 'produits_memoire_prix_trg') as memoire_du_prix,
  exists (select 1 from pg_trigger where tgname = 'ventes_regles_prix_gel_trg') as vente_prix_et_gel,
  exists (select 1 from pg_trigger where tgname = 'proformas_regles_prix_trg') as proforma_prix,
  exists (select 1 from pg_trigger where tgname = 'commandes_regles_prix_trg') as commande_prix,
  exists (select 1 from pg_trigger where tgname = 'dettes_regles_argent_trg') as dette_protegee;

-- RETOUR EN ARRIÈRE (à coller seulement si on veut retirer ces règles) :
-- drop trigger if exists produits_memoire_prix_trg on public.produits;
-- drop trigger if exists ventes_regles_prix_gel_trg on public.ventes;
-- drop trigger if exists proformas_regles_prix_trg on public.proformas;
-- drop trigger if exists commandes_regles_prix_trg on public.commandes;
-- drop trigger if exists dettes_regles_argent_trg on public.dettes;
