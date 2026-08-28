#!/usr/bin/env bash
# ============================================================
# Rejoue supabase/client-1-fermer-annuaire.sql sur un PostgreSQL local
# jetable reproduisant Supabase.
#
#   bash scripts/tester-client-annuaire-sql.sh
#
# N'a AUCUN contact avec la base Supabase de BMI.
#
# Ce qu'on vérifie n'est pas « le script passe » mais les deux choses qui
# comptent vraiment :
#   1. un client ne voit plus l'annuaire ;
#   2. son espace continue de fonctionner — sa fiche, ses devis, ses
#      filleuls, ses messages. Une fermeture qui casse son espace est une
#      panne, pas une sécurité.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable"; exit 1; }
export PATH="$PATH:$BIN"
D=$(mktemp -d /tmp/bmi-cli-XXXXXX); PORT=55483
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
$P -c "
create table if not exists public.messages (id text primary key, data jsonb, updated_at timestamptz default now());
create table if not exists public.prospects (id text primary key, data jsonb, updated_at timestamptz default now());
create table if not exists public.audits (id text primary key, data jsonb, updated_at timestamptz default now());
create table if not exists public.categories_prospects (id text primary key, data jsonb, updated_at timestamptz default now());
alter table public.messages enable row level security;
alter table public.prospects enable row level security;
alter table public.audits enable row level security;
alter table public.categories_prospects enable row level security;
grant select, insert, update, delete on public.messages, public.prospects, public.audits, public.categories_prospects to authenticated;
do \$\$ begin
  execute 'create policy \"ouvert_messages\" on public.messages for all to authenticated using (true) with check (true)';
  execute 'create policy \"ouvert_prospects\" on public.prospects for all to authenticated using (true) with check (true)';
  execute 'create policy \"ouvert_audits\" on public.audits for all to authenticated using (true) with check (true)';
  execute 'create policy \"ouvert_cat\" on public.categories_prospects for all to authenticated using (true) with check (true)';
end \$\$;
-- Deux clients, un employe, un filleul du premier client.
insert into public.users (id, data) values
  ('cli1', '{\"nom\":\"KOFFI\",\"role\":\"client\",\"tel\":\"90112233\",\"devis\":[{\"id\":\"d1\",\"total\":1200000}]}'),
  ('cli2', '{\"nom\":\"AMA\",\"role\":\"client\",\"tel\":\"91445566\",\"mdp_auto\":true,\"nom_base\":\"AMA\"}'),
  ('fill1','{\"nom\":\"YAO\",\"role\":\"client\",\"parrain_client_id\":\"cli1\"}'),
  ('emp1', '{\"nom\":\"VENDEUR\",\"role\":\"vendeur\",\"tel\":\"70000000\"}')
on conflict (id) do update set data = excluded.data;
insert into public.messages (id, data) values
  ('m_pour_cli1','{\"a_id\":\"cli1\",\"de_id\":\"emp1\",\"texte\":\"bonjour\"}'),
  ('m_de_cli1','{\"a_id\":\"emp1\",\"de_id\":\"cli1\",\"texte\":\"merci\"}'),
  ('m_autre','{\"a_id\":\"cli2\",\"de_id\":\"emp1\",\"texte\":\"prive\"}')
on conflict (id) do nothing;
insert into public.prospects (id, data) values
  ('p_cli1','{\"nom\":\"KOFFI\",\"client_user_id\":\"cli1\"}'),
  ('p_filleul','{\"nom\":\"YAO\",\"parrain_user_id\":\"cli1\"}'),
  ('p_autre','{\"nom\":\"INCONNU\"}')
on conflict (id) do nothing;
insert into public.audits (id, data) values ('a1','{\"action\":\"vente 500000\"}') on conflict (id) do nothing;
insert into public.categories_prospects (id, data) values ('k1','{\"nom\":\"Particulier\"}') on conflict (id) do nothing;
" >/dev/null

echo "▸ Application de client-1-fermer-annuaire.sql"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/client-1-fermer-annuaire.sql >/dev/null

ok=0; ko=0
CLI1='{"email":"cli1@bmi.internal","app_metadata":{"role":"client","espace":"reel"}}'
CLI2='{"email":"cli2@bmi.internal","app_metadata":{"role":"client","espace":"reel"}}'
EMP='{"email":"emp1@bmi.internal","app_metadata":{"role":"vendeur","espace":"reel"}}'
compte() {
  local desc="$1" claims="$2" sql="$3" attendu="$4" res
  res=$($P -c "set role authenticated; select set_config('request.jwt.claims', '$claims', true); $sql" 2>&1 | tail -1)
  if [ "$res" = "$attendu" ]; then ok=$((ok+1)); echo "  ✓ $desc"
  else ko=$((ko+1)); echo "  ✗ $desc — attendu $attendu, obtenu $res"; fi
}

echo
echo "▸ 1. L'annuaire est fermé"
compte "★ un client ne voit QUE sa fiche et celle de son filleul" "$CLI1" "select count(*) from public.users;" "2"
compte "★ il ne voit PAS l'autre client (dont il pourrait recalculer le mot de passe)" "$CLI1" "select count(*) from public.users where id='cli2';" "0"
compte "★ il ne voit PAS le personnel" "$CLI1" "select count(*) from public.users where id='emp1';" "0"
compte "un autre client ne voit que lui-même (aucun filleul)" "$CLI2" "select count(*) from public.users;" "1"
# ⚠ Un décompte en dur dépendrait du contenu de la base d'essai (qui porte
# déjà d'autres comptes) : on vérifie ce qui compte vraiment — l'employé voit
# les comptes que le client ne voit plus.
compte "un employé continue de voir les autres clients" "$EMP" "select count(*) from public.users where id in ('cli1','cli2','fill1','emp1');" "4"
compte "…et il en voit strictement plus que le client" "$EMP" \
  "select (select count(*) from public.users) > 2;" "t"

echo
echo "▸ 2. Son espace continue de marcher"
compte "★ il voit SA fiche" "$CLI1" "select count(*) from public.users where id='cli1';" "1"
compte "★ ses DEVIS sont dans sa fiche, donc toujours là" "$CLI1" "select jsonb_array_length(data->'devis') from public.users where id='cli1';" "1"
compte "★ il voit son FILLEUL (écran de parrainage)" "$CLI1" "select count(*) from public.users where id='fill1';" "1"
compte "il reçoit les messages qui lui sont adressés" "$CLI1" "select count(*) from public.messages where id='m_pour_cli1';" "1"
compte "…et retrouve ceux qu'il a envoyés" "$CLI1" "select count(*) from public.messages where id='m_de_cli1';" "1"
compte "★ mais PAS les messages destinés à un autre client" "$CLI1" "select count(*) from public.messages where id='m_autre';" "0"
compte "il voit sa fiche de prospect et celle de son filleul" "$CLI1" "select count(*) from public.prospects;" "2"
compte "★ mais pas les prospects qui ne le concernent pas" "$CLI1" "select count(*) from public.prospects where id='p_autre';" "0"

echo
echo "▸ 3. Ce qu'il ne doit jamais lire"
compte "★ le journal des opérations lui est fermé" "$CLI1" "select count(*) from public.audits;" "0"
compte "les catégories de prospects aussi" "$CLI1" "select count(*) from public.categories_prospects;" "0"
compte "l'employé garde le journal" "$EMP" "select count(*) from public.audits;" "1"

echo
echo "▸ 4. Écrire reste possible — fermer la lecture ne doit rien bloquer d'autre"
compte "un client peut toujours modifier SA fiche (mot de passe, devis)" "$CLI1" \
  "update public.users set data = data || '{\"maj\":1}'::jsonb where id='cli1'; select count(*) from public.users where id='cli1';" "1"

echo
echo "$([ $ko -eq 0 ] && echo '✅' || echo '❌')  $ok vérification(s) passée(s), $ko en échec."
exit $([ $ko -eq 0 ] && echo 0 || echo 1)
