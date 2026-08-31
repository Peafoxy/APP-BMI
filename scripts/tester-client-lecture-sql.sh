#!/usr/bin/env bash
# ============================================================
# QUE PEUT LIRE UN COMPTE CLIENT ? — mesuré sur un PostgreSQL jetable
# reproduisant Supabase, politiques réelles rejouées, étape 3 comprise
# (supabase/client-4-fermer-lecture.sql).
#
#   npm run tester-client-lecture
#
# N'a AUCUN contact avec la base Supabase de BMI.
#
# On ne lit pas le code des politiques : on se connecte COMME un client
# et on regarde ce que la base rend. C'est la seule mesure qui compte.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable"; exit 1; }
export PATH="$PATH:$BIN"
D=$(mktemp -d /tmp/bmi-lec-XXXXXX); PORT=55492
nettoyer() { su postgres -c "$BIN/pg_ctl -D $D stop -m immediate" >/dev/null 2>&1 || true; rm -rf "$D"; }
trap nettoyer EXIT
chown postgres:postgres "$D"
su postgres -c "$BIN/initdb -D $D -U postgres -A trust" >/dev/null
su postgres -c "$BIN/pg_ctl -D $D -o '-p $PORT -k /tmp' -l $D/log start" >/dev/null
sleep 2
psql -h /tmp -p $PORT -U postgres -q -c "create database bmi;" >/dev/null
P="psql -h /tmp -p $PORT -U postgres -d bmi -v ON_ERROR_STOP=1 -tA"

echo "▸ Environnement Supabase simulé + politiques réelles (étape 3 comprise)"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/test/fixture.sql
for f in supabase/roles-1-vague1.sql supabase/roles-2-vague2.sql supabase/client-1-fermer-annuaire.sql supabase/paie-1-table.sql supabase/securite-2-role-inviolable.sql supabase/client-2-fermer-ecriture.sql supabase/client-4-fermer-lecture.sql; do
  psql -h /tmp -p $PORT -U postgres -d bmi -q -f "$f" >/dev/null 2>&1 || echo "   (⚠ $f partiellement rejoué)"
done

# Table rase : le banc contrôle des visibilités EXACTES.
$P -c "delete from public.dettes; delete from public.ventes;
       delete from public.clients_installes; delete from public.users;" >/dev/null

# ── Le petit monde d'essai ───────────────────────────────────
#  ca_parrain  : client, parrain de ca_filleul
#  ca_filleul  : client, a une vente à crédit (dette non soldée)
#  ca_autre    : client sans aucun lien avec les deux premiers
#  zv_kossi    : vendeur — doit continuer de TOUT voir
#  za_timo     : admin principal — pareil
$P -c "
insert into public.users (id, data) values
 ('ca_parrain','{\"id\":\"ca_parrain\",\"nom\":\"PARRAIN\",\"role\":\"client\"}'),
 ('ca_filleul','{\"id\":\"ca_filleul\",\"nom\":\"FILLEUL\",\"role\":\"client\",\"parrain_client_id\":\"ca_parrain\"}'),
 ('ca_autre',  '{\"id\":\"ca_autre\",\"nom\":\"AUTRE\",\"role\":\"client\"}'),
 ('zv_kossi',  '{\"id\":\"zv_kossi\",\"nom\":\"KOSSI\",\"role\":\"vendeur\"}'),
 ('za_timo',   '{\"id\":\"za_timo\",\"nom\":\"TIMO\",\"role\":\"admin\",\"admin_principal\":true}');
insert into public.ventes (id, data) values
 ('vt_parrain','{\"id\":\"vt_parrain\",\"client\":\"PARRAIN\",\"client_user_id\":\"ca_parrain\",\"articles\":[{\"qte\":1,\"pu\":100}]}'),
 ('vt_filleul','{\"id\":\"vt_filleul\",\"client\":\"FILLEUL\",\"client_user_id\":\"ca_filleul\",\"apporteur\":{\"parrain_user_id\":\"ca_parrain\",\"montant\":5000,\"a_la_reception\":true}}'),
 ('vt_passage','{\"id\":\"vt_passage\",\"client\":\"PASSANT\"}'),
 ('vt_pv',     '{\"id\":\"vt_pv\",\"client\":\"PARRAIN MAL ORTHOGRAPHIE\",\"commission_a_la_reception\":true}');
insert into public.dettes (id, data) values
 ('dt_parrain','{\"id\":\"dt_parrain\",\"client\":\"PARRAIN\",\"client_user_id\":\"ca_parrain\",\"montant\":1000,\"paye\":0}'),
 ('dt_filleul','{\"id\":\"dt_filleul\",\"client\":\"FILLEUL\",\"client_user_id\":\"ca_filleul\",\"vente_id\":\"vt_filleul\",\"montant\":800000,\"paye\":100000}'),
 ('dt_passage','{\"id\":\"dt_passage\",\"client\":\"PASSANT\",\"montant\":500}');
insert into public.clients_installes (id, data) values
 ('ch_parrain','{\"id\":\"ch_parrain\",\"nom\":\"PARRAIN\",\"user_id\":\"ca_parrain\",\"vente_id\":\"vt_pv\"}'),
 ('ch_filleul','{\"id\":\"ch_filleul\",\"nom\":\"FILLEUL\",\"user_id\":\"ca_filleul\",\"vente_id\":\"vt_filleul\"}'),
 ('ch_passage','{\"id\":\"ch_passage\",\"nom\":\"PASSANT\",\"user_id\":\"\"}');
" >/dev/null

PARRAIN='{"role":"authenticated","email":"ca_parrain@bmi.internal","app_metadata":{"role":"client","ecriture":true,"espace":"reel"}}'
FILLEUL='{"role":"authenticated","email":"ca_filleul@bmi.internal","app_metadata":{"role":"client","ecriture":true,"espace":"reel"}}'
AUTRE='{"role":"authenticated","email":"ca_autre@bmi.internal","app_metadata":{"role":"client","ecriture":true,"espace":"reel"}}'
VENDEUR='{"role":"authenticated","email":"zv_kossi@bmi.internal","app_metadata":{"role":"vendeur","ecriture":true,"espace":"reel"}}'
ADMIN='{"role":"authenticated","email":"za_timo@bmi.internal","app_metadata":{"role":"admin","ecriture":true,"espace":"tous"}}'

ok=0; ko=0
# lire <description> <jeton> <sql> <attendu>  — exécute la requête COMME ce
# compte et compare le résultat. Un échec psql fait échouer le contrôle.
lire() {
  local desc="$1" jeton="$2" sql="$3" attendu="$4" sortie obtenu
  if sortie=$(psql -h /tmp -p $PORT -U postgres -d bmi -qtA -v ON_ERROR_STOP=1 -c "
    begin;
    set local role authenticated;
    set local request.jwt.claims = '$jeton';
    $sql
    rollback;" 2>&1); then obtenu=$(echo "$sortie" | tail -1); else obtenu="ERREUR: $sortie"; fi
  if [ "$obtenu" = "$attendu" ]; then ok=$((ok+1)); echo "  ✓ $desc";
  else ko=$((ko+1)); echo "  ❌ $desc → « $obtenu » (attendu : « $attendu »)"; fi
}

echo
echo "── CE QU'UN CLIENT VOIT ENCORE (sinon son écran se vide) ──"
lire "sa propre dette" "$PARRAIN" "select count(*) from public.dettes where id='dt_parrain';" "1"
lire "sa propre vente" "$PARRAIN" "select count(*) from public.ventes where id='vt_parrain';" "1"
lire "son propre chantier" "$PARRAIN" "select count(*) from public.clients_installes where id='ch_parrain';" "1"
lire "le chantier de son filleul (écran parrainage)" "$PARRAIN" "select count(*) from public.clients_installes where id='ch_filleul';" "1"
lire "la vente de son filleul où il est parrain (ses gains)" "$PARRAIN" "select count(*) from public.ventes where id='vt_filleul';" "1"
lire "la dette de cette vente-là (part due SEULEMENT après solde)" "$PARRAIN" "select count(*) from public.dettes where id='dt_filleul';" "1"
lire "la vente rattachée à son chantier (celle du PV à signer)" "$PARRAIN" "select count(*) from public.ventes where id='vt_pv';" "1"

echo
echo "── CE QU'IL NE VOIT PLUS ──"
lire "la dette d'un client de passage" "$PARRAIN" "select count(*) from public.dettes where id='dt_passage';" "0"
lire "la vente d'un client de passage" "$PARRAIN" "select count(*) from public.ventes where id='vt_passage';" "0"
lire "le chantier d'un client de passage" "$PARRAIN" "select count(*) from public.clients_installes where id='ch_passage';" "0"
lire "un client SANS lien ne voit ni la dette du parrain…" "$AUTRE" "select count(*) from public.dettes where id='dt_parrain';" "0"
lire "…ni celle du filleul" "$AUTRE" "select count(*) from public.dettes where id='dt_filleul';" "0"
lire "…ni leurs ventes" "$AUTRE" "select count(*) from public.ventes where id in ('vt_parrain','vt_filleul','vt_pv');" "0"
lire "…ni leurs chantiers" "$AUTRE" "select count(*) from public.clients_installes;" "0"
lire "le filleul ne voit pas la dette de son parrain (ça ne remonte pas)" "$FILLEUL" "select count(*) from public.dettes where id='dt_parrain';" "0"
lire "le filleul, lui, voit bien SA dette" "$FILLEUL" "select count(*) from public.dettes where id='dt_filleul';" "1"

echo
echo "── LES EMPLOYÉS ET L'ADMIN, EUX, VOIENT TOUJOURS TOUT ──"
lire "un vendeur lit les 3 dettes" "$VENDEUR" "select count(*) from public.dettes;" "3"
lire "un vendeur lit les 4 ventes" "$VENDEUR" "select count(*) from public.ventes;" "4"
lire "un vendeur lit les 3 chantiers" "$VENDEUR" "select count(*) from public.clients_installes;" "3"
lire "l'admin principal aussi" "$ADMIN" "select count(*) from public.dettes;" "3"

echo
echo "── ET LES GESTES DU CLIENT PASSENT ENCORE ──"
lire "il signe son PV (la vente de SON chantier, 3 champs autorisés)" "$PARRAIN" \
  "with x as (update public.ventes set data = data || '{\"commission_a_la_reception\":false,\"commission_debloquee_le\":\"2026-08-31\"}' where id='vt_pv' returning 1) select count(*) from x;" "1"
lire "mais il ne touche pas à la vente d'un autre" "$PARRAIN" \
  "with x as (update public.ventes set data = data || '{\"commission_a_la_reception\":false}' where id='vt_passage' returning 1) select count(*) from x;" "0"
lire "il crée encore la dette de son devis « pose seule »" "$PARRAIN" \
  "with x as (insert into public.dettes (id,data) values ('dt_neuf','{\"client_user_id\":\"ca_parrain\",\"montant\":300}') returning 1) select count(*) from x;" "1"

echo
if [ $ko -eq 0 ]; then echo "✅  $ok vérification(s) passée(s), 0 en échec."; exit 0
else echo "❌  $ko vérification(s) EN ÉCHEC sur $((ok+ko))."; exit 1; fi
