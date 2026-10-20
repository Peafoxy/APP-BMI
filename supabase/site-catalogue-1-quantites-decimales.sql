-- ============================================================
-- SITE VITRINE — le calcul du stock ne plante plus sur une quantité à virgule
-- (20/10/2026)
-- ============================================================
-- POURQUOI : la page Boutique de bmitogo.com affichait « Le catalogue est
-- temporairement indisponible ». La fonction stock_calcule (posée par le site,
-- migration 0001) lisait chaque quantité comme un NOMBRE ENTIER. Une vente de
-- 2,5 (un câble au mètre) et son ajustement de -2,5 sont dans la base : la
-- conversion de « -2.5 » en entier lève une erreur, et TOUT le catalogue tombe
-- avec elle. (Le comptage `count(*)` de la vue passait : il ne calcule pas le
-- stock — d'où « 168 » sans erreur.)
--
-- CE QUI CHANGE : chaque quantité est lue comme un nombre à virgule par
-- nombre_sur() (une valeur illisible vaut 0 au lieu de faire tomber le
-- catalogue), puis le stock est arrondi À L'ENTIER INFÉRIEUR (0,5 m de câble
-- restant = « pas disponible »). La fonction garde son nom, ses arguments et
-- son type de réponse : la vue catalogue_public et les fonctions de commande
-- en ligne qui l'appellent ne bougent pas. Rien d'autre n'est touché.
-- ============================================================

-- 1. Lire un nombre sans jamais lever d'erreur
create or replace function public.nombre_sur(p text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case when p ~ '^\s*[-+]?\d+(\.\d+)?\s*$' then p::numeric else 0 end;
$$;
revoke all on function public.nombre_sur(text) from public, anon, authenticated;

-- 2. Le stock, comme avant, avec des quantités à virgule permises
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
             jsonb_array_elements(case when jsonb_typeof(data->'articles') = 'array'
                                       then data->'articles' else '[]'::jsonb end) art
        where art->>'produit_id' = p_produit_id
      ), 0)
    - coalesce((
        select sum(nombre_sur(ligne->>'quantite'))
        from commandes_en_ligne, jsonb_array_elements(lignes) ligne
        where ligne->>'produit_id' = p_produit_id and statut = 'payee'
      ), 0)
  )::int;
$$;

-- 3. Vérifier : le catalogue se lit EN ENTIER avec les droits d'un visiteur
--    (doit répondre : true | true). ⚠ count(disponible), jamais count(*) :
--    compter les lignes ne calcule pas le stock (le 20/10/2026, la première
--    version répondait true | true pendant que la page restait en panne).
begin;
set local role anon;
select
  (select count(*) from public.catalogue_public) > 0 as catalogue_lisible,
  (select count(disponible) from public.catalogue_public) > 0 as stock_calcule_partout;
rollback;
