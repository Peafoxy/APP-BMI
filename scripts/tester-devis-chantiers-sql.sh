#!/usr/bin/env bash
# ============================================================
# DEVIS, CHANTIERS, PROSPECTS, BOUTIQUES, GROUPES — RÈGLES DE RÔLE CÔTÉ SERVEUR
# mesurées sur un PostgreSQL jetable (vague 3, étape 4 —
# supabase/securite-6-devis-chantiers.sql)
#
#   bash scripts/tester-devis-chantiers-sql.sh
#
# N'a AUCUN contact avec la base Supabase de BMI.
# Pour chaque règle validée par Timo le 05/09/2026 : le geste INTERDIT est
# REFUSÉ, et le geste PERMIS passe — les deux, sinon le verrou casserait le
# travail de tous les jours. On regarde si la base a levé une objection.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable"; exit 1; }
export PATH="$PATH:$BIN"
D=$(mktemp -d /tmp/bmi-dch-XXXXXX); PORT=55494
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
for f in supabase/securite-4-argent.sql supabase/securite-5-comptes.sql; do
  psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1
done
echo "▸ Pose des verrous : supabase/securite-6-devis-chantiers.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f supabase/securite-6-devis-chantiers.sql >/dev/null 2>&1
echo "▸ La demande de l'assistant se prend en charge : supabase/securite-32-prendre-demande-assistant.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f supabase/securite-32-prendre-demande-assistant.sql >/dev/null 2>&1 || echo "   ❌ securite-32 refusé par la base"
# ⚠ On LIT la phrase de vérification (leçon de securite-31, 24/09/2026).
VERIF32=$($P -c "$(sed -n '/^select$/,/;$/p' supabase/securite-32-prendre-demande-assistant.sql | grep -v '^\s*--')" | tr -d ' ')
if [ "$VERIF32" = "t|t" ]; then echo "   ✓ la phrase de vérification de securite-32 répond true | true"; else echo "   ❌ la phrase de vérification de securite-32 répond : $VERIF32"; exit 1; fi
echo "▸ Pose du verrou de la corbeille : supabase/securite-7-corbeille.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f supabase/securite-7-corbeille.sql >/dev/null 2>&1
echo "▸ Correctif upsert : supabase/securite-8-correctif-upsert.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f supabase/securite-8-correctif-upsert.sql >/dev/null 2>&1
echo "▸ Pose des verrous : supabase/securite-22-outillage.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f supabase/securite-22-outillage.sql >/dev/null 2>&1 || echo "   ❌ securite-22 refusé par la base"
echo "▸ Pose des verrous : supabase/securite-23-justifier-retard.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f supabase/securite-23-justifier-retard.sql >/dev/null 2>&1 || echo "   ❌ securite-23 refusé par la base"
echo "▸ Pose des verrous : supabase/securite-24-retenue-outil.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f supabase/securite-24-retenue-outil.sql >/dev/null 2>&1 || echo "   ❌ securite-24 refusé par la base"
echo "▸ Pose des verrous : supabase/securite-25-chantier-outil.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f supabase/securite-25-chantier-outil.sql >/dev/null 2>&1 || echo "   ❌ securite-25 refusé par la base"
echo "▸ Pose des verrous : supabase/securite-26-comptage-boite.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f supabase/securite-26-comptage-boite.sql >/dev/null 2>&1 || echo "   ❌ securite-26 refusé par la base"

$P -c "
insert into public.users (id, data) values
  ('za_timo',  '{\"id\":\"za_timo\",\"nom\":\"TIMO\",\"role\":\"admin\",\"admin_principal\":true}'),
  ('za_caleb', '{\"id\":\"za_caleb\",\"nom\":\"CALEB\",\"role\":\"admin\"}'),
  ('zv_kossi', '{\"id\":\"zv_kossi\",\"nom\":\"KOSSI\",\"role\":\"vendeur\",\"boutique\":\"APESSITO\"}'),
  ('zg_ali',   '{\"id\":\"zg_ali\",\"nom\":\"ALI\",\"role\":\"gerant\",\"boutique\":\"APESSITO\"}'),
  ('zo_com',   '{\"id\":\"zo_com\",\"nom\":\"COM\",\"role\":\"commercial\",\"chef_equipe\":true}'),
  ('zo_com2',  '{\"id\":\"zo_com2\",\"nom\":\"COM2\",\"role\":\"commercial\"}'),
  ('zt_tech',  '{\"id\":\"zt_tech\",\"nom\":\"TECH\",\"role\":\"technicien\"}'),
  ('zt_tech2', '{\"id\":\"zt_tech2\",\"nom\":\"TECH2\",\"role\":\"technicien\"}'),
  ('zm_mag',   '{\"id\":\"zm_mag\",\"nom\":\"MAGASIN\",\"role\":\"magasinier\",\"boutique\":\"APESSITO\"}'),
  ('zb_chef',  '{\"id\":\"zb_chef\",\"nom\":\"CHEF BMI\",\"role\":\"technicien_bmi\",\"chef_equipe\":true}'),
  ('zr_resp',  '{\"id\":\"zr_resp\",\"nom\":\"RESP\",\"role\":\"resp_commercial\"}'),
  ('zc_ama',   '{\"id\":\"zc_ama\",\"nom\":\"AMA\",\"role\":\"client\",\"tel\":\"90112233\",\"devis\":[{\"id\":\"dv1\",\"statut\":\"propose\",\"total\":100000,\"plan_reglement\":{\"type\":\"mensuel\",\"statut\":\"en_attente\"}}]}')
on conflict (id) do nothing;
insert into public.clients_installes (id, data) values
  ('zch1', '{\"id\":\"zch1\",\"nom\":\"AMA\",\"commercial\":\"COM\",\"user_id\":\"zc_ama\",\"statut\":\"en_cours\",\"date_installation\":\"2026-09-10\",\"adresse_contrat\":\"Rue 1\",\"garantie_mois\":24,\"photos\":[{\"id\":\"ph1\",\"data\":\"x\"}],\"observations\":[],\"equipe\":[{\"user_id\":\"zt_tech\",\"nom\":\"TECH\",\"chef\":true,\"pct\":0,\"montant\":0,\"paye\":false},{\"user_id\":\"zt_tech2\",\"nom\":\"TECH2\",\"chef\":false,\"pct\":0,\"montant\":0,\"paye\":false}]}'),
  ('zch2', '{\"id\":\"zch2\",\"nom\":\"KOFFI\",\"commercial\":\"COM2\",\"statut\":\"termine\",\"frais_installation\":50000,\"equipe\":[{\"user_id\":\"zt_tech\",\"nom\":\"TECH\",\"chef\":true,\"pct\":60,\"montant\":30000,\"paye\":false,\"demande_prime\":true,\"prime_boutique\":\"APESSITO\",\"prime_demandee_par\":\"TIMO\"}]}');
insert into public.prospects (id, data) values
  ('zpr1', '{\"id\":\"zpr1\",\"nom\":\"PROSPECT A\",\"tel\":\"91000000\",\"commercial\":\"COM\",\"contacts\":[],\"relance\":\"2026-09-20\"}'),
  ('zpr80', '{\"id\":\"zpr80\",\"nom\":\"MANDA\",\"tel\":\"99021319\",\"commercial\":\"Assistant BMI TOGO\",\"source\":\"assistant_whatsapp\",\"nature\":\"2 clim\"}'),
  ('zpr81', '{\"id\":\"zpr81\",\"nom\":\"AKOSSIWA\",\"tel\":\"99021320\",\"commercial\":\"COM\",\"source\":\"assistant_whatsapp\",\"pris_le\":\"2026-09-24\"}');
insert into public.categories_prospects (id, data) values ('zcat1', '{\"id\":\"zcat1\",\"nom\":\"Particulier\",\"actif\":true}');
insert into public.groupes (id, data) values ('zg1', '{\"id\":\"zg1\",\"nom\":\"Techniciens\",\"membres\":[\"za_timo\",\"zt_tech\"]}');
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
jeton() { echo "{\"role\":\"authenticated\",\"email\":\"$1@bmi.internal\",\"app_metadata\":{\"role\":\"$2\",\"ecriture\":true,\"espace\":\"reel\"$3}}"; }
PRINCIPAL=$(jeton za_timo admin ',"principal":true')
CALEB=$(jeton za_caleb admin ',"principal":false')
VENDEUR=$(jeton zv_kossi vendeur '')
GERANT=$(jeton zg_ali gerant '')
COM=$(jeton zo_com commercial ',"pouvoirs_off":[]')
COM_SANS_REAFFECTER=$(jeton zo_com commercial ',"pouvoirs_off":["act_reaffecter"]')
COM2=$(jeton zo_com2 commercial '')
TECH=$(jeton zt_tech technicien '')
TECH2=$(jeton zt_tech2 technicien '')
# 🧰 OUTILLAGE (17/09/2026) : « chef technicien, magasinier, administrateur ».
MAGASINIER=$(jeton zm_mag magasinier '')
CHEF_BMI=$(jeton zb_chef technicien_bmi ',"pouvoirs_off":[]')
CHEF_BMI_SANS_OUTILLAGE=$(jeton zb_chef technicien_bmi ',"pouvoirs_off":["outillage"]')
RESP=$(jeton zr_resp resp_commercial '')
CLIENT=$(jeton zc_ama client '')

MAJ() { echo "with x as (update public.$1 set data = $2 where id='$3' returning 1) select count(*) from x;"; }
SUPPR() { echo "with x as (delete from public.$1 where id='$2' returning 1) select count(*) from x;"; }
INS() { echo "with x as (insert into public.$1 (id, data) values ('$2', '$3') returning 1) select count(*) from x;"; }
SET() { echo "jsonb_set(data,'{$1}','$2')"; }
# L'écriture telle que l'application la fait VRAIMENT : un upsert.
UPS() { echo "with x as (insert into public.$1 (id, data) values ('$2', '$3') on conflict (id) do update set data = excluded.data returning 1) select count(*) from x;"; }

echo
echo "── LES DEVIS DANS LA FICHE CLIENT : « validé » et plan de règlement → admin PRINCIPAL ──"
essai "un vendeur pose « validé » sur le devis d'un client" "REFUSE" "$VENDEUR" "$(MAJ users "$(SET devis,0,statut '"valide"')" zc_ama)"
essai "un admin secondaire fait signer en boutique (devis → validé)" "REFUSE" "$CALEB" "$(MAJ users "$(SET devis,0,statut '"valide"')" zc_ama)"
essai "l'admin principal fait signer en boutique" "PERMIS" "$PRINCIPAL" "$(MAJ users "$(SET devis,0,statut '"valide"')" zc_ama)"
essai "le client valide SON devis depuis son espace" "PERMIS" "$CLIENT" "$(MAJ users "$(SET devis,0,statut '"valide"')" zc_ama)"
essai "un vendeur encaisse le devis (statut → payé) — le quotidien passe" "PERMIS" "$VENDEUR" "$(MAJ users "$(SET devis,0,statut '"paye"')" zc_ama)"
essai "un commercial range un NOUVEAU devis dans la fiche" "PERMIS" "$COM" "$(MAJ users "jsonb_set(data,'{devis}', data->'devis' || '[{\"id\":\"dv2\",\"statut\":\"propose\",\"total\":5000}]')" zc_ama)"
essai "un admin secondaire ACCEPTE un plan de règlement" "REFUSE" "$CALEB" "$(MAJ users "$(SET devis,0,plan_reglement,statut '"accepte"')" zc_ama)"
essai "un commercial REJETTE un plan de règlement" "REFUSE" "$COM" "$(MAJ users "$(SET devis,0,plan_reglement,statut '"rejete"')" zc_ama)"
essai "l'admin principal accepte un plan de règlement" "PERMIS" "$PRINCIPAL" "$(MAJ users "$(SET devis,0,plan_reglement,statut '"accepte"')" zc_ama)"
essai "le client propose un autre plan (en_attente, sur SA fiche)" "PERMIS" "$CLIENT" "$(MAJ users "$(SET devis,0,plan_reglement '{"type":"hebdo","statut":"en_attente"}')" zc_ama)"

echo
echo "── LES CHANTIERS : supprimer = admin ou son commercial ──"
essai "un vendeur supprime un chantier" "REFUSE" "$VENDEUR" "$(SUPPR clients_installes zch1)"
essai "un commercial supprime le chantier d'un AUTRE commercial" "REFUSE" "$COM2" "$(SUPPR clients_installes zch1)"
essai "le commercial rattaché supprime son chantier" "PERMIS" "$COM" "$(SUPPR clients_installes zch1)"
essai "un admin secondaire supprime un chantier" "PERMIS" "$CALEB" "$(SUPPR clients_installes zch1)"
essai "un commercial CRÉE un chantier (le quotidien passe)" "PERMIS" "$COM" "$(INS clients_installes zch9 '{"id":"zch9","nom":"X","commercial":"COM","statut":"en_cours","equipe":[]}')"

echo
echo "── LES CHANTIERS : la fiche (adresse, garantie, entretien, cadeau, compte lié, commercial) → admin ──"
essai "un commercial corrige l'adresse formelle" "REFUSE" "$COM" "$(MAJ clients_installes "$(SET adresse_contrat '"Rue 2"')" zch1)"
essai "un technicien change la date d'entretien" "REFUSE" "$TECH" "$(MAJ clients_installes "$(SET date_entretien '"2027-01-01"')" zch1)"
essai "un vendeur offre un cadeau" "REFUSE" "$VENDEUR" "$(MAJ clients_installes "$(SET cadeau '{"quoi":"lampe"}')" zch1)"
essai "un commercial change le commercial rattaché" "REFUSE" "$COM" "$(MAJ clients_installes "$(SET commercial '"COM2"')" zch1)"
essai "le responsable commercial lie un compte client" "REFUSE" "$RESP" "$(MAJ clients_installes "$(SET user_id '"zc_ama"')" zch2)"
essai "un admin secondaire corrige l'adresse et la garantie" "PERMIS" "$CALEB" "$(MAJ clients_installes "data || '{\"adresse_contrat\":\"Rue 2\",\"garantie_mois\":36}'" zch1)"
essai "un technicien SUPPRIME une photo" "REFUSE" "$TECH" "$(MAJ clients_installes "$(SET photos '[]')" zch1)"
essai "un technicien AJOUTE une photo (le quotidien passe)" "PERMIS" "$TECH" "$(MAJ clients_installes "jsonb_set(data,'{photos}', data->'photos' || '[{\"id\":\"ph2\",\"data\":\"y\"}]')" zch1)"
essai "un technicien ajoute une observation" "PERMIS" "$TECH" "$(MAJ clients_installes "$(SET observations '[{"id":"o1","texte":"RAS"}]')" zch1)"
essai "l'admin supprime une photo" "PERMIS" "$CALEB" "$(MAJ clients_installes "$(SET photos '[]')" zch1)"

echo
echo "── LES CHANTIERS : programmer = admin + resp. commercial ; frais et primes = admin ; payer une prime demandée = le vendeur ──"
PROG="data || '{\"date_installation\":\"2026-09-12\",\"a_programmer\":false,\"equipe\":[{\"user_id\":\"zt_tech2\",\"nom\":\"TECH2\",\"chef\":true,\"pct\":0,\"montant\":0,\"paye\":false}]}'"
essai "le responsable commercial programme l'installation (date, équipe, chef)" "PERMIS" "$RESP" "$(MAJ clients_installes "$PROG" zch1)"
essai "un commercial programme l'installation" "REFUSE" "$COM" "$(MAJ clients_installes "$PROG" zch1)"
essai "un technicien change la date d'installation" "REFUSE" "$TECH" "$(MAJ clients_installes "$(SET date_installation '"2026-10-01"')" zch1)"
REPART="data || '{\"frais_installation\":50000,\"chef_id\":\"zt_tech\",\"equipe\":[{\"user_id\":\"zt_tech\",\"nom\":\"TECH\",\"chef\":true,\"pct\":60,\"montant\":30000,\"paye\":false},{\"user_id\":\"zt_tech2\",\"nom\":\"TECH2\",\"chef\":false,\"pct\":40,\"montant\":20000,\"paye\":false}]}'"
essai "le responsable commercial répartit les frais (parts, montants)" "REFUSE" "$RESP" "$(MAJ clients_installes "$REPART" zch1)"
essai "le chef technicien s'attribue une part" "REFUSE" "$TECH" "$(MAJ clients_installes "$(SET equipe,0,montant 90000)" zch1)"
essai "l'admin répartit les frais" "PERMIS" "$CALEB" "$(MAJ clients_installes "$REPART" zch1)"
essai "un vendeur déplace une demande de prime vers SA boutique (prime_boutique)" "REFUSE" "$VENDEUR" "$(MAJ clients_installes "$(SET equipe,0,prime_boutique '"HEDZRANAWOE"')" zch2)"
essai "le responsable commercial retire de l'équipe un technicien qui a une PART" "REFUSE" "$RESP" "$(MAJ clients_installes "$(SET equipe '[]')" zch2)"
essai "le vendeur de la boutique désignée PAIE la prime demandée" "PERMIS" "$VENDEUR" "$(MAJ clients_installes "jsonb_set(data,'{equipe,0}', (data->'equipe'->0) || '{\"paye\":true,\"date_paiement\":\"2026-09-05\",\"dep_id\":\"zx1\",\"demande_prime\":false,\"validee_par\":\"KOSSI\"}')" zch2)"

echo
echo "── LES CHANTIERS : terminé = admin ou chef de CE chantier ; PV, réception forcée, avenant = admin ──"
TERMINE="data || '{\"statut\":\"termine\",\"termine_par\":\"TECH\",\"date_fin\":\"2026-09-05\",\"contrat_jeton\":\"j1\",\"contrat_numero\":\"PV-1\",\"contrat_statut\":\"attente_signature\"}'"
essai "le chef de CE chantier marque terminé (+ lien PV automatique)" "PERMIS" "$TECH" "$(MAJ clients_installes "$TERMINE" zch1)"
essai "un autre technicien de l'équipe marque terminé" "REFUSE" "$TECH2" "$(MAJ clients_installes "$TERMINE" zch1)"
essai "un vendeur marque terminé" "REFUSE" "$VENDEUR" "$(MAJ clients_installes "$TERMINE" zch1)"
essai "l'admin marque terminé" "PERMIS" "$CALEB" "$(MAJ clients_installes "$TERMINE" zch1)"
essai "un vendeur RENVOIE le lien de signature (chantier déjà terminé)" "REFUSE" "$VENDEUR" "$(MAJ clients_installes "data || '{\"contrat_jeton\":\"j2\",\"contrat_numero\":\"PV-2\",\"contrat_statut\":\"attente_signature\"}'" zch2)"
essai "un commercial FORCE la réception sans signature" "REFUSE" "$COM2" "$(MAJ clients_installes "data || '{\"statut\":\"receptionne\",\"contrat_force_par\":\"COM2\"}'" zch2)"
essai "l'admin force la réception sans signature" "PERMIS" "$CALEB" "$(MAJ clients_installes "data || '{\"statut\":\"receptionne\",\"contrat_force_par\":\"CALEB\"}'" zch2)"
essai "un technicien envoie un avenant" "REFUSE" "$TECH" "$(MAJ clients_installes "data || '{\"avenant_jeton\":\"a1\",\"avenant_statut\":\"attente_signature\"}'" zch2)"
essai "le client signe SON PV (règles client inchangées)" "PERMIS" "$CLIENT" "$(MAJ clients_installes "data || '{\"statut\":\"receptionne\",\"contrat_statut\":\"signe\",\"contrat_signature\":\"data:...\"}'" zch1)"

echo
echo "── LA CORBEILLE : mettre à la corbeille = admin ou son commercial ; restaurer = admin principal ──"
CORB="data || '{\"supprime_le\":\"2026-09-05T10:00:00Z\",\"supprime_par\":\"X\"}'"
essai "un vendeur met un chantier à la corbeille" "REFUSE" "$VENDEUR" "$(MAJ clients_installes "$CORB" zch1)"
essai "un commercial met le chantier d'un AUTRE à la corbeille" "REFUSE" "$COM2" "$(MAJ clients_installes "$CORB" zch1)"
essai "le client met SON chantier à la corbeille" "REFUSE" "$CLIENT" "$(MAJ clients_installes "$CORB" zch1)"
essai "le commercial rattaché met son chantier à la corbeille" "PERMIS" "$COM" "$(MAJ clients_installes "$CORB" zch1)"
essai "un admin secondaire met un chantier à la corbeille" "PERMIS" "$CALEB" "$(MAJ clients_installes "$CORB" zch1)"
$P -c "update public.clients_installes set data = data || '{\"supprime_le\":\"2026-09-01T10:00:00Z\",\"supprime_par\":\"COM\"}' where id='zch2';" >/dev/null
essai "un admin secondaire RESTAURE une fiche de la corbeille" "REFUSE" "$CALEB" "$(MAJ clients_installes "data - 'supprime_le' - 'supprime_par'" zch2)"
essai "le commercial rattaché restaure sa fiche" "REFUSE" "$COM2" "$(MAJ clients_installes "data - 'supprime_le' - 'supprime_par'" zch2)"
essai "l'admin principal restaure une fiche" "PERMIS" "$PRINCIPAL" "$(MAJ clients_installes "data - 'supprime_le' - 'supprime_par'" zch2)"
essai "l'admin principal efface pour de bon une fiche de la corbeille (purge)" "PERMIS" "$PRINCIPAL" "$(SUPPR clients_installes zch2)"
essai "une fiche à la corbeille réécrite à l'identique par un vendeur (synchronisation)" "PERMIS" "$VENDEUR" "$(MAJ clients_installes "data" zch2)"

echo
echo "── LES PROSPECTS : admin ou son commercial ; réassigner = admin / resp. com / chef avec le pouvoir ──"
essai "un commercial supprime le prospect d'un AUTRE" "REFUSE" "$COM2" "$(SUPPR prospects zpr1)"
essai "le commercial rattaché supprime son prospect" "PERMIS" "$COM" "$(SUPPR prospects zpr1)"
essai "un commercial archive le prospect d'un AUTRE" "REFUSE" "$COM2" "$(MAJ prospects "data || '{\"archive\":true,\"archive_motif\":\"Trop cher\"}'" zpr1)"
essai "le commercial rattaché archive son prospect" "PERMIS" "$COM" "$(MAJ prospects "data || '{\"archive\":true,\"archive_motif\":\"Trop cher\"}'" zpr1)"
essai "un commercial note un contact sur le prospect d'un AUTRE" "REFUSE" "$COM2" "$(MAJ prospects "$(SET contacts '[{"date":"2026-09-05","note":"x"}]')" zpr1)"
essai "le chef d'équipe (pouvoir en place) réassigne" "PERMIS" "$COM" "$(MAJ prospects "$(SET commercial '"COM2"')" zpr1)"
essai "le même chef, pouvoir « Réaffecter » RETIRÉ" "REFUSE" "$COM_SANS_REAFFECTER" "$(MAJ prospects "$(SET commercial '"COM2"')" zpr1)"
essai "un commercial qui n'est pas chef réassigne" "REFUSE" "$COM2" "$(MAJ prospects "$(SET commercial '"COM2"')" zpr1)"
essai "le responsable commercial réassigne" "PERMIS" "$RESP" "$(MAJ prospects "$(SET commercial '"COM2"')" zpr1)"
# 🤖 securite-32 (24/09/2026) : une demande de l'assistant se prend POUR SOI, une fois.
essai "un commercial PREND pour lui une demande de l'assistant (personne ne l'avait)" "PERMIS" "$COM2" "$(MAJ prospects "data || '{\"commercial\":\"COM2\",\"pris_le\":\"2026-09-24\"}'" zpr80)"
essai "un technicien prend pour lui une demande de l'assistant" "PERMIS" "$TECH" "$(MAJ prospects "data || '{\"commercial\":\"TECH\",\"pris_le\":\"2026-09-24\"}'" zpr80)"
essai "un commercial prend une demande de l'assistant POUR UN AUTRE" "REFUSE" "$COM2" "$(MAJ prospects "data || '{\"commercial\":\"COM\",\"pris_le\":\"2026-09-24\"}'" zpr80)"
essai "une demande DÉJÀ prise ne se reprend pas (la règle ordinaire joue)" "REFUSE" "$COM2" "$(MAJ prospects "data || '{\"commercial\":\"COM2\"}'" zpr81)"
essai "un prospect ordinaire ne se prend pas « pour soi » par ce chemin" "REFUSE" "$COM2" "$(MAJ prospects "data || '{\"commercial\":\"COM2\",\"pris_le\":\"2026-09-24\"}'" zpr1)"
essai "un vendeur marque le prospect converti à l'encaissement (le quotidien passe)" "PERMIS" "$VENDEUR" "$(MAJ prospects "data || '{\"converti\":true,\"statut\":\"Client acquis\"}'" zpr1)"
essai "un technicien crée un prospect" "PERMIS" "$TECH" "$(INS prospects zpr9 '{"id":"zpr9","nom":"Y","commercial":"TECH"}')"

echo
echo "── CATÉGORIES, GROUPES : admin seul ──"
essai "un vendeur crée une catégorie de prospects" "REFUSE" "$VENDEUR" "$(INS categories_prospects zcat9 '{"id":"zcat9","nom":"X"}')"
essai "l'admin crée une catégorie" "PERMIS" "$CALEB" "$(INS categories_prospects zcat9 '{"id":"zcat9","nom":"X"}')"
essai "un commercial crée un groupe de discussion" "REFUSE" "$COM" "$(INS groupes zg9 '{"id":"zg9","nom":"X","membres":[]}')"
essai "un technicien modifie les membres d'un groupe" "REFUSE" "$TECH" "$(MAJ groupes "$(SET membres '["zt_tech"]')" zg1)"
essai "l'admin supprime un groupe" "PERMIS" "$CALEB" "$(SUPPR groupes zg1)"

echo
echo "── BOUTIQUES : admin, sauf les demandes de ravitaillement et la caisse TERRAIN ; accueil et cachet = principal ──"
essai "un vendeur dépose une demande de ravitaillement" "PERMIS" "$VENDEUR" "$(MAJ boutiques "$(SET demandes '[{"id":"dm1","qte":5}]')" b1)"
essai "un vendeur change le taux de parrainage d'une boutique" "REFUSE" "$VENDEUR" "$(MAJ boutiques "$(SET taux_parrainage 50)" b1)"
essai "un gérant renomme une boutique" "REFUSE" "$GERANT" "$(MAJ boutiques "$(SET nom '"AUTRE"')" b1)"
essai "un admin secondaire change le taux de parrainage" "PERMIS" "$CALEB" "$(MAJ boutiques "$(SET taux_parrainage 50)" b1)"
essai "un admin secondaire personnalise l'écran de connexion" "REFUSE" "$CALEB" "$(MAJ boutiques "$(SET accueil_texte '"Bonne fête"')" b1)"
essai "l'admin principal personnalise l'écran de connexion" "PERMIS" "$PRINCIPAL" "$(MAJ boutiques "$(SET accueil_texte '"Bonne fête"')" b1)"
essai "un vendeur crée une boutique" "REFUSE" "$VENDEUR" "$(INS boutiques b9 '{"id":"b9","nom":"NOUVELLE"}')"
# ⚠ Capture Timo du 08/09/2026 (securite-8) : l'application écrit par UPSERT,
# et le contrôle de création refusait la demande de ravitaillement d'un vendeur.
essai "★ un vendeur dépose une demande de ravitaillement PAR UPSERT (comme l'application) — capture du 08/09" "PERMIS" "$VENDEUR" "$(UPS boutiques b1 '{"nom":"APESSITO","demandes":[{"id":"dm1","qte":20,"article":"Panneau 370W"}]}')"
essai "★ un gérant renomme sa boutique par upsert" "REFUSE" "$GERANT" "$(UPS boutiques b1 '{"nom":"AUTRE","demandes":[]}')"
essai "★ un vendeur crée une boutique par upsert (ligne vraiment nouvelle)" "REFUSE" "$VENDEUR" "$(UPS boutiques b8 '{"id":"b8","nom":"NOUVELLE"}')"
essai "★ un admin secondaire personnalise l'écran de connexion par upsert" "REFUSE" "$CALEB" "$(UPS boutiques b1 '{"nom":"APESSITO","accueil_texte":"Bonne fête"}')"
essai "★ l'admin principal, lui, le peut par upsert" "PERMIS" "$PRINCIPAL" "$(UPS boutiques b1 '{"nom":"APESSITO","accueil_texte":"Bonne fête"}')"
essai "un client crée la caisse TERRAIN (devis « pose seule »)" "PERMIS" "$CLIENT" "$(INS boutiques b_terrain '{"id":"b_terrain","nom":"TERRAIN","terrain":true,"actif":true}')"
essai "un gérant supprime une boutique" "REFUSE" "$GERANT" "$(SUPPR boutiques b2)"
essai "l'admin supprime une boutique" "PERMIS" "$CALEB" "$(SUPPR boutiques b2)"

echo
echo "── 🧰 LE REGISTRE DE L'OUTILLAGE (securite-22) : chef technicien, magasinier, admin ──"
# Le registre vit dans le champ `outillage` de la boutique : aucune table à
# créer, mais sans securite-22 SEUL l'administrateur pouvait l'écrire.
# ⚠ PIÈGE MESURÉ : `jsonb_set(data,'{outillage,outils}',…)` ne crée PAS le
# chemin quand `outillage` n'existe pas encore — la ligne repartait
# IDENTIQUE, le déclencheur ne voyait rien, et les huit contrôles passaient
# sans rien mesurer. On CONCATÈNE, ce qui ajoute vraiment le champ.
REG='{"outillage":{"outils":[{"id":"o1","nom":"Perceuse","numero":"BMI-012","mouvements":[]}],"appels":[]}}'
POSER="data || '$REG'::jsonb"
essai "★ le MAGASINIER enregistre une sortie d'outil" "PERMIS" "$MAGASINIER" "$(MAJ boutiques "$POSER" b1)"
essai "★ le CHEF TECHNICIEN (technicien BMI ⭐) enregistre une sortie d'outil" "PERMIS" "$CHEF_BMI" "$(MAJ boutiques "$POSER" b1)"
essai "★ l'administrateur tient le registre" "PERMIS" "$CALEB" "$(MAJ boutiques "$POSER" b1)"
essai "★ un technicien ORDINAIRE (sans l'étoile) touche au registre" "REFUSE" "$TECH" "$(MAJ boutiques "$POSER" b1)"
essai "★ un chef d'équipe COMMERCIAL touche au registre (ce n'est pas son métier)" "REFUSE" "$COM" "$(MAJ boutiques "$POSER" b1)"
essai "★ un vendeur touche au registre" "REFUSE" "$VENDEUR" "$(MAJ boutiques "$POSER" b1)"
essai "★ un gérant touche au registre (Timo n'a pas nommé le gérant)" "REFUSE" "$GERANT" "$(MAJ boutiques "$POSER" b1)"
essai "★ un chef technicien à qui l'admin a RETIRÉ l'onglet 🧰 Outillage" "REFUSE" "$CHEF_BMI_SANS_OUTILLAGE" "$(MAJ boutiques "$POSER" b1)"
essai "★ le magasinier tient le registre PAR UPSERT (comme l'application écrit)" "PERMIS" "$MAGASINIER" "$(UPS boutiques b1 '{"nom":"APESSITO","outillage":{"outils":[{"id":"o1","nom":"Perceuse"}],"appels":[]}}')"
essai "★ le magasinier en PROFITE pour renommer la boutique : refusé" "REFUSE" "$MAGASINIER" "$(UPS boutiques b1 '{"nom":"AUTRE","outillage":{"outils":[],"appels":[]}}')"
essai "★ le chef technicien ne touche toujours pas au taux de parrainage" "REFUSE" "$CHEF_BMI" "$(MAJ boutiques "$(SET taux_parrainage 50)" b1)"
essai "★ la demande de ravitaillement du vendeur passe TOUJOURS (securite-8 intact)" "PERMIS" "$VENDEUR" "$(UPS boutiques b1 '{"nom":"APESSITO","demandes":[{"id":"dm1","qte":20}]}')"

echo
echo "── ⏱ LE RETARD SE JUSTIFIE, PAR CELUI QUI DÉTIENT L'OUTIL (securite-23) ──"
# Le technicien n'a pas le droit de tenir le registre : on lui ouvre EXACTEMENT
# une porte — ajouter une justification — et pas une de plus. Le registre, une
# fois les justifications retirées, doit rester IDENTIQUE.
POSE_OUTIL="data || '{\"outillage\":{\"outils\":[{\"id\":\"o1\",\"nom\":\"Perceuse\",\"mouvements\":[{\"id\":\"s1\",\"type\":\"sortie\",\"user_id\":\"zt_tech\",\"retour_prevu\":\"2026-09-16\"}]}],\"appels\":[]}}'::jsonb"
JUSTIF="data || '{\"outillage\":{\"outils\":[{\"id\":\"o1\",\"nom\":\"Perceuse\",\"mouvements\":[{\"id\":\"s1\",\"type\":\"sortie\",\"user_id\":\"zt_tech\",\"retour_prevu\":\"2026-09-16\"}],\"justifications\":[{\"id\":\"j1\",\"texte\":\"Le chantier a pris du retard\"}]}],\"appels\":[]}}'::jsonb"
RENDU="data || '{\"outillage\":{\"outils\":[{\"id\":\"o1\",\"nom\":\"Perceuse\",\"mouvements\":[{\"id\":\"s1\",\"type\":\"sortie\",\"user_id\":\"zt_tech\",\"retour_prevu\":\"2026-09-16\"},{\"id\":\"r1\",\"type\":\"retour\"}]}],\"appels\":[]}}'::jsonb"
$P -c "update public.boutiques set data = $POSE_OUTIL where id='b1';" >/dev/null
essai "★ le TECHNICIEN qui détient l'outil justifie son retard" "PERMIS" "$TECH" "$(MAJ boutiques "$JUSTIF" b1)"
essai "★ le même technicien en PROFITE pour rendre l'outil : refusé (ce n'est pas son geste)" "REFUSE" "$TECH" "$(MAJ boutiques "$RENDU" b1)"
essai "★ un VENDEUR ne justifie rien (ce n'est pas un technicien)" "REFUSE" "$VENDEUR" "$(MAJ boutiques "$JUSTIF" b1)"
essai "★ le chef technicien, lui, peut tout : justifier comme rendre" "PERMIS" "$CHEF_BMI" "$(MAJ boutiques "$RENDU" b1)"
$P -c "update public.boutiques set data = data - 'outillage' where id='b1';" >/dev/null

echo
echo "── 💵 LA RETENUE POUR UN OUTIL PERDU (securite-24) ──"
# La retenue sur COMMISSION se prend quand on paie la part d'installation du
# technicien — et ce paiement peut être fait par le VENDEUR de la boutique ou
# par le GÉRANT, qui ne tiennent pas le registre. Sans cette porte, leur geste
# serait refusé et TOUT LE LOT resterait coincé dans la file d'attente.
PERTE='{"outillage":{"outils":[{"id":"o1","nom":"Perceuse","mouvements":[{"id":"p1","type":"perdu","user_id":"zt_tech","valeur":80000,"a_rembourser":30000,"retenues":[]}]}],"appels":[]}}'
RETENU='{"outillage":{"outils":[{"id":"o1","nom":"Perceuse","mouvements":[{"id":"p1","type":"perdu","user_id":"zt_tech","valeur":80000,"a_rembourser":30000,"retenues":[{"id":"r1","montant":10000,"sur":"commission"}]}]}],"appels":[]}}'
MOINS_DU='{"outillage":{"outils":[{"id":"o1","nom":"Perceuse","mouvements":[{"id":"p1","type":"perdu","user_id":"zt_tech","valeur":80000,"a_rembourser":0,"retenues":[]}]}],"appels":[]}}'
SORTI_APRES='{"outillage":{"outils":[{"id":"o1","nom":"Perceuse","mouvements":[{"id":"p1","type":"perdu","user_id":"zt_tech","valeur":80000,"a_rembourser":30000,"retenues":[{"id":"r1","montant":10000,"sur":"commission"}]},{"id":"s9","type":"sortie","user_id":"zt_tech"}]}],"appels":[]}}'
$P -c "update public.boutiques set data = data || '$PERTE'::jsonb where id='b1';" >/dev/null
essai "★ le VENDEUR qui paie la part inscrit la retenue (sinon tout le lot reste coincé)" "PERMIS" "$VENDEUR" "$(MAJ boutiques "data || '$RETENU'::jsonb" b1)"
essai "★ le GÉRANT aussi (il paie une part depuis 🏠 Clients installés)" "PERMIS" "$GERANT" "$(MAJ boutiques "data || '$RETENU'::jsonb" b1)"
essai "★ le vendeur en PROFITE pour effacer ce qui est dû : refusé" "REFUSE" "$VENDEUR" "$(MAJ boutiques "data || '$MOINS_DU'::jsonb" b1)"
essai "★ le vendeur en PROFITE pour sortir l'outil : refusé (ce n'est pas son geste)" "REFUSE" "$VENDEUR" "$(MAJ boutiques "data || '$SORTI_APRES'::jsonb" b1)"
essai "★ un technicien ORDINAIRE n'inscrit aucune retenue (il se solderait lui-même)" "REFUSE" "$TECH" "$(MAJ boutiques "data || '$RETENU'::jsonb" b1)"
essai "★ le magasinier, lui, peut tout : c'est son registre" "PERMIS" "$MAGASINIER" "$(MAJ boutiques "data || '$SORTI_APRES'::jsonb" b1)"
essai "★ le vendeur ne renomme toujours pas la boutique en glissant une retenue" "REFUSE" "$VENDEUR" "$(UPS boutiques b1 '{"nom":"AUTRE","outillage":{"outils":[],"appels":[]}}')"
$P -c "update public.boutiques set data = data - 'outillage' where id='b1';" >/dev/null

echo
echo "── 🏗 LE CHANTIER D'UN OUTIL SE CHANGE SANS LE RAMENER (securite-25) ──"
# Le détenteur n'a pas le droit de tenir le registre : on élargit sa porte
# d'UN cran — il dit sur quel chantier il part, et rien d'autre.
SORTI='{"outillage":{"outils":[{"id":"o1","nom":"Perceuse","mouvements":[{"id":"s1","type":"sortie","user_id":"zt_tech","chantier":"MR ERIC","retour_prevu":"2026-09-20"}]}],"appels":[]}}'
CHANTIER='{"outillage":{"outils":[{"id":"o1","nom":"Perceuse","mouvements":[{"id":"s1","type":"sortie","user_id":"zt_tech","chantier":"MR ERIC","retour_prevu":"2026-09-20"},{"id":"c1","type":"chantier","chantier":"MME AFI"}]}],"appels":[]}}'
RENTRE='{"outillage":{"outils":[{"id":"o1","nom":"Perceuse","mouvements":[{"id":"s1","type":"sortie","user_id":"zt_tech","chantier":"MR ERIC","retour_prevu":"2026-09-20"},{"id":"r9","type":"retour"}]}],"appels":[]}}'
TRICHE='{"outillage":{"outils":[{"id":"o1","nom":"Perceuse","mouvements":[{"id":"s1","type":"sortie","user_id":"zt_tech","chantier":"MR ERIC","retour_prevu":"2026-12-31"},{"id":"c1","type":"chantier","chantier":"MME AFI"}]}],"appels":[]}}'
$P -c "update public.boutiques set data = data || '$SORTI'::jsonb where id='b1';" >/dev/null
essai "★ le TECHNICIEN qui détient l'outil change son chantier (sinon tout le lot reste coincé)" "PERMIS" "$TECH" "$(MAJ boutiques "data || '$CHANTIER'::jsonb" b1)"
essai "★ il en PROFITE pour rendre l'outil : refusé (ce n'est pas son geste)" "REFUSE" "$TECH" "$(MAJ boutiques "data || '$RENTRE'::jsonb" b1)"
essai "★ il en PROFITE pour repousser sa date de retour : refusé" "REFUSE" "$TECH" "$(MAJ boutiques "data || '$TRICHE'::jsonb" b1)"
essai "★ un VENDEUR ne change aucun chantier (ce n'est pas un technicien)" "REFUSE" "$VENDEUR" "$(MAJ boutiques "data || '$CHANTIER'::jsonb" b1)"
essai "★ le chef technicien, lui, peut tout : changer le chantier comme rendre" "PERMIS" "$CHEF_BMI" "$(MAJ boutiques "data || '$RENTRE'::jsonb" b1)"
JUSTIF25='{"outillage":{"outils":[{"id":"o1","nom":"Perceuse","mouvements":[{"id":"s1","type":"sortie","user_id":"zt_tech","chantier":"MR ERIC","retour_prevu":"2026-09-20"}],"justifications":[{"id":"j1","texte":"bloque"}]}],"appels":[]}}'
essai "★ la justification de securite-23 passe TOUJOURS (elle n'a pas été perdue en route)" "PERMIS" "$TECH" "$(MAJ boutiques "data || '$JUSTIF25'::jsonb" b1)"
$P -c "update public.boutiques set data = data - 'outillage' where id='b1';" >/dev/null

echo
echo "── 🧰 LE COMPTAGE D'UNE BOÎTE À OUTILS (securite-26) ──"
# Décision 2b de Timo : celui qui REND compte ce qu'il ramène. Sa porte
# s'élargit d'UN cran — il dit ce qu'il y a dans la boîte, et rien d'autre.
BOITE='{"outillage":{"outils":[{"id":"o2","nom":"Boite 2","contenu":[{"id":"L1","nom":"Tournevis","quantite":3,"valeur":2000}],"mouvements":[{"id":"s2","type":"sortie","user_id":"zt_tech","chantier":"MR ERIC","retour_prevu":"2026-09-20"}]}],"appels":[]}}'
COMPTE='{"outillage":{"outils":[{"id":"o2","nom":"Boite 2","contenu":[{"id":"L1","nom":"Tournevis","quantite":3,"valeur":2000}],"mouvements":[{"id":"s2","type":"sortie","user_id":"zt_tech","chantier":"MR ERIC","retour_prevu":"2026-09-20"},{"id":"k1","type":"comptage","compte":{"L1":2}}]}],"appels":[]}}'
RENTRE2='{"outillage":{"outils":[{"id":"o2","nom":"Boite 2","contenu":[{"id":"L1","nom":"Tournevis","quantite":3,"valeur":2000}],"mouvements":[{"id":"s2","type":"sortie","user_id":"zt_tech","chantier":"MR ERIC","retour_prevu":"2026-09-20"},{"id":"k1","type":"comptage","compte":{"L1":2}},{"id":"r2","type":"retour"}]}],"appels":[]}}'
LISTE2='{"outillage":{"outils":[{"id":"o2","nom":"Boite 2","contenu":[{"id":"L1","nom":"Tournevis","quantite":1,"valeur":2000}],"mouvements":[{"id":"s2","type":"sortie","user_id":"zt_tech","chantier":"MR ERIC","retour_prevu":"2026-09-20"},{"id":"k1","type":"comptage","compte":{"L1":2}}]}],"appels":[]}}'
$P -c "update public.boutiques set data = data || '$BOITE'::jsonb where id='b1';" >/dev/null
essai "★ le TECHNICIEN qui détient la boîte COMPTE ce qu'il ramène (sinon tout le lot reste coincé)" "PERMIS" "$TECH" "$(MAJ boutiques "data || '$COMPTE'::jsonb" b1)"
essai "★ il en PROFITE pour enregistrer le retour : refusé (le retour reste le geste de son chef)" "REFUSE" "$TECH" "$(MAJ boutiques "data || '$RENTRE2'::jsonb" b1)"
essai "★ il en PROFITE pour baisser ce que la boîte DOIT contenir : refusé" "REFUSE" "$TECH" "$(MAJ boutiques "data || '$LISTE2'::jsonb" b1)"
essai "★ un VENDEUR ne compte aucune boîte (ce n'est pas un technicien)" "REFUSE" "$VENDEUR" "$(MAJ boutiques "data || '$COMPTE'::jsonb" b1)"
essai "★ le chef technicien, lui, compte ET enregistre le retour" "PERMIS" "$CHEF_BMI" "$(MAJ boutiques "data || '$RENTRE2'::jsonb" b1)"
$P -c "update public.boutiques set data = data - 'outillage' where id='b1';" >/dev/null

echo
if [ $ko -eq 0 ]; then echo "✅  $ok vérification(s) passée(s), 0 en échec."; exit 0
else echo "❌  $ok passée(s), $ko en échec."; exit 1; fi
