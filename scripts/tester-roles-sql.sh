#!/usr/bin/env bash
# ============================================================
# Rejoue supabase/roles-1-vague1.sql sur un PostgreSQL local jetable, dans
# un environnement qui reproduit celui de Supabase (mêmes tables, mêmes
# rôles, même auth.jwt(), mêmes politiques permissives de départ).
#
#   bash scripts/tester-roles-sql.sh
#
# N'a AUCUN contact avec la base Supabase de BMI. Sert à vérifier le script
# AVANT de l'exécuter en production, et à le revérifier après toute
# modification. Le retour en arrière est extrait du fichier lui-même : on
# teste exactement ce qui sera copié-collé.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable (apt-get install postgresql)"; exit 1; }
export PATH="$PATH:$BIN"

D=$(mktemp -d /tmp/bmi-roles-XXXXXX); PORT=55434
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
echo "▸ Application de roles-1-vague1.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/roles-1-vague1.sql >/dev/null 2>&1

ok=0; ko=0
# essai <description> <PASSE|REFUSE> <revendications json> <requete sql>
essai() {
  local desc="$1" attendu="$2" claims="$3" sql="$4" res
  if res=$($P -c "set role authenticated; select set_config('request.jwt.claims', '$claims', true); $sql" 2>&1); then
    reel="PASSE"
  else
    reel="REFUSE"
  fi
  if [ "$reel" = "$attendu" ]; then echo "  ✓ $desc"; ok=$((ok+1));
  else echo "  ✗ $desc  (attendu $attendu, obtenu $reel)"; echo "$res" | tail -2 | sed 's/^/      /'; ko=$((ko+1)); fi
}

C_CLIENT='{"role":"authenticated","app_metadata":{"role":"client","ecriture":true,"espace":"reel"}}'
C_VENDEUR='{"role":"authenticated","app_metadata":{"role":"vendeur","ecriture":true,"espace":"reel"}}'
C_COMPTABLE='{"role":"authenticated","app_metadata":{"role":"comptable","ecriture":false,"espace":"reel"}}'
C_ADMIN='{"role":"authenticated","app_metadata":{"role":"admin","ecriture":true,"espace":"tous"}}'
C_ANCIEN='{"role":"authenticated","app_metadata":{"espace":"reel"}}'

echo
echo "1. UN CLIENT NE TOUCHE PAS AUX TABLES QUI NE LE REGARDENT PAS"
essai "un client ne peut PAS créer une dépense"          REFUSE "$C_CLIENT"   "insert into public.depenses(id,data) values('d1','{}'::jsonb);"
essai "…ni un mouvement de stock"                        REFUSE "$C_CLIENT"   "insert into public.ajustements(id,data) values('a1','{}'::jsonb);"
essai "…ni une clôture de caisse"                        REFUSE "$C_CLIENT"   "insert into public.clotures(id,data) values('c1','{}'::jsonb);"
essai "…et il ne peut même pas LIRE les dépenses"        REFUSE "$C_CLIENT"   "select 1/count(*) from public.depenses;"
essai "un vendeur, lui, crée une dépense normalement"    PASSE  "$C_VENDEUR"  "insert into public.depenses(id,data) values('d2','{}'::jsonb);"

echo
echo "2. CE DONT LE CLIENT A VRAIMENT BESOIN RESTE OUVERT"
essai "il valide un devis : la commande passe"           PASSE  "$C_CLIENT"   "insert into public.commandes(id,data) values('k1','{}'::jsonb);"
essai "…la dette aussi"                                  PASSE  "$C_CLIENT"   "insert into public.dettes(id,data) values('t_essai','{}'::jsonb);"
essai "il signe son PV : le chantier est modifiable"     PASSE  "$C_CLIENT"   "insert into public.clients_installes(id,data) values('ch1','{}'::jsonb);"
essai "la commission se débloque : la vente est écrite"  PASSE  "$C_CLIENT"   "insert into public.ventes(id,data) values('v_essai','{}'::jsonb);"
essai "il écrit dans la messagerie"                      PASSE  "$C_CLIENT"   "insert into public.messages(id,data) values('m1','{}'::jsonb);"

echo
echo "3. LES COMPTES EN LECTURE SEULE LE SONT VRAIMENT"
essai "le comptable ne peut PAS créer une vente"         REFUSE "$C_COMPTABLE" "insert into public.ventes(id,data) values('v_essai2','{}'::jsonb);"
essai "…ni en modifier une"                              REFUSE "$C_COMPTABLE" "update public.ventes set data='{\"x\":1}'::jsonb where id='v_essai';"
r=$($P -c "set role authenticated; select set_config('request.jwt.claims', '$C_COMPTABLE', true); delete from public.ventes where id='v_essai'; select count(*) from public.ventes where id='v_essai';" 2>&1 | tail -1)
if [ "$r" = "1" ]; then echo "  ✓ …ni en supprimer (la ligne reste bien sur le serveur)"; ok=$((ok+1));
else echo "  ✗ le comptable a pu supprimer une vente"; ko=$((ko+1)); fi
essai "mais il LIT tout, c'est son métier"               PASSE  "$C_COMPTABLE" "select count(*) from public.ventes;"
essai "un jeton d'AVANT le déploiement peut écrire (filet)" PASSE "$C_ANCIEN"  "insert into public.ventes(id,data) values('v_essai3','{}'::jsonb);"

echo
echo "4. PLUS AUCUNE ESCALADE DE PRIVILEGE"
psql -h /tmp -p $PORT -U postgres -d bmi -q -c "insert into public.users(id,data) values('u_cli','{\"nom\":\"CLIENT\",\"role\":\"client\"}'::jsonb);" >/dev/null
essai "un client ne peut PAS se nommer administrateur"   REFUSE "$C_CLIENT"   "update public.users set data=data||'{\"role\":\"admin\"}'::jsonb where id='u_cli';"
essai "…ni se déclarer administrateur principal"         REFUSE "$C_CLIENT"   "update public.users set data=data||'{\"admin_principal\":true}'::jsonb where id='u_cli';"
essai "…ni s'ajouter des pouvoirs"                       REFUSE "$C_CLIENT"   "update public.users set data=data||'{\"droits_off\":[\"act_ecriture\"]}'::jsonb where id='u_cli';"
essai "…ni changer d'espace pour voir le réel"           REFUSE "$C_CLIENT"   "update public.users set data=data||'{\"formation\":true}'::jsonb where id='u_cli';"
essai "…ni créer un compte administrateur de toutes pièces" REFUSE "$C_CLIENT" "insert into public.users(id,data) values('u_x','{\"role\":\"admin\"}'::jsonb);"
essai "mais il modifie SA fiche normalement (mot de passe, devis)" PASSE "$C_CLIENT" "update public.users set data=data||'{\"pwd_hash2\":\"abc\"}'::jsonb where id='u_cli';"
essai "un client peut encore créer un compte CLIENT (parrainage)" PASSE "$C_CLIENT" "insert into public.users(id,data) values('u_f','{\"role\":\"client\"}'::jsonb);"
essai "l'ADMINISTRATEUR, lui, change bien les rôles"     PASSE  "$C_ADMIN"    "update public.users set data=data||'{\"role\":\"vendeur\"}'::jsonb where id='u_cli';"

echo
echo "4bis. L'APPLICATION ECRIT PAR UPSERT — le banc d'essai aussi, desormais"
# ⚠ Defaut reel trouve par Timo (compte ANGELF) : le declencheur refusait
# l'upsert d'un employe sur SA PROPRE fiche, parce que le controle de
# creation se declenchait meme quand la ligne existait deja. Mon banc
# d'essai testait des UPDATE simples : il ne pouvait pas le voir. Chaque
# role passe desormais par le MEME geste que l'application.
upsert_soi() {
  local desc="$1" attendu="$2" role="$3" extra="${4:-}"
  local id="u_$role"
  psql -h /tmp -p $PORT -U postgres -d bmi -q -c "insert into public.users(id,data) values('$id','{\"nom\":\"T\",\"role\":\"$role\"$extra}'::jsonb) on conflict (id) do nothing;" >/dev/null 2>&1
  local claims="{\"role\":\"authenticated\",\"email\":\"$id@bmi.internal\",\"app_metadata\":{\"role\":\"$role\",\"ecriture\":true,\"espace\":\"reel\"}}"
  essai "$desc" "$attendu" "$claims" "insert into public.users(id,data) values('$id','{\"nom\":\"T\",\"role\":\"$role\"$extra,\"signature_personnelle\":\"sig\"}'::jsonb) on conflict (id) do update set data = excluded.data;"
}
upsert_soi "un VENDEUR enregistre sa signature (le cas ANGELF)"        PASSE vendeur ""
upsert_soi "un COMMERCIAL aussi"                                      PASSE commercial ""
upsert_soi "un TECHNICIEN aussi"                                      PASSE technicien ""
upsert_soi "un TECHNICIEN BMI aussi"                                  PASSE technicien_bmi ""
upsert_soi "un GERANT aussi"                                          PASSE gerant ""
upsert_soi "un MAGASINIER aussi"                                      PASSE magasinier ""
upsert_soi "un RESPONSABLE COMMERCIAL aussi"                          PASSE resp_commercial ""
upsert_soi "un vendeur de FORMATION aussi (le compte exact de la capture)" PASSE vendeur2 ",\"formation\":true"
C_CLI_UP='{"role":"authenticated","email":"u_cli@bmi.internal","app_metadata":{"role":"client","ecriture":true,"espace":"reel"}}'
essai "un CLIENT met a jour sa fiche par upsert"                      PASSE "$C_CLI_UP" "insert into public.users(id,data) values('u_cli','{\"nom\":\"CLIENT\",\"role\":\"vendeur\",\"pwd_hash2\":\"n\"}'::jsonb) on conflict (id) do update set data = excluded.data;"
echo "   — et l'escalade par UPSERT reste bien fermee :"
essai "se nommer admin PAR UPSERT est toujours refuse"                REFUSE "$C_CLI_UP" "insert into public.users(id,data) values('u_cli','{\"nom\":\"CLIENT\",\"role\":\"admin\"}'::jsonb) on conflict (id) do update set data = excluded.data;"
essai "creer un compte admin de toutes pieces PAR UPSERT aussi"       REFUSE "$C_CLI_UP" "insert into public.users(id,data) values('u_neuf','{\"role\":\"admin\"}'::jsonb) on conflict (id) do update set data = excluded.data;"

echo
echo "5. LA CLE DE SERVICE RESTE MAITRESSE (voie de secours)"
r=$(psql -h /tmp -p $PORT -U postgres -d bmi -tA -c "update public.users set data=data||'{\"role\":\"admin\"}'::jsonb where id='u_cli'; select data->>'role' from public.users where id='u_cli';" 2>&1 | tail -1) || true
if [ "$r" = "admin" ]; then echo "  ✓ l'éditeur SQL peut toujours changer un rôle"; ok=$((ok+1));
else echo "  ✗ l'éditeur SQL est bloqué — ce serait une impasse"; echo "      $r"; ko=$((ko+1)); fi
r=$(psql -h /tmp -p $PORT -U postgres -d bmi -tA -c "drop trigger if exists interdire_escalade on public.users; select 'retire';" 2>&1 | tail -1) || true
if [ "$r" = "retire" ]; then echo "  ✓ …et retirer le déclencheur lui-même en cas de besoin"; ok=$((ok+1));
else echo "  ✗ impossible de retirer le déclencheur"; ko=$((ko+1)); fi
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/roles-1-vague1.sql >/dev/null 2>&1

echo
echo "6. VAGUE 2 — LE PARCOURS REEL D UN CLIENT, DE BOUT EN BOUT"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/roles-2-vague2.sql >/dev/null 2>&1
# Le jeton d un vrai client : son adresse porte son identifiant BMI.
C_CLI2='{"role":"authenticated","email":"u_cli@bmi.internal","app_metadata":{"role":"client","ecriture":true,"espace":"reel"}}'
psql -h /tmp -p $PORT -U postgres -d bmi -q -c "insert into public.clients_installes(id,data) values('ch_moi','{\"user_id\":\"u_cli\",\"nom\":\"MOI\"}'::jsonb), ('ch_autre','{\"user_id\":\"u_zzz\",\"nom\":\"UN AUTRE\"}'::jsonb);" >/dev/null 2>&1

essai "il valide son devis : la commande part"          PASSE  "$C_CLI2" "insert into public.commandes(id,data) values('k2','{}'::jsonb);"
essai "…et la dette aussi"                              PASSE  "$C_CLI2" "insert into public.dettes(id,data) values('t2','{}'::jsonb);"
essai "il signe le PV de SON chantier"                  PASSE  "$C_CLI2" "update public.clients_installes set data=data||'{\"contrat_statut\":\"signe\"}'::jsonb where id='ch_moi';"
essai "il ne peut PAS toucher au chantier d'un autre"   REFUSE "$C_CLI2" "update public.clients_installes set data=data||'{\"contrat_statut\":\"signe\"}'::jsonb where id='ch_autre';"
essai "il LIT quand même le chantier de son filleul"    PASSE  "$C_CLI2" "select count(*) from public.clients_installes where id='ch_autre';"
essai "il note le commercial (écrit dans SA fiche)"     PASSE  "$C_CLI2" "update public.users set data=data||'{\"evaluations\":[]}'::jsonb where id='u_cli';"
essai "il parraine : un compte client est créé"         PASSE  "$C_CLI2" "insert into public.users(id,data) values('u_fill','{\"role\":\"client\"}'::jsonb);"
essai "il écrit dans la messagerie"                     PASSE  "$C_CLI2" "insert into public.messages(id,data) values('m2','{}'::jsonb);"
essai "il change son mot de passe"                      PASSE  "$C_CLI2" "update public.users set data=data||'{\"pwd_hash2\":\"zz\"}'::jsonb where id='u_cli';"

echo "   — et ce qu'il ne doit plus pouvoir faire :"
# ⚠ Une suppression refusée par une politique est SILENCIEUSE : PostgreSQL
# ne trouve simplement aucune ligne à supprimer, sans lever d'erreur. Le sens
# est le bon — on CONSERVE au lieu de perdre. On vérifie donc que la ligne
# est TOUJOURS LÀ après la tentative, pas qu'une erreur a été levée.
survit() {
  local desc="$1" claims="$2" table="$3" id="$4" r
  r=$($P -c "set role authenticated; select set_config('request.jwt.claims', '$claims', true); delete from public.$table where id='$id'; select count(*) from public.$table where id='$id';" 2>&1 | tail -1)
  if [ "$r" = "1" ]; then echo "  ✓ $desc"; ok=$((ok+1));
  else echo "  ✗ $desc (la ligne a été supprimée)"; ko=$((ko+1)); fi
}
survit "il ne supprime plus une vente"      "$C_CLI2" ventes            v_essai
survit "…ni un message"                     "$C_CLI2" messages          m2
survit "…ni un compte utilisateur"          "$C_CLI2" users             u_fill
survit "…ni son propre chantier"            "$C_CLI2" clients_installes ch_moi
essai "un VENDEUR, lui, supprime toujours normalement"  PASSE  "$C_VENDEUR" "delete from public.depenses where id='d2'; select count(*) from public.depenses;"

echo
echo "7. RETOUR EN ARRIERE (extrait du fichier lui-même)"
python3 - "$D" <<'PY'
import io, sys
sql = []
for f in ['supabase/roles-1-vague1.sql', 'supabase/roles-2-vague2.sql']:
    s = io.open(f, encoding='utf-8').read()
    bloc = s.split("POUR TOUT ANNULER EN 5 SECONDES")[1].split("À exécuter dans Supabase")[0]
    lignes = [l[3:] if l.startswith('--   ') else l[2:] for l in bloc.splitlines() if l.strip().startswith('--')]
    sql.append("\n".join(l for l in lignes if l.strip() and not l.strip().startswith('copiez')))
io.open(sys.argv[1] + '/annuler.sql', 'w', encoding='utf-8').write("\n".join(sql))
PY
psql -h /tmp -p $PORT -U postgres -d bmi -q -f "$D/annuler.sql" >/dev/null 2>&1 && echo "  ✓ le bloc d'annulation s'exécute sans erreur" && ok=$((ok+1)) || { echo "  ✗ le bloc d'annulation échoue"; ko=$((ko+1)); }
essai "après annulation, le client peut de nouveau tout faire" PASSE "$C_CLIENT" "insert into public.depenses(id,data) values('d9','{}'::jsonb);"
r=$($P -c "select count(*) from pg_policies where policyname like 'role_%';")
if [ "$r" = "0" ]; then echo "  ✓ plus aucune politique de rôle ne subsiste"; ok=$((ok+1));
else echo "  ✗ il reste $r politique(s) de rôle"; ko=$((ko+1)); fi
r=$($P -c "select count(*) from pg_policies where policyname like 'acces_authentifie%';")
if [ "$r" -ge 18 ]; then echo "  ✓ vos politiques d'origine sont intactes ($r)"; ok=$((ok+1));
else echo "  ✗ politiques d'origine abîmées ($r)"; ko=$((ko+1)); fi

echo
if [ "$ko" -eq 0 ]; then echo "✅  $ok vérification(s) passée(s), 0 en échec."; else echo "❌  $ok passée(s), $ko en échec."; exit 1; fi
