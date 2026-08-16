#!/usr/bin/env bash
# ============================================================
# Rejoue les scripts de cloisonnement (supabase/espace-*.sql) sur un
# PostgreSQL local jetable, avec un environnement qui reproduit celui de
# Supabase : mêmes tables, mêmes rôles, même auth.jwt(), mêmes politiques
# permissives de départ.
#
#   bash scripts/tester-cloisonnement-sql.sh
#
# N'a AUCUN contact avec votre base Supabase. Sert à vérifier les scripts
# avant de les exécuter en production — et à les revérifier après toute
# modification.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable (apt-get install postgresql)"; exit 1; }
export PATH="$PATH:$BIN"

D=$(mktemp -d /tmp/bmi-pg-XXXXXX)
PORT=55433
nettoyer() { su postgres -c "$BIN/pg_ctl -D $D stop -m immediate" >/dev/null 2>&1 || true; rm -rf "$D"; }
trap nettoyer EXIT

chown postgres:postgres "$D"
su postgres -c "$BIN/initdb -D $D -U postgres -A trust" >/dev/null
su postgres -c "$BIN/pg_ctl -D $D -o '-p $PORT -k /tmp' -l $D/log start" >/dev/null
sleep 2

P="psql -h /tmp -p $PORT -U postgres -d bmi -v ON_ERROR_STOP=1"
psql -h /tmp -p $PORT -U postgres -q -c "create database bmi;" >/dev/null

echo "▸ Environnement Supabase simulé"
$P -q -f supabase/test/fixture.sql
sleep 1
echo "▸ Étape 1 — colonne et déclencheurs"
$P -q -f supabase/espace-1-colonne.sql >/dev/null 2>&1
echo "▸ Étape 3 — politiques"
$P -q -f supabase/espace-3-politiques.sql >/dev/null 2>&1
echo "▸ Vérifications"
echo
$P -f supabase/test/verifier.sql 2>&1 | grep -viE "^$|pager|CREATE FUNCTION|^ incarner|^ redevenir" | sed 's/^ //'

# ---- Le retour en arrière, tel qu'il sera copié-collé ----
# Les blocs d'annulation sont EXTRAITS DES FICHIERS eux-mêmes (on retire le
# "--" de commentaire) : on teste donc exactement ce que l'utilisateur
# copiera, typos de commentaire comprises.
echo
echo "=== RETOUR EN ARRIERE ==="
python3 - "$D" <<'PY'
import re, sys
def extraire(chemin, depuis, jusqua=None):
    lignes = open(chemin, encoding="utf-8").read().split("\n")
    d = next(i for i, l in enumerate(lignes) if depuis in l)
    f = next((i for i, l in enumerate(lignes[d:], d) if jusqua and jusqua in l), len(lignes))
    return "\n".join(m.group(2) for m in (re.match(r"^--( ?)(.*)$", l) for l in lignes[d:f]) if m)
d = sys.argv[1]
open(d + "/annuler-3.sql", "w").write(extraire("supabase/espace-3-politiques.sql", "do $$", "(Cette annulation"))
open(d + "/annuler-1.sql", "w").write(extraire("supabase/espace-1-colonne.sql", "  do $$"))
PY

$P -q -f "$D/annuler-3.sql"
echo "▸ Bloc d'urgence exécuté"
$P -tA -c "select public.incarner('formation');" -c "select 'un compte formation revoit ' || count(*) || ' ventes (toutes)' from public.ventes;" | tail -1
$P -tA -c "select 'politiques d''origine encore la : ' || count(*) from pg_policies where schemaname='public' and policyname like 'acces_authentifie_%';"

$P -q -f "$D/annuler-1.sql"
echo "▸ Annulation de l'étape 1 exécutée"
$P -tA -c "select 'colonnes espace restantes : ' || count(*) from information_schema.columns where table_schema='public' and column_name='espace';"
$P -tA -c "select 'fonctions espace_* restantes : ' || count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'espace%';"
$P -tA -c "select 'donnees intactes : ' || count(*) || ' ventes, ' || (select count(*) from public.depenses) || ' depenses' from public.ventes;"
echo
echo "✅ Banc d'essai terminé."
