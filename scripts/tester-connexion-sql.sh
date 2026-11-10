#!/usr/bin/env bash
# ============================================================
# LA CONNEXION RAPIDE — la fonction qui retrouve le compte sécurisé
# (supabase/connexion-rapide-1.sql, 10/11/2026), sur un PostgreSQL
# local jetable.
#
#   bash scripts/tester-connexion-sql.sh
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
D=$(mktemp -d /tmp/bmi-connexion-XXXXXX); PORT=55498
nettoyer() { su postgres -c "$BIN/pg_ctl -D $D stop -m immediate" >/dev/null 2>&1 || true; rm -rf "$D"; }
trap nettoyer EXIT
chown postgres:postgres "$D"
su postgres -c "$BIN/initdb -D $D -U postgres -A trust" >/dev/null
su postgres -c "$BIN/pg_ctl -D $D -o '-p $PORT -k /tmp' -l $D/log start" >/dev/null
sleep 2
psql -h /tmp -p $PORT -U postgres -q -c "create database bmi;" >/dev/null
P="psql -h /tmp -p $PORT -U postgres -d bmi -v ON_ERROR_STOP=1 -tA"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/test/fixture.sql >/dev/null
# ⚠ Comme Supabase : toute NOUVELLE fonction est d'office appelable par le
# visiteur et le compte connecté. Sans ça, le banc ne verrait pas une porte
# laissée ouverte (éprouvé : la ligne « revoke » retirée passait quand même).
$P -c "alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;" >/dev/null

ok=0; ko=0
verdict() { if [ "$2" = "$3" ]; then echo "  ✓ $1"; ok=$((ok+1)); else echo "  ✗ $1 (obtenu : $2, attendu : $3)"; ko=$((ko+1)); fi; }

echo "▸ Le script se colle sans objection, deux fois, EN UN SEUL ENVOI (comme l'éditeur de Supabase)"
R=0; $P -c "$(cat supabase/connexion-rapide-1.sql)" >/dev/null 2>&1 || R=1
verdict "le script passe" "$R" "0"
VERIF=$($P -c "$(cat supabase/connexion-rapide-1.sql)" 2>/dev/null | tail -1)
verdict "le relancer est sans danger, et sa vérification répond true | true | true" "$VERIF" "t|t|t"
R=$(grep -ciE "^\s*rollback" supabase/connexion-rapide-1.sql || true)
verdict "le script ne finit pas par un rollback (il défairait tout)" "$R" "0"

echo "▸ Elle retrouve le bon compte, et rien quand l'adresse n'existe pas"
ATTENDU=$($P -c "select id from auth.users where email='TIMO@bmi.internal';")
R=$($P -c "set role service_role; select public.compte_securise_par_email('TIMO@bmi.internal');" | tail -1)
verdict "le serveur retrouve le compte de TIMO" "$R" "$ATTENDU"
R=$($P -c "set role service_role; select public.compte_securise_par_email('timo@BMI.internal');" | tail -1)
verdict "majuscules et minuscules ne comptent pas (Supabase range les adresses en minuscules)" "$R" "$ATTENDU"
R=$($P -c "set role service_role; select public.compte_securise_par_email('PERSONNE@bmi.internal') is null;" | tail -1)
verdict "une adresse inconnue ne rend rien" "$R" "t"
R=$($P -c "set role service_role; select public.compte_securise_par_email('%') is null;" | tail -1)
verdict "« % » n'est pas un joker : rien ne sort" "$R" "t"

echo "▸ Personne d'autre que le serveur ne peut l'appeler"
for role in anon authenticated; do
  R=0; $P -c "set role $role; select public.compte_securise_par_email('TIMO@bmi.internal');" >/dev/null 2>&1 || R=1
  verdict "le rôle $role est REFUSÉ" "$R" "1"
done

echo "▸ Elle ne rend qu'un numéro, ne touche à rien"
R=$($P -c "select pg_get_function_result(oid) from pg_proc where proname='compte_securise_par_email';")
verdict "elle ne rend qu'un numéro de compte (uuid)" "$R" "uuid"
R=$($P -c "select provolatile::text || '|' || prosecdef::text || '|' || coalesce(array_to_string(proconfig, ','), '') from pg_proc where proname='compte_securise_par_email';")
verdict "lecture seule, droits du propriétaire, search_path vide" "$R" "s|true|search_path=\"\""
R=$(grep -ciE "insert|update |delete|raw_app_meta|encrypted_password" supabase/connexion-rapide-1.sql || true)
verdict "le script n'écrit rien et ne lit ni rôle ni mot de passe" "$R" "0"

echo
echo "Résultat : $ok ✓, $ko ✗"
[ "$ko" -eq 0 ]
