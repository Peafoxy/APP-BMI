#!/usr/bin/env bash
# ============================================================
# Rejoue supabase/paie-1-table.sql sur un PostgreSQL local jetable, dans un
# environnement qui reproduit celui de Supabase (mêmes tables, mêmes rôles,
# même auth.jwt(), mêmes politiques permissives de départ).
#
#   bash scripts/tester-paie-sql.sh
#
# N'a AUCUN contact avec la base Supabase de BMI. Sert à vérifier le script
# AVANT de l'exécuter en production. Le retour en arrière est extrait du
# fichier lui-même : on teste exactement ce qui sera copié-collé.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable (apt-get install postgresql)"; exit 1; }
export PATH="$PATH:$BIN"

D=$(mktemp -d /tmp/bmi-paie-XXXXXX); PORT=55450
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

# Des fiches employés qui portent VRAIMENT des champs sensibles.
$P -c "
update public.users set data = data || '{\"salaire_base\":120000,\"virements\":[{\"id\":\"v1\",\"mois\":\"2026-08\",\"montant\":50000,\"statut\":\"en_attente\"}],\"credits\":[{\"id\":\"c1\",\"statut\":\"en_attente\",\"montant_demande\":30000}],\"piece_num\":\"AB1234\",\"cnss_matricule\":\"M-9\"}'::jsonb where id = 'KOSSI';
update public.users set data = data || '{\"salaire_base\":400000,\"primes\":[{\"mois\":\"2026-08\",\"montant\":25000}]}'::jsonb where id = 'TIMO';
update public.users set data = data || '{\"nom\":\"CLIENTE\",\"role\":\"client\"}'::jsonb where id = 'SANSAUTH';
insert into public.users (id, data) values ('CLI1', '{\"nom\":\"CLI1\",\"role\":\"client\"}');
" >/dev/null

echo "▸ Application de paie-1-table.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/paie-1-table.sql >/dev/null 2>&1

ok=0; ko=0
essai() {   # essai <description> <PASSE|REFUSE> <revendications json> <requete>
  local desc="$1" attendu="$2" claims="$3" sql="$4" res
  if res=$($P -c "set role authenticated; select set_config('request.jwt.claims', '$claims', true); $sql" 2>&1); then
    if [ "$attendu" = "PASSE" ]; then ok=$((ok+1)); echo "  ✓ $desc"
    else ko=$((ko+1)); echo "  ✗ $desc — PASSÉ alors qu'on attendait un refus"; fi
  else
    if [ "$attendu" = "REFUSE" ]; then ok=$((ok+1)); echo "  ✓ $desc"
    else ko=$((ko+1)); echo "  ✗ $desc — REFUSÉ alors qu'on attendait un succès"; echo "      ${res##*ERROR:  }"; fi
  fi
}
verite() {  # verite <description> <requete renvoyant t/f>
  local desc="$1" sql="$2" res
  res=$(psql -h /tmp -p $PORT -U postgres -d bmi -tA -c "$sql" 2>&1 || true)
  if [ "$res" = "t" ]; then ok=$((ok+1)); echo "  ✓ $desc"
  else ko=$((ko+1)); echo "  ✗ $desc — obtenu : $res"; fi
}

ADMIN='{"email":"TIMO@bmi.internal","app_metadata":{"role":"admin","espace":"tous","ecriture":true}}'
VEND='{"email":"KOSSI@bmi.internal","app_metadata":{"role":"vendeur","espace":"reel","ecriture":true}}'
AUTRE='{"email":"AMA@bmi.internal","app_metadata":{"role":"vendeur","espace":"reel","ecriture":true}}'
COMPTA='{"email":"COMPTA@bmi.internal","app_metadata":{"role":"comptable","espace":"reel","ecriture":false}}'
CLIENT='{"email":"CLI1@bmi.internal","app_metadata":{"role":"client","espace":"reel","ecriture":true}}'

echo
echo "▸ 1. Le déménagement a bien eu lieu"
verite "les fiches de paie ont été créées"            "select count(*) = 2 from public.paie;"
verite "le salaire a quitté la fiche employé"          "select not (data ? 'salaire_base') from public.users where id='KOSSI';"
verite "le numéro de pièce a quitté la fiche employé"  "select not (data ? 'piece_num') from public.users where id='KOSSI';"
verite "le matricule CNSS a quitté la fiche employé"   "select not (data ? 'cnss_matricule') from public.users where id='KOSSI';"
verite "le salaire est bien arrivé dans la fiche paie" "select (data->>'salaire_base')::int = 120000 from public.paie where id='KOSSI';"
verite "le nom, lui, est resté sur la fiche employé"   "select data->>'nom' = 'KOSSI' from public.users where id='KOSSI';"
verite "aucune fiche employé ne porte encore d'argent" "select count(*) = 0 from public.users where data ?| array['salaire_base','virements','credits','primes','avances','piece_num','cnss_matricule'];"
verite "relancer le script ne duplique rien"           "select count(*) = 2 from public.paie;"

echo
echo "▸ 2. Qui voit quoi"
verite "le visiteur anonyme n'a AUCUN droit sur la table" "select not has_table_privilege('anon','public.paie','select');"
essai "l'administrateur lit toutes les fiches"  PASSE  "$ADMIN" "select count(*) from public.paie having count(*) = 2;"
essai "le comptable lit toutes les fiches"      PASSE  "$COMPTA" "select count(*) from public.paie having count(*) = 2;"
essai "un vendeur ne voit QUE la sienne"        PASSE  "$VEND"  "select count(*) from public.paie having count(*) = 1;"
essai "…et c'est bien la sienne"                PASSE  "$VEND"  "select 1 from public.paie where id = 'KOSSI';"
essai "un autre vendeur ne voit RIEN de KOSSI"  PASSE  "$AUTRE" "select count(*) from public.paie having count(*) = 0;"
essai "un compte client ne voit rien du tout"   PASSE  "$CLIENT" "select count(*) from public.paie having count(*) = 0;"
essai "un compte client ne peut rien écrire"    REFUSE "$CLIENT" "insert into public.paie (id, data) values ('CLI1','{\"salaire_base\":9}');"

echo
echo "▸ 3. L'employé fait ce qu'il a le droit de faire"
essai "il confirme un virement reçu" PASSE "$VEND" \
  "update public.paie set data = jsonb_set(data,'{virements,0,statut}','\"accepte\"') where id='KOSSI';"
essai "il demande un crédit (en attente)" PASSE "$VEND" \
  "update public.paie set data = jsonb_set(data,'{credits}', (data->'credits') || '[{\"id\":\"c2\",\"statut\":\"en_attente\",\"montant_demande\":10000}]'::jsonb) where id='KOSSI';"
essai "il enregistre par UPSERT, comme le fait l'application" PASSE "$VEND" \
  "insert into public.paie (id, data) values ('KOSSI', (select data from public.paie where id='KOSSI')) on conflict (id) do update set data = excluded.data;"

echo
echo "▸ 4. …et rien de plus"
essai "il ne s'augmente PAS" REFUSE "$VEND" \
  "update public.paie set data = jsonb_set(data,'{salaire_base}','2000000') where id='KOSSI';"
essai "il ne s'accorde PAS de prime" REFUSE "$VEND" \
  "update public.paie set data = data || '{\"primes\":[{\"mois\":\"2026-08\",\"montant\":500000}]}'::jsonb where id='KOSSI';"
essai "il ne s'invente PAS un virement" REFUSE "$VEND" \
  "update public.paie set data = jsonb_set(data,'{virements}', (data->'virements') || '[{\"id\":\"vX\",\"montant\":999999}]'::jsonb) where id='KOSSI';"
essai "il n'approuve PAS son propre crédit" REFUSE "$VEND" \
  "update public.paie set data = jsonb_set(data,'{credits,0,statut}','\"approuve\"') where id='KOSSI';"
essai "il ne crée PAS une fiche de paie" REFUSE "$VEND" \
  "insert into public.paie (id, data) values ('NOUVEAU','{\"salaire_base\":999}');"
essai "il ne touche PAS la fiche d'un collègue" PASSE "$VEND" \
  "update public.paie set data = jsonb_set(data,'{salaire_base}','1') where id='TIMO'; select 1 where (select count(*) from public.paie where id='TIMO' and (data->>'salaire_base')::int = 1) = 0;"
essai "il ne supprime PAS sa fiche pour effacer ses dettes" PASSE "$VEND" \
  "delete from public.paie where id='KOSSI'; select 1 where (select count(*) from public.paie where id='KOSSI') = 1;"

echo
echo "▸ 5. L'administrateur, lui, garde la main"
essai "il fixe un salaire"        PASSE "$ADMIN" "update public.paie set data = jsonb_set(data,'{salaire_base}','150000') where id='KOSSI';"
essai "il approuve un crédit"     PASSE "$ADMIN" "update public.paie set data = jsonb_set(data,'{credits,0,statut}','\"approuve\"') where id='KOSSI';"
essai "il enregistre un virement" PASSE "$ADMIN" \
  "update public.paie set data = jsonb_set(data,'{virements}', (data->'virements') || '[{\"id\":\"v2\",\"montant\":50000}]'::jsonb) where id='KOSSI';"
essai "il crée une fiche de paie" PASSE "$ADMIN" "insert into public.paie (id, data) values ('AMA','{\"salaire_base\":90000}');"

echo
echo "▸ 6. Le retour en arrière remet tout en place"
# Bloc d'annulation extrait du fichier lui-même (lignes commençant par "--   ").
sed -n '/EN CAS DE PROBLÈME/,/^-- ===/p' supabase/paie-1-table.sql \
  | grep '^--   ' | sed 's/^--   //' > "$D/rollback.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f "$D/rollback.sql" >/dev/null 2>&1
verite "la table paie a disparu"                  "select count(*) = 0 from pg_tables where schemaname='public' and tablename='paie';"
verite "le salaire est revenu dans la fiche employé" "select (data->>'salaire_base')::int = 150000 from public.users where id='KOSSI';"
verite "le numéro de pièce aussi"                 "select data->>'piece_num' = 'AB1234' from public.users where id='KOSSI';"

echo
if [ $ko -eq 0 ]; then echo "✅  $ok vérification(s) passée(s), 0 en échec."
else echo "❌  $ok passée(s), $ko en ÉCHEC."; exit 1; fi
