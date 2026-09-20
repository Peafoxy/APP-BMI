#!/usr/bin/env bash
# ============================================================
# Rejoue supabase/securite-27-conversations-whatsapp.sql sur un PostgreSQL
# local jetable, dans un environnement qui reproduit celui de Supabase
# (mêmes tables, mêmes rôles, même auth.jwt(), mêmes politiques de départ,
# ET la règle des comptes clients déjà posée — client-1-fermer-annuaire).
#
#   bash scripts/tester-conversations-sql.sh
#
# N'a AUCUN contact avec la base Supabase de BMI. Sert à vérifier le script
# AVANT que Timo ne le colle. ⚠ C'est la table de TOUS les messages : le
# banc vérifie d'abord que la messagerie INTERNE n'a pas bougé d'un pouce.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable (apt-get install postgresql)"; exit 1; }
export PATH="$PATH:$BIN"

D=$(mktemp -d /tmp/bmi-wa-XXXXXX); PORT=55462
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

# Les comptes dont on a besoin en plus : un commercial, un second
# commercial, un comptable, un client.
$P -c "
insert into public.users (id, data) values
  ('COM1',   '{\"nom\":\"COM1\",\"role\":\"commercial\"}'),
  ('COM2',   '{\"nom\":\"COM2\",\"role\":\"commercial\"}'),
  ('COMPTA', '{\"nom\":\"COMPTA\",\"role\":\"comptable\"}'),
  ('CLI1',   '{\"nom\":\"CLI1\",\"role\":\"client\"}');
" >/dev/null

# ---- LES MESSAGES ----
# (1) la messagerie INTERNE, qui ne doit pas bouger d'un pouce ;
# (2) une conversation WhatsApp confiée à COM1 ;
# (3) une conversation de SUPPORT, que personne n'a engagée ;
# (4) une conversation confiée au vendeur KOSSI.
# ⚠ La conversation de COM1 porte DEUX lignes, dont une SANS propriétaire
# (le premier message du client) : c'est le fil qui décide, pas la ligne.
$P -c "
insert into public.messages (id, data) values
  ('int1', '{\"de_id\":\"KOSSI\",\"a_id\":\"TIMO\",\"texte\":\"message interne\"}'),
  ('int2', '{\"de_id\":\"TIMO\",\"a_id\":\"CLI1\",\"texte\":\"bonjour client\"}'),
  ('int3', '{\"de_id\":\"COM1\",\"a_id\":\"COMPTA\",\"texte\":\"note au comptable\"}'),
  ('wa1a', '{\"canal\":\"whatsapp\",\"wa_tel\":\"90112233\",\"ts\":\"2026-09-20T10:00:00Z\",\"wa_entrant\":true,\"texte\":\"bonjour\"}'),
  ('wa1b', '{\"canal\":\"whatsapp\",\"wa_tel\":\"90112233\",\"ts\":\"2026-09-20T10:05:00Z\",\"proprietaire_id\":\"COM1\",\"texte\":\"reponse\"}'),
  ('wa2',  '{\"canal\":\"whatsapp\",\"wa_tel\":\"90114455\",\"ts\":\"2026-09-20T11:00:00Z\",\"wa_entrant\":true,\"texte\":\"support\"}'),
  ('wa3',  '{\"canal\":\"whatsapp\",\"wa_tel\":\"90116677\",\"ts\":\"2026-09-20T12:00:00Z\",\"proprietaire_id\":\"KOSSI\",\"texte\":\"a KOSSI\"}');
" >/dev/null

# ⚠ Supabase accorde AUTOMATIQUEMENT les droits sur toute table ET toute
# fonction nouvelle, au visiteur anonyme compris. Sans reproduire ce
# réglage, le banc validerait un script qui laisse pourtant une porte
# ouverte en production (défaut relevé par Timo le 19/08/2026).
$P -c "alter default privileges in schema public grant all on functions to anon, authenticated, service_role;" >/dev/null

echo "▸ La règle des comptes clients, telle qu'elle est déjà en production"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/client-1-fermer-annuaire.sql >/dev/null 2>&1

ok=0; ko=0
compte() {  # compte <description> <revendications> <requete> <attendu>
  local desc="$1" claims="$2" sql="$3" attendu="$4" res
  res=$(psql -h /tmp -p $PORT -U postgres -d bmi -tA \
    -c "set role authenticated; select set_config('request.jwt.claims', '$claims', true); $sql" 2>&1 | tail -1)
  if [ "$res" = "$attendu" ]; then ok=$((ok+1)); echo "  ✓ $desc"
  else ko=$((ko+1)); echo "  ✗ $desc — obtenu : $res (attendu $attendu)"; fi
}
essai() {   # essai <description> <PASSE|REFUSE> <revendications> <requete>
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
COM1='{"email":"COM1@bmi.internal","app_metadata":{"role":"commercial","espace":"reel","ecriture":true}}'
COM2='{"email":"COM2@bmi.internal","app_metadata":{"role":"commercial","espace":"reel","ecriture":true}}'
COMPTA='{"email":"COMPTA@bmi.internal","app_metadata":{"role":"comptable","espace":"reel","ecriture":false}}'
CLIENT='{"email":"CLI1@bmi.internal","app_metadata":{"role":"client","espace":"reel","ecriture":true}}'

WA="select count(*) from public.messages where data->>'canal' = 'whatsapp';"
INT="select count(*) from public.messages where data->>'canal' is null;"

echo
echo "▸ 0. AVANT le script : tout descend chez tout le monde (c'est le défaut)"
compte "un commercial reçoit les 4 lignes WhatsApp"  "$COM1"  "$WA" "4"
compte "le comptable aussi"                          "$COMPTA" "$WA" "4"

echo
echo "▸ Application de securite-27-conversations-whatsapp.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/securite-27-conversations-whatsapp.sql >/dev/null 2>&1

echo
echo "▸ 1. La messagerie INTERNE n'a pas bougé d'un pouce"
compte "l'administrateur lit les 3 messages internes" "$ADMIN"  "$INT" "3"
compte "le vendeur aussi"                             "$VEND"   "$INT" "3"
compte "le commercial aussi"                          "$COM1"   "$INT" "3"
compte "le comptable aussi"                           "$COMPTA" "$INT" "3"
compte "le client lit le sien, et lui seul"           "$CLIENT" "$INT" "1"

echo
echo "▸ 2. WhatsApp : qui reçoit quoi"
compte "l'administrateur reçoit tout"                          "$ADMIN"  "$WA" "4"
compte "un vendeur (salarié) reçoit tout"                      "$VEND"   "$WA" "4"
compte "le commercial : SA conversation + le support"          "$COM1"   "$WA" "3"
compte "…et pas celle du vendeur"  "$COM1" \
  "select count(*) from public.messages where id = 'wa3';" "0"
compte "un autre commercial : le support, rien de plus"        "$COM2"   "$WA" "1"
compte "le comptable ne reçoit PLUS RIEN de WhatsApp"          "$COMPTA" "$WA" "0"
compte "un compte client non plus"                             "$CLIENT" "$WA" "0"

echo
echo "▸ 3. Écrire reste possible — sinon tout le lot resterait coincé"
essai "le commercial répond dans SA conversation" PASSE "$COM1" \
  "insert into public.messages (id, data) values ('wa1c','{\"canal\":\"whatsapp\",\"wa_tel\":\"90112233\",\"ts\":\"2026-09-20T13:00:00Z\",\"proprietaire_id\":\"COM1\",\"texte\":\"encore\"}');"
essai "…et par UPSERT, comme le fait l'application" PASSE "$COM1" \
  "insert into public.messages (id, data) values ('wa1c', (select data from public.messages where id='wa1c')) on conflict (id) do update set data = excluded.data;"
essai "le commercial écrit un message interne"      PASSE "$COM1" \
  "insert into public.messages (id, data) values ('int4','{\"de_id\":\"COM1\",\"a_id\":\"TIMO\",\"texte\":\"bonjour\"}');"
compte "sa conversation compte bien le nouveau message" "$COM1" \
  "select count(*) from public.messages where data->>'wa_tel' = '90112233';" "3"

echo
echo "▸ 4. La porte de derrière reste fermée"
verite "le visiteur anonyme ne peut pas appeler la fonction" \
  "select not has_function_privilege('anon','public.wa_proprietaire(text)','execute');"
verite "la règle est bien posée sur la table des messages" \
  "select count(*) = 1 from pg_policies where tablename='messages' and policyname='wa_conversations_visibles';"
# ⚠ Tous nos scripts sont en « create or replace » : les relancer doit être
# sans danger. On le VÉRIFIE au lieu de le supposer.
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/securite-27-conversations-whatsapp.sql >/dev/null 2>&1
compte "après un second passage, le commercial voit toujours les siennes" "$COM1" \
  "select count(*) from public.messages where data->>'wa_tel' = '90112233';" "3"
compte "…et toujours pas celle du vendeur"  "$COM1" \
  "select count(*) from public.messages where id = 'wa3';" "0"

echo
echo "──────────────────────────────────────────"
echo "  $ok contrôles au vert, $ko en échec"
[ "$ko" -eq 0 ] || exit 1
