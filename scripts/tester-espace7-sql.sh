#!/usr/bin/env bash
# ============================================================
# Rejoue supabase/espace-7-travaux.sql sur un PostgreSQL local jetable
# reproduisant Supabase (11/11/2026). N'a AUCUN contact avec la base de BMI.
#
#   bash scripts/tester-espace7-sql.sh
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable"; exit 1; }
export PATH="$PATH:$BIN"

D=$(mktemp -d /tmp/bmi-esp7-XXXXXX); PORT=55457
nettoyer() { su postgres -c "$BIN/pg_ctl -D $D stop -m immediate" >/dev/null 2>&1 || true; rm -rf "$D"; }
trap nettoyer EXIT
chown postgres:postgres "$D"
su postgres -c "$BIN/initdb -D $D -U postgres -A trust" >/dev/null
su postgres -c "$BIN/pg_ctl -D $D -o '-p $PORT -k /tmp' -l $D/log start" >/dev/null
sleep 2
P="psql -h /tmp -p $PORT -U postgres -d bmi -v ON_ERROR_STOP=1 -tA"
psql -h /tmp -p $PORT -U postgres -q -c "create database bmi;" >/dev/null

echo "▸ Environnement Supabase simulé + cloisonnement existant"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/test/fixture.sql
for f in espace-1-colonne espace-3-VAGUE-2 espace-4-admin-voit-tout espace-5-fournisseurs-commerciaux securite-1-audits-et-tombstones; do
  psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/$f.sql >/dev/null 2>&1
done

$P -c "
delete from public.clients_installes;
insert into public.boutiques (id, data) values
  ('b8', '{\"nom\":\"BMI DEMAKPOE\"}'),
  ('b9', '{\"nom\":\"DFORMATION\",\"formation\":true}');
insert into public.ventes (id, data) values ('v9', '{\"boutique\":\"DFORMATION\"}');
insert into public.clients_installes (id, data) values
  ('t_reel', '{\"nom\":\"ALADJI\",\"boutique\":\"BMI DEMAKPOE\",\"travaux\":true,\"formation\":false,\"statut\":\"travaux\"}'),
  ('t_form', '{\"nom\":\"ESSAI\",\"boutique\":\"DFORMATION\",\"travaux\":true,\"formation\":true,\"statut\":\"travaux\"}'),
  ('c_devis','{\"nom\":\"DEVIS\",\"boutique\":\"BMI DEMAKPOE\",\"vente_id\":\"v9\"}');
" >/dev/null

ok=0; ko=0
verite() {
  local desc="$1" sql="$2" res
  res=$(psql -h /tmp -p $PORT -U postgres -d bmi -tA -c "$sql" 2>&1 || true)
  if [ "$res" = "t" ]; then ok=$((ok+1)); echo "  ✓ $desc"
  else ko=$((ko+1)); echo "  ✗ $desc — obtenu : $res"; fi
}
compte() {   # $1 desc, $2 claims, $3 attendu
  local res
  res=$(psql -h /tmp -p $PORT -U postgres -d bmi -tA -c "begin; set local role authenticated; select set_config('request.jwt.claims', '$2', true); select string_agg(id, ',' order by id) from public.clients_installes; rollback;" 2>&1 | grep -v '^$' | grep -v BEGIN | grep -v ROLLBACK | grep -v '^.*@' | tail -1 || true)
  if [ "$res" = "$3" ]; then ok=$((ok+1)); echo "  ✓ $1"
  else ko=$((ko+1)); echo "  ✗ $1 — obtenu : $res (attendu : $3)"; fi
}
REEL='{"email":"KOSSI@bmi.internal","app_metadata":{"role":"vendeur","espace":"reel"}}'
FORM='{"email":"STAGIAIRE@bmi.internal","app_metadata":{"role":"vendeur","espace":"formation"}}'

echo
echo "▸ 1. AVANT le script : le trou"
verite "les deux fiches de travaux sont SANS espace" "select count(*) = 2 from public.clients_installes where espace is null and id like 't_%';"
compte "un compte de FORMATION reçoit les travaux RÉELS (le trou)" "$FORM" "c_devis,t_form,t_reel"

echo
echo "▸ Application de espace-7-travaux.sql (EN UN SEUL ENVOI, comme l'éditeur de Supabase)"
grep -qi '^ *rollback' supabase/espace-7-travaux.sql && { echo "  ✗ le script contient un rollback"; exit 1; }
VERIF=$(psql -h /tmp -p $PORT -U postgres -d bmi -v ON_ERROR_STOP=1 -tA -c "$(cat supabase/espace-7-travaux.sql)" 2>&1 | tail -1)

echo
echo "▸ 2. APRÈS le script"
if [ "$VERIF" = "t|t|t" ]; then ok=$((ok+1)); echo "  ✓ la vérification du script répond true | true | true"
else ko=$((ko+1)); echo "  ✗ la vérification du script — obtenu : $VERIF"; fi
verite "la fiche ALADJI (BMI DEMAKPOE) est RÉELLE"       "select espace = 'reel' from public.clients_installes where id='t_reel';"
verite "la fiche d'essai (DFORMATION) est en FORMATION"  "select espace = 'formation' from public.clients_installes where id='t_form';"
verite "un chantier de devis suit TOUJOURS sa vente"     "select espace = 'formation' from public.clients_installes where id='c_devis';"
compte "un compte de FORMATION ne reçoit plus les travaux réels" "$FORM" "c_devis,t_form"
compte "un compte RÉEL reçoit ses travaux, pas ceux de la formation" "$REEL" "t_reel"
$P -c "insert into public.clients_installes (id, data) values ('t_neuf', '{\"nom\":\"NOUVEAU\",\"boutique\":\"BMI DEMAKPOE\",\"travaux\":true}');" >/dev/null
verite "une NOUVELLE fiche de travaux naît dans le bon espace" "select espace = 'reel' from public.clients_installes where id='t_neuf';"
verite "les autres tables ne bougent pas (une dépense suit sa boutique)" "select public.espace_de_ligne('depenses', '{\"boutique\":\"DFORMATION\"}'::jsonb) = 'formation';"
verite "le journal garde sa marque" "select public.espace_de_ligne('audits', '{\"formation\":true}'::jsonb) = 'formation';"

echo
echo "▸ 3. Relancer le script est sans danger"
VERIF2=$(psql -h /tmp -p $PORT -U postgres -d bmi -v ON_ERROR_STOP=1 -tA -c "$(cat supabase/espace-7-travaux.sql)" 2>&1 | tail -1)
if [ "$VERIF2" = "t|t|t" ]; then ok=$((ok+1)); echo "  ✓ second passage : true | true | true"
else ko=$((ko+1)); echo "  ✗ second passage — obtenu : $VERIF2"; fi

echo
if [ $ko -eq 0 ]; then echo "✅  $ok vérification(s) passée(s), 0 en échec."; else echo "❌  $ok passée(s), $ko en échec."; exit 1; fi
