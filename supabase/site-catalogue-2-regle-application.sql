-- ============================================================
-- SITE VITRINE — le stock affiché suit LA règle de l'application (20/10/2026)
-- ============================================================
-- Timo : « aligne le site sur la règle de l'application ».
--
-- POURQUOI : stock_calcule (fonction du site) retirait DEUX FOIS un article
-- sorti pour des 🛠 Travaux à crédit (ligne `deja_sorti`) ou vendu pour un
-- 🏗 chantier (ligne `au_chantier`) : une fois par la ligne de vente, une fois
-- par l'ajustement qui l'a vraiment sorti. Le site pouvait dire « épuisé »
-- alors qu'il en restait.
--
-- LA RÈGLE DE L'APPLICATION (stockActuel, src/lib/calculs.js) :
--   stock initial + entrées + tous les ajustements
--   − les quantités vendues, SAUF les lignes `deja_sorti` / `au_chantier`
--   (une vente ancienne sans liste d'articles compte son article unique).
-- Le site garde EN PLUS ce qui lui est propre : les commandes payées en ligne
-- sont retirées, pour ne jamais vendre deux fois en attendant leur saisie.
--
-- Même nom, mêmes arguments, même type de réponse, même protection : la vue
-- catalogue_public et les fonctions de commande en ligne ne bougent pas.
-- ⚠ PAS de « rollback » dans ce script : l'éditeur de Supabase envoie tout
-- le texte en une transaction, un rollback final défairait tout.
-- ============================================================

-- 1. Lire un nombre sans jamais lever d'erreur (déjà posé par le script 1)
create or replace function public.nombre_sur(p text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case when p ~ '^\s*[-+]?\d+(\.\d+)?\s*$' then p::numeric else 0 end;
$$;
revoke all on function public.nombre_sur(text) from public, anon, authenticated;

-- 2. « Vrai » au sens de l'application (true, 1, un texte non vide)
create or replace function public.est_vrai(j jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case jsonb_typeof(j)
    when 'boolean' then j::text = 'true'
    when 'number'  then (j #>> '{}')::numeric <> 0
    when 'string'  then (j #>> '{}') <> ''
    when 'object'  then true
    when 'array'   then true
    else false
  end;
$$;
revoke all on function public.est_vrai(jsonb) from public, anon, authenticated;

-- 3. Le stock, selon la règle de l'application
create or replace function public.stock_calcule(p_produit_id text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select floor(
      coalesce((select nombre_sur(data->>'initial') from produits where id = p_produit_id), 0)
    + coalesce((select nombre_sur(data->>'entrees') from produits where id = p_produit_id), 0)
    + coalesce((
        select sum(nombre_sur(data->>'qte'))
        from ajustements
        where data->>'produit_id' = p_produit_id
      ), 0)
    - coalesce((
        select sum(nombre_sur(art->>'qte'))
        from ventes,
             jsonb_array_elements(
               case when jsonb_typeof(data->'articles') = 'array'
                         and jsonb_array_length(data->'articles') > 0
                    then data->'articles'
                    else jsonb_build_array(jsonb_build_object(
                           'produit_id', data->'produit_id', 'qte', data->'qte'))
               end) art
        where art->>'produit_id' = p_produit_id
          and not est_vrai(art->'deja_sorti')
          and not est_vrai(art->'au_chantier')
      ), 0)
    - coalesce((
        select sum(nombre_sur(ligne->>'quantite'))
        from commandes_en_ligne, jsonb_array_elements(lignes) ligne
        where ligne->>'produit_id' = p_produit_id and statut = 'payee'
      ), 0)
  )::int;
$$;

-- 4. Vérifier : doit répondre « true | true »
select
  (select count(disponible) from public.catalogue_public) > 0 as catalogue_et_stock_lisibles,
  position('est_vrai' in (select prosrc from pg_proc
                          where oid = 'public.stock_calcule(text)'::regprocedure)) > 0 as regle_de_l_application;
