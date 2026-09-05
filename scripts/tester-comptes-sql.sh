#!/usr/bin/env bash
# ============================================================
# LES COMPTES, RÈGLES DE RÔLE CÔTÉ SERVEUR — mesuré sur un PostgreSQL jetable
# (vague 3, étape 3 — supabase/securite-5-comptes.sql)
#
#   bash scripts/tester-comptes-sql.sh
#
# N'a AUCUN contact avec la base Supabase de BMI.
# Pour chaque règle validée par Timo le 05/09/2026 : le geste INTERDIT est
# REFUSÉ, et le geste PERMIS passe — les deux, sinon le verrou casserait le
# travail de tous les jours (leçon ESSO). On regarde si la base a levé une
# objection, jamais ce que psql affiche.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable"; exit 1; }
export PATH="$PATH:$BIN"
D=$(mktemp -d /tmp/bmi-cpt-XXXXXX); PORT=55493
nettoyer() { su postgres -c "$BIN/pg_ctl -D $D stop -m immediate" >/dev/null 2>&1 || true; rm -rf "$D"; }
trap nettoyer EXIT
chown postgres:postgres "$D"
su postgres -c "$BIN/initdb -D $D -U postgres -A trust" >/dev/null
su postgres -c "$BIN/pg_ctl -D $D -o '-p $PORT -k /tmp' -l $D/log start" >/dev/null
sleep 2
psql -h /tmp -p $PORT -U postgres -q -c "create database bmi;" >/dev/null
P="psql -h /tmp -p $PORT -U postgres -d bmi -v ON_ERROR_STOP=1 -tA"

echo "▸ Environnement Supabase simulé + règles réelles déjà en place"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/test/fixture.sql
for f in supabase/roles-1-vague1.sql supabase/roles-2-vague2.sql supabase/securite-2-role-inviolable.sql; do
  psql -h /tmp -p $PORT -U postgres -d bmi -q -f "$f" >/dev/null 2>&1 || echo "   (⚠ $f partiellement rejoué)"
done
psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f supabase/securite-4-argent.sql >/dev/null 2>&1
echo "▸ Pose des verrous : supabase/securite-5-comptes.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f supabase/securite-5-comptes.sql >/dev/null 2>&1

$P -c "
insert into public.users (id, data) values
  ('za_timo',  '{\"id\":\"za_timo\",\"nom\":\"TIMO\",\"role\":\"admin\",\"admin_principal\":true,\"pwd_hash2\":\"h-timo\",\"pwd_salt\":\"s\"}'),
  ('za_caleb', '{\"id\":\"za_caleb\",\"nom\":\"CALEB\",\"role\":\"admin\",\"droits_off\":[\"historique\"],\"pwd_hash2\":\"h-caleb\",\"pwd_salt\":\"s\"}'),
  ('zv_kossi', '{\"id\":\"zv_kossi\",\"nom\":\"KOSSI\",\"role\":\"vendeur\",\"boutique\":\"APESSITO\",\"taux_commission\":0,\"pwd_hash2\":\"h-kossi\",\"pwd_salt\":\"s\",\"taches\":[{\"id\":\"tk1\",\"titre\":\"Ranger\",\"statut\":\"a_faire\"}]}'),
  ('zg_ali',   '{\"id\":\"zg_ali\",\"nom\":\"ALI\",\"role\":\"gerant\",\"boutique\":\"APESSITO\"}'),
  ('zo_com',   '{\"id\":\"zo_com\",\"nom\":\"COM\",\"role\":\"commercial\",\"taux_commission\":5,\"chef_equipe\":true}'),
  ('zt_tech',  '{\"id\":\"zt_tech\",\"nom\":\"TECH\",\"role\":\"technicien\",\"parrain_id\":\"zo_com\",\"taux_commission\":3,\"taches\":[{\"id\":\"tt1\",\"titre\":\"Poser\",\"statut\":\"terminee\"}]}'),
  ('zr_resp',  '{\"id\":\"zr_resp\",\"nom\":\"RESP\",\"role\":\"resp_commercial\"}'),
  ('zc_ama',   '{\"id\":\"zc_ama\",\"nom\":\"AMA\",\"role\":\"client\",\"tel\":\"90112233\",\"pwd_hash2\":\"h-ama\",\"pwd_salt\":\"s\",\"mdp_auto\":true,\"devis\":[]}')
on conflict (id) do nothing;
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
  else ko=$((ko+1)); echo "  ❌ $desc → $obtenu (attendu : $attendu)"; echo "     $(echo "$sortie" | grep -v '^$' | tail -1)"; fi
}
# jeton <id> <rôle> <écriture> <complément d'étiquette JSON (sans accolades)>
jeton() { echo "{\"role\":\"authenticated\",\"email\":\"$1@bmi.internal\",\"app_metadata\":{\"role\":\"$2\",\"ecriture\":$3,\"espace\":\"reel\"$4}}"; }
PRINCIPAL=$(jeton za_timo admin true ',"principal":true')
PRINCIPAL_VIEILLE_ETIQUETTE=$(jeton za_timo admin true '')      # connecté avant 2.101.51 : pas d'étiquette « principal »
CALEB=$(jeton za_caleb admin true ',"principal":false')          # admin secondaire
VENDEUR=$(jeton zv_kossi vendeur true '')
GERANT=$(jeton zg_ali gerant true '')
COMMERCIAL=$(jeton zo_com commercial true ',"pouvoirs_off":[]')
COMMERCIAL_SANS_TACHES=$(jeton zo_com commercial true ',"pouvoirs_off":["act_taches"]')
TECHNICIEN=$(jeton zt_tech technicien true '')
RESP=$(jeton zr_resp resp_commercial true '')
CLIENT=$(jeton zc_ama client true '')
VIDE='{}'

MAJ() { echo "with x as (update public.users set data = $1 where id='$2' returning 1) select count(*) from x;"; }
SUPPR() { echo "with x as (delete from public.users where id='$1' returning 1) select count(*) from x;"; }
SET() { echo "jsonb_set(data,'{$1}','$2')"; }

echo
echo "── SUPPRIMER UN COMPTE : admin seul ──"
essai "un vendeur supprime un compte" "REFUSE" "$VENDEUR" "$(SUPPR zt_tech)"
essai "un gérant supprime un compte" "REFUSE" "$GERANT" "$(SUPPR zv_kossi)"
essai "un client supprime un compte" "REFUSE" "$CLIENT" "$(SUPPR zv_kossi)"
essai "un admin secondaire supprime un compte" "PERMIS" "$CALEB" "$(SUPPR zv_kossi)"

echo
echo "── BLOQUER / RÉACTIVER : admin seul ──"
essai "un gérant bloque un vendeur" "REFUSE" "$GERANT" "$(MAJ "$(SET actif false)" zv_kossi)"
essai "un vendeur bloque un client" "REFUSE" "$VENDEUR" "$(MAJ "$(SET actif false)" zc_ama)"
essai "un admin secondaire bloque un vendeur" "PERMIS" "$CALEB" "$(MAJ "$(SET actif false)" zv_kossi)"
essai "un vendeur se débloque lui-même (déjà fermé en 2.101.17)" "REFUSE" "$VENDEUR" "$(MAJ "$(SET actif true)" zv_kossi)"

echo
echo "── LA FICHE D'UN EMPLOYÉ (rattachement, taux, identité, paie) : admin seul ──"
essai "un gérant change la boutique d'un vendeur" "REFUSE" "$GERANT" "$(MAJ "$(SET boutique '"HEDZRANAWOE"')" zv_kossi)"
essai "un gérant change le taux de commission d'un commercial" "REFUSE" "$GERANT" "$(MAJ "$(SET taux_commission 50)" zo_com)"
essai "un commercial s'augmente SON taux de commission" "REFUSE" "$COMMERCIAL" "$(MAJ "$(SET taux_commission 50)" zo_com)"
essai "un commercial change le parrain d'un technicien" "REFUSE" "$COMMERCIAL" "$(MAJ "$(SET parrain_id '"zo_com"')" zv_kossi)"
essai "un commercial se nomme chef d'équipe" "REFUSE" "$COMMERCIAL" "$(MAJ "$(SET chef_equipe true)" zt_tech)"
essai "★ un vendeur écrit un salaire dans SA fiche (le dernier échec de tester-ecriture-sql)" "REFUSE" "$VENDEUR" "$(MAJ "$(SET salaire_base 900000)" zv_kossi)"
essai "★ un vendeur écrit un salaire dans la fiche de l'administrateur" "REFUSE" "$VENDEUR" "$(MAJ "$(SET salaire_base 1)" za_timo)"
essai "un vendeur change l'identité officielle d'un collègue" "REFUSE" "$VENDEUR" "$(MAJ "$(SET nom_complet '"X"')" zt_tech)"
essai "un admin secondaire change la boutique d'un vendeur" "PERMIS" "$CALEB" "$(MAJ "$(SET boutique '"HEDZRANAWOE"')" zv_kossi)"
essai "un admin secondaire fixe un taux de commission" "PERMIS" "$CALEB" "$(MAJ "$(SET taux_commission 7)" zo_com)"
essai "un admin secondaire enregistre l'identité et l'anniversaire" "PERMIS" "$CALEB" "$(MAJ "data || '{\"nom_complet\":\"KOSSI A.\",\"anniv\":\"04-12\"}'" zv_kossi)"
essai "un admin secondaire nomme un chef d'équipe" "PERMIS" "$CALEB" "$(MAJ "$(SET chef_equipe true)" zt_tech)"

echo
echo "── LE MOT DE PASSE D'UN AUTRE COMPTE : admin PRINCIPAL seul ──"
essai "un admin secondaire change le mot de passe d'un vendeur" "REFUSE" "$CALEB" "$(MAJ "$(SET pwd_hash2 '"nouveau"')" zv_kossi)"
essai "un admin secondaire change le mot de passe d'un client" "REFUSE" "$CALEB" "$(MAJ "data || '{\"pwd_hash2\":\"nouveau\",\"mdp_auto\":false}'" zc_ama)"
essai "un gérant change le mot de passe d'un vendeur" "REFUSE" "$GERANT" "$(MAJ "$(SET pwd_hash2 '"nouveau"')" zv_kossi)"
essai "l'admin principal change le mot de passe d'un vendeur" "PERMIS" "$PRINCIPAL" "$(MAJ "$(SET pwd_hash2 '"nouveau"')" zv_kossi)"
essai "★ …même avec une étiquette de connexion d'avant 2.101.51 (la fiche fait foi)" "PERMIS" "$PRINCIPAL_VIEILLE_ETIQUETTE" "$(MAJ "$(SET pwd_hash2 '"nouveau"')" zv_kossi)"
essai "l'admin principal change le mot de passe d'un client" "PERMIS" "$PRINCIPAL" "$(MAJ "data || '{\"pwd_hash2\":\"nouveau\",\"mdp_auto\":false}'" zc_ama)"
essai "un vendeur renforce SON mot de passe à la connexion" "PERMIS" "$VENDEUR" "$(MAJ "(data || '{\"pwd_hash2\":\"fort\",\"pwd_salt\":\"s2\"}'::jsonb) - 'pwd'" zv_kossi)"
essai "un client change SON mot de passe" "PERMIS" "$CLIENT" "$(MAJ "data || '{\"pwd_hash2\":\"perso\",\"mdp_auto\":false}'" zc_ama)"
essai "l'éditeur SQL (jeton vide) change un mot de passe" "PERMIS" "$VIDE" "$(MAJ "$(SET pwd_hash2 '"sql"')" zv_kossi)"

echo
echo "── TRANSFÉRER LE RÔLE PRINCIPAL : le principal seul ──"
essai "un admin secondaire se déclare principal" "REFUSE" "$CALEB" "$(MAJ "$(SET admin_principal true)" za_caleb)"
essai "un admin secondaire donne le rôle principal à un autre admin" "REFUSE" "$CALEB" "$(MAJ "$(SET admin_principal true)" zt_tech)"
essai "un admin secondaire retire le drapeau au principal" "REFUSE" "$CALEB" "$(MAJ "$(SET admin_principal false)" za_timo)"
essai "★ le principal transfère son rôle (sa fiche d'abord, puis celle du nouveau)" "PERMIS" "$PRINCIPAL_VIEILLE_ETIQUETTE" \
  "update public.users set data = $(SET admin_principal false) where id='za_timo'; $(MAJ "$(SET admin_principal true)" za_caleb)"
essai "★ le principal transfère son rôle (celle du nouveau d'abord, puis la sienne)" "PERMIS" "$PRINCIPAL_VIEILLE_ETIQUETTE" \
  "update public.users set data = $(SET admin_principal true) where id='za_caleb'; $(MAJ "$(SET admin_principal false)" za_timo)"
essai "le principal transfère son rôle en un seul envoi (toutes les fiches réécrites)" "PERMIS" "$PRINCIPAL" \
  "with x as (update public.users set data = jsonb_set(data,'{admin_principal}', to_jsonb(id = 'za_caleb')) where data->>'role' <> 'client' returning 1) select count(*) from x;"

echo
echo "── BASCULER UN COMPTE RÉEL ↔ FORMATION : le principal seul ──"
essai "un admin secondaire passe un vendeur en formation" "REFUSE" "$CALEB" "$(MAJ "data || '{\"formation\":true,\"boutique\":\"APESSITO FORMATION\",\"boutique_avant_espace\":\"APESSITO\"}'" zv_kossi)"
essai "le principal passe un vendeur en formation (avec sa boutique)" "PERMIS" "$PRINCIPAL" "$(MAJ "data || '{\"formation\":true,\"boutique\":\"APESSITO FORMATION\",\"boutique_avant_espace\":\"APESSITO\"}'" zv_kossi)"

echo
echo "── LES TÂCHES : le pouvoir « tâches » pour celles des autres, chacun pour les siennes ──"
essai "un commercial (chef) assigne une tâche à un membre de son équipe" "PERMIS" "$COMMERCIAL" "$(MAJ "jsonb_set(data,'{taches}', coalesce(data->'taches','[]') || '[{\"id\":\"t9\",\"titre\":\"Visite\",\"statut\":\"a_faire\"}]')" zt_tech)"
essai "un commercial valide la tâche terminée d'un membre" "PERMIS" "$COMMERCIAL" "$(MAJ "jsonb_set(data,'{taches,0,statut}','\"validee\"')" zt_tech)"
essai "le responsable commercial assigne une tâche" "PERMIS" "$RESP" "$(MAJ "jsonb_set(data,'{taches}', coalesce(data->'taches','[]') || '[{\"id\":\"t9\",\"titre\":\"Visite\"}]')" zo_com)"
essai "un commercial à qui l'admin a RETIRÉ le pouvoir « tâches »" "REFUSE" "$COMMERCIAL_SANS_TACHES" "$(MAJ "jsonb_set(data,'{taches,0,statut}','\"validee\"')" zt_tech)"
essai "un vendeur assigne une tâche à un collègue" "REFUSE" "$VENDEUR" "$(MAJ "jsonb_set(data,'{taches}','[{\"id\":\"t9\"}]')" zt_tech)"
essai "un gérant valide la tâche d'un autre" "REFUSE" "$GERANT" "$(MAJ "jsonb_set(data,'{taches,0,statut}','\"validee\"')" zt_tech)"
essai "un technicien déclare SA tâche terminée (✅ Mes tâches)" "PERMIS" "$TECHNICIEN" "$(MAJ "jsonb_set(data,'{taches,0,statut}','\"terminee\"')" zt_tech)"
essai "un vendeur déclare SA tâche terminée" "PERMIS" "$VENDEUR" "$(MAJ "jsonb_set(data,'{taches,0,statut}','\"terminee\"')" zv_kossi)"

echo
echo "── LE QUOTIDIEN SUR SA PROPRE FICHE : passe ──"
essai "un vendeur enregistre sa signature personnelle" "PERMIS" "$VENDEUR" "$(MAJ "$(SET signature_personnelle '"data:image/png;base64,x"')" zv_kossi)"
essai "un technicien se met indisponible" "PERMIS" "$TECHNICIEN" "$(MAJ "$(SET indisponible true)" zt_tech)"
essai "un vendeur réécrit SA fiche à l'identique (synchronisation)" "PERMIS" "$VENDEUR" "$(MAJ "data" zv_kossi)"
essai "un vendeur se passe en formation lui-même (déjà fermé)" "REFUSE" "$VENDEUR" "$(MAJ "$(SET formation true)" zv_kossi)"

echo
echo "── LES FICHES DES CLIENTS : PAS TOUCHÉES par cette étape (étape 4) ──"
essai "un vendeur range un devis dans la fiche d'un client" "PERMIS" "$VENDEUR" "$(MAJ "jsonb_set(data,'{devis}','[{\"id\":\"dv1\",\"total\":1000}]')" zc_ama)"
essai "un commercial marque « devis validé » sur la fiche d'un client" "PERMIS" "$COMMERCIAL" "$(MAJ "$(SET devis_valide true)" zc_ama)"
essai "un client écrit son évaluation dans SA fiche" "PERMIS" "$CLIENT" "$(MAJ "$(SET evaluations_donnees '[{"note":5}]')" zc_ama)"
essai "un vendeur autorise le chat libre à un client" "REFUSE" "$VENDEUR" "$(MAJ "$(SET chat_libre true)" zc_ama)"
essai "un admin secondaire autorise le chat libre à un client" "PERMIS" "$CALEB" "$(MAJ "$(SET chat_libre true)" zc_ama)"

echo
if [ $ko -eq 0 ]; then echo "✅  $ok vérification(s) passée(s), 0 en échec."; exit 0
else echo "❌  $ok passée(s), $ko en échec."; exit 1; fi
