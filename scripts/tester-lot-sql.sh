#!/usr/bin/env bash
# ============================================================
# Rejoue supabase/lot-1-ecriture-groupee.sql sur un PostgreSQL local
# jetable reproduisant Supabase.
#
#   bash scripts/tester-lot-sql.sh
#
# N'a AUCUN contact avec la base Supabase de BMI.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable"; exit 1; }
export PATH="$PATH:$BIN"

D=$(mktemp -d /tmp/bmi-lot-XXXXXX); PORT=55460
nettoyer() { su postgres -c "$BIN/pg_ctl -D $D stop -m immediate" >/dev/null 2>&1 || true; rm -rf "$D"; }
trap nettoyer EXIT
chown postgres:postgres "$D"
su postgres -c "$BIN/initdb -D $D -U postgres -A trust" >/dev/null
su postgres -c "$BIN/pg_ctl -D $D -o '-p $PORT -k /tmp' -l $D/log start" >/dev/null
sleep 2
P="psql -h /tmp -p $PORT -U postgres -d bmi -v ON_ERROR_STOP=1 -tA"
psql -h /tmp -p $PORT -U postgres -q -c "create database bmi;" >/dev/null

echo "▸ Environnement Supabase simulé"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/test/fixture.sql
$P -c "
create table if not exists public.tombstones (id text primary key, table_name text, record_id text, deleted_at timestamptz);
create table if not exists public.paie (id text primary key, data jsonb, updated_at timestamptz default now());
grant select, insert, update, delete on public.tombstones, public.paie to authenticated;
-- Une table qui n'appartient PAS a l'application, sans aucune protection :
-- c'est elle que la liste blanche doit rendre inatteignable.
create table public.wifi_settings (id text primary key, data jsonb, updated_at timestamptz default now());
grant all on public.wifi_settings to authenticated, anon;
" >/dev/null

echo "▸ Cloisonnement en place (pour verifier que la fonction n'ouvre rien)"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/espace-1-colonne.sql >/dev/null 2>&1
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/espace-3-VAGUE-2.sql >/dev/null 2>&1

# ⚠ Supabase accorde AUTOMATIQUEMENT l'execution de toute nouvelle fonction du
# schema public au visiteur anonyme. Sans reproduire ce reglage, le banc
# validait un script qui laissait pourtant la porte ouverte en production
# (releve par Timo le 20/08/2026).
$P -c "alter default privileges in schema public grant all on functions to anon, authenticated, service_role;" >/dev/null

echo "▸ Application de lot-1-ecriture-groupee.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/lot-1-ecriture-groupee.sql >/dev/null 2>&1

ok=0; ko=0
essai() {
  local desc="$1" attendu="$2" claims="$3" sql="$4" res
  if res=$($P -c "set role authenticated; select set_config('request.jwt.claims', '$claims', true); $sql" 2>&1); then
    if [ "$attendu" = "PASSE" ]; then ok=$((ok+1)); echo "  ✓ $desc"
    else ko=$((ko+1)); echo "  ✗ $desc — PASSÉ alors qu'on attendait un refus"; fi
  else
    if [ "$attendu" = "REFUSE" ]; then ok=$((ok+1)); echo "  ✓ $desc"
    else ko=$((ko+1)); echo "  ✗ $desc — REFUSÉ à tort"; echo "      ${res##*ERROR:  }"; fi
  fi
}
verite() {
  local desc="$1" sql="$2" res
  res=$(psql -h /tmp -p $PORT -U postgres -d bmi -tA -c "$sql" 2>&1 | tail -1 || true)
  if [ "$res" = "t" ]; then ok=$((ok+1)); echo "  ✓ $desc"
  else ko=$((ko+1)); echo "  ✗ $desc — obtenu : $res"; fi
}

REEL='{"email":"KOSSI@bmi.internal","app_metadata":{"role":"vendeur","espace":"reel"}}'
FORM='{"email":"STAGIAIRE@bmi.internal","app_metadata":{"role":"vendeur","espace":"formation"}}'

echo
echo "▸ 1. Le cas normal : les deux écritures passent ensemble"
essai "un versement écrit sa dépense ET sa dette en un seul geste" PASSE "$REEL" "
select public.appliquer_lot('[
  {\"table\":\"depenses\",\"id\":\"e_lot\",\"data\":{\"boutique\":\"APESSITO\",\"montant\":5000}},
  {\"table\":\"dettes\",\"id\":\"t1\",\"data\":{\"boutique\":\"APESSITO\",\"client\":\"X\",\"paye\":5000}}
]'::jsonb);"
verite "la dépense est bien là"  "select count(*) = 1 from public.depenses where id='e_lot';"
verite "et la dette est à jour"  "select (data->>'paye')::int = 5000 from public.dettes where id='t1';"

echo
echo "▸ 2. LE POINT DE L'AUDIT : si une écriture est refusée, l'autre est annulée"
essai "un lot dont la seconde écriture viole le cloisonnement est refusé EN ENTIER" REFUSE "$FORM" "
select public.appliquer_lot('[
  {\"table\":\"depenses\",\"id\":\"e_moitie\",\"data\":{\"boutique\":\"APESSITO FORMATION\",\"montant\":100}},
  {\"table\":\"depenses\",\"id\":\"e_interdite\",\"data\":{\"boutique\":\"APESSITO\",\"montant\":999999}}
]'::jsonb);"
verite "…et la PREMIÈRE écriture n'a laissé aucune trace (c'était le défaut)" \
  "select count(*) = 0 from public.depenses where id='e_moitie';"
verite "l'écriture interdite n'est pas passée non plus" \
  "select count(*) = 0 from public.depenses where id='e_interdite';"

echo
echo "▸ 3. La fonction n'ouvre AUCUN droit supplémentaire"
essai "un compte de formation ne peut toujours pas écrire dans une vraie boutique" REFUSE "$FORM" "
select public.appliquer_lot('[{\"table\":\"ventes\",\"id\":\"v_intrus\",\"data\":{\"boutique\":\"APESSITO\"}}]'::jsonb);"
essai "une table étrangère à l'application est refusée net" REFUSE "$REEL" "
select public.appliquer_lot('[{\"table\":\"wifi_settings\",\"id\":\"w1\",\"data\":{}}]'::jsonb);"
verite "…et rien n'y a été écrit" "select count(*) = 0 from public.wifi_settings;"
essai "un nom de table fantaisiste est refusé" REFUSE "$REEL" "
select public.appliquer_lot('[{\"table\":\"pg_shadow\",\"id\":\"x\",\"data\":{}}]'::jsonb);"
essai "une opération sans identifiant est refusée" REFUSE "$REEL" "
select public.appliquer_lot('[{\"table\":\"ventes\",\"data\":{}}]'::jsonb);"
essai "un lot démesuré est refusé" REFUSE "$REEL" "
select public.appliquer_lot((select jsonb_agg(jsonb_build_object('table','ventes','id','x'||g,'data','{}'::jsonb)) from generate_series(1,250) g));"
verite "le visiteur anonyme n'a PAS le droit d'appeler la fonction" \
  "select not has_function_privilege('anon','public.appliquer_lot(jsonb)','execute');"
# Second verrou : meme si le droit revenait, la fonction refuse d'elle-meme.
$P -c "grant execute on function public.appliquer_lot(jsonb) to anon;" >/dev/null
# On garde TOUT le message : psql fait suivre l'erreur d'une ligne CONTEXT,
# et ne lire que la derniere ligne masquait le refus.
refus=$(psql -h /tmp -p $PORT -U postgres -d bmi -tA -c "set role anon; select public.appliquer_lot('[{\"table\":\"depenses\",\"id\":\"e_anon\",\"data\":{}}]'::jsonb);" 2>&1 || true)
if echo "$refus" | grep -qi "reservee aux comptes connectes"; then
  ok=$((ok+1)); echo "  ✓ …et meme avec le droit rendu, elle refuse le visiteur anonyme"
else ko=$((ko+1)); echo "  ✗ le visiteur anonyme n'a pas ete refuse : $refus"; fi
verite "…et aucune ligne n'a ete ecrite par ce biais" "select count(*) = 0 from public.depenses where id='e_anon';"
$P -c "revoke all on function public.appliquer_lot(jsonb) from anon;" >/dev/null

echo
echo "▸ 4. Les suppressions aussi"
essai "un lot peut supprimer et signaler la suppression" PASSE "$REEL" "
select public.appliquer_lot('[{\"table\":\"depenses\",\"id\":\"e_lot\",\"op\":\"delete\"}]'::jsonb);"
verite "la ligne a disparu"          "select count(*) = 0 from public.depenses where id='e_lot';"
verite "et le faire-part est déposé" "select count(*) = 1 from public.tombstones where record_id='e_lot';"

echo
echo "▸ 5. Le retour en arrière"
sed -n '/EN CAS DE PROBLÈME/,/^-- ===/p' supabase/lot-1-ecriture-groupee.sql \
  | grep '^--   ' | sed 's/^--   //' > "$D/rollback.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f "$D/rollback.sql" >/dev/null 2>&1
verite "la fonction a disparu" \
  "select count(*) = 0 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='appliquer_lot';"
verite "les données écrites avant, elles, sont intactes" "select count(*) = 1 from public.dettes where id='t1';"

echo
if [ $ko -eq 0 ]; then echo "✅  $ok vérification(s) passée(s), 0 en échec."
else echo "❌  $ok passée(s), $ko en ÉCHEC."; exit 1; fi
