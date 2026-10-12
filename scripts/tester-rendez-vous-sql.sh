#!/usr/bin/env bash
# ============================================================
# Rejoue supabase/rendez-vous-1-table.sql sur un PostgreSQL local jetable,
# dans un environnement qui reproduit celui de Supabase.
#
#   bash scripts/tester-rendez-vous-sql.sh
#
# N'a AUCUN contact avec la base Supabase de BMI. On regarde si la base a
# levé une objection, jamais ce que psql affiche (leçon du 29/08/2026).
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable (apt-get install postgresql)"; exit 1; }
export PATH="$PATH:$BIN"

D=$(mktemp -d /tmp/bmi-rdv-XXXXXX); PORT=55462
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
grant select, insert, update, delete on public.tombstones to authenticated;
" >/dev/null
# ⚠ Supabase accorde AUTOMATIQUEMENT les droits sur toute nouvelle table, au
# visiteur anonyme compris : on reproduit ce réglage, sinon le banc validerait
# une table restée ouverte (défaut relevé par Timo le 19/08/2026).
$P -c "alter default privileges in schema public grant all on tables to anon, authenticated, service_role;" >/dev/null

echo "▸ Application de rendez-vous-1-table.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -v ON_ERROR_STOP=1 -q -f supabase/rendez-vous-1-table.sql >/dev/null

# Des rendez-vous de départ, posés par l'éditeur SQL (aucun jeton).
$P -c "
insert into public.rendez_vous (id, data) values
  ('P1', '{\"id\":\"P1\",\"type\":\"prive\",\"par_id\":\"KOSSI\",\"objet\":\"Banque\",\"date\":\"2026-10-20\",\"heure\":\"10:00\",\"statut\":\"a_venir\"}'),
  ('R1', '{\"id\":\"R1\",\"type\":\"pro\",\"par_id\":\"KOSSI\",\"objet\":\"Visite MR ERIC\",\"date\":\"2026-10-21\",\"heure\":\"09:00\",\"visite\":true,\"participants\":[\"AMA\"],\"statut\":\"a_venir\"}'),
  ('F1', '{\"id\":\"F1\",\"type\":\"pro\",\"par_id\":\"FORM\",\"objet\":\"Visite essai\",\"date\":\"2026-10-21\",\"heure\":\"11:00\",\"formation\":true,\"participants\":[],\"statut\":\"a_venir\"}');
" >/dev/null

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
# Une requête de LECTURE qui doit renvoyer une ligne : on la fait échouer
# par une division par zéro si la condition est fausse.
compte() { echo "select 1/(case when ($1) then 1 else 0 end);"; }

PRINC='{"email":"TIMO@bmi.internal","app_metadata":{"role":"admin","espace":"tous","ecriture":true}}'
ADM2='{"email":"ADM2@bmi.internal","app_metadata":{"role":"admin","espace":"reel","ecriture":true}}'
KOSSI='{"email":"KOSSI@bmi.internal","app_metadata":{"role":"vendeur","espace":"reel","ecriture":true}}'
AMA='{"email":"AMA@bmi.internal","app_metadata":{"role":"technicien","espace":"reel","ecriture":true}}'
YAO='{"email":"YAO@bmi.internal","app_metadata":{"role":"technicien","espace":"reel","ecriture":true}}'
COMPTA='{"email":"COMPTA@bmi.internal","app_metadata":{"role":"comptable","espace":"reel","ecriture":false}}'
CLIENT='{"email":"CLI1@bmi.internal","app_metadata":{"role":"client","espace":"reel","ecriture":true}}'
FORM='{"email":"FORM@bmi.internal","app_metadata":{"role":"vendeur","espace":"formation","ecriture":true}}'

echo
echo "▸ 1. Qui voit quoi"
verite "le visiteur anonyme n'a AUCUN droit sur la table" "select not has_table_privilege('anon','public.rendez_vous','select');"
essai "KOSSI voit son privé et le pro (2)"                PASSE "$KOSSI"  "$(compte "(select count(*) from public.rendez_vous) = 2")"
essai "AMA voit le pro, PAS le privé de KOSSI"            PASSE "$AMA"    "$(compte "(select count(*) from public.rendez_vous) = 1 and not exists (select 1 from public.rendez_vous where id='P1')")"
essai "★ l'administrateur principal ne voit PAS le privé de KOSSI (A2 a)" PASSE "$PRINC" "$(compte "not exists (select 1 from public.rendez_vous where id='P1')")"
essai "★ …mais voit les pro des DEUX espaces"             PASSE "$PRINC"  "$(compte "(select count(*) from public.rendez_vous) = 2")"
essai "un autre administrateur : le pro réel seulement"   PASSE "$ADM2"   "$(compte "(select count(*) from public.rendez_vous) = 1 and exists (select 1 from public.rendez_vous where id='R1')")"
essai "★ un compte de formation ne voit QUE la formation" PASSE "$FORM"   "$(compte "(select count(*) from public.rendez_vous) = 1 and exists (select 1 from public.rendez_vous where id='F1')")"
essai "le comptable lit le pro"                           PASSE "$COMPTA" "$(compte "exists (select 1 from public.rendez_vous where id='R1') and not exists (select 1 from public.rendez_vous where id='P1')")"
essai "un compte client ne voit rien"                     PASSE "$CLIENT" "$(compte "(select count(*) from public.rendez_vous) = 0")"

echo
echo "▸ 2. Créer"
essai "KOSSI crée un privé à son nom"                PASSE  "$KOSSI" "insert into public.rendez_vous (id, data) values ('P2','{\"type\":\"prive\",\"par_id\":\"KOSSI\",\"objet\":\"Medecin\"}');"
essai "AMA (technicien) crée un pro à son nom (E a)" PASSE  "$AMA"   "insert into public.rendez_vous (id, data) values ('R2','{\"type\":\"pro\",\"par_id\":\"AMA\",\"objet\":\"Visite\",\"participants\":[\"YAO\"]}');"
essai "★ on ne crée PAS un privé au nom d'un autre"  REFUSE "$KOSSI" "insert into public.rendez_vous (id, data) values ('P3','{\"type\":\"prive\",\"par_id\":\"AMA\"}');"
essai "★ on ne crée PAS un pro au nom d'un autre"    REFUSE "$KOSSI" "insert into public.rendez_vous (id, data) values ('R3','{\"type\":\"pro\",\"par_id\":\"AMA\"}');"
essai "un type inconnu est refusé"                   REFUSE "$KOSSI" "insert into public.rendez_vous (id, data) values ('X1','{\"type\":\"autre\",\"par_id\":\"KOSSI\"}');"
essai "le comptable (lecture seule) n'écrit pas"     REFUSE "$COMPTA" "insert into public.rendez_vous (id, data) values ('C1','{\"type\":\"prive\",\"par_id\":\"COMPTA\"}');"
essai "un compte client n'écrit pas"                 REFUSE "$CLIENT" "insert into public.rendez_vous (id, data) values ('C2','{\"type\":\"prive\",\"par_id\":\"CLI1\"}');"
essai "★ un compte de formation ne crée pas un vrai rendez-vous" REFUSE "$FORM" "insert into public.rendez_vous (id, data) values ('F2','{\"type\":\"pro\",\"par_id\":\"FORM\"}');"
essai "…mais crée un rendez-vous de formation"       PASSE  "$FORM"  "insert into public.rendez_vous (id, data) values ('F3','{\"type\":\"pro\",\"par_id\":\"FORM\",\"formation\":true}');"
essai "★ un vendeur réel ne crée pas un rendez-vous de formation" REFUSE "$KOSSI" "insert into public.rendez_vous (id, data) values ('F4','{\"type\":\"pro\",\"par_id\":\"KOSSI\",\"formation\":true}');"

echo
echo "▸ 3. Modifier un privé"
essai "KOSSI modifie son privé par UPSERT, comme l'application" PASSE "$KOSSI" \
  "insert into public.rendez_vous (id, data) values ('P1','{\"id\":\"P1\",\"type\":\"prive\",\"par_id\":\"KOSSI\",\"objet\":\"Banque BTCI\",\"date\":\"2026-10-20\",\"heure\":\"11:00\"}') on conflict (id) do update set data = excluded.data;"
essai "★ AMA ne touche PAS le privé de KOSSI (rien ne bouge)" PASSE "$AMA" \
  "update public.rendez_vous set data = jsonb_set(data,'{objet}','\"pirate\"') where id='P1';"
verite "…le privé n'a pas bougé" "select data->>'objet' = 'Banque BTCI' from public.rendez_vous where id='P1';"
essai "★ l'administrateur principal ne le touche pas non plus" PASSE "$PRINC" \
  "update public.rendez_vous set data = jsonb_set(data,'{objet}','\"pirate\"') where id='P1';"
verite "…toujours intact" "select data->>'objet' = 'Banque BTCI' from public.rendez_vous where id='P1';"
essai "★ ni par UPSERT" REFUSE "$PRINC" \
  "insert into public.rendez_vous (id, data) values ('P1','{\"type\":\"prive\",\"par_id\":\"KOSSI\",\"objet\":\"pirate\"}') on conflict (id) do update set data = excluded.data;"
essai "★ un privé ne devient pas pro" REFUSE "$KOSSI" \
  "update public.rendez_vous set data = jsonb_set(data,'{type}','\"pro\"') where id='P1';"
essai "★ son auteur ne change pas" REFUSE "$KOSSI" \
  "update public.rendez_vous set data = jsonb_set(data,'{par_id}','\"AMA\"') where id='P1';"

echo
echo "▸ 4. Modifier un pro"
essai "AMA (participante) le marque fait avec un compte rendu" PASSE "$AMA" \
  "update public.rendez_vous set data = data || '{\"statut\":\"fait\",\"compte_rendu\":\"Toit vu, devis a faire\",\"fait_le\":\"2026-10-21\",\"fait_par\":\"AMA\"}'::jsonb where id='R1';"
essai "…et par UPSERT aussi" PASSE "$AMA" \
  "insert into public.rendez_vous (id, data) values ('R1', (select data || '{\"compte_rendu\":\"Toit vu, devis 3 kW\"}'::jsonb from public.rendez_vous where id='R1')) on conflict (id) do update set data = excluded.data;"
essai "★ une participante ne change PAS la date" REFUSE "$AMA" \
  "update public.rendez_vous set data = jsonb_set(data,'{date}','\"2026-11-01\"') where id='R1';"
essai "★ ni les participants" REFUSE "$AMA" \
  "update public.rendez_vous set data = jsonb_set(data,'{participants}','[\"AMA\",\"YAO\"]') where id='R1';"
essai "★ une participante n'annule pas" REFUSE "$AMA" \
  "update public.rendez_vous set data = jsonb_set(data,'{statut}','\"annule\"') where id='R1';"
essai "★ un technicien qui n'y participe pas ne touche rien" REFUSE "$YAO" \
  "update public.rendez_vous set data = jsonb_set(data,'{statut}','\"fait\"') where id='R1';"
essai "son auteur change la date" PASSE "$KOSSI" \
  "update public.rendez_vous set data = jsonb_set(data,'{date}','\"2026-10-22\"') where id='R1';"
essai "un administrateur change la date (UPSERT)" PASSE "$ADM2" \
  "insert into public.rendez_vous (id, data) values ('R1', (select jsonb_set(data,'{heure}','\"10:00\"') from public.rendez_vous where id='R1')) on conflict (id) do update set data = excluded.data;"
essai "★ l'espace d'un pro ne bascule pas" REFUSE "$PRINC" \
  "update public.rendez_vous set data = data || '{\"formation\":true}'::jsonb where id='R1';"

echo
echo "▸ 5. Supprimer"
essai "★ une participante ne supprime pas (rien ne part)" PASSE "$AMA" "delete from public.rendez_vous where id='R1';"
verite "…le pro est toujours là" "select count(*) = 1 from public.rendez_vous where id='R1';"
essai "★ l'administrateur principal ne supprime pas le privé de KOSSI" PASSE "$PRINC" "delete from public.rendez_vous where id='P1';"
verite "…le privé est toujours là" "select count(*) = 1 from public.rendez_vous where id='P1';"
essai "un administrateur supprime un pro" PASSE "$ADM2" "delete from public.rendez_vous where id='R2';"
verite "…il est parti" "select count(*) = 0 from public.rendez_vous where id='R2';"
essai "KOSSI supprime son privé" PASSE "$KOSSI" "delete from public.rendez_vous where id='P2';"
verite "…il est parti" "select count(*) = 0 from public.rendez_vous where id='P2';"

echo
echo "▸ 6. L'écriture groupée de l'application"
essai "appliquer_lot accepte la table" PASSE "$KOSSI" \
  "select public.appliquer_lot('[{\"table\":\"rendez_vous\",\"id\":\"P9\",\"data\":{\"type\":\"prive\",\"par_id\":\"KOSSI\"}}]'::jsonb);"
essai "★ …et les règles y valent (privé au nom d'un autre)" REFUSE "$KOSSI" \
  "select public.appliquer_lot('[{\"table\":\"rendez_vous\",\"id\":\"P8\",\"data\":{\"type\":\"prive\",\"par_id\":\"AMA\"}}]'::jsonb);"
essai "les autres tables passent toujours" PASSE "$KOSSI" \
  "select public.appliquer_lot('[{\"table\":\"audits\",\"id\":\"a1\",\"data\":{\"action\":\"test\"}}]'::jsonb);"

echo
echo "▸ 7. La phrase de vérification et le second passage"
verite "★ la phrase de vérification répond true | true | true | true" \
  "select bool_and(v) from (select unnest(array[table_protegee, anonyme_refuse, regles_en_place, ecriture_groupee_ok]) as v from ($(sed -n '/^-- VÉRIFICATION/,$p' supabase/rendez-vous-1-table.sql | grep -v '^--' | tr '\n' ' ' | sed 's/;\s*$//')) q) z;"
if psql -h /tmp -p $PORT -U postgres -d bmi -v ON_ERROR_STOP=1 -q -f supabase/rendez-vous-1-table.sql >/dev/null 2>&1; then
  ok=$((ok+1)); echo "  ✓ relancer le script est sans danger"
else ko=$((ko+1)); echo "  ✗ le second passage du script a échoué"; fi
verite "…et n'a rien effacé" "select count(*) = 1 from public.rendez_vous where id='P1';"

echo
echo "Résultat : $ok ✓, $ko ✗"
[ "$ko" -eq 0 ]
