-- ============================================================
-- COMPLÉMENT au garde-fou anti-escalade de roles-1-vague1.sql
-- ============================================================
-- ⚠ À LIRE D'ABORD : L'ESSENTIEL EST DÉJÀ EN PLACE.
--
-- `supabase/roles-1-vague1.sql` installe déjà le déclencheur
-- « interdire_escalade » sur public.users. Il empêche tout compte NON
-- administrateur — client comme employé — de changer son rôle, son drapeau
-- admin_principal, ses pouvoirs ou son espace formation/réel. Vérifié sur
-- une base d'essai : un client qui tente de se nommer administrateur
-- principal est refusé.
--
-- `supabase/paie-1-table.sql` fait de même sur les fiches de paie : un
-- employé ne peut ni s'augmenter, ni lire le salaire des autres.
--
-- ⚠ VÉRIFIEZ D'ABORD QUE CES DEUX SCRIPTS ONT BIEN ÉTÉ EXÉCUTÉS —
-- la requête de vérification est tout en bas de ce fichier. S'il manque
-- « interdire_escalade », c'est roles-1-vague1.sql qu'il faut coller,
-- AVANT celui-ci.
--
-- CE QUE CE SCRIPT-CI AJOUTE, ET RIEN DE PLUS — deux trous mesurés :
--
--   1. Un ADMINISTRATEUR peut modifier SA PROPRE fiche. Le déclencheur
--      existant laisse passer tout jeton portant le rôle « admin », sans
--      rien vérifier ensuite. Un administrateur secondaire peut donc se
--      donner « admin_principal ». Depuis le 28/08/2026, ce drapeau décide
--      seul de qui traverse le mur formation / réel : il ne doit plus
--      pouvoir être pris, seulement donné.
--
--   2. Le champ `actif` n'est surveillé par personne. Un employé qu'on
--      vient de bloquer garde son jeton de session jusqu'à son expiration :
--      il peut, pendant ce temps, se remettre `actif: true`.
--
-- RISQUE : faible. Ces deux champs ne se modifient, dans l'application,
-- que depuis 👥 Utilisateurs, par l'administrateur principal, sur la fiche
-- de QUELQU'UN D'AUTRE. Jamais sur la sienne.
--
-- RETOUR EN ARRIÈRE : deux lignes, tout en bas.
-- ============================================================


-- ══════════════════════════════════════════════════════════════════
-- LA VÉRIFICATION AJOUTÉE
-- ══════════════════════════════════════════════════════════════════
create or replace function public.refuser_elevation_de_soi()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  jetons jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  moi    text  := split_part(coalesce(jetons ->> 'email', ''), '@', 1);
  champ  text;
  surveilles constant text[] := array['role', 'admin_principal', 'droits_off', 'formation', 'actif'];
begin
  -- Hors de l'application : éditeur SQL, clé service_role (api/sync-auth.js,
  -- api/creer-filleul.js), migrations. Les bloquer vous empêcherait de
  -- réparer quoi que ce soit à la main — c'est la même voie de secours que
  -- celle de roles-1-vague1.sql, et pour la même raison.
  if jetons = '{}'::jsonb or coalesce(jetons ->> 'role', '') = 'service_role' then
    return new;
  end if;

  -- On ne s'occupe QUE de la fiche de celui qui écrit. Tout le reste est
  -- déjà traité par « interdire_escalade ».
  if new.id is distinct from moi then
    return new;
  end if;

  foreach champ in array surveilles loop
    if (old.data -> champ) is distinct from (new.data -> champ) then
      raise exception
        'Refusé : personne ne modifie les pouvoirs de sa propre fiche (champ « % »). Demandez à l''administrateur principal.', champ
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists refuser_elevation_de_soi_trg on public.users;
create trigger refuser_elevation_de_soi_trg
  before update on public.users
  for each row execute function public.refuser_elevation_de_soi();


-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — doit afficher les DEUX déclencheurs
-- ══════════════════════════════════════════════════════════════════
-- Si « interdire_escalade » manque, exécutez roles-1-vague1.sql : c'est LUI
-- qui porte l'essentiel de la protection.
select tgname as declencheur
from pg_trigger
where tgrelid = 'public.users'::regclass
  and tgname in ('interdire_escalade', 'refuser_elevation_de_soi_trg')
order by tgname;


-- ══════════════════════════════════════════════════════════════════
-- RETOUR EN ARRIÈRE (à ne coller QUE si quelque chose se bloque)
-- ══════════════════════════════════════════════════════════════════
-- drop trigger if exists refuser_elevation_de_soi_trg on public.users;
-- drop function if exists public.refuser_elevation_de_soi();
