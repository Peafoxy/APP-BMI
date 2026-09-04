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

MAJ() { echo "with x as (update public.$1 set data = $2 where id='$3' returning 1) select count(*) from x;"; }
SUPPR() { echo "with x as (delete from public.$1 where id='$2' returning 1) select count(*) from x;"; }
INS() { echo "with x as (insert into public.$1 (id, data) values ('$2', '$3') returning 1) select count(*) from x;"; }

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
essai "un vendeur clôture la caisse" "REFUSE" "$VENDEUR" "$(INS clotures zcl1 '{"id":"zcl1","boutique":"APESSITO","compte":1000}')"
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
echo "── L'ÉDITEUR SQL (jeton vide) n'est jamais gêné ──"
essai "l'éditeur SQL supprime une vente" "PERMIS" "$ADMIN" "set local request.jwt.claims = ''; set local role postgres; $(SUPPR ventes zv1)"

echo
if [ $ko -eq 0 ]; then echo "✅  $ok vérification(s) passée(s), 0 en échec."; exit 0;
else echo "❌  $ko vérification(s) EN ÉCHEC sur $((ok+ko))."; exit 1; fi
