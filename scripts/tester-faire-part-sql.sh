#!/usr/bin/env bash
# ============================================================
# LES FAIRE-PART DE SUPPRESSION — mesuré sur un PostgreSQL local jetable
# (vague 3, étape 0 — supabase/securite-3-faire-part.sql)
#
#   bash scripts/tester-faire-part-sql.sh
#
# N'a AUCUN contact avec la base Supabase de BMI.
#
# ⚠ POURQUOI CE BANC EXISTE
# Un faire-part (« cette ligne a été effacée ») est lu par TOUS les
# appareils, qui effacent leur copie ; le marqueur `*` leur fait vider
# base locale ET file d'attente. Avant ce verrou, n'importe quel compte
# connecté — client compris — pouvait en déposer. Ce banc rejoue les
# mensonges (REFUSÉ attendu) ET les suppressions vraies (PERMIS attendu),
# pour que le verrou ne casse pas la synchronisation.
# Même harnais que tester-ecriture-sql.sh : on ne lit pas la sortie de
# psql, on regarde si la base a levé une objection.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable"; exit 1; }
export PATH="$PATH:$BIN"
D=$(mktemp -d /tmp/bmi-fp-XXXXXX); PORT=55491
nettoyer() { su postgres -c "$BIN/pg_ctl -D $D stop -m immediate" >/dev/null 2>&1 || true; rm -rf "$D"; }
trap nettoyer EXIT
chown postgres:postgres "$D"
su postgres -c "$BIN/initdb -D $D -U postgres -A trust" >/dev/null
su postgres -c "$BIN/pg_ctl -D $D -o '-p $PORT -k /tmp' -l $D/log start" >/dev/null
sleep 2
psql -h /tmp -p $PORT -U postgres -q -c "create database bmi;" >/dev/null
P="psql -h /tmp -p $PORT -U postgres -d bmi -v ON_ERROR_STOP=1 -tA"

echo "▸ Environnement Supabase simulé + faire-part tels qu'en production"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/test/fixture.sql
# La table des faire-part et sa règle ACTUELLE (securite-1) : ouverte à tout
# compte connecté — c'est l'état de départ qu'on veut corriger.
$P -c "
create table public.tombstones (id text primary key, table_name text not null, record_id text not null, deleted_at timestamptz not null default now());
grant select, insert, update, delete on public.tombstones to authenticated, service_role;
alter table public.tombstones enable row level security;
create policy tombstones_connectes on public.tombstones for all to authenticated using (true) with check (true);
" >/dev/null
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/tombstones-automatiques.sql >/dev/null 2>&1 || echo "   (⚠ tombstones-automatiques partiellement rejoué)"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/roles-2-vague2.sql >/dev/null 2>&1 || echo "   (⚠ roles-2 partiellement rejoué)"

$P -c "
insert into public.users (id, data) values
  ('zc_ama', '{\"id\":\"zc_ama\",\"nom\":\"AMA\",\"role\":\"client\"}'),
  ('zv_kossi','{\"id\":\"zv_kossi\",\"nom\":\"KOSSI\",\"role\":\"vendeur\",\"boutique\":\"APESSITO\"}'),
  ('za_timo', '{\"id\":\"za_timo\",\"nom\":\"TIMO\",\"role\":\"admin\",\"admin_principal\":true}')
on conflict (id) do nothing;
insert into public.ventes (id, data) values
  ('zv1', '{\"id\":\"zv1\",\"boutique\":\"APESSITO\",\"client\":\"AMA\",\"articles\":[{\"qte\":1,\"pu\":800000}]}'),
  ('zv2', '{\"id\":\"zv2\",\"boutique\":\"APESSITO\",\"client\":\"AMA\"}');
" >/dev/null

ok=0; ko=0
essai() {
  local desc="$1" attendu="$2" jeton="$3" sql="$4"
  local sortie code obtenu
  if sortie=$(psql -h /tmp -p $PORT -U postgres -d bmi -qtA -v ON_ERROR_STOP=1 -c "
    begin;
    set local role authenticated;
    set local request.jwt.claims = '$jeton';
    $sql
    rollback;" 2>&1); then code=0; else code=1; fi
  if [ $code -ne 0 ]; then obtenu="REFUSE";
  elif [ "$(echo "$sortie" | tail -1)" = "0" ]; then obtenu="REFUSE";
  else obtenu="PERMIS"; fi
  if [ "$obtenu" = "$attendu" ]; then ok=$((ok+1)); echo "  ✓ $desc → $obtenu";
  else ko=$((ko+1)); echo "  ❌ $desc → $obtenu (attendu : $attendu)"; echo "     $(echo "$sortie" | tail -1)"; fi
}

CLIENT='{"role":"authenticated","email":"zc_ama@bmi.internal","app_metadata":{"role":"client","ecriture":true,"espace":"reel"}}'
VENDEUR='{"role":"authenticated","email":"zv_kossi@bmi.internal","app_metadata":{"role":"vendeur","ecriture":true,"espace":"reel"}}'
ADMIN='{"role":"authenticated","email":"za_timo@bmi.internal","app_metadata":{"role":"admin","ecriture":true,"espace":"tous"}}'

FAUX_VENTE="with x as (insert into public.tombstones (id, table_name, record_id, deleted_at) values ('ventes:zv1','ventes','zv1',now()) on conflict (id) do update set deleted_at = now() returning 1) select count(*) from x;"
MARQUEUR="with x as (insert into public.tombstones (id, table_name, record_id, deleted_at) values ('__RESET__','*','__RESET__',now()) on conflict (id) do update set deleted_at = now() returning 1) select count(*) from x;"
TRUNC="with x as (insert into public.tombstones (id, table_name, record_id, deleted_at) values ('produits:__TRUNCATE__','produits','__TRUNCATE__',now()) on conflict (id) do update set deleted_at = now() returning 1) select count(*) from x;"
# Le chemin NORMAL de l'application (src/sync.js) : effacer la ligne, PUIS
# déposer le faire-part (le déclencheur AFTER DELETE en a déjà posé un ; l'upsert
# de l'application le rafraîchit).
VRAIE_SUPPR="delete from public.ventes where id='zv2'; with x as (insert into public.tombstones (id, table_name, record_id, deleted_at) values ('ventes:zv2','ventes','zv2',now()) on conflict (id) do update set deleted_at = now() returning 1) select count(*) from x;"

echo
echo "── AVANT LE VERROU : l'état actuel de la production ──"
essai "un CLIENT dépose un faire-part sur une vente vivante (aujourd'hui : passe)" "PERMIS" "$CLIENT" "$FAUX_VENTE"
essai "un CLIENT dépose le marqueur de réinitialisation (aujourd'hui : passe)" "PERMIS" "$CLIENT" "$MARQUEUR"

echo
echo "▸ Pose du verrou : supabase/securite-3-faire-part.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f supabase/securite-3-faire-part.sql >/dev/null

echo
echo "── LES MENSONGES, REFUSÉS ──"
essai "un CLIENT dépose un faire-part sur une vente vivante" "REFUSE" "$CLIENT" "$FAUX_VENTE"
essai "un CLIENT dépose le marqueur de réinitialisation" "REFUSE" "$CLIENT" "$MARQUEUR"
essai "un CLIENT modifie un faire-part existant" "REFUSE" "$CLIENT" \
  "with x as (update public.tombstones set deleted_at = now() returning 1) select count(*) from x;"
essai "un VENDEUR dépose un faire-part sur une vente qui existe encore" "REFUSE" "$VENDEUR" "$FAUX_VENTE"
essai "un VENDEUR dépose le marqueur de réinitialisation (vide tous les appareils)" "REFUSE" "$VENDEUR" "$MARQUEUR"
essai "un VENDEUR dépose un faire-part de vidage de table" "REFUSE" "$VENDEUR" "$TRUNC"
essai "un VENDEUR dépose un faire-part sur une table inconnue" "REFUSE" "$VENDEUR" \
  "with x as (insert into public.tombstones (id, table_name, record_id) values ('wifi:1','wifi_clients','1') returning 1) select count(*) from x;"

echo
echo "── LES VRAIES SUPPRESSIONS, TOUJOURS PERMISES ──"
essai "un VENDEUR efface une vente puis dépose son faire-part (chemin de l'application)" "PERMIS" "$VENDEUR" "$VRAIE_SUPPR"
essai "le déclencheur AFTER DELETE pose lui-même le faire-part sous un VENDEUR" "PERMIS" "$VENDEUR" \
  "delete from public.ventes where id='zv2'; select count(*) from public.tombstones where id='ventes:zv2';"
essai "l'ADMIN dépose le marqueur de réinitialisation" "PERMIS" "$ADMIN" "$MARQUEUR"
essai "un CLIENT LIT toujours les faire-part (la synchronisation en dépend)" "PERMIS" "$CLIENT" \
  "select count(*) + 1 from public.tombstones;"
essai "l'éditeur SQL (jeton vide) vide une table : le faire-part TRUNCATE passe" "PERMIS" "$ADMIN" \
  "set local request.jwt.claims = ''; set local role postgres; truncate public.ventes; select count(*) from public.tombstones where record_id='__TRUNCATE__';"

echo
if [ $ko -eq 0 ]; then echo "✅  $ok vérification(s) passée(s), 0 en échec."; exit 0;
else echo "❌  $ko vérification(s) EN ÉCHEC sur $((ok+ko))."; exit 1; fi
