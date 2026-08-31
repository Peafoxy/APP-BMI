#!/usr/bin/env bash
# Banc jetable : le SQL de l'étape 2 (client-3-rapprocher-proprietaires.sql)
# fait-il EXACTEMENT ce qu'il promet ? Cas piégeux inclus.
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable"; exit 1; }
export PATH="$PATH:$BIN"
D=$(mktemp -d /tmp/bmi-rap-XXXXXX); PORT=55491
nettoyer() { su postgres -c "$BIN/pg_ctl -D $D stop -m immediate" >/dev/null 2>&1 || true; rm -rf "$D"; }
trap nettoyer EXIT
chown postgres:postgres "$D"
su postgres -c "$BIN/initdb -D $D -U postgres -A trust" >/dev/null
su postgres -c "$BIN/pg_ctl -D $D -o '-p $PORT -k /tmp' -l $D/log start" >/dev/null
sleep 2
psql -h /tmp -p $PORT -U postgres -q -c "create database bmi;" >/dev/null
P="psql -h /tmp -p $PORT -U postgres -d bmi -v ON_ERROR_STOP=1 -tA"

echo "▸ Base simulée (mêmes tables, même déclencheur d'horodatage)"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/test/fixture.sql

# Table rase sur les tables concernées : le banc contrôle des COMPTES EXACTS.
$P -c "delete from public.dettes; delete from public.ventes;
       delete from public.clients_installes; delete from public.users;" >/dev/null

# ── Les comptes ──────────────────────────────────────────────
$P -c "
insert into public.users (id, data) values
 ('ca_afi',   '{\"id\":\"ca_afi\",\"role\":\"client\",\"tel\":\"+228 90 11 22 33\",\"nom_complet\":\"AFI MENSAH\"}'),
 ('ca_kodjo', '{\"id\":\"ca_kodjo\",\"role\":\"client\",\"nom_complet\":\"Kodjo Agbeko\"}'),
 ('ca_dup1',  '{\"id\":\"ca_dup1\",\"role\":\"client\",\"tel\":\"99 88 77 66\",\"nom\":\"DUP UN\"}'),
 ('ca_dup2',  '{\"id\":\"ca_dup2\",\"role\":\"client\",\"tel\":\"99887766\",\"nom\":\"DUP DEUX\"}'),
 ('ca_off',   '{\"id\":\"ca_off\",\"role\":\"client\",\"actif\":false,\"tel\":\"97001122\",\"nom\":\"BLOQUE\"}'),
 ('ca_court', '{\"id\":\"ca_court\",\"role\":\"client\",\"tel\":\"22 33\",\"nom\":\"COURT\"}'),
 ('zz_vend',  '{\"id\":\"zz_vend\",\"role\":\"vendeur\",\"tel\":\"96334455\",\"nom\":\"VENDEUR\"}');
" >/dev/null

# ── Les lignes à rapprocher (chacune est un piège différent) ──
$P -c "
insert into public.dettes (id, data) values
 ('dt_tel',    '{\"id\":\"dt_tel\",\"client\":\"AFI\",\"tel\":\"90112233\",\"montant\":100}'),
 ('dt_nom',    '{\"id\":\"dt_nom\",\"client\":\"  kodjo AGBEKO \",\"montant\":100}'),
 ('dt_relais', '{\"id\":\"dt_relais\",\"client\":\"Kodjo Agbeko\",\"tel\":\"98765432\",\"montant\":100}'),
 ('dt_ambigu', '{\"id\":\"dt_ambigu\",\"client\":\"Kodjo Agbeko\",\"tel\":\"99887766\",\"montant\":100}'),
 ('dt_deja',   '{\"id\":\"dt_deja\",\"client\":\"AFI\",\"tel\":\"90112233\",\"client_user_id\":\"ca_autre\",\"montant\":100}'),
 ('dt_off',    '{\"id\":\"dt_off\",\"client\":\"X\",\"tel\":\"97001122\",\"montant\":100}'),
 ('dt_vend',   '{\"id\":\"dt_vend\",\"client\":\"X\",\"tel\":\"96334455\",\"montant\":100}'),
 ('dt_passage','{\"id\":\"dt_passage\",\"client\":\"PASSANT\",\"tel\":\"91 00 00 00\",\"montant\":100}'),
 ('dt_court',  '{\"id\":\"dt_court\",\"client\":\"\",\"tel\":\"2233\",\"montant\":100}');
insert into public.ventes (id, data) values
 ('vt_tel',  '{\"id\":\"vt_tel\",\"client\":\"AFI\",\"tel\":\"+22890112233\"}'),
 ('vt_vide', '{\"id\":\"vt_vide\",\"client\":\"AFI\",\"tel\":\"90112233\",\"client_user_id\":\"\"}');
insert into public.clients_installes (id, data) values
 ('ch_tel',  '{\"id\":\"ch_tel\",\"nom\":\"AFI\",\"tel\":\"90 11 22 33\",\"user_id\":\"\"}'),
 ('ch_nom',  '{\"id\":\"ch_nom\",\"nom\":\"Kodjo\",\"prenom\":\"Agbeko\",\"tel\":\"\"}'),
 ('ch_deja', '{\"id\":\"ch_deja\",\"nom\":\"AFI\",\"tel\":\"90112233\",\"user_id\":\"ca_autre\"}');
" >/dev/null

# Mémorise les horodatages AVANT (le script ne doit PAS les changer).
$P -c "create table _avant as
  select 'dettes' t, id, updated_at from public.dettes
  union all select 'ventes', id, updated_at from public.ventes
  union all select 'clients_installes', id, updated_at from public.clients_installes;" >/dev/null

echo
echo "▸ Exécution du script de l'étape 2 (tel que Timo le collera)"
psql -h /tmp -p $PORT -U postgres -d bmi -v ON_ERROR_STOP=1 \
  -f supabase/client-3-rapprocher-proprietaires.sql

ok=0; ko=0
verif() { # verif <description> <sql renvoyant une valeur> <attendu>
  local desc="$1" sql="$2" attendu="$3" obtenu
  obtenu=$($P -c "$sql")
  if [ "$obtenu" = "$attendu" ]; then ok=$((ok+1)); echo "  ✓ $desc";
  else ko=$((ko+1)); echo "  ❌ $desc → « $obtenu » (attendu : « $attendu »)"; fi
}
M="coalesce(data->>'client_user_id','∅')"
MU="coalesce(nullif(data->>'user_id',''),'∅')"

echo
echo "── DETTES ──"
verif "téléphone identique à 8 chiffres près → rattachée"        "select $M from public.dettes where id='dt_tel'" "ca_afi"
verif "pas de téléphone, nom exact (casse/espaces ignorés) → rattachée" "select $M from public.dettes where id='dt_nom'" "ca_kodjo"
verif "téléphone inconnu, le nom exact prend le relais"          "select $M from public.dettes where id='dt_relais'" "ca_kodjo"
verif "téléphone AMBIGU (2 comptes) : rien, même si le nom correspond" "select $M from public.dettes where id='dt_ambigu'" "∅"
verif "ligne déjà marquée : JAMAIS réécrite"                     "select $M from public.dettes where id='dt_deja'" "ca_autre"
verif "compte bloqué : jamais rattaché"                          "select $M from public.dettes where id='dt_off'" "∅"
verif "compte non-client (vendeur) : jamais rattaché"            "select $M from public.dettes where id='dt_vend'" "∅"
verif "client de passage sans compte : rien"                     "select $M from public.dettes where id='dt_passage'" "∅"
verif "numéro trop court (< 6 chiffres) : rien"                  "select $M from public.dettes where id='dt_court'" "∅"

echo
echo "── VENTES ──"
verif "indicatif +228 devant : quand même rattachée"             "select $M from public.ventes where id='vt_tel'" "ca_afi"
verif "client_user_id vide (\"\") compte comme non marqué"       "select $M from public.ventes where id='vt_vide'" "ca_afi"

echo
echo "── CHANTIERS ──"
verif "chantier rattaché par téléphone (user_id était \"\")"     "select $MU from public.clients_installes where id='ch_tel'" "ca_afi"
verif "chantier sans téléphone : PAS de rapprochement par nom"   "select $MU from public.clients_installes where id='ch_nom'" "∅"
verif "chantier déjà lié : jamais réécrit"                       "select $MU from public.clients_installes where id='ch_deja'" "ca_autre"

echo
echo "── EFFETS DE BORD ──"
verif "AUCUN updated_at n'a bougé (les téléphones ne retéléchargeront rien)" "
  select count(*) from _avant a
  join (select 'dettes' t, id, updated_at from public.dettes
        union all select 'ventes', id, updated_at from public.ventes
        union all select 'clients_installes', id, updated_at from public.clients_installes) ap
    on ap.t=a.t and ap.id=a.id
  where ap.updated_at is distinct from a.updated_at" "0"
verif "la fonction temporaire a bien été retirée de la base" "
  select count(*) from pg_proc where proname='rapprocher_proprietaires'" "0"
verif "le déclencheur d'horodatage est bien RÉACTIVÉ partout" "
  select count(*) from pg_trigger tg join pg_class c on c.oid=tg.tgrelid
  where tg.tgname='horodatage_serveur_trg'
    and c.relname in ('dettes','ventes','clients_installes')
    and tg.tgenabled = 'O'" "3"

echo
echo "▸ Deuxième passage (le script doit être inoffensif rejoué)"
psql -h /tmp -p $PORT -U postgres -d bmi -v ON_ERROR_STOP=1 \
  -f supabase/client-3-rapprocher-proprietaires.sql >/dev/null
verif "rien n'a changé au deuxième passage (dette déjà marquée intacte)" "select $M from public.dettes where id='dt_deja'" "ca_autre"
verif "rien n'a changé au deuxième passage (ambiguë toujours vierge)" "select $M from public.dettes where id='dt_ambigu'" "∅"

echo
if [ $ko -eq 0 ]; then echo "✅  $ok vérification(s) passée(s), 0 en échec."; exit 0
else echo "❌  $ko vérification(s) EN ÉCHEC sur $((ok+ko))."; exit 1; fi
