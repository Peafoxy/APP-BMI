-- ============================================================
-- SITE VITRINE — la corbeille des ventes et des articles (01/11/2026)
-- ============================================================
-- Timo : « Lance 3 » → « A a, B oui, C oui ». Supprimer une vente ou un
-- article ne l'efface plus : la fiche reste dans sa table 30 jours avec la
-- marque `supprime_le` (la corbeille). Le site lit ces tables directement :
--   • une VENTE à la corbeille ne retire plus son stock (comme l'application,
--     qui ne la compte plus) ; restaurée, elle le retire de nouveau ;
--   • un ARTICLE à la corbeille vaut 0 : le site le montre « indisponible ».
-- Tout le reste est la règle du script 2, mot pour mot. Même nom, mêmes
-- arguments, même type de réponse : la vue catalogue_public ne bouge pas.
-- ⚠ PAS de « rollback » dans ce script : l'éditeur de Supabase envoie tout
-- le texte en une transaction.
-- ============================================================

-- 1. Le stock, selon la règle de l'application — la corbeille comprise
create or replace function public.stock_calcule(p_produit_id text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when exists (select 1 from produits where id = p_produit_id
                           and coalesce(data->>'supprime_le', '') <> '')
    then 0 else floor(
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
          and coalesce(ventes.data->>'supprime_le', '') = ''
          and not est_vrai(art->'deja_sorti')
          and not est_vrai(art->'au_chantier')
      ), 0)
    - coalesce((
        select sum(nombre_sur(ligne->>'quantite'))
        from commandes_en_ligne, jsonb_array_elements(lignes) ligne
        where ligne->>'produit_id' = p_produit_id and statut = 'payee'
      ), 0)
  )::int end;
$$;

-- 2. Vérifier : doit répondre « true | true »
select
  (select count(disponible) from public.catalogue_public) > 0 as catalogue_et_stock_lisibles,
  position('supprime_le' in (select prosrc from pg_proc
                             where oid = 'public.stock_calcule(text)'::regprocedure)) > 0 as corbeille_comprise;
