#!/usr/bin/env bash
# ============================================================
# Rejoue supabase/users-1-fermer-lecture-publique.sql sur un PostgreSQL
# local jetable reproduisant Supabase.
#
#   bash scripts/tester-users-fermeture-sql.sh
#
# N'a AUCUN contact avec la base Supabase de BMI.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable"; exit 1; }
export PATH="$PATH:$BIN"

D=$(mktemp -d /tmp/bmi-usr-XXXXXX); PORT=55454
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

# L'état RÉEL d'aujourd'hui : lecture publique + droits par défaut Supabase.
$P -c "
alter default privileges in schema public grant all on tables to anon, authenticated;
grant select, insert, update, delete on public.users to anon;
create policy \"lecture_publique_users\" on public.users for select using (true);
" >/dev/null

ok=0; ko=0
verite() {
  local desc="$1" sql="$2" res
  res=$(psql -h /tmp -p $PORT -U postgres -d bmi -tA -c "$sql" 2>&1 | tail -1 || true)
  if [ "$res" = "t" ]; then ok=$((ok+1)); echo "  ✓ $desc"
  else ko=$((ko+1)); echo "  ✗ $desc — obtenu : $res"; fi
}
compte_anon() { psql -h /tmp -p $PORT -U postgres -d bmi -tA -c "set role anon; select count(*) from public.users;" 2>&1 | tail -1 || true; }
compte_connecte() {
  psql -h /tmp -p $PORT -U postgres -d bmi -tA -c \
    "set role authenticated; select set_config('request.jwt.claims','{\"email\":\"KOSSI@bmi.internal\",\"app_metadata\":{\"role\":\"vendeur\",\"espace\":\"reel\"}}',true); select count(*) from public.users;" 2>&1 | tail -1 || true
}

echo
echo "▸ 1. AVANT : l'annuaire est bien ouvert à tous (le trou)"
a=$(compte_anon || true)
if [ "$a" != "0" ] && [ "$a" != "" ]; then ok=$((ok+1)); echo "  ✓ un visiteur anonyme lit $a fiche(s) — c'est bien le trou à fermer"
else ko=$((ko+1)); echo "  ✗ l'état de départ ne reproduit pas le trou (obtenu : $a)"; fi

echo
echo "▸ Application de users-1-fermer-lecture-publique.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/users-1-fermer-lecture-publique.sql >/dev/null 2>&1

echo
echo "▸ 2. APRÈS : la porte est fermée"
verite "le visiteur anonyme n'a plus le droit de lire"  "select not has_table_privilege('anon','public.users','select');"
verite "l'ancienne règle publique a disparu"            "select count(*) = 0 from pg_policies where tablename='users' and policyname='lecture_publique_users';"
a=$(compte_anon || true)
if [ "$a" = "0" ] || echo "$a" | grep -qi "denied\|permission"; then ok=$((ok+1)); echo "  ✓ un visiteur anonyme ne lit plus AUCUNE fiche"
else ko=$((ko+1)); echo "  ✗ le visiteur anonyme lit encore : $a"; fi

echo
echo "▸ 3. …mais les comptes connectés travaillent normalement"
c=$(compte_connecte || true)
if [ "$c" != "0" ] && [ -n "$c" ] && ! echo "$c" | grep -qi "denied\|error"; then
  ok=$((ok+1)); echo "  ✓ un vendeur connecté lit toujours les fiches ($c)"
else ko=$((ko+1)); echo "  ✗ un vendeur connecté ne lit plus rien : $c"; fi
verite "au moins une règle de lecture pour les comptes connectés" \
  "select count(*) > 0 from pg_policies where tablename='users' and permissive='PERMISSIVE' and cmd in ('SELECT','ALL') and 'authenticated' = any(roles);"

echo
echo "▸ 4. Relancer le script ne casse rien"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/users-1-fermer-lecture-publique.sql >/dev/null 2>&1
c=$(compte_connecte || true)
if [ "$c" != "0" ] && [ -n "$c" ]; then ok=$((ok+1)); echo "  ✓ deuxième passage sans dégât ($c fiches lues par un connecté)"
else ko=$((ko+1)); echo "  ✗ le deuxième passage a cassé la lecture : $c"; fi

echo
echo "▸ 5. Le retour en arrière rouvre bien la porte"
sed -n '/EN CAS DE PROBLÈME/,/^-- ===/p' supabase/users-1-fermer-lecture-publique.sql \
  | grep '^--   ' | sed 's/^--   //' > "$D/rollback.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f "$D/rollback.sql" >/dev/null 2>&1
verite "la règle publique est revenue" \
  "select count(*) = 1 from pg_policies where tablename='users' and policyname='lecture_publique_users';"

echo
if [ $ko -eq 0 ]; then echo "✅  $ok vérification(s) passée(s), 0 en échec."
else echo "❌  $ok passée(s), $ko en ÉCHEC."; exit 1; fi
