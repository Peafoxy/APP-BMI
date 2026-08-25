#!/usr/bin/env bash
# ============================================================
# scripts/tester-injection-sql.sh — TENTATIVE D'INJECTION SQL RÉELLE
#
#   bash scripts/tester-injection-sql.sh
#
# ⚠ N'A AUCUN CONTACT AVEC LA BASE SUPABASE DE BMI. Tout se passe sur un
# PostgreSQL jetable, créé pour l'occasion et détruit à la fin.
#
# POURQUOI CE BANC EXISTE (question de Timo, 25/08/2026 : « tu as essayé
# l'injection SQL avec mon app ? »). La réponse honnête était NON. Lire le
# code et conclure « ça a l'air bon » n'est pas une vérification : c'est un
# avis. Ce banc remplace l'avis par une tentative.
#
# CE QU'ON ATTAQUE. L'application n'écrit jamais de SQL elle-même : elle
# passe par la bibliothèque Supabase, qui envoie des requêtes déjà
# découpées (les valeurs voyagent à part, jamais collées dans du texte
# SQL). Il reste UNE porte où du SQL est réellement construit à la volée :
# la fonction appliquer_lot, appelée par la synchronisation. C'est le seul
# endroit qu'un attaquant puisse viser, donc le seul qui mérite ce banc.
#
# ON PLACE UN COFFRE : une table « coffre_fort » qui n'appartient pas à
# l'application, avec un secret dedans. Après chaque tentative, on vérifie
# qu'elle est toujours là, intacte. Si une seule injection passait, elle
# aurait disparu.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable"; exit 1; }
export PATH="$PATH:$BIN"

D=$(mktemp -d /tmp/bmi-inj-XXXXXX); PORT=55471
nettoyer() { su postgres -c "$BIN/pg_ctl -D $D stop -m immediate" >/dev/null 2>&1 || true; rm -rf "$D"; }
trap nettoyer EXIT
chown postgres:postgres "$D"
su postgres -c "$BIN/initdb -D $D -U postgres -A trust" >/dev/null
su postgres -c "$BIN/pg_ctl -D $D -o '-p $PORT -k /tmp' -l $D/log start" >/dev/null
sleep 2
P="psql -h /tmp -p $PORT -U postgres -d bmi -v ON_ERROR_STOP=1 -tA"
psql -h /tmp -p $PORT -U postgres -q -c "create database bmi;" >/dev/null

echo "▸ Base jetable + fonction réelle de l'application"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/test/fixture.sql
$P -c "
create table if not exists public.tombstones (id text primary key, table_name text, record_id text, deleted_at timestamptz);
create table if not exists public.paie (id text primary key, data jsonb, updated_at timestamptz default now());
grant select, insert, update, delete on public.tombstones, public.paie to authenticated;
-- LE COFFRE : une table étrangère à l'application, volontairement SANS
-- aucune protection et accessible à tous. Si une injection aboutit, c'est
-- elle qui tombe.
create table public.coffre_fort (id text primary key, secret text);
insert into public.coffre_fort values ('1','les-chiffres-de-BMI');
grant all on public.coffre_fort to authenticated, anon;
" >/dev/null
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/lot-1-ecriture-groupee.sql >/dev/null 2>&1

ok=0; ko=0
# Une tentative d'injection : on la lance, puis — quoi qu'il arrive — on
# vérifie que le coffre est intact. Une erreur SQL est un SUCCÈS de défense ;
# ce qui compte, c'est l'état de la base après.
attaque() {
  local desc="$1" charge="$2" res
  res=$($P -c "set role authenticated;
    select set_config('request.jwt.claims', '{\"email\":\"K@bmi.internal\",\"app_metadata\":{\"role\":\"admin\",\"espace\":\"tous\"}}', true);
    select public.appliquer_lot(\$json\$$charge\$json\$::jsonb);" 2>&1) || res="REFUSE"
  local coffre
  coffre=$(psql -h /tmp -p $PORT -U postgres -d bmi -tA -c \
    "select count(*)||'/'||coalesce(max(secret),'?') from public.coffre_fort;" 2>&1 | tail -1)
  if [ "$coffre" = "1/les-chiffres-de-BMI" ]; then
    ok=$((ok+1)); echo "  ✓ $desc"
  else
    ko=$((ko+1)); echo "  ✗ $desc — LE COFFRE A ÉTÉ TOUCHÉ ($coffre)"
  fi
}
verite() {
  local desc="$1" sql="$2" res
  res=$(psql -h /tmp -p $PORT -U postgres -d bmi -tA -c "$sql" 2>&1 | tail -1 || true)
  if [ "$res" = "t" ]; then ok=$((ok+1)); echo "  ✓ $desc"
  else ko=$((ko+1)); echo "  ✗ $desc — obtenu : $res"; fi
}

echo
echo "▸ 1. Le nom de table — la seule valeur qui entre dans du SQL construit"
attaque "« users; drop table coffre_fort; -- »" \
  '[{"table":"users; drop table coffre_fort; --","id":"x","data":{}}]'
attaque "« users\"; drop table coffre_fort; -- » (on ferme le guillemet)" \
  '[{"table":"users\"; drop table coffre_fort; --","id":"x","data":{}}]'
attaque "« \"users\"; drop table public.coffre_fort; -- »" \
  '[{"table":"\"users\"; drop table public.coffre_fort; --","id":"x","data":{}}]'
attaque "une table système (pg_shadow, les mots de passe du serveur)" \
  '[{"table":"pg_shadow","id":"x","data":{}}]'
attaque "une table de l'hébergeur (information_schema.tables)" \
  '[{"table":"information_schema.tables","id":"x","data":{}}]'
attaque "le coffre lui-même, nommé directement" \
  '[{"table":"coffre_fort","id":"1","op":"delete"}]'
attaque "le coffre avec le schéma devant (public.coffre_fort)" \
  '[{"table":"public.coffre_fort","id":"1","op":"delete"}]'
attaque "le coffre en majuscules (COFFRE_FORT)" \
  '[{"table":"COFFRE_FORT","id":"1","op":"delete"}]'
attaque "un nom de table vide" '[{"table":"","id":"x","data":{}}]'
attaque "aucun nom de table" '[{"id":"x","data":{}}]'

echo
echo "▸ 2. L'identifiant de la ligne"
attaque "« x'; drop table coffre_fort; -- »" \
  '[{"table":"produits","id":"x'"'"'; drop table coffre_fort; --","data":{}}]'
attaque "le classique OR 1=1 (pour faire correspondre toutes les lignes)" \
  '[{"table":"produits","id":"'"'"' or '"'"'1'"'"'='"'"'1","data":{}}]'
attaque "une suppression avec identifiant piégé" \
  '[{"table":"produits","op":"delete","id":"1'"'"' or true; --"}]'

echo
echo "▸ 3. Le contenu de la fiche, et la date"
attaque "du SQL glissé dans les données de la fiche" \
  '[{"table":"produits","id":"p_inj","data":{"nom":"'"'"'); drop table coffre_fort; --"}}]'
attaque "du SQL glissé dans la date de modification" \
  '[{"table":"produits","id":"p_inj2","data":{},"updated_at":"now()'"'"'); drop table coffre_fort; --"}]'
attaque "une opération inconnue (ni upsert ni delete)" \
  '[{"table":"produits","id":"p_inj3","op":"drop table coffre_fort","data":{}}]'

echo
echo "▸ 4. Le lot lui-même"
attaque "une charge qui n'est pas une liste" '{"table":"produits","id":"x"}'
attaque "une liste vide" '[]'
attaque "un lot démesuré (301 opérations)" \
  "$(python3 -c "import json;print(json.dumps([{'table':'produits','id':'z%d'%i,'data':{}} for i in range(301)]))")"

echo
echo "▸ 5. Et le coffre, au bout de toutes ces tentatives ?"
verite "la table étrangère existe toujours" \
  "select to_regclass('public.coffre_fort') is not null;"
verite "son secret n'a pas bougé" \
  "select secret = 'les-chiffres-de-BMI' from public.coffre_fort where id='1';"
verite "aucune ligne n'a été créée dans une table hors liste blanche" \
  "select count(*) = 1 from public.coffre_fort;"

echo
echo "▸ 6. Ce qui doit continuer à marcher (une défense qui casse tout ne sert à rien)"
ecrire() {
  $P -c "set role authenticated;
    select set_config('request.jwt.claims', '{\"email\":\"K@bmi.internal\",\"app_metadata\":{\"role\":\"admin\",\"espace\":\"tous\"}}', true);
    select public.appliquer_lot(\$json\$$1\$json\$::jsonb);" >/dev/null 2>&1 || true
}
ecrire '[{"table":"produits","id":"p_ok","data":{"boutique":"APESSITO","nom":"COFFRET"}}]'
verite "une écriture normale passe toujours" \
  "select count(*) = 1 from public.produits where id='p_ok';"
# ⚠ Le cas ordinaire que la défense ne doit surtout pas casser : une
# apostrophe dans un nom d'article (« L'ONDULEUR »). Une protection qui
# refuserait ce nom-là serait une panne, pas une sécurité.
ecrire '[{"table":"produits","id":"p_apo","data":{"boutique":"APESSITO","nom":"L'"'"'ONDULEUR 5KVA"}}]'
verite "…et un nom contenant une apostrophe est enregistré TEL QUEL" \
  "select data->>'nom' = 'L''ONDULEUR 5KVA' from public.produits where id='p_apo';"
# Même question pour un nom qui RESSEMBLE à une attaque : il doit être stocké
# comme du texte ordinaire, ni exécuté ni rejeté.
ecrire '[{"table":"produits","id":"p_txt","data":{"boutique":"APESSITO","nom":"DROP TABLE coffre_fort; --"}}]'
verite "un nom qui ressemble à une attaque est stocké comme du simple texte" \
  "select data->>'nom' = 'DROP TABLE coffre_fort; --' from public.produits where id='p_txt';"
verite "…sans que le coffre en souffre" \
  "select to_regclass('public.coffre_fort') is not null;"

echo
echo "$([ $ko -eq 0 ] && echo '✅' || echo '❌')  $ok tentative(s) repoussée(s), $ko en échec."
exit $([ $ko -eq 0 ] && echo 0 || echo 1)
