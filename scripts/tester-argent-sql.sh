#!/usr/bin/env bash
# ============================================================
# L'ARGENT, RÈGLES DE RÔLE CÔTÉ SERVEUR — mesuré sur un PostgreSQL jetable
# (vague 3, étape 2 — supabase/securite-4-argent.sql)
#
#   bash scripts/tester-argent-sql.sh
#
# N'a AUCUN contact avec la base Supabase de BMI.
# Pour chaque règle tranchée par Timo le 04/09/2026 : le geste INTERDIT est
# REFUSÉ, et le geste PERMIS passe — les deux, sinon le verrou casserait le
# travail de tous les jours (leçon ESSO). Même harnais que
# tester-ecriture-sql.sh : on regarde si la base a levé une objection.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable"; exit 1; }
export PATH="$PATH:$BIN"
D=$(mktemp -d /tmp/bmi-arg-XXXXXX); PORT=55492
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
for f in supabase/roles-1-vague1.sql supabase/roles-2-vague2.sql; do
  psql -h /tmp -p $PORT -U postgres -d bmi -q -f "$f" >/dev/null 2>&1 || echo "   (⚠ $f partiellement rejoué)"
done
echo "▸ Pose des verrous : supabase/securite-4-argent.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f supabase/securite-4-argent.sql >/dev/null
echo "▸ Correctif upsert : supabase/securite-8-correctif-upsert.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f supabase/securite-8-correctif-upsert.sql >/dev/null 2>&1
echo "▸ Le DG reconnu (est_admin_principal) : supabase/securite-5-comptes.sql, puis le versement des fonds : supabase/securite-10-versements.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f supabase/securite-5-comptes.sql >/dev/null 2>&1
psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f supabase/securite-10-versements.sql >/dev/null 2>&1 || echo "   ❌ securite-10 refusé par la base"
echo "▸ Le versement au gérant : supabase/securite-11-versement-gerant.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f supabase/securite-11-versement-gerant.sql >/dev/null 2>&1 || echo "   ❌ securite-11 refusé par la base"
echo "▸ Le rejet d'un versement : supabase/securite-12-rejet-versement.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f supabase/securite-12-rejet-versement.sql >/dev/null 2>&1 || echo "   ❌ securite-12 refusé par la base"
echo "▸ La reprise d'un article par le client : supabase/securite-13-reprise.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f supabase/securite-13-reprise.sql >/dev/null 2>&1 || echo "   ❌ securite-13 refusé par la base"
echo "▸ Les remises par article : supabase/securite-14-remise-article.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -v ON_ERROR_STOP=1 -f supabase/securite-14-remise-article.sql >/dev/null 2>&1 || echo "   ❌ securite-14 refusé par la base"

$P -c "
insert into public.users (id, data) values
  ('zc_ama',  '{\"id\":\"zc_ama\",\"nom\":\"AMA\",\"role\":\"client\",\"devis\":[{\"id\":\"dv5\",\"statut\":\"propose\",\"pct_remise\":5,\"total\":100000}]}'),
  ('zv_kossi','{\"id\":\"zv_kossi\",\"nom\":\"KOSSI\",\"role\":\"vendeur\",\"boutique\":\"APESSITO\"}'),
  ('zg_ali',  '{\"id\":\"zg_ali\",\"nom\":\"ALI\",\"role\":\"gerant\",\"boutique\":\"APESSITO\"}'),
  ('zm_paul', '{\"id\":\"zm_paul\",\"nom\":\"PAUL\",\"role\":\"magasinier\",\"boutique\":\"DEPOT\"}'),
  ('zk_marie','{\"id\":\"zk_marie\",\"nom\":\"MARIE\",\"role\":\"comptable\"}'),
  ('zo_com',  '{\"id\":\"zo_com\",\"nom\":\"COM\",\"role\":\"commercial\"}'),
  ('za_timo', '{\"id\":\"za_timo\",\"nom\":\"TIMO\",\"role\":\"admin\",\"admin_principal\":true}')
on conflict (id) do nothing;
insert into public.ventes (id, data) values ('zv1', '{\"id\":\"zv1\",\"boutique\":\"APESSITO\",\"client\":\"AMA\",\"remise_pct\":0}');
insert into public.dettes (id, data) values ('zd1', '{\"id\":\"zd1\",\"boutique\":\"APESSITO\",\"client\":\"AMA\",\"montant\":50000,\"paye\":0}');
insert into public.depenses (id, data) values
  ('zx1', '{\"id\":\"zx1\",\"boutique\":\"APESSITO\",\"montant\":10000,\"libelle\":\"Carburant\"}'),
  ('zx2', '{\"id\":\"zx2\",\"boutique\":\"Chez le comptable\",\"montant\":20000,\"libelle\":\"Remis\",\"decaisse_le\":\"2026-09-01\",\"decaisse_par\":\"MARIE\"}');
insert into public.produits (id, data) values ('zp1', '{\"id\":\"zp1\",\"boutique\":\"APESSITO\",\"nom\":\"BATTERIE\",\"initial\":10,\"seuil\":2,\"prix_achat\":8000,\"prix_vente\":12000,\"entrees\":0}');
insert into public.ajustements (id, data) values ('zj1', '{\"id\":\"zj1\",\"produit_id\":\"zp1\",\"boutique\":\"APESSITO\",\"qte\":0,\"qte_sav\":1,\"type\":\"retour_defectueux\",\"statut\":\"en_sav\"}');
insert into public.commerciaux (id, data) values ('zco1', '{\"id\":\"zco1\",\"nom\":\"AGENT\",\"taux\":5}');
insert into public.commandes (id, data) values ('zcmA', '{\"id\":\"zcmA\",\"remise_pct\":5,\"statut\":\"validee\"}');
insert into public.fournisseurs (id, data) values ('zf1', '{\"id\":\"zf1\",\"nom\":\"SOLARIS\",\"doit\":100000,\"paye\":0}');
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
jeton() { echo "{\"role\":\"authenticated\",\"email\":\"$1@bmi.internal\",\"app_metadata\":{\"role\":\"$2\",\"ecriture\":$3,\"espace\":\"reel\",\"principal\":$4}}"; }
CLIENT=$(jeton zc_ama client true false)
VENDEUR=$(jeton zv_kossi vendeur true false)
GERANT=$(jeton zg_ali gerant true false)
MAGASINIER=$(jeton zm_paul magasinier true false)
COMPTABLE=$(jeton zk_marie comptable false false)
COMMERCIAL=$(jeton zo_com commercial true false)
ADMIN=$(jeton za_timo admin true true)
ADMIN2=$(jeton za_caleb admin true false)   # administrateur secondaire : pas le DG

MAJ() { echo "with x as (update public.$1 set data = $2 where id='$3' returning 1) select count(*) from x;"; }
SUPPR() { echo "with x as (delete from public.$1 where id='$2' returning 1) select count(*) from x;"; }
INS() { echo "with x as (insert into public.$1 (id, data) values ('$2', '$3') returning 1) select count(*) from x;"; }
# L'écriture telle que l'application la fait VRAIMENT : un upsert.
UPS() { echo "with x as (insert into public.$1 (id, data) values ('$2', '$3') on conflict (id) do update set data = excluded.data returning 1) select count(*) from x;"; }

echo
echo "── SUPPRIMER UNE VENTE, UNE DETTE, UNE DÉPENSE : admin seul ──"
essai "un vendeur supprime une vente" "REFUSE" "$VENDEUR" "$(SUPPR ventes zv1)"
essai "un gérant supprime une vente" "REFUSE" "$GERANT" "$(SUPPR ventes zv1)"
essai "l'admin supprime une vente" "PERMIS" "$ADMIN" "$(SUPPR ventes zv1)"
essai "un vendeur supprime une dette" "REFUSE" "$VENDEUR" "$(SUPPR dettes zd1)"
essai "l'admin supprime une dette" "PERMIS" "$ADMIN" "$(SUPPR dettes zd1)"
essai "un gérant supprime une dépense" "REFUSE" "$GERANT" "$(SUPPR depenses zx1)"
essai "l'admin supprime une dépense" "PERMIS" "$ADMIN" "$(SUPPR depenses zx1)"
essai "un vendeur ENCAISSE une vente sans remise (le quotidien passe)" "PERMIS" "$VENDEUR" "$(INS ventes zv9 '{"id":"zv9","boutique":"APESSITO","client":"X","remise_pct":0}')"
essai "un vendeur encaisse un versement sur une dette (le quotidien passe)" "PERMIS" "$VENDEUR" "$(MAJ dettes "jsonb_set(data,'{paye}','10000')" zd1)"

echo
echo "── LE POINTAGE DU COMPTABLE : son seul geste, et rien d'autre ──"
essai "le comptable pointe un décaissement « remis »" "PERMIS" "$COMPTABLE" "$(MAJ depenses "data || '{\"decaisse_le\":\"2026-09-04\",\"decaisse_par\":\"MARIE\"}'" zx1)"
essai "le comptable change le MONTANT d'une dépense" "REFUSE" "$COMPTABLE" "$(MAJ depenses "jsonb_set(data,'{montant}','1')" zx1)"
essai "le comptable crée une dépense" "REFUSE" "$COMPTABLE" "$(INS depenses zx9 '{"id":"zx9","montant":5}')"
essai "un vendeur annule un pointage" "REFUSE" "$VENDEUR" "$(MAJ depenses "data || '{\"decaisse_le\":null,\"decaisse_par\":null}'" zx2)"
essai "l'admin annule un pointage" "PERMIS" "$ADMIN" "$(MAJ depenses "data || '{\"decaisse_le\":null,\"decaisse_par\":null}'" zx2)"

echo
echo "── LES ARTICLES : écrire = magasinier / gérant / admin ; prix, quantité initiale, suppression = admin ──"
essai "un vendeur modifie le seuil d'alerte d'un article" "REFUSE" "$VENDEUR" "$(MAJ produits "jsonb_set(data,'{seuil}','5')" zp1)"
essai "le magasinier modifie le seuil d'alerte" "PERMIS" "$MAGASINIER" "$(MAJ produits "jsonb_set(data,'{seuil}','5')" zp1)"
essai "le magasinier enregistre une ENTRÉE de stock (entrees +10)" "PERMIS" "$MAGASINIER" "$(MAJ produits "jsonb_set(data,'{entrees}','10')" zp1)"
essai "le gérant change le PRIX DE VENTE" "REFUSE" "$GERANT" "$(MAJ produits "jsonb_set(data,'{prix_vente}','1')" zp1)"
essai "le magasinier change le PRIX D'ACHAT" "REFUSE" "$MAGASINIER" "$(MAJ produits "jsonb_set(data,'{prix_achat}','1')" zp1)"
essai "le magasinier change la QUANTITÉ INITIALE" "REFUSE" "$MAGASINIER" "$(MAJ produits "jsonb_set(data,'{initial}','99')" zp1)"
essai "l'admin change le prix de vente" "PERMIS" "$ADMIN" "$(MAJ produits "jsonb_set(data,'{prix_vente}','1')" zp1)"
essai "un vendeur crée un article" "REFUSE" "$VENDEUR" "$(INS produits zp9 '{"id":"zp9","nom":"X","prix_vente":1}')"
essai "le gérant crée un article (importation, fiche)" "PERMIS" "$GERANT" "$(INS produits zp9 '{"id":"zp9","nom":"X","prix_vente":1}')"
essai "le magasinier supprime un article" "REFUSE" "$MAGASINIER" "$(SUPPR produits zp1)"
essai "l'admin supprime un article" "PERMIS" "$ADMIN" "$(SUPPR produits zp1)"

echo
echo "── LES MOUVEMENTS DE STOCK : magasinier / gérant / admin ; garantie et SAV : admin ──"
essai "un vendeur enregistre un transfert de stock" "REFUSE" "$VENDEUR" "$(INS ajustements zj9 '{"id":"zj9","produit_id":"zp1","qte":-1,"type":"transfert"}')"
essai "le gérant enregistre un transfert de stock" "PERMIS" "$GERANT" "$(INS ajustements zj9 '{"id":"zj9","produit_id":"zp1","qte":-1,"type":"transfert"}')"
essai "le magasinier valide un inventaire (ajustement d'écart)" "PERMIS" "$MAGASINIER" "$(INS ajustements zj9 '{"id":"zj9","produit_id":"zp1","qte":-2,"type":"inventaire"}')"
essai "le magasinier enregistre un ÉCHANGE SOUS GARANTIE" "REFUSE" "$MAGASINIER" "$(INS ajustements zj9 '{"id":"zj9","produit_id":"zp1","qte":-1,"type":"echange_garantie"}')"
essai "l'admin enregistre un échange sous garantie" "PERMIS" "$ADMIN" "$(INS ajustements zj9 '{"id":"zj9","produit_id":"zp1","qte":-1,"type":"echange_garantie"}')"
essai "le gérant statue sur un défectueux (rebut)" "REFUSE" "$GERANT" "$(MAJ ajustements "jsonb_set(data,'{statut}','\"rebut\"')" zj1)"
essai "l'admin statue sur un défectueux (rebut)" "PERMIS" "$ADMIN" "$(MAJ ajustements "jsonb_set(data,'{statut}','\"rebut\"')" zj1)"
essai "un vendeur supprime un ajustement" "REFUSE" "$VENDEUR" "$(SUPPR ajustements zj1)"

echo
echo "── CAISSE, AGENTS COMMERCIAUX, FOURNISSEURS ──"
essai "★ un vendeur clôture la caisse (securite-11 : Timo, « comment la clôture peut être impossible à un vendeur ? »)" "PERMIS" "$VENDEUR" "$(INS clotures zcl1 '{"id":"zcl1","boutique":"APESSITO","compte":1000}')"
essai "un magasinier clôture la caisse" "REFUSE" "$MAGASINIER" "$(INS clotures zcl1 '{"id":"zcl1","boutique":"APESSITO","compte":1000}')"
essai "le gérant clôture la caisse" "PERMIS" "$GERANT" "$(INS clotures zcl1 '{"id":"zcl1","boutique":"APESSITO","compte":1000}')"
essai "le gérant change le taux d'un agent commercial" "REFUSE" "$GERANT" "$(MAJ commerciaux "jsonb_set(data,'{taux}','50')" zco1)"
essai "l'admin change le taux d'un agent commercial" "PERMIS" "$ADMIN" "$(MAJ commerciaux "jsonb_set(data,'{taux}','50')" zco1)"
essai "un vendeur règle un fournisseur" "REFUSE" "$VENDEUR" "$(MAJ fournisseurs "jsonb_set(data,'{paye}','100000')" zf1)"
essai "le gérant règle un fournisseur" "PERMIS" "$GERANT" "$(MAJ fournisseurs "jsonb_set(data,'{paye}','100000')" zf1)"
essai "un vendeur supprime un fournisseur" "REFUSE" "$VENDEUR" "$(SUPPR fournisseurs zf1)"

echo
echo "── LA REMISE AU-DELÀ DE 3 % : admin seul (devis, vente, proforma, commande) ──"
essai "un commercial envoie un devis à 5 % de remise (dans la fiche du client)" "REFUSE" "$COMMERCIAL" \
  "$(MAJ users "jsonb_set(data,'{devis}','[{\"id\":\"dv5\",\"statut\":\"propose\",\"pct_remise\":5,\"total\":100000},{\"id\":\"dv6\",\"statut\":\"propose\",\"pct_remise\":5,\"total\":50000}]')" zc_ama)"
essai "un commercial envoie un devis à 3 % de remise" "PERMIS" "$COMMERCIAL" \
  "$(MAJ users "jsonb_set(data,'{devis}','[{\"id\":\"dv5\",\"statut\":\"propose\",\"pct_remise\":5,\"total\":100000},{\"id\":\"dv7\",\"statut\":\"propose\",\"pct_remise\":3,\"total\":50000}]')" zc_ama)"
essai "l'admin envoie un devis à 5 %" "PERMIS" "$ADMIN" \
  "$(MAJ users "jsonb_set(data,'{devis}','[{\"id\":\"dv5\",\"statut\":\"propose\",\"pct_remise\":5,\"total\":100000},{\"id\":\"dv6\",\"statut\":\"propose\",\"pct_remise\":5,\"total\":50000}]')" zc_ama)"
essai "le CLIENT valide son devis à 5 % (remise inchangée : celle de l'admin)" "PERMIS" "$CLIENT" \
  "$(MAJ users "jsonb_set(data,'{devis}','[{\"id\":\"dv5\",\"statut\":\"valide\",\"pct_remise\":5,\"total\":100000}]')" zc_ama)"
essai "le CLIENT gonfle la remise de son devis à 20 %" "REFUSE" "$CLIENT" \
  "$(MAJ users "jsonb_set(data,'{devis}','[{\"id\":\"dv5\",\"statut\":\"valide\",\"pct_remise\":20,\"total\":100000}]')" zc_ama)"
essai "le CLIENT crée la commande de son devis (remise 5 % = celle du devis)" "PERMIS" "$CLIENT" \
  "$(INS commandes zcm1 '{"id":"zcm1","remise_pct":5,"origine_devis":{"client_id":"zc_ama","devis_id":"dv5"}}')"
essai "le CLIENT crée une commande à 10 % (≠ devis)" "REFUSE" "$CLIENT" \
  "$(INS commandes zcm2 '{"id":"zcm2","remise_pct":10,"origine_devis":{"client_id":"zc_ama","devis_id":"dv5"}}')"
essai "un commercial envoie une commande à 5 %" "REFUSE" "$COMMERCIAL" "$(INS commandes zcm3 '{"id":"zcm3","remise_pct":5}')"
essai "un commercial envoie une commande à 2 %" "PERMIS" "$COMMERCIAL" "$(INS commandes zcm3 '{"id":"zcm3","remise_pct":2}')"
essai "un vendeur encaisse une vente à 5 % de remise" "REFUSE" "$VENDEUR" "$(INS ventes zv8 '{"id":"zv8","boutique":"APESSITO","remise_pct":5}')"
essai "un vendeur encaisse une vente à 3 %" "PERMIS" "$VENDEUR" "$(INS ventes zv8 '{"id":"zv8","boutique":"APESSITO","remise_pct":3}')"
essai "l'admin encaisse une vente à 5 %" "PERMIS" "$ADMIN" "$(INS ventes zv8 '{"id":"zv8","boutique":"APESSITO","remise_pct":5}')"
essai "un vendeur ENCAISSE la commande d'un devis à 5 % fait par l'admin (remise = celle de la commande)" "PERMIS" "$VENDEUR" \
  "$(INS ventes zv8 '{"id":"zv8","boutique":"APESSITO","remise_pct":5,"commande_id":"zcmA"}')"
essai "un vendeur encaisse cette commande en GONFLANT la remise à 8 %" "REFUSE" "$VENDEUR" \
  "$(INS ventes zv8 '{"id":"zv8","boutique":"APESSITO","remise_pct":8,"commande_id":"zcmA"}')"
essai "un vendeur émet un proforma à 5 %" "REFUSE" "$VENDEUR" "$(INS proformas zpf1 '{"id":"zpf1","remise_pct":5}')"
essai "un vendeur émet un proforma à 3 %" "PERMIS" "$VENDEUR" "$(INS proformas zpf1 '{"id":"zpf1","remise_pct":3}')"

echo
echo "── LE VERSEMENT DES FONDS (securite-10, Timo 09/09/2026) : la validation DG / BANQUE = l'administrateur PRINCIPAL seul ──"
VERS='{"id":"zvf1","boutique":"APESSITO","categorie":"Versement de fonds","montant":150000,"paiement":"Espèces","par":"KOSSI","versement":{"id":"vf1","destination":"BANQUE","banque":"Ecobank","bordereau":"B-77"}}'
essai "★ le gérant enregistre un versement BANQUE (dépense de sa boutique, par upsert)" "PERMIS" "$GERANT" "$(UPS depenses zvf1 "$VERS")"
essai "★ le gérant enregistre l'entrée miroir chez le comptable (montant négatif)" "PERMIS" "$GERANT" "$(UPS depenses zvf2 '{"id":"zvf2","boutique":"Chez le comptable","categorie":"Versement de fonds","montant":-150000,"versement_id":"vf2"}')"
essai "★ un vendeur enregistre un versement (securite-11 : le gérant, pas le vendeur)" "REFUSE" "$VENDEUR" "$(UPS depenses zvf1 "$VERS")"
essai "★ un vendeur enregistre l'entrée miroir chez le comptable" "REFUSE" "$VENDEUR" "$(UPS depenses zvf2 '{"id":"zvf2","boutique":"Chez le comptable","categorie":"Versement de fonds","montant":-150000,"versement_id":"vf2"}')"
essai "un vendeur enregistre une dépense ordinaire (rien ne change pour lui)" "PERMIS" "$VENDEUR" "$(UPS depenses zvf4 '{"id":"zvf4","boutique":"APESSITO","categorie":"Transport","montant":2000}')"
essai "★ un vendeur se valide lui-même son versement (versement_valide_le)" "REFUSE" "$VENDEUR" "$(UPS depenses zvf1 "$(echo "$VERS" | sed 's/}}$/},"versement_valide_le":"2026-09-09","versement_valide_par":"KOSSI"}/')")"
essai "★ …même en créant la dépense déjà validée" "REFUSE" "$VENDEUR" "$(UPS depenses zvf3 '{"id":"zvf3","boutique":"APESSITO","categorie":"Versement de fonds","montant":1,"versement":{"destination":"Chez le DG"},"versement_valide_le":"2026-09-09"}')"
essai "★ un gérant valide un versement" "REFUSE" "$GERANT" "$(UPS depenses zx1 '{"id":"zx1","boutique":"APESSITO","montant":15000,"versement_valide_le":"2026-09-09","versement_valide_par":"ALI"}')"
essai "★ un administrateur SECONDAIRE valide un versement" "REFUSE" "$ADMIN2" "$(MAJ depenses "jsonb_set(data,'{versement_valide_le}','\"2026-09-09\"')" zx1)"
essai "★ le DG (administrateur principal) valide un versement" "PERMIS" "$ADMIN" "$(MAJ depenses "jsonb_set(data,'{versement_valide_le}','\"2026-09-09\"')" zx1)"
essai "★ …par upsert aussi" "PERMIS" "$ADMIN" "$(UPS depenses zx1 '{"id":"zx1","boutique":"APESSITO","montant":15000,"versement_valide_le":"2026-09-09","versement_valide_par":"TIMO"}')"
essai "le comptable pointe « Encaissé » l'entrée miroir (son geste habituel)" "PERMIS" "$COMPTABLE" "$(MAJ depenses "jsonb_set(data,'{decaisse_le}','\"2026-09-09\"')" zx1)"

echo
echo "── LE REJET D'UN VERSEMENT (securite-12, Timo 10/09/2026) : qui valide rejette, en attente seulement, l'argent « jamais versé » ──"
$P -c "insert into public.depenses (id, data) values
  ('zr1',  '{\"id\":\"zr1\",\"boutique\":\"APESSITO\",\"categorie\":\"Versement de fonds\",\"montant\":50000,\"paiement\":\"Espèces\",\"par\":\"ALI\",\"description\":\"Versement de fonds → Chez le DG\",\"versement\":{\"id\":\"vr1\",\"destination\":\"Chez le DG\",\"montant\":50000}}'),
  ('zr2',  '{\"id\":\"zr2\",\"boutique\":\"APESSITO\",\"categorie\":\"Versement de fonds\",\"montant\":90000,\"paiement\":\"Espèces\",\"par\":\"ALI\",\"versement\":{\"id\":\"vr2\",\"destination\":\"BANQUE\",\"banque\":\"Ecobank\",\"bordereau\":\"B-1\",\"montant\":90000},\"versement_valide_le\":\"2026-09-09\",\"versement_valide_par\":\"TIMO\"}'),
  ('zr3',  '{\"id\":\"zr3\",\"boutique\":\"APESSITO\",\"categorie\":\"Versement de fonds\",\"montant\":70000,\"paiement\":\"Espèces\",\"par\":\"ALI\",\"description\":\"Versement de fonds → Chez le comptable\",\"versement\":{\"id\":\"vr3\",\"destination\":\"Chez le comptable\",\"montant\":70000}}'),
  ('zr3m', '{\"id\":\"zr3m\",\"boutique\":\"Chez le comptable\",\"categorie\":\"Versement de fonds\",\"montant\":-70000,\"paiement\":\"Espèces\",\"par\":\"ALI\",\"description\":\"Versement du 10/09/2026 reçu de APESSITO\",\"versement_id\":\"vr3\"}'),
  ('zr4',  '{\"id\":\"zr4\",\"boutique\":\"APESSITO\",\"categorie\":\"Versement de fonds\",\"montant\":0,\"paiement\":\"Espèces\",\"par\":\"ALI\",\"versement\":{\"id\":\"vr4\",\"destination\":\"Chez le DG\",\"montant\":30000},\"versement_rejete_le\":\"2026-09-09\",\"versement_rejete_par\":\"TIMO\",\"versement_rejet_motif\":\"jamais reçu\"}'),
  ('zr4m', '{\"id\":\"zr4m\",\"boutique\":\"Chez le comptable\",\"categorie\":\"Versement de fonds\",\"montant\":0,\"paiement\":\"Espèces\",\"versement_id\":\"vr6\",\"versement_rejete_le\":\"2026-09-09\",\"versement_rejete_par\":\"MARIE\",\"versement_rejet_motif\":\"jamais reçu\"}'),
  ('zr5',  '{\"id\":\"zr5\",\"boutique\":\"APESSITO\",\"categorie\":\"Versement de fonds\",\"montant\":20000,\"paiement\":\"Espèces\",\"par\":\"ALI\",\"versement\":{\"id\":\"vr5\",\"destination\":\"Chez le comptable\",\"montant\":20000}}'),
  ('zr5m', '{\"id\":\"zr5m\",\"boutique\":\"Chez le comptable\",\"categorie\":\"Versement de fonds\",\"montant\":-20000,\"paiement\":\"Espèces\",\"versement_id\":\"vr5\",\"decaisse_le\":\"2026-09-09\",\"decaisse_par\":\"MARIE\"}');" >/dev/null
# Le rejet tel que l'application l'écrit : montant 0, les trois champs, la description — par UPSERT.
REJET_ZR1='{"id":"zr1","boutique":"APESSITO","categorie":"Versement de fonds","montant":0,"paiement":"Espèces","par":"ALI","description":"✖ REJETÉ (jamais reçu) — Versement de fonds → Chez le DG","versement":{"id":"vr1","destination":"Chez le DG","montant":50000},"versement_rejete_le":"2026-09-10","versement_rejete_par":"X","versement_rejet_motif":"jamais reçu"}'
REJET_ZR3='{"id":"zr3","boutique":"APESSITO","categorie":"Versement de fonds","montant":0,"paiement":"Espèces","par":"ALI","description":"✖ REJETÉ (jamais reçu) — Versement de fonds → Chez le comptable","versement":{"id":"vr3","destination":"Chez le comptable","montant":70000},"versement_rejete_le":"2026-09-10","versement_rejete_par":"MARIE","versement_rejet_motif":"jamais reçu"}'
REJET_ZR3M='{"id":"zr3m","boutique":"Chez le comptable","categorie":"Versement de fonds","montant":0,"paiement":"Espèces","par":"ALI","description":"✖ REJETÉ (jamais reçu) — Versement du 10/09/2026 reçu de APESSITO","versement_id":"vr3","versement_rejete_le":"2026-09-10","versement_rejete_par":"MARIE","versement_rejet_motif":"jamais reçu"}'
essai "★ un vendeur rejette un versement Chez le DG" "REFUSE" "$VENDEUR" "$(UPS depenses zr1 "$REJET_ZR1")"
essai "★ un gérant rejette un versement Chez le DG" "REFUSE" "$GERANT" "$(UPS depenses zr1 "$REJET_ZR1")"
essai "★ un administrateur SECONDAIRE rejette un versement Chez le DG" "REFUSE" "$ADMIN2" "$(UPS depenses zr1 "$REJET_ZR1")"
essai "★ le comptable rejette un versement Chez le DG (pas le sien)" "REFUSE" "$COMPTABLE" "$(UPS depenses zr1 "$REJET_ZR1")"
essai "★ le DG rejette un versement Chez le DG en attente, avec motif (par upsert, comme l'application)" "PERMIS" "$ADMIN" "$(UPS depenses zr1 "$REJET_ZR1")"
essai "★ …et le serveur FORCE le montant à 0 même si l'application envoyait encore 50 000 (« jamais versé »)" "PERMIS" "$ADMIN" "with x as (update public.depenses set data = jsonb_set(jsonb_set(data,'{versement_rejete_le}','\"2026-09-10\"'),'{versement_rejet_motif}','\"jamais reçu\"') where id='zr1' returning (data->>'montant')::numeric m) select count(*) from x where m = 0;"
essai "★ le DG rejette SANS motif" "REFUSE" "$ADMIN" "$(MAJ depenses "jsonb_set(data,'{versement_rejete_le}','\"2026-09-10\"')" zr1)"
essai "★ le DG rejette un versement DÉJÀ VALIDÉ" "REFUSE" "$ADMIN" "$(MAJ depenses "jsonb_set(jsonb_set(data,'{versement_rejete_le}','\"2026-09-10\"'),'{versement_rejet_motif}','\"x\"')" zr2)"
essai "★ le DG annule un rejet (retire versement_rejete_le)" "REFUSE" "$ADMIN" "$(MAJ depenses "data - 'versement_rejete_le'" zr4)"
essai "★ le DG change le motif d'un rejet" "REFUSE" "$ADMIN" "$(MAJ depenses "jsonb_set(data,'{versement_rejet_motif}','\"autre\"')" zr4)"
essai "★ le DG valide un versement rejeté" "REFUSE" "$ADMIN" "$(MAJ depenses "jsonb_set(data,'{versement_valide_le}','\"2026-09-10\"')" zr4)"
essai "★ on remet un montant sur un versement rejeté → le serveur le ramène à 0" "PERMIS" "$ADMIN" "with x as (update public.depenses set data = jsonb_set(data,'{montant}','30000') where id='zr4' returning (data->>'montant')::numeric m) select count(*) from x where m = 0;"
essai "★ le comptable rejette un versement « Chez le comptable » en attente — la sortie de la boutique (par upsert)" "PERMIS" "$COMPTABLE" "$(UPS depenses zr3 "$REJET_ZR3")"
essai "★ …et l'entrée miroir chez lui (par upsert)" "PERMIS" "$COMPTABLE" "$(UPS depenses zr3m "$REJET_ZR3M")"
essai "★ le DG rejette un versement « Chez le comptable » (c'est au comptable)" "REFUSE" "$ADMIN" "$(UPS depenses zr3 "$REJET_ZR3")"
essai "★ un gérant rejette un versement « Chez le comptable »" "REFUSE" "$GERANT" "$(UPS depenses zr3 "$REJET_ZR3")"
essai "★ le comptable rejette un versement dont l'entrée miroir est DÉJÀ pointée « Encaissé »" "REFUSE" "$COMPTABLE" "$(MAJ depenses "jsonb_set(jsonb_set(data,'{versement_rejete_le}','\"2026-09-10\"'),'{versement_rejet_motif}','\"x\"')" zr5)"
essai "★ le comptable pointe « Encaissé » une entrée miroir REJETÉE" "REFUSE" "$COMPTABLE" "$(MAJ depenses "jsonb_set(data,'{decaisse_le}','\"2026-09-10\"')" zr4m)"
essai "★ le comptable profite du rejet pour changer la boutique de la dépense" "REFUSE" "$COMPTABLE" "$(UPS depenses zr3 "$(echo "$REJET_ZR3" | sed 's/"boutique":"APESSITO"/"boutique":"DEPOT"/')")"
essai "★ le comptable rejette une dépense ordinaire (pas un versement)" "REFUSE" "$COMPTABLE" "$(MAJ depenses "jsonb_set(jsonb_set(data,'{versement_rejete_le}','\"2026-09-10\"'),'{versement_rejet_motif}','\"x\"')" zx1)"
essai "★ un gérant crée un versement déjà rejeté" "REFUSE" "$GERANT" "$(UPS depenses zr9 '{"id":"zr9","boutique":"APESSITO","categorie":"Versement de fonds","montant":0,"versement":{"id":"vr9","destination":"Chez le DG","montant":5},"versement_rejete_le":"2026-09-10","versement_rejet_motif":"x"}')"
essai "le gérant enregistre toujours un versement ordinaire (rien ne change pour lui)" "PERMIS" "$GERANT" "$(UPS depenses zvf1 "$VERS")"
essai "le comptable pointe toujours « Encaissé » une entrée miroir en attente" "PERMIS" "$COMPTABLE" "$(MAJ depenses "jsonb_set(data,'{decaisse_le}','\"2026-09-10\"')" zr3m)"

echo
echo "── LA REPRISE D'UN ARTICLE PAR LE CLIENT (securite-13, Timo 10/09/2026) : l'administrateur PRINCIPAL seul, jamais en arrière ──"
$P -c "insert into public.ventes (id, data) values
  ('zvr1', '{\"id\":\"zvr1\",\"boutique\":\"APESSITO\",\"client\":\"AMA\",\"remise_pct\":0,\"articles\":[{\"produit_id\":\"zp1\",\"article\":\"BATTERIE\",\"qte\":2,\"pu\":12000}]}'),
  ('zvr2', '{\"id\":\"zvr2\",\"boutique\":\"APESSITO\",\"client\":\"AMA\",\"remise_pct\":0,\"reprises\":[{\"ref\":\"REP-1\",\"produit_id\":\"zp1\",\"qte\":1,\"montant\":12000}]}');" >/dev/null
REPRISE_ZVR1='{"id":"zvr1","boutique":"APESSITO","client":"AMA","remise_pct":0,"articles":[{"produit_id":"zp1","article":"BATTERIE","qte":2,"pu":12000}],"reprises":[{"ref":"REP-2","produit_id":"zp1","qte":1,"montant":12000,"motif":"changé d avis"}]}'
essai "★ un vendeur note une reprise sur une vente (par upsert, comme l'application)" "REFUSE" "$VENDEUR" "$(UPS ventes zvr1 "$REPRISE_ZVR1")"
essai "★ un gérant note une reprise" "REFUSE" "$GERANT" "$(UPS ventes zvr1 "$REPRISE_ZVR1")"
essai "★ un administrateur SECONDAIRE note une reprise" "REFUSE" "$ADMIN2" "$(UPS ventes zvr1 "$REPRISE_ZVR1")"
essai "★ l'administrateur PRINCIPAL note une reprise" "PERMIS" "$ADMIN" "$(UPS ventes zvr1 "$REPRISE_ZVR1")"
essai "★ …et il ne peut pas l'effacer ensuite (la liste ne rétrécit jamais)" "REFUSE" "$ADMIN" "$(MAJ ventes "data - 'reprises'" zvr2)"
essai "★ …ni la vider" "REFUSE" "$ADMIN" "$(MAJ ventes "jsonb_set(data,'{reprises}','[]')" zvr2)"
essai "★ …mais il peut en ajouter une deuxième" "PERMIS" "$ADMIN" "$(MAJ ventes "jsonb_set(data,'{reprises}',(data->'reprises') || '[{\"ref\":\"REP-3\",\"qte\":1}]'::jsonb)" zvr2)"
essai "un vendeur touche une vente SANS toucher aux reprises (le quotidien passe)" "PERMIS" "$VENDEUR" "$(UPS ventes zvr2 '{"id":"zvr2","boutique":"APESSITO","client":"AMA","remise_pct":0,"reprises":[{"ref":"REP-1","produit_id":"zp1","qte":1,"montant":12000}],"note":"livrée"}')"
essai "★ un vendeur remet l'article au stock (ajustement reprise_client)" "REFUSE" "$VENDEUR" "$(INS ajustements zj8 '{"id":"zj8","produit_id":"zp1","qte":1,"type":"reprise_client"}')"
essai "★ un gérant remet l'article au stock (reprise_client)" "REFUSE" "$GERANT" "$(INS ajustements zj8 '{"id":"zj8","produit_id":"zp1","qte":1,"type":"reprise_client"}')"
essai "★ un administrateur SECONDAIRE remet l'article au stock (reprise_client)" "REFUSE" "$ADMIN2" "$(INS ajustements zj8 '{"id":"zj8","produit_id":"zp1","qte":1,"type":"reprise_client"}')"
essai "★ l'administrateur PRINCIPAL remet l'article au stock (reprise_client)" "PERMIS" "$ADMIN" "$(INS ajustements zj8 '{"id":"zj8","produit_id":"zp1","qte":1,"type":"reprise_client"}')"
essai "le gérant enregistre toujours un transfert (rien ne change pour lui)" "PERMIS" "$GERANT" "$(INS ajustements zj8 '{"id":"zj8","produit_id":"zp1","qte":-1,"type":"transfert"}')"
essai "★ un vendeur crée une dépense « Remboursement client »" "REFUSE" "$VENDEUR" "$(UPS depenses zrb1 '{"id":"zrb1","boutique":"APESSITO","categorie":"Remboursement client","montant":12000,"paiement":"Espèces"}')"
essai "★ un gérant crée une dépense « Remboursement client »" "REFUSE" "$GERANT" "$(UPS depenses zrb1 '{"id":"zrb1","boutique":"APESSITO","categorie":"Remboursement client","montant":12000,"paiement":"Espèces"}')"
essai "★ un administrateur SECONDAIRE crée une dépense « Remboursement client »" "REFUSE" "$ADMIN2" "$(UPS depenses zrb1 '{"id":"zrb1","boutique":"APESSITO","categorie":"Remboursement client","montant":12000,"paiement":"Espèces"}')"
essai "★ l'administrateur PRINCIPAL crée une dépense « Remboursement client »" "PERMIS" "$ADMIN" "$(UPS depenses zrb1 '{"id":"zrb1","boutique":"APESSITO","categorie":"Remboursement client","montant":12000,"paiement":"Espèces"}')"
essai "le gérant enregistre toujours un versement de fonds (securite-11 repris tel quel)" "PERMIS" "$GERANT" "$(UPS depenses zvf1 "$VERS")"

echo
echo "── LES REMISES PAR ARTICLE (securite-14, Timo 10/09/2026) : 3 % max par ligne sauf admin ; jamais ligne + générale ──"
$P -c "insert into public.ventes (id, data) values
  ('zrl0', '{\"id\":\"zrl0\",\"boutique\":\"APESSITO\",\"remise_pct\":0,\"articles\":[{\"produit_id\":\"zp1\",\"article\":\"BATTERIE\",\"qte\":1,\"pu\":100000,\"remise_ligne\":5000}]}');" >/dev/null
L5='[{"produit_id":"zp1","article":"BATTERIE","qte":1,"pu":100000,"remise_ligne":5000}]'
L3='[{"produit_id":"zp1","article":"BATTERIE","qte":2,"pu":100000,"remise_ligne":6000}]'
L0='[{"produit_id":"zp1","article":"BATTERIE","qte":1,"pu":100000}]'
essai "★ un vendeur vend avec 5 % de remise sur un article (remise_ligne 5 000 sur 100 000)" "REFUSE" "$VENDEUR" "$(UPS ventes zrl1 "{\"id\":\"zrl1\",\"boutique\":\"APESSITO\",\"remise_pct\":0,\"articles\":$L5}")"
essai "★ un gérant vend avec 5 % sur un article" "REFUSE" "$GERANT" "$(UPS ventes zrl1 "{\"id\":\"zrl1\",\"boutique\":\"APESSITO\",\"remise_pct\":0,\"articles\":$L5}")"
essai "★ un vendeur vend avec 3 % sur un article (6 000 sur 2 × 100 000)" "PERMIS" "$VENDEUR" "$(UPS ventes zrl1 "{\"id\":\"zrl1\",\"boutique\":\"APESSITO\",\"remise_pct\":0,\"articles\":$L3}")"
essai "★ l'admin vend avec 5 % sur un article" "PERMIS" "$ADMIN" "$(UPS ventes zrl1 "{\"id\":\"zrl1\",\"boutique\":\"APESSITO\",\"remise_pct\":0,\"articles\":$L5}")"
essai "★ un vendeur cumule 3 % sur un article ET 2 % de remise générale" "REFUSE" "$VENDEUR" "$(UPS ventes zrl1 "{\"id\":\"zrl1\",\"boutique\":\"APESSITO\",\"remise_pct\":2,\"remise\":4000,\"articles\":$L3}")"
essai "★ l'ADMIN aussi : remise sur un article ET remise générale, jamais (l'une ou l'autre)" "REFUSE" "$ADMIN" "$(UPS ventes zrl1 "{\"id\":\"zrl1\",\"boutique\":\"APESSITO\",\"remise_pct\":2,\"remise\":4000,\"articles\":$L3}")"
essai "★ …remise générale en francs seulement (remise 4 000, pct 0) avec une remise de ligne" "REFUSE" "$ADMIN" "$(UPS ventes zrl1 "{\"id\":\"zrl1\",\"boutique\":\"APESSITO\",\"remise_pct\":0,\"remise\":4000,\"articles\":$L3}")"
essai "un vendeur vend avec 2 % de remise générale et aucune remise de ligne (le quotidien passe)" "PERMIS" "$VENDEUR" "$(UPS ventes zrl1 "{\"id\":\"zrl1\",\"boutique\":\"APESSITO\",\"remise_pct\":2,\"remise\":2000,\"articles\":$L0}")"
essai "★ un vendeur touche une vente à 5 % de ligne accordée par l'admin, SANS toucher aux lignes ni à la remise (par upsert)" "PERMIS" "$VENDEUR" "$(UPS ventes zrl0 "{\"id\":\"zrl0\",\"boutique\":\"APESSITO\",\"remise_pct\":0,\"articles\":$L5,\"note\":\"livrée\"}")"
essai "★ un vendeur émet un proforma avec 5 % sur un article" "REFUSE" "$VENDEUR" "$(UPS proformas zpl1 "{\"id\":\"zpl1\",\"remise_pct\":0,\"lignes\":$L5}")"
essai "★ un vendeur émet un proforma avec 3 % sur un article" "PERMIS" "$VENDEUR" "$(UPS proformas zpl1 "{\"id\":\"zpl1\",\"remise_pct\":0,\"lignes\":$L3}")"
essai "★ l'admin émet un proforma avec 3 % sur un article ET 2 % de remise générale" "REFUSE" "$ADMIN" "$(UPS proformas zpl1 "{\"id\":\"zpl1\",\"remise_pct\":2,\"remise_montant\":4000,\"lignes\":$L3}")"
essai "l'admin émet un proforma avec 5 % sur un article" "PERMIS" "$ADMIN" "$(UPS proformas zpl1 "{\"id\":\"zpl1\",\"remise_pct\":0,\"lignes\":$L5}")"
essai "★ l'ancien verrou tient : un vendeur émet un proforma à 5 % de remise générale" "REFUSE" "$VENDEUR" "$(UPS proformas zpl2 "{\"id\":\"zpl2\",\"remise_pct\":5,\"lignes\":$L0}")"

echo
echo "── L'UPSERT N'EST PAS UNE CRÉATION (securite-8, capture Timo du 08/09/2026) ──"
$P -c "insert into public.ventes (id, data) values ('zv5', '{\"id\":\"zv5\",\"boutique\":\"APESSITO\",\"client\":\"AMA\",\"remise_pct\":5}');
insert into public.proformas (id, data) values ('zpf5', '{\"id\":\"zpf5\",\"remise_pct\":5}') on conflict (id) do nothing;" >/dev/null
essai "★ le comptable pointe un décaissement PAR UPSERT (comme l'application)" "PERMIS" "$COMPTABLE" "$(UPS depenses zx1 '{"id":"zx1","boutique":"APESSITO","montant":10000,"libelle":"Carburant","decaisse_le":"2026-09-08","decaisse_par":"MARIE"}')"
essai "★ le comptable modifie le montant par upsert" "REFUSE" "$COMPTABLE" "$(UPS depenses zx1 '{"id":"zx1","boutique":"APESSITO","montant":99,"libelle":"Carburant","decaisse_le":"2026-09-08","decaisse_par":"MARIE"}')"
essai "★ le comptable crée une dépense par upsert (ligne vraiment nouvelle)" "REFUSE" "$COMPTABLE" "$(UPS depenses zx9 '{"id":"zx9","boutique":"APESSITO","montant":1}')"
essai "★ un vendeur annule un pointage par upsert" "REFUSE" "$VENDEUR" "$(UPS depenses zx2 '{"id":"zx2","boutique":"Chez le comptable","montant":20000,"libelle":"Remis"}')"
essai "★ un vendeur touche une vente à 5 % accordée par l'admin, SANS changer la remise, par upsert" "PERMIS" "$VENDEUR" "$(UPS ventes zv5 '{"id":"zv5","boutique":"APESSITO","client":"AMA","remise_pct":5,"note":"livrée"}')"
essai "★ un vendeur porte la remise de 0 à 5 % par upsert" "REFUSE" "$VENDEUR" "$(UPS ventes zv1 '{"id":"zv1","boutique":"APESSITO","client":"AMA","remise_pct":5}')"
essai "★ un vendeur crée une vente à 5 % par upsert (ligne vraiment nouvelle)" "REFUSE" "$VENDEUR" "$(UPS ventes zv8 '{"id":"zv8","boutique":"APESSITO","remise_pct":5}')"
essai "★ un vendeur touche un proforma à 5 % sans changer la remise, par upsert" "PERMIS" "$VENDEUR" "$(UPS proformas zpf5 '{"id":"zpf5","remise_pct":5,"note":"x"}')"
essai "★ un vendeur crée un proforma à 5 % par upsert (ligne vraiment nouvelle)" "REFUSE" "$VENDEUR" "$(UPS proformas zpf8 '{"id":"zpf8","remise_pct":5}')"

echo
echo "── L'ÉDITEUR SQL (jeton vide) n'est jamais gêné ──"
essai "l'éditeur SQL supprime une vente" "PERMIS" "$ADMIN" "set local request.jwt.claims = ''; set local role postgres; $(SUPPR ventes zv1)"

echo
if [ $ko -eq 0 ]; then echo "✅  $ok vérification(s) passée(s), 0 en échec."; exit 0;
else echo "❌  $ko vérification(s) EN ÉCHEC sur $((ok+ko))."; exit 1; fi
