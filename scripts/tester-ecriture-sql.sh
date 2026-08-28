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
for f in supabase/roles-1-vague1.sql supabase/roles-2-vague2.sql supabase/client-1-fermer-annuaire.sql; do
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
essai() {
  local desc="$1" attendu="$2" jeton="$3" sql="$4"
  local n
  n=$(psql -h /tmp -p $PORT -U postgres -d bmi -tA -c "
    set local role authenticated;
    set local request.jwt.claims = '$jeton';
    $sql" 2>/dev/null | tail -1 || echo "ERREUR")
  local obtenu="REFUSE"
  [ "$n" != "0" ] && [ "$n" != "ERREUR" ] && [ -n "$n" ] && obtenu="PERMIS"
  if [ "$obtenu" = "$attendu" ]; then ok=$((ok+1)); echo "  ✓ $desc → $obtenu";
  else ko=$((ko+1)); echo "  ❌ $desc → $obtenu (attendu : $attendu)"; fi
}

CLIENT='{"role":"authenticated","email":"zc_ama@bmi.internal","app_metadata":{"role":"client","ecriture":true,"espace":"reel"}}'
VENDEUR='{"role":"authenticated","email":"zv_kossi@bmi.internal","app_metadata":{"role":"vendeur","ecriture":true,"espace":"reel"}}'

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

echo
echo "── CE QU'UN VENDEUR PEUT FAIRE HORS DE L'APPLICATION ──"
essai "un vendeur se nomme ADMINISTRATEUR PRINCIPAL" "REFUSE" "$VENDEUR" \
  "with x as (update public.users set data = data || '{\"role\":\"admin\",\"admin_principal\":true}' where id='zv_kossi' returning 1) select count(*) from x;"
essai "un vendeur s'augmente le salaire de l'administrateur" "REFUSE" "$VENDEUR" \
  "with x as (update public.users set data = jsonb_set(data,'{salaire_base}','9000000') where id='za_timo' returning 1) select count(*) from x;"
essai "un vendeur efface une dette client" "PERMIS" "$VENDEUR" \
  "with x as (update public.dettes set data = jsonb_set(data,'{paye}','800000') where id='zd1' returning 1) select count(*) from x;"

echo
if [ $ko -eq 0 ]; then echo "✅  $ok vérification(s) passée(s), 0 en échec."; exit 0
else echo "❌  $ko vérification(s) EN ÉCHEC sur $((ok+ko))."; exit 1; fi
