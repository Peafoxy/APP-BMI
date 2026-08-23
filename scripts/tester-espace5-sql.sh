#!/usr/bin/env bash
# ============================================================
# Rejoue supabase/espace-5-fournisseurs-commerciaux.sql sur un PostgreSQL
# local jetable reproduisant Supabase.
#
#   bash scripts/tester-espace5-sql.sh
#
# N'a AUCUN contact avec la base Supabase de BMI.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable"; exit 1; }
export PATH="$PATH:$BIN"

D=$(mktemp -d /tmp/bmi-esp5-XXXXXX); PORT=55452
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
echo "▸ Cloisonnement de base (espace-1 + vague 2)"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/espace-1-colonne.sql >/dev/null 2>&1
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/espace-3-VAGUE-2.sql >/dev/null 2>&1
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/espace-4-admin-voit-tout.sql >/dev/null 2>&1

# Des fiches des deux bords, comme dans la vraie vie.
$P -c "
insert into public.fournisseurs (id, data) values
  ('f_reel', '{\"nom\":\"SOLARIS\",\"doit\":500000,\"paye\":0}'),
  ('f_form', '{\"nom\":\"FOURNISSEUR ESSAI\",\"doit\":0,\"formation\":true}');
insert into public.commerciaux (id, data) values
  ('co_reel', '{\"nom\":\"KOFFI\",\"taux\":5,\"actif\":true}'),
  ('co_form', '{\"nom\":\"STAGIAIRE COMMERCIAL\",\"taux\":5,\"formation\":true}');
" >/dev/null

echo "▸ Application de espace-5-fournisseurs-commerciaux.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/espace-5-fournisseurs-commerciaux.sql >/dev/null 2>&1

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
  res=$(psql -h /tmp -p $PORT -U postgres -d bmi -tA -c "$sql" 2>&1 || true)
  if [ "$res" = "t" ]; then ok=$((ok+1)); echo "  ✓ $desc"
  else ko=$((ko+1)); echo "  ✗ $desc — obtenu : $res"; fi
}

REEL='{"email":"KOSSI@bmi.internal","app_metadata":{"role":"vendeur","espace":"reel"}}'
FORM='{"email":"STAGIAIRE@bmi.internal","app_metadata":{"role":"vendeur","espace":"formation"}}'
TOUS='{"email":"TIMO@bmi.internal","app_metadata":{"role":"admin","espace":"tous"}}'
VIEUX='{"email":"AMA@bmi.internal","app_metadata":{}}'

echo
echo "▸ 1. Le rangement automatique"
verite "les fiches sans marque sont RÉELLES"     "select espace = 'reel' from public.fournisseurs where id='f_reel';"
verite "les fiches marquées sont en FORMATION"   "select espace = 'formation' from public.fournisseurs where id='f_form';"
verite "idem pour les commerciaux"               "select espace = 'formation' from public.commerciaux where id='co_form';"
verite "13 tables cloisonnées au total"          "select count(*) = 13 from pg_policies where schemaname='public' and policyname='espace_cloisonnement';"
# ⚠ GARDE-FOU né d'un vrai blocage (Timo, 20/08/2026) : la dérogation « tous »,
# qui laisse l'administrateur principal traverser les deux espaces, avait été
# oubliee dans ce script et dans celui des audits. Resultat : ses propres
# ecritures lui etaient refusees, et les operations restaient bloquees dans la
# file d'envoi. Aucune regle de cloisonnement ne doit plus l'oublier.
verite "AUCUNE table ne perd la dérogation de l'administrateur principal" \
  "select count(*) = 0 from pg_policies where schemaname='public' and policyname='espace_cloisonnement' and not (qual like '%tous%' and with_check like '%tous%');"
essai "l'administrateur principal écrit dans les nouvelles tables" PASSE "$TOUS" \
  "insert into public.fournisseurs (id, data) values ('f_admin', '{\"nom\":\"ADMIN\"}');"

echo
echo "▸ 2. Le serveur refuse ce qui traverse"
essai "un stagiaire ne VOIT pas un vrai fournisseur" PASSE "$FORM" \
  "select 1 where (select count(*) from public.fournisseurs where id='f_reel') = 0;"
essai "un stagiaire ne gonfle PAS la vraie ardoise" PASSE "$FORM" \
  "update public.fournisseurs set data = jsonb_set(data,'{doit}','9000000') where id='f_reel'; select 1 where (select (data->>'doit')::int from public.fournisseurs where id='f_reel') = 500000;"
essai "un stagiaire ne supprime PAS un vrai fournisseur" PASSE "$FORM" \
  "delete from public.fournisseurs where id='f_reel'; select 1 where (select count(*) from public.fournisseurs where id='f_reel') = 1;"
essai "un stagiaire ne crée PAS un fournisseur réel" REFUSE "$FORM" \
  "insert into public.fournisseurs (id, data) values ('f_x','{\"nom\":\"INTRUS\"}');"
essai "un stagiaire ne fait PAS basculer un vrai fournisseur chez lui" PASSE "$FORM" \
  "update public.fournisseurs set data = data || '{\"formation\":true}'::jsonb where id='f_reel'; select 1 where (select espace from public.fournisseurs where id='f_reel') = 'reel';"
essai "un vendeur réel ne voit pas les fournisseurs d'essai" PASSE "$REEL" \
  "select 1 where (select count(*) from public.fournisseurs where id='f_form') = 0;"
essai "un vendeur réel ne crée PAS un fournisseur de formation" REFUSE "$REEL" \
  "insert into public.fournisseurs (id, data) values ('f_z','{\"nom\":\"X\",\"formation\":true}');"
essai "un stagiaire ne change PAS le taux d'un vrai commercial" PASSE "$FORM" \
  "update public.commerciaux set data = jsonb_set(data,'{taux}','90') where id='co_reel'; select 1 where (select (data->>'taux')::int from public.commerciaux where id='co_reel') = 5;"

echo
echo "▸ 3. …et laisse passer le travail normal"
essai "le stagiaire travaille sur SES fournisseurs" PASSE "$FORM" \
  "update public.fournisseurs set data = jsonb_set(data,'{doit}','25000') where id='f_form';"
essai "…et en crée de nouveaux chez lui"            PASSE "$FORM" \
  "insert into public.fournisseurs (id, data) values ('f_y','{\"nom\":\"ESSAI 2\",\"formation\":true}');"
essai "le vendeur réel règle un vrai fournisseur"   PASSE "$REEL" \
  "update public.fournisseurs set data = jsonb_set(data,'{paye}','100000') where id='f_reel';"
essai "l'administrateur voit les deux espaces"      PASSE "$TOUS" \
  "select 1 where (select count(*) from public.fournisseurs) >= 3;"
essai "un jeton ancien est traité comme RÉEL, jamais bloqué" PASSE "$VIEUX" \
  "select 1 where (select count(*) from public.fournisseurs where id='f_reel') = 1;"

echo
echo "▸ 4. Le retour en arrière"
sed -n '/EN CAS DE PROBLÈME/,/^-- ===/p' supabase/espace-5-fournisseurs-commerciaux.sql \
  | grep '^--   ' | sed 's/^--   //' > "$D/rollback.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f "$D/rollback.sql" >/dev/null 2>&1
verite "les deux règles ont disparu"      "select count(*) = 11 from pg_policies where schemaname='public' and policyname='espace_cloisonnement';"
verite "la colonne espace a disparu"      "select count(*) = 0 from information_schema.columns where table_name='fournisseurs' and column_name='espace';"
verite "les données sont intactes"        "select count(*) >= 3 from public.fournisseurs;"

echo
if [ $ko -eq 0 ]; then echo "✅  $ok vérification(s) passée(s), 0 en échec."
else echo "❌  $ok passée(s), $ko en ÉCHEC."; exit 1; fi
