-- ============================================================
-- CORRECTIF URGENT — vague 1 : les employés ne pouvaient plus écrire
-- sur leur propre fiche (signature, tâches, mot de passe…)
-- ============================================================
--
-- LE DÉFAUT (signalé par Timo, capture du compte ANGELF, 18/08/2026)
--
-- L'application synchronise par « UPSERT » : créer-ou-mettre-à-jour en un
-- seul geste. PostgreSQL déclenche le contrôle de CRÉATION même quand la
-- ligne existe déjà et que l'écriture n'est qu'une mise à jour. Le
-- déclencheur anti-escalade posé par roles-1-vague1.sql refusait donc
-- CHAQUE écriture d'un employé sur sa propre fiche :
--     « Creation d'un compte vendeur refusee : reservee aux administrateurs »
-- L'opération restait bloquée dans la file d'attente de l'appareil.
--
-- QUI ÉTAIT TOUCHÉ : tous les rôles SAUF administrateur et client —
-- vendeur, gérant, magasinier, commercial, technicien, technicien BMI,
-- responsable commercial. Pour : enregistrer sa signature, terminer une
-- tâche, changer son mot de passe, confirmer un virement…
--
-- LE CORRECTIF : une ligne qui existe déjà n'est pas une création — le
-- contrôle de création ne s'applique plus qu'aux lignes NOUVELLES. Les
-- protections restent entières : les comparaisons champ à champ (rôle,
-- pouvoirs, espace, admin principal) continuent de s'appliquer à toute
-- mise à jour, y compris par upsert — vérifié sur base jetable.
--
-- À exécuter dans Supabase → SQL Editor → coller → Run.
-- Les opérations bloquées repartiront TOUTES SEULES dans la minute
-- (l'application réessaie toutes les 20 secondes) — aucune reconnexion
-- nécessaire.
-- ============================================================

create or replace function public.interdire_escalade()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_jeton text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  appelant   text := coalesce(auth.jwt() ->> 'role', '');
begin
  -- ⚠ VOIE DE SECOURS — défaut trouvé par le banc d'essai, et c'était le
  -- pire possible : le déclencheur bloquait l'ÉDITEUR SQL lui-même. Plus
  -- personne n'aurait pu réparer quoi que ce soit à la main, y compris
  -- retirer ce déclencheur.
  -- Une connexion DIRECTE à la base (éditeur SQL de Supabase, clé de
  -- service, tâche de fond) n'a aucune revendication : auth.jwt() y vaut
  -- NULL, ou l'objet vide selon la version. On laisse passer dans les deux
  -- cas. Ce n'est pas une faille : PostgREST attache TOUJOURS des
  -- revendications aux requêtes venant de l'application, même anonymes —
  -- l'absence totale de jeton signifie donc « on est déjà dans la base ».
  if appelant = 'service_role'
     or auth.jwt() is null
     or auth.jwt() = '{}'::jsonb
     or role_jeton = 'admin' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- ⚠ CORRECTIF (2.100.61, signalé par Timo — capture ANGELF) :
    -- l'application synchronise par UPSERT (« insert … on conflict update »).
    -- PostgreSQL déclenche AVANT INSERT même quand la ligne existe déjà et
    -- que l'écriture deviendra une simple mise à jour. Ce contrôle de
    -- création s'appliquait donc à CHAQUE écriture d'un employé sur sa
    -- propre fiche — signature, tâches, mot de passe — et la refusait :
    -- « Creation d'un compte vendeur refusee ». Tous les rôles étaient
    -- touchés SAUF admin et client.
    -- Une ligne qui existe déjà n'est pas une création : on laisse passer,
    -- et le déclencheur BEFORE UPDATE (branche ci-dessous) fera, lui, les
    -- comparaisons champ à champ sur le chemin « on conflict ».
    if exists (select 1 from public.users u where u.id = new.id) then
      return new;
    end if;
    -- Créer un compte CLIENT reste permis (un client peut en parrainer un
    -- autre). Créer un compte d'un autre rôle : réservé aux administrateurs.
    if coalesce(new.data ->> 'role', 'client') <> 'client' then
      raise exception 'Creation d''un compte % refusee : reservee aux administrateurs.',
        new.data ->> 'role' using errcode = '42501';
    end if;
    if coalesce((new.data ->> 'admin_principal')::boolean, false) then
      raise exception 'Impossible de se declarer administrateur principal.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- MODIFICATION : les trois champs de pouvoir ne doivent pas bouger.
  if coalesce(new.data ->> 'role', '') is distinct from coalesce(old.data ->> 'role', '') then
    raise exception 'Changement de role refuse : reserve aux administrateurs.' using errcode = '42501';
  end if;
  if coalesce((new.data ->> 'admin_principal')::boolean, false)
     is distinct from coalesce((old.data ->> 'admin_principal')::boolean, false) then
    raise exception 'Changement d''administrateur principal refuse.' using errcode = '42501';
  end if;
  if coalesce(new.data -> 'droits_off', '[]'::jsonb)
     is distinct from coalesce(old.data -> 'droits_off', '[]'::jsonb) then
    raise exception 'Changement des pouvoirs refuse : reserve aux administrateurs.' using errcode = '42501';
  end if;
  -- Le drapeau formation décide de l'espace : le laisser modifiable par
  -- n'importe qui reviendrait à contourner le cloisonnement.
  if coalesce((new.data ->> 'formation')::boolean, false)
     is distinct from coalesce((old.data ->> 'formation')::boolean, false) then
    raise exception 'Changement d''espace (formation/reel) refuse : reserve aux administrateurs.' using errcode = '42501';
  end if;

  return new;
end;
$$;

do $$ begin raise notice 'Correctif applique — les ecritures bloquees repartiront d''elles-memes.'; end $$;
