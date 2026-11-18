#!/usr/bin/env bash
# ============================================================
# LE CONTRÔLE UNIQUE DE LA SYNCHRONISATION — mesuré sur un PostgreSQL
# local jetable (supabase/sync-1-derniers-changements.sql, 18/11/2026)
#
#   bash scripts/tester-modifs-sql.sh
#
# N'a AUCUN contact avec la base Supabase de BMI.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable"; exit 1; }
export PATH="$PATH:$BIN"
D=$(mktemp -d /tmp/bmi-modifs-XXXXXX); PORT=55498
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
R=0; $P -f supabase/sync-1-derniers-changements.sql >/dev/null 2>&1 || R=1
verdict "le script passe" "$R" "0"
VERIF=$($P -f supabase/sync-1-derniers-changements.sql 2>/dev/null | tail -1)
verdict "le relancer est sans danger, et sa vérification répond true | true | true" "$VERIF" "t|t|t"
# La phrase de vérification est LUE, jamais présumée : le script lui-même la porte.
verdict "le script porte sa vérification « true | true | true »" "$(grep -c 'doit répondre true | true | true' supabase/sync-1-derniers-changements.sql)" "1"

echo "▸ Ce qu'elle rend"
$P -c "truncate public.ventes, public.produits, public.dettes;" >/dev/null
$P -c "insert into public.ventes (id, data, updated_at) values ('v1','{}',now()), ('v2','{}',now());" >/dev/null; $P -c "select pg_sleep(0.05); update public.ventes set data='{\"a\":1}' where id='v2';" >/dev/null
# (le déclencheur d'horodatage de la base pose lui-même updated_at : on compare à ce qui est RANGÉ)
ATTENDU=$($P -c "select (extract(epoch from max(updated_at)) * 1000000)::bigint from public.ventes;")
R=$($P -c "set role authenticated; select (public.dernieres_modifs() ->> 'ventes');" | tail -1)
verdict "la dernière modification de ventes, à la microseconde (pas d'arrondi)" "$R" "$ATTENDU"
R=$($P -c "set role authenticated; select (public.dernieres_modifs() -> 'produits') is not null and public.dernieres_modifs() ->> 'produits' is null;" | tail -1)
verdict "une table vide répond « null » (présente, sans modification)" "$R" "t"
R=$($P -c "set role authenticated; select public.dernieres_modifs() ? 'paie';" | tail -1)
verdict "une table absente de la base est OMISE (l'application la lira comme avant)" "$R" "f"
R=$($P -c "set role authenticated; select public.dernieres_modifs()::text ~ '(\"|:)v[12](\"|,|})';" | tail -1)
verdict "elle ne rend que des dates : jamais un identifiant ni une ligne" "$R" "f"

echo "▸ Elle respecte les règles de lecture de la personne (SECURITY INVOKER)"
$P -c "select prosecdef::text from pg_proc where proname='dernieres_modifs';" | grep -q '^false$' && R=ok || R=ko
verdict "fonction ordinaire : pas de droits élargis (security definer absent)" "$R" "ok"
$P -c "create policy cache_v2 on public.ventes as restrictive for select using (id <> 'v2');" >/dev/null
ATTENDU=$($P -c "select (extract(epoch from updated_at) * 1000000)::bigint from public.ventes where id='v1';")
R=$($P -c "set role authenticated; select (public.dernieres_modifs() ->> 'ventes');" | tail -1)
verdict "une ligne que la personne n'a pas le droit de lire ne compte pas dans la date" "$R" "$ATTENDU"
$P -c "drop policy cache_v2 on public.ventes;" >/dev/null
$P -c "revoke select on public.dettes from authenticated;" >/dev/null
R=$($P -c "set role authenticated; select public.dernieres_modifs() ? 'dettes';" | tail -1)
verdict "une table illisible pour ce compte est omise, sans faire échouer le reste" "$R" "f"
R=$($P -c "set role authenticated; select public.dernieres_modifs() ? 'ventes';" | tail -1)
verdict "…les autres tables répondent toujours" "$R" "t"
$P -c "grant select on public.dettes to authenticated;" >/dev/null

echo "▸ Qui peut la lancer"
R=$($P -c "set role anon; select public.dernieres_modifs();" 2>&1 | grep -c "permission denied" || true)
verdict "le visiteur non connecté est refusé" "$R" "1"
R=$($P -c "set role authenticated; select public.dernieres_modifs() is not null;" | tail -1)
verdict "un compte connecté peut la lancer" "$R" "t"

echo "▸ Elle ne touche à rien"
AVANT=$($P -c "select count(*) from public.ventes;")
$P -c "set role authenticated; select public.dernieres_modifs();" >/dev/null
APRES=$($P -c "select count(*) from public.ventes;")
verdict "aucune ligne n'est créée ni retirée" "$AVANT/$APRES" "2/2"
R=$(sed -n '/^create or replace function/,/^\$\$;/p' supabase/sync-1-derniers-changements.sql | grep -ciE "insert into|update public|delete from" || true)
verdict "le script n'écrit dans aucune table" "$R" "0"
R=$($P -c "select provolatile::text from pg_proc where proname='dernieres_modifs';")
verdict "fonction de lecture (stable)" "$R" "s"

echo
echo "Résultat : $ok ✓, $ko ✗"
[ "$ko" -eq 0 ]
