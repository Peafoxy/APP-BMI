#!/usr/bin/env bash
# ============================================================
# LES GESTES DE L'ESPACE CLIENT PASSENT-ILS LE SERVEUR ? — mesuré sur un
# PostgreSQL jetable, politiques réelles rejouées, via appliquer_lot
# (le VRAI chemin de la synchronisation groupée).
#
#   npm run tester-espace-client
#
# N'a AUCUN contact avec la base Supabase de BMI.
#
# ⚠ POURQUOI CE BANC EXISTE (31/08/2026, compte ESSO). La première vraie
# validation de devis d'un client a été refusée par le serveur — en
# silence. Le banc d'écriture testait chaque table isolément ; personne
# n'avait jamais rejoué les GESTES COMPLETS de l'espace client (une
# validation écrit 3 lignes qui partent ensemble : une seule refusée, et
# tout reste coincé). Ce banc rejoue chaque geste tel que l'application
# l'envoie, et vérifie aussi le rattrapage client-5 des fiches prospect.
# ============================================================
set -uo pipefail
cd "$(dirname "$0")/.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable"; exit 1; }
export PATH="$PATH:$BIN"
D=$(mktemp -d /tmp/bmi-esp-XXXXXX); PORT=55496
nettoyer() { su postgres -c "$BIN/pg_ctl -D $D stop -m immediate" >/dev/null 2>&1 || true; rm -rf "$D"; }
trap nettoyer EXIT
chown postgres:postgres "$D"
su postgres -c "$BIN/initdb -D $D -U postgres -A trust" >/dev/null
su postgres -c "$BIN/pg_ctl -D $D -o '-p $PORT -k /tmp' -l $D/log start" >/dev/null
sleep 2
psql -h /tmp -p $PORT -U postgres -q -c "create database bmi;" >/dev/null
Q="psql -h /tmp -p $PORT -U postgres -d bmi"

echo "▸ Environnement Supabase simulé + TOUTES les politiques réelles"
$Q -q -f supabase/test/fixture.sql
$Q -q -c "create table if not exists public.tombstones (id text primary key, table_name text, record_id text, deleted_at timestamptz);
grant all on public.tombstones to authenticated, service_role;" >/dev/null
for f in supabase/tombstones-automatiques.sql supabase/espace-1-colonne.sql supabase/espace-3-politiques.sql supabase/espace-3-VAGUE-2.sql supabase/espace-4-admin-voit-tout.sql supabase/espace-5-fournisseurs-commerciaux.sql supabase/espace-6-correctif-tous.sql supabase/lot-1-ecriture-groupee.sql supabase/roles-1-vague1.sql supabase/roles-1b-correctif-upsert.sql supabase/roles-2-vague2.sql supabase/client-1-fermer-annuaire.sql supabase/paie-1-table.sql supabase/securite-2-role-inviolable.sql supabase/client-2-fermer-ecriture.sql supabase/client-4-fermer-lecture.sql supabase/securite-1-audits-et-tombstones.sql supabase/securite-4-argent.sql supabase/securite-5-comptes.sql supabase/securite-6-devis-chantiers.sql; do
  $Q -q -v ON_ERROR_STOP=0 -f "$f" >/dev/null 2>&1 || echo "   (⚠ $f partiellement rejoué)"
done

$Q -q -v ON_ERROR_STOP=1 -c "
delete from public.dettes; delete from public.ventes; delete from public.clients_installes;
delete from public.users; delete from public.prospects; delete from public.commandes; delete from public.boutiques;
insert into public.boutiques (id, data) values ('b1', '{\"nom\":\"APESSITO\"}');
insert into public.users (id, data) values
 ('ca_esso','{\"id\":\"ca_esso\",\"nom\":\"ESSO\",\"nom_base\":\"ESSO\",\"role\":\"client\",\"tel\":\"90554433\",\"devis\":[{\"id\":\"dv1\",\"total\":500000,\"par_id\":\"tech1\",\"statut\":\"envoye\"}]}'),
 ('tech1','{\"id\":\"tech1\",\"nom\":\"TECHNICIEN\",\"role\":\"technicien\"}');
insert into public.prospects (id, data) values
 ('pr_marque',  '{\"id\":\"pr_marque\",\"nom\":\"ESSO\",\"tel\":\"90554433\",\"client_user_id\":\"ca_esso\"}'),
 ('pr_anonyme', '{\"id\":\"pr_anonyme\",\"nom\":\"ESSO\",\"tel\":\"90554433\"}');
" >/dev/null

ESSO='{"role":"authenticated","email":"ca_esso@bmi.internal","app_metadata":{"role":"client","ecriture":true,"espace":"reel"}}'
ok=0; ko=0
lot() { # lot <description> <ACCEPTE|REFUSE> <json>
  local desc="$1" attendu="$2" opsjson="$3" sortie obtenu
  if sortie=$(psql -h /tmp -p $PORT -U postgres -d bmi -qtA -v ON_ERROR_STOP=1 -c "
    begin; set local role authenticated; set local request.jwt.claims = '$ESSO';
    select public.appliquer_lot('$opsjson'::jsonb); rollback;" 2>&1); then obtenu="ACCEPTE"; else obtenu="REFUSE"; fi
  if [ "$obtenu" = "$attendu" ]; then ok=$((ok+1)); echo "  ✓ $desc → $obtenu";
  else ko=$((ko+1)); echo "  ❌ $desc → $obtenu (attendu : $attendu)"; echo "     $(echo "$sortie" | grep -m1 ERROR | cut -c1-150)"; fi
}

echo
echo "── LES GESTES DE L'ESPACE CLIENT, TELS QUE L'APPLICATION LES ENVOIE ──"
lot "★ valider un devis — LE LOT EXACT D'ESSO : users + audits + commandes" "ACCEPTE" '[
 {"table":"users","id":"ca_esso","data":{"id":"ca_esso","nom":"ESSO","nom_base":"ESSO","role":"client","tel":"90554433","devis":[{"id":"dv1","total":500000,"par_id":"tech1","statut":"valide","contrat_statut":"signe"}]}},
 {"table":"audits","id":"au1","data":{"id":"au1","date":"2026-08-31","user":"ESSO","action":"Devis 500 000 F VALIDE par le client ESSO"}},
 {"table":"commandes","id":"cm1","data":{"id":"cm1","boutique":"APESSITO","client":"ESSO","tel":"90554433","articles":[{"article":"PANNEAU","qte":2,"pu":125000}],"statut":"en_attente","origine_devis":{"client_id":"ca_esso","devis_id":"dv1"}}}]'
lot "★ …même lot avec le badge prospect MARQUÉ (4 écritures)" "ACCEPTE" '[
 {"table":"commandes","id":"cm5","data":{"id":"cm5","boutique":"APESSITO","client":"ESSO","statut":"en_attente"}},
 {"table":"prospects","id":"pr_marque","data":{"id":"pr_marque","nom":"ESSO","tel":"90554433","client_user_id":"ca_esso","devis_valide":true,"devis_total":500000}},
 {"table":"audits","id":"au2","data":{"id":"au2","date":"2026-08-31","user":"ESSO","user_id":"ca_esso","action":"Devis VALIDE"}},
 {"table":"users","id":"ca_esso","data":{"id":"ca_esso","nom":"ESSO","nom_base":"ESSO","role":"client","tel":"90554433","devis":[{"id":"dv1","total":500000,"par_id":"tech1","statut":"valide"}]}}]'
lot "★ valider un devis « pose seule » (dette + chantier + journal + sa fiche)" "ACCEPTE" '[
 {"table":"dettes","id":"dt9","data":{"id":"dt9","client_user_id":"ca_esso","boutique":"TERRAIN","client":"ESSO","tel":"90554433","montant":300000,"paye":0}},
 {"table":"clients_installes","id":"ch9","data":{"id":"ch9","nom":"ESSO","tel":"90554433","user_id":"ca_esso","vente_id":null,"devis_id":"dv1","pose_seule":true,"dette_id":"dt9","statut":"en_cours"}},
 {"table":"audits","id":"au3","data":{"id":"au3","date":"2026-08-31","user":"ESSO","user_id":"ca_esso","action":"Devis pose seule VALIDE"}},
 {"table":"users","id":"ca_esso","data":{"id":"ca_esso","nom":"ESSO","nom_base":"ESSO","role":"client","tel":"90554433","devis":[{"id":"dv1","total":500000,"par_id":"tech1","statut":"valide"}]}}]'
lot "★ noter l'employé — NOUVEL emplacement (la note dans SA fiche)" "ACCEPTE" '[
 {"table":"users","id":"ca_esso","data":{"id":"ca_esso","nom":"ESSO","nom_base":"ESSO","role":"client","tel":"90554433","evaluations_donnees":[{"id":"ev1","par_id":"tech1","par_nom":"TECHNICIEN","client_id":"ca_esso","habillement":5,"maitrise":4,"respect":5}],"devis":[{"id":"dv1","total":500000,"par_id":"tech1","statut":"valide","note_donnee":true}]}},
 {"table":"messages","id":"ms1","data":{"id":"ms1","de_id":"ca_esso","a_id":"tech1","texte":"merci"}}]'

echo
echo "── ET CE QUE LE SERVEUR DOIT CONTINUER DE REFUSER ──"
lot "toucher une fiche prospect SANS étiquette (raison du marquage en amont)" "REFUSE" '[
 {"table":"prospects","id":"pr_anonyme","data":{"id":"pr_anonyme","nom":"ESSO","tel":"90554433","devis_valide":true}},
 {"table":"users","id":"ca_esso","data":{"id":"ca_esso","nom":"ESSO","role":"client","tel":"90554433"}}]'
lot "écrire dans la fiche d'un employé (l'ANCIEN emplacement des notes)" "REFUSE" '[
 {"table":"users","id":"tech1","data":{"id":"tech1","nom":"TECHNICIEN","role":"technicien","evaluations":[{"id":"ev2","habillement":5}]}},
 {"table":"users","id":"ca_esso","data":{"id":"ca_esso","nom":"ESSO","role":"client","tel":"90554433"}}]'
lot "écrire une ligne de journal au nom de QUELQU'UN D'AUTRE" "REFUSE" '[
 {"table":"audits","id":"au9","data":{"id":"au9","date":"2026-08-31","user":"TECHNICIEN","user_id":"tech1","action":"fausse ligne"}},
 {"table":"messages","id":"ms9","data":{"id":"ms9","de_id":"ca_esso","a_id":"tech1","texte":"x"}}]'

echo
echo "── LE RATTRAPAGE client-5 MARQUE LES FICHES SANS DEVINER ──"
$Q -q -v ON_ERROR_STOP=1 -c "
insert into public.users (id, data) values
 ('ca_dup1','{\"id\":\"ca_dup1\",\"role\":\"client\",\"tel\":\"99887766\"}'),
 ('ca_dup2','{\"id\":\"ca_dup2\",\"role\":\"client\",\"tel\":\"99 88 77 66\"}'),
 ('ca_off', '{\"id\":\"ca_off\",\"role\":\"client\",\"actif\":false,\"tel\":\"97001122\"}');
insert into public.prospects (id, data) values
 ('pr_ambigu', '{\"id\":\"pr_ambigu\",\"nom\":\"DUP\",\"tel\":\"99887766\"}'),
 ('pr_off',    '{\"id\":\"pr_off\",\"nom\":\"BLOQUE\",\"tel\":\"97001122\"}'),
 ('pr_deja',   '{\"id\":\"pr_deja\",\"nom\":\"X\",\"tel\":\"90554433\",\"client_user_id\":\"ca_autre\"}'),
 ('pr_court',  '{\"id\":\"pr_court\",\"nom\":\"COURT\",\"tel\":\"4433\"}');
" >/dev/null
$Q -q -v ON_ERROR_STOP=1 -f supabase/client-5-marquer-prospects.sql >/dev/null
verif() { local desc="$1" sql="$2" attendu="$3" obtenu
  obtenu=$($Q -qtA -v ON_ERROR_STOP=1 -c "$sql")
  if [ "$obtenu" = "$attendu" ]; then ok=$((ok+1)); echo "  ✓ $desc";
  else ko=$((ko+1)); echo "  ❌ $desc → « $obtenu » (attendu : « $attendu »)"; fi
}
M="coalesce(nullif(data->>'client_user_id',''),'∅')"
verif "la fiche au téléphone unique est marquée" "select $M from public.prospects where id='pr_anonyme'" "ca_esso"
verif "deux comptes au même numéro : on ne devine pas" "select $M from public.prospects where id='pr_ambigu'" "∅"
verif "un compte bloqué n'est jamais rattaché" "select $M from public.prospects where id='pr_off'" "∅"
verif "une fiche déjà marquée n'est jamais réécrite" "select $M from public.prospects where id='pr_deja'" "ca_autre"
verif "un numéro trop court ne marque rien" "select $M from public.prospects where id='pr_court'" "∅"
verif "l'horodatage a bien BOUGÉ (les appareils retéléchargeront la fiche)" "
  select (select updated_at from public.prospects where id='pr_anonyme')
       > (select updated_at from public.prospects where id='pr_ambigu')" "t"

echo
if [ $ko -eq 0 ]; then echo "✅  $ok vérification(s) passée(s), 0 en échec."; exit 0
else echo "❌  $ko vérification(s) EN ÉCHEC sur $((ok+ko))."; exit 1; fi
