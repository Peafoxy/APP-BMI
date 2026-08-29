#!/usr/bin/env bash
# ============================================================
# QUI PEUT ÉCRIRE QUOI ? — mesuré sur un PostgreSQL local jetable
# reproduisant Supabase, politiques réelles rejouées.
#
#   bash scripts/tester-ecriture-sql.sh
#
# N'a AUCUN contact avec la base Supabase de BMI.
#
# ⚠ POURQUOI CE BANC EXISTE
# Les bancs existants vérifient la LECTURE (qui voit quoi) et le
# cloisonnement. Personne n'avait jamais mesuré l'ÉCRITURE : un compte
# connecté qui n'utilise pas l'application, mais parle directement au
# serveur avec la clé publique (celle-ci est dans le code envoyé au
# navigateur, elle est connue de tous), que peut-il modifier ?
#
# On ne teste pas « le script passe » : on tente les gestes qui coûtent de
# l'argent, et on regarde ce que la base accepte.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable"; exit 1; }
export PATH="$PATH:$BIN"
D=$(mktemp -d /tmp/bmi-ecr-XXXXXX); PORT=55489
nettoyer() { su postgres -c "$BIN/pg_ctl -D $D stop -m immediate" >/dev/null 2>&1 || true; rm -rf "$D"; }
trap nettoyer EXIT
chown postgres:postgres "$D"
su postgres -c "$BIN/initdb -D $D -U postgres -A trust" >/dev/null
su postgres -c "$BIN/pg_ctl -D $D -o '-p $PORT -k /tmp' -l $D/log start" >/dev/null
sleep 2
psql -h /tmp -p $PORT -U postgres -q -c "create database bmi;" >/dev/null
P="psql -h /tmp -p $PORT -U postgres -d bmi -v ON_ERROR_STOP=1 -tA"

echo "▸ Environnement Supabase simulé + politiques réelles"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/test/fixture.sql
for f in supabase/roles-1-vague1.sql supabase/roles-2-vague2.sql supabase/client-1-fermer-annuaire.sql supabase/paie-1-table.sql supabase/securite-2-role-inviolable.sql; do
  psql -h /tmp -p $PORT -U postgres -d bmi -q -f "$f" >/dev/null 2>&1 || echo "   (⚠ $f partiellement rejoué)"
done

# Données d'essai : un client, un vendeur, l'admin principal, une dette,
# une vente, un chantier.
$P -c "
insert into public.users (id, data) values
  ('zc_ama', '{\"id\":\"zc_ama\",\"nom\":\"AMA\",\"role\":\"client\",\"tel\":\"90112233\"}'),
  ('zv_kossi','{\"id\":\"zv_kossi\",\"nom\":\"KOSSI\",\"role\":\"vendeur\",\"boutique\":\"APESSITO\"}'),
  ('za_timo', '{\"id\":\"za_timo\",\"nom\":\"TIMO\",\"role\":\"admin\",\"admin_principal\":true,\"salaire_base\":500000}')
on conflict (id) do nothing;
insert into public.dettes (id, data) values
  ('zd1', '{\"id\":\"d1\",\"boutique\":\"APESSITO\",\"client\":\"AMA\",\"montant\":800000,\"paye\":100000}');
insert into public.ventes (id, data) values
  ('zv1', '{\"id\":\"v1\",\"boutique\":\"APESSITO\",\"client\":\"AMA\",\"articles\":[{\"qte\":1,\"pu\":800000}]}');
insert into public.produits (id, data) values
  ('zp1', '{\"id\":\"p1\",\"boutique\":\"APESSITO\",\"nom\":\"BATTERIE\",\"initial\":10,\"prix_vente\":250000}');
" >/dev/null

ok=0; ko=0
# essai <description> <attendu: PERMIS|REFUSE> <jeton> <sql>
# ⚠ DÉFAUT DE CE BANC, TROUVÉ LE 29/08/2026 — et il faussait TOUT.
# La version précédente lisait la DERNIÈRE LIGNE de la sortie de psql pour
# décider. Or psql annonce chaque commande réussie (« SET ») sur cette même
# sortie : quand un déclencheur refusait l'écriture, il ne restait que ces
# « SET », et le banc les prenait pour un résultat — donc pour une écriture
# ACCEPTÉE. Toutes les portes fermées par un déclencheur étaient annoncées
# grandes ouvertes.
#
# Un banc qui se trompe dans ce sens-là est le pire de tous : il fait crier
# au feu là où tout va bien, et on finit par ne plus l'écouter.
#
# On ne lit plus la sortie : on regarde si psql a ÉCHOUÉ (ON_ERROR_STOP),
# ce qui est la seule marque fiable d'un refus. Et chaque essai tourne dans
# sa propre transaction annulée à la fin, pour qu'aucun ne dépende du
# précédent.
essai() {
  local desc="$1" attendu="$2" jeton="$3" sql="$4"
  local sortie code obtenu
  # `set -e` est actif : on capture l'échec sans faire tomber le banc.
  if sortie=$(psql -h /tmp -p $PORT -U postgres -d bmi -qtA -v ON_ERROR_STOP=1 -c "
    begin;
    set local role authenticated;
    set local request.jwt.claims = '$jeton';
    $sql
    rollback;" 2>&1); then code=0; else code=1; fi
  if [ $code -ne 0 ]; then
    obtenu="REFUSE"                       # la base a levé une objection
  elif [ "$(echo "$sortie" | tail -1)" = "0" ]; then
    obtenu="REFUSE"                       # aucune ligne touchée : RLS a filtré
  else
    obtenu="PERMIS"
  fi
  if [ "$obtenu" = "$attendu" ]; then ok=$((ok+1)); echo "  ✓ $desc → $obtenu";
  else ko=$((ko+1)); echo "  ❌ $desc → $obtenu (attendu : $attendu)"; fi
}

CLIENT='{"role":"authenticated","email":"zc_ama@bmi.internal","app_metadata":{"role":"client","ecriture":true,"espace":"reel"}}'
VENDEUR='{"role":"authenticated","email":"zv_kossi@bmi.internal","app_metadata":{"role":"vendeur","ecriture":true,"espace":"reel"}}'
ADMIN='{"role":"authenticated","email":"za_timo@bmi.internal","app_metadata":{"role":"admin","ecriture":true,"espace":"tous"}}'

echo
echo "── CE QU'UN COMPTE CLIENT PEUT FAIRE À L'ARGENT ──"
essai "un client efface sa propre dette (800 000 F)" "REFUSE" "$CLIENT" \
  "with x as (update public.dettes set data = jsonb_set(data,'{paye}','800000') where id='zd1' returning 1) select count(*) from x;"
essai "un client change le montant d'une vente" "REFUSE" "$CLIENT" \
  "with x as (update public.ventes set data = jsonb_set(data,'{client}','\"AUTRE\"') where id='zv1' returning 1) select count(*) from x;"
essai "un client change le prix d'un article" "REFUSE" "$CLIENT" \
  "with x as (update public.produits set data = jsonb_set(data,'{prix_vente}','1') where id='zp1' returning 1) select count(*) from x;"
essai "un client se nomme ADMINISTRATEUR PRINCIPAL" "REFUSE" "$CLIENT" \
  "with x as (update public.users set data = data || '{\"role\":\"admin\",\"admin_principal\":true}' where id='zc_ama' returning 1) select count(*) from x;"
essai "un client modifie la fiche de l'administrateur" "REFUSE" "$CLIENT" \
  "with x as (update public.users set data = jsonb_set(data,'{salaire_base}','1') where id='za_timo' returning 1) select count(*) from x;"
essai "un client invente une vente de toutes pièces" "REFUSE" "$CLIENT" \
  "with x as (insert into public.ventes (id,data) values ('zvX','{\"boutique\":\"APESSITO\"}') returning 1) select count(*) from x;"
essai "un client supprime une vente (déjà fermé en vague 2)" "REFUSE" "$CLIENT" \
  "with x as (delete from public.ventes where id='zv1' returning 1) select count(*) from x;"

$P -c "insert into public.paie (id, data) values ('zv_kossi','{\"id\":\"zv_kossi\",\"salaire_base\":120000}') on conflict (id) do nothing;" >/dev/null 2>&1 || true

echo
echo "── CE QU'UN VENDEUR PEUT FAIRE HORS DE L'APPLICATION ──"
essai "un vendeur se nomme ADMINISTRATEUR PRINCIPAL" "REFUSE" "$VENDEUR" \
  "with x as (update public.users set data = data || '{\"role\":\"admin\",\"admin_principal\":true}' where id='zv_kossi' returning 1) select count(*) from x;"
essai "un vendeur s'augmente le salaire de l'administrateur" "REFUSE" "$VENDEUR" \
  "with x as (update public.users set data = jsonb_set(data,'{salaire_base}','9000000') where id='za_timo' returning 1) select count(*) from x;"
essai "un vendeur efface une dette client" "PERMIS" "$VENDEUR" \
  "with x as (update public.dettes set data = jsonb_set(data,'{paye}','800000') where id='zd1' returning 1) select count(*) from x;"
essai "un vendeur s'augmente SON PROPRE salaire (table paie)" "REFUSE" "$VENDEUR" \
  "with x as (update public.paie set data = jsonb_set(data,'{salaire_base}','900000') where id='zv_kossi' returning 1) select count(*) from x;"
essai "un vendeur lit le salaire des autres (table paie)" "REFUSE" "$VENDEUR" \
  "select count(*) from public.paie where id <> 'zv_kossi';"

echo
echo "── ET CE QUI DOIT CONTINUER DE PASSER (sinon le garde-fou casse l'app) ──"
essai "un vendeur cree un compte CLIENT (fiche, devis, prospect converti)" "PERMIS" "$VENDEUR" \
  "with x as (insert into public.users (id,data) values ('zc_new','{\"nom\":\"AMEKO\",\"role\":\"client\"}') returning 1) select count(*) from x;"
essai "un client met a jour SA fiche (devis valide, mot de passe)" "PERMIS" "$CLIENT" \
  "with x as (update public.users set data = data || '{\"pwd_hash2\":\"abc\"}' where id='zc_ama' returning 1) select count(*) from x;"
essai "un vendeur complete la fiche d'un client (telephone)" "PERMIS" "$VENDEUR" \
  "with x as (update public.users set data = jsonb_set(data,'{tel}','\"90998877\"') where id='zc_ama' returning 1) select count(*) from x;"
essai "l'ADMIN change le role d'un autre compte (ecran Utilisateurs)" "PERMIS" "$ADMIN" \
  "with x as (update public.users set data = data || '{\"role\":\"gerant\"}' where id='zv_kossi' returning 1) select count(*) from x;"
essai "l'ADMIN ne change pas ses PROPRES pouvoirs non plus" "REFUSE" "$ADMIN" \
  "with x as (update public.users set data = data || '{\"droits_off\":[]}' where id='za_timo' returning 1) select count(*) from x;"

echo
if [ $ko -eq 0 ]; then echo "✅  $ok vérification(s) passée(s), 0 en échec."; exit 0
else echo "❌  $ko vérification(s) EN ÉCHEC sur $((ok+ko))."; exit 1; fi
