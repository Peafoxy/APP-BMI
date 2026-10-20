#!/usr/bin/env bash
# ============================================================
# LE CATALOGUE DU SITE VITRINE — mesuré sur un PostgreSQL local jetable
# (supabase/site-catalogue-1-quantites-decimales.sql, 20/10/2026)
#
#   bash scripts/tester-catalogue-sql.sh
#
# N'a AUCUN contact avec la base Supabase de BMI.
# On rejoue la vue catalogue_public et la fonction stock_calcule telles que
# le site les a posées (migrations 0001 et 0025 de site-bmitogo), on montre
# le trou AVANT (une quantité 2,5 fait tomber le catalogue), puis le script.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable"; exit 1; }
export PATH="$PATH:$BIN"
D=$(mktemp -d /tmp/bmi-catalogue-XXXXXX); PORT=55498
nettoyer() { su postgres -c "$BIN/pg_ctl -D $D stop -m immediate" >/dev/null 2>&1 || true; rm -rf "$D"; }
trap nettoyer EXIT
chown postgres:postgres "$D"
su postgres -c "$BIN/initdb -D $D -U postgres -A trust" >/dev/null
su postgres -c "$BIN/pg_ctl -D $D -o '-p $PORT -k /tmp' -l $D/log start" >/dev/null
sleep 2
psql -h /tmp -p $PORT -U postgres -q -c "create database bmi;" >/dev/null
P="psql -h /tmp -p $PORT -U postgres -d bmi -v ON_ERROR_STOP=1 -tA"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/test/fixture.sql >/dev/null

ok=0; ko=0
verdict() { if [ "$2" = "$3" ]; then echo "  ✓ $1"; ok=$((ok+1)); else echo "  ✗ $1 (obtenu : $2, attendu : $3)"; ko=$((ko+1)); fi; }

# --- Ce que le site a posé (0001 + 0025), tel quel -------------------------
$P >/dev/null <<'SQL'
create table public.commandes_en_ligne (id text primary key, lignes jsonb, statut text);
create table public.produit_images (produit_id text, image_url text, ordre int default 0, cree_le timestamptz default now());
create table public.produit_details (produit_id text primary key, description text);
create table public.nom_source_boutique (nom text primary key, boutique text not null);
create or replace function boutique_source_nom(p_nom text) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select boutique from nom_source_boutique where nom = p_nom), 'DEMAKPOE'); $$;
create or replace function normaliser_boutique(p_nom text) returns text language sql immutable set search_path = public as $$
  select upper(btrim(regexp_replace(coalesce(p_nom, ''), '^\s*BMI\s+', '', 'i'))); $$;
create or replace function stock_calcule(p_produit_id text) returns integer language sql stable security definer set search_path = public as $$
  select
    coalesce((select (data->>'initial')::int from produits where id = p_produit_id), 0)
    + coalesce((select (data->>'entrees')::int from produits where id = p_produit_id), 0)
    + coalesce((select sum((data->>'qte')::int) from ajustements where data->>'produit_id' = p_produit_id), 0)
    - coalesce((select sum((art->>'qte')::int) from ventes, jsonb_array_elements(data->'articles') art where art->>'produit_id' = p_produit_id), 0)
    - coalesce((select sum((ligne->>'quantite')::int) from commandes_en_ligne, jsonb_array_elements(lignes) ligne where ligne->>'produit_id' = p_produit_id and statut = 'payee'), 0); $$;
create or replace view catalogue_public as
select distinct on (p.data->>'nom')
  p.id, p.data->>'nom' as nom, (p.data->>'prix_vente')::numeric as prix,
  (stock_calcule(p.id) > 0) as disponible, p.data->>'categorie' as categorie,
  pi.image_url, pd.description
from produits p
left join lateral (select image_url from produit_images where produit_id = p.id order by ordre asc, cree_le asc limit 1) pi on true
left join produit_details pd on pd.produit_id = p.id
where normaliser_boutique(p.data->>'boutique') = normaliser_boutique(boutique_source_nom(p.data->>'nom'))
  and not exists (select 1 from boutiques b where b.data->>'nom' ilike p.data->>'boutique' and (b.data->>'depot')::boolean = true)
  and not exists (select 1 from boutiques b where b.data->>'nom' ilike p.data->>'boutique' and coalesce((b.data->>'formation')::boolean, false) = true)
order by p.data->>'nom', p.updated_at desc;
grant select on catalogue_public to anon;

-- base jetable : on repart de tables vides pour ce banc
delete from ventes; delete from ajustements; delete from produits; delete from boutiques;
insert into boutiques values ('bq-cat', '{"nom":"BMI DEMAKPOE"}');
insert into produits values
  ('cable', '{"nom":"Câble 6 mm²","boutique":"BMI DEMAKPOE","prix_vente":"1500","initial":"100","entrees":"0"}'),
  ('panneau', '{"nom":"Panneau 400W","boutique":"BMI DEMAKPOE","prix_vente":"95000","initial":"3"}'),
  ('vide', '{"nom":"Batterie 200Ah","boutique":"BMI DEMAKPOE","prix_vente":"450000","initial":"2"}'),
  ('reste', '{"nom":"Tuyau","boutique":"BMI DEMAKPOE","prix_vente":"800","initial":"1"}');
-- la vente de travaux : 2,5 m vendus, et l'ajustement de sortie de -2,5
insert into ventes values ('v1', '{"articles":[{"produit_id":"cable","qte":2.5,"deja_sorti":true},{"produit_id":"vide","qte":2}]}');
insert into ajustements values ('a1', '{"produit_id":"cable","qte":-2.5}');
-- 0,5 de tuyau restant : arrondi à l'entier inférieur → pas disponible
insert into ventes values ('v2', '{"articles":[{"produit_id":"reste","qte":"0.5"}]}');
-- une vente sans liste d'articles ne fait pas tomber le catalogue
insert into ventes values ('v3', '{"articles":{"oops":1}}');
insert into commandes_en_ligne values ('c1', '[{"produit_id":"panneau","quantite":1}]', 'payee');
SQL

lire() { $P -q -c "begin; set local role anon; $1; rollback;" 2>/dev/null | grep -v '^$' | tail -1 || true; }

echo "▸ Le trou AVANT le script"
verdict "le simple comptage passe (c'est ce qui trompait)" "$(lire 'select count(*) from catalogue_public')" "4"
R=0; $P -c "begin; set local role anon; select count(disponible) from catalogue_public; rollback;" >/dev/null 2>&1 || R=1
verdict "la page Boutique (qui lit « disponible ») tombe" "$R" "1"

# La vérification du script doit TOMBER tant que l'ancien calcul est en place
# (le 20/10/2026, une vérification par count(*) répondait true | true à tort).
VERIF_AVANT=$(sed -n '/^-- 3\. Vérifier/,$p' supabase/site-catalogue-1-quantites-decimales.sql)
R=0; $P -c "begin; set local role anon; $VERIF_AVANT rollback;" >/dev/null 2>&1 || R=1
verdict "la vérification du script tombe sur l'ancien calcul (elle mesure vraiment)" "$R" "1"

echo "▸ Le script se colle sans objection, deux fois — EN UN SEUL ENVOI, comme l'éditeur de Supabase"
# L'éditeur de Supabase envoie TOUT le texte d'un coup : une seule transaction.
# Un « begin; … rollback; » dans le script défait alors TOUT, correctif compris
# (20/10/2026 : true | true affiché, fonction jamais remplacée).
R=0; $P -c "$(cat supabase/site-catalogue-1-quantites-decimales.sql)" >/dev/null 2>&1 || R=1
verdict "le script passe" "$R" "0"
verdict "après l'envoi, la fonction est VRAIMENT remplacée (elle lit nombre_sur)" \
  "$($P -c "select position('nombre_sur' in prosrc) > 0 from pg_proc where proname = 'stock_calcule'")" "t"
VERIF=$($P -c "$(cat supabase/site-catalogue-1-quantites-decimales.sql)" 2>/dev/null | tail -1)
verdict "le relancer est sans danger, et sa vérification répond true" "$VERIF" "t"
verdict "le script ne contient aucun rollback (il défairait tout dans l'éditeur)" \
  "$(grep -ciE '^[[:space:]]*rollback' supabase/site-catalogue-1-quantites-decimales.sql || true)" "0"

echo "▸ Le catalogue se lit en entier, comme le visiteur du site"
verdict "les quatre articles avec leur disponibilité" \
  "$(lire "select string_agg(nom || '=' || disponible, ',' order by nom) from catalogue_public")" \
  "Batterie 200Ah=false,Câble 6 mm²=true,Panneau 400W=true,Tuyau=false"
verdict "le câble : 100 − 2,5 vendus − 2,5 sortis = 95" "$($P -c "select stock_calcule('cable')")" "95"
verdict "le panneau : 3 − 1 commande en ligne payée = 2" "$($P -c "select stock_calcule('panneau')")" "2"
verdict "0,5 restant est arrondi à 0 (pas disponible)" "$($P -c "select stock_calcule('reste')")" "0"
verdict "une valeur illisible vaut 0" "$($P -c "select nombre_sur('abc') + nombre_sur('') + nombre_sur(null) + nombre_sur(' 3 ')")" "3"

echo "▸ Rien de plus n'est ouvert au visiteur"
R=0; $P -c "begin; set local role anon; select nombre_sur('1'); rollback;" >/dev/null 2>&1 || R=1
verdict "le visiteur n'appelle pas nombre_sur directement" "$R" "1"
verdict "le visiteur ne voit toujours aucune ligne de la table des articles" "$(lire 'select count(*) from produits')" "0"
verdict "stock_calcule garde son type de réponse (integer)" \
  "$($P -c "select pg_get_function_result('public.stock_calcule(text)'::regprocedure)")" "integer"

# ============================================================
# Script 2 — le stock suit LA règle de l'application (20/10/2026)
# ============================================================
echo "▸ Script 2 : la règle de l'application"
$P >/dev/null <<'SQL'
-- un article vendu pour un chantier (« Avec installation ») : la ligne de vente
-- ne sort pas le stock, l'achat pour le chantier le sort (ajustement -2)
insert into produits values ('onduleur', '{"nom":"Onduleur 5 kW","boutique":"BMI DEMAKPOE","prix_vente":"650000","initial":"4"}');
insert into ventes values ('v4', '{"articles":[{"produit_id":"onduleur","qte":2,"au_chantier":true}]}');
insert into ajustements values ('a2', '{"produit_id":"onduleur","qte":-2,"type":"sortie_chantier"}');
-- une vente ancienne, sans liste d'articles : son article unique compte
insert into produits values ('regulateur', '{"nom":"Régulateur 60A","boutique":"BMI DEMAKPOE","prix_vente":"45000","initial":"5"}');
insert into ventes values ('v5', '{"produit_id":"regulateur","qte":3,"articles":[]}');
-- une ligne explicitement non sortie (false) se compte
insert into ventes values ('v6', '{"articles":[{"produit_id":"panneau","qte":1,"deja_sorti":false}]}');
SQL
R=0; $P -c "$(cat supabase/site-catalogue-2-regle-application.sql)" >/dev/null 2>&1 || R=1
verdict "le script 2 passe en un seul envoi, comme l'éditeur" "$R" "0"
VERIF=$($P -c "$(cat supabase/site-catalogue-2-regle-application.sql)" 2>/dev/null | tail -1)
verdict "relancé sans danger, sa vérification répond true | true" "$VERIF" "t|t"
verdict "le script 2 ne contient aucun rollback" \
  "$(grep -ciE '^[[:space:]]*rollback' supabase/site-catalogue-2-regle-application.sql || true)" "0"
verdict "le câble des travaux n'est plus retiré deux fois : 100 − 2,5 = 97 (97,5 arrondi)" "$($P -c "select stock_calcule('cable')")" "97"
verdict "l'onduleur du chantier : 4 − 2 sortis par l'achat = 2 (pas 0)" "$($P -c "select stock_calcule('onduleur')")" "2"
verdict "la vente ancienne sans liste compte : 5 − 3 = 2" "$($P -c "select stock_calcule('regulateur')")" "2"
verdict "le panneau : 3 − 1 vendu − 1 commande en ligne payée = 1" "$($P -c "select stock_calcule('panneau')")" "1"

# La MÊME réponse que l'application : on fait calculer stockDepuisLignes
# (src/lib/assistantWhatsapp.js, la copie lisible par Node de stockActuel)
# sur les MÊMES lignes, et on compare article par article.
PRODUITS=$($P -c "select coalesce(json_agg(data || jsonb_build_object('id', id)), '[]') from produits")
VENTES=$($P -c "select coalesce(json_agg(data), '[]') from ventes")
AJUST=$($P -c "select coalesce(json_agg(data), '[]') from ajustements")
APPLI=$(PRODUITS="$PRODUITS" VENTES="$VENTES" AJUST="$AJUST" node --input-type=module -e '
  const { stockDepuisLignes } = await import(process.cwd() + "/src/lib/assistantWhatsapp.js");
  const P = JSON.parse(process.env.PRODUITS), V = JSON.parse(process.env.VENTES), A = JSON.parse(process.env.AJUST);
  console.log(P.map((p) => p.id).sort().map((id) => id + "=" + Math.floor(stockDepuisLignes(P.find((p) => p.id === id), V, A))).join(","));
')
SITE=$($P -c "select string_agg(id || '=' || (stock_calcule(id) + case when id = 'panneau' then 1 else 0 end), ',' order by id) from produits")
verdict "le site et l'application donnent le même stock pour chaque article (hors commande en ligne)" "$SITE" "$APPLI"
verdict "la vue du visiteur se lit toujours en entier" \
  "$(lire "select count(disponible) from catalogue_public")" "6"

echo ""
echo "$ok contrôle(s) réussi(s), $ko échec(s)."
[ "$ko" -eq 0 ]
