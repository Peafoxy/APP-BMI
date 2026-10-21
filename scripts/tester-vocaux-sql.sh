#!/usr/bin/env bash
# ============================================================
# L'ESPACE PRIVÉ DES NOTES VOCALES — mesuré sur un PostgreSQL local jetable
# (supabase/vocaux-1-espace.sql, 21/10/2026)
#
#   bash scripts/tester-vocaux-sql.sh
#
# N'a AUCUN contact avec la base Supabase de BMI. L'espace de fichiers de
# Supabase (schéma « storage ») est reproduit dans sa forme : la table des
# espaces, la table des fichiers sous RLS, sans règle d'office.
# On regarde si la base a levé une objection, et ce que chaque rôle VOIT.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1 || true)
[ -n "$BIN" ] || { echo "PostgreSQL introuvable"; exit 1; }
export PATH="$PATH:$BIN"
D=$(mktemp -d /tmp/bmi-vocaux-XXXXXX); PORT=55498
nettoyer() { su postgres -c "$BIN/pg_ctl -D $D stop -m immediate" >/dev/null 2>&1 || true; rm -rf "$D"; }
trap nettoyer EXIT
chown postgres:postgres "$D"
su postgres -c "$BIN/initdb -D $D -U postgres -A trust" >/dev/null
su postgres -c "$BIN/pg_ctl -D $D -o '-p $PORT -k /tmp' -l $D/log start" >/dev/null
sleep 2
psql -h /tmp -p $PORT -U postgres -q -c "create database bmi;" >/dev/null
P="psql -h /tmp -p $PORT -U postgres -d bmi -v ON_ERROR_STOP=1 -tA"
psql -h /tmp -p $PORT -U postgres -d bmi -q -f supabase/test/fixture.sql >/dev/null
# L'espace de fichiers, dans la forme de Supabase.
$P -q >/dev/null <<'SQL'
create schema if not exists storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, created_at timestamptz default now());
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
-- Un espace du site vitrine, ouvert en lecture À LUI SEUL (le cas ordinaire).
insert into storage.buckets (id, name, public) values ('images', 'images', true);
create policy lecture_images on storage.objects for select to public using (bucket_id = 'images');
SQL

ok=0; ko=0
verdict() { if [ "$2" = "$3" ]; then echo "  ✓ $1"; ok=$((ok+1)); else echo "  ✗ $1 (obtenu : $2, attendu : $3)"; ko=$((ko+1)); fi; }

echo "▸ Le script se colle sans objection, deux fois, EN UN SEUL ENVOI (comme l'éditeur de Supabase)"
R=0; $P -c "$(cat supabase/vocaux-1-espace.sql)" >/dev/null 2>&1 || R=1
verdict "le script passe" "$R" "0"
VERIF=$($P -c "$(cat supabase/vocaux-1-espace.sql)" 2>/dev/null | tail -1)
verdict "le relancer est sans danger, et sa vérification répond true | true | true" "$VERIF" "t|t|t"
R=$(grep -ciE "^\s*rollback" supabase/vocaux-1-espace.sql || true)
verdict "aucun « rollback » dans le script (il défairait tout dans l'éditeur)" "$R" "0"

echo "▸ L'espace est privé, borné, réservé aux sons"
R=$($P -c "select public::text || '|' || file_size_limit || '|' || array_length(allowed_mime_types, 1) || '|' || ('audio/ogg' = any(allowed_mime_types))::text from storage.buckets where id='vocaux-wa';")
verdict "privé, 3 Mo, cinq types de son dont le .ogg" "$R" "false|3145728|5|true"
$P -q -c "update storage.buckets set public = true where id='vocaux-wa';" >/dev/null
$P -c "$(cat supabase/vocaux-1-espace.sql)" >/dev/null 2>&1
R=$($P -c "select public from storage.buckets where id='vocaux-wa';")
verdict "un espace rendu public par erreur redevient privé quand on relance" "$R" "f"

echo "▸ Les appareils n'y voient rien (seul le serveur y lit)"
$P -q -c "insert into storage.objects (bucket_id, name) values ('vocaux-wa', '2026-10-21/90112233_abcdefgh12.ogg'), ('images', 'logo.png');" >/dev/null
for role in anon authenticated; do
  R=$($P -c "set role $role; select count(*) from storage.objects where bucket_id='vocaux-wa';" 2>/dev/null | tail -1)
  verdict "le rôle $role ne voit aucune note vocale" "$R" "0"
  R=$($P -c "set role $role; select count(*) from storage.objects where bucket_id='images';" 2>/dev/null | tail -1)
  verdict "le rôle $role voit toujours les images du site (rien d'autre n'a bougé)" "$R" "1"
  R=0; $P -c "set role $role; insert into storage.objects (bucket_id, name) values ('vocaux-wa', 'x.ogg');" >/dev/null 2>&1 || R=1
  verdict "le rôle $role ne peut rien y déposer" "$R" "1"
done
R=$($P -c "set role service_role; select count(*) from storage.objects where bucket_id='vocaux-wa';" 2>/dev/null | tail -1)
verdict "le serveur (service_role) y lit la note" "$R" "1"

echo "▸ La vérification ne rassure pas à tort"
$P -q -c "create policy ouvre_tout on storage.objects for select to authenticated using (true);" >/dev/null
VERIF=$($P -c "$(cat supabase/vocaux-1-espace.sql)" 2>/dev/null | tail -1)
verdict "une règle qui vaut pour tous les espaces fait répondre false au 3e" "$VERIF" "t|t|f"
$P -q -c "drop policy ouvre_tout on storage.objects; create policy ouvre_vocaux on storage.objects for select to authenticated using (bucket_id = 'vocaux-wa');" >/dev/null
VERIF=$($P -c "$(cat supabase/vocaux-1-espace.sql)" 2>/dev/null | tail -1)
verdict "une règle qui nomme l'espace des vocaux fait répondre false au 2e" "$VERIF" "t|f|t"
$P -q -c "drop policy ouvre_vocaux on storage.objects;" >/dev/null

echo "▸ Il ne touche à rien d'autre"
R=$(grep -ciE "from public\.|update public\.|delete |drop " supabase/vocaux-1-espace.sql || true)
verdict "le script ne lit ni n'écrit aucune table de BMI, ne supprime rien" "$R" "0"

echo
echo "Résultat : $ok ✓, $ko ✗"
[ "$ko" -eq 0 ]
