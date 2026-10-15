#!/usr/bin/env bash
# ============================================================
# L'HEURE DE LA BASE — mesurée sur un PostgreSQL local jetable
# (supabase/heure-serveur-1.sql, 15/10/2026)
#
#   bash scripts/tester-heure-sql.sh
#
# N'a AUCUN contact avec la base Supabase de BMI.
# On regarde si la base a levé une objection, jamais ce que psql affiche
# en vrac : chaque réponse est comparée à ce qu'on attend.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable"; exit 1; }
export PATH="$PATH:$BIN"
D=$(mktemp -d /tmp/bmi-heure-XXXXXX); PORT=55497
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

echo "▸ Le script se colle sans objection, deux fois"
R=0; $P -f supabase/heure-serveur-1.sql >/dev/null 2>&1 || R=1
verdict "le script passe" "$R" "0"
VERIF=$($P -f supabase/heure-serveur-1.sql 2>/dev/null | tail -1)
verdict "le relancer est sans danger, et sa vérification répond true | true" "$VERIF" "t|t"

echo "▸ Qui peut lire l'heure"
for role in anon authenticated; do
  R=$($P -c "set role $role; select abs(extract(epoch from (public.heure_serveur() - clock_timestamp()))) < 5;" 2>/dev/null | tail -1 || true)
  verdict "le rôle $role lit l'heure, et elle est juste" "$R" "t"
done

echo "▸ L'heure de la RÉPONSE, pas celle du début de la transaction"
R=$($P -c "begin; select pg_sleep(1.2); select (public.heure_serveur() - now()) > interval '1 second'; commit;" 2>/dev/null | grep -E '^(t|f)$' | tail -1 || true)
verdict "clock_timestamp() et non now() : 1,2 s d'attente se voient" "$R" "t"

echo "▸ Elle ne touche à rien"
R=$($P -c "select provolatile::text || '|' || prosecdef::text from pg_proc where proname='heure_serveur';")
verdict "fonction ordinaire (pas de droits élargis : security definer absent)" "$R" "v|false"
R=$(grep -ciE "insert|update|delete|from public\.(users|ventes|dettes|depenses)" supabase/heure-serveur-1.sql || true)
verdict "le script ne lit ni n'écrit aucune table de BMI" "$R" "0"

echo
echo "Résultat : $ok ✓, $ko ✗"
[ "$ko" -eq 0 ]
