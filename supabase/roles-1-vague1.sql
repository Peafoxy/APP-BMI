-- ============================================================
-- DROITS PAR RÔLE CÔTÉ SERVEUR — VAGUE 1
-- ============================================================
--
-- LE PROBLÈME (faille n° 3 de l'audit général)
--
-- Jusqu'ici le serveur ne vérifiait qu'une chose : « cette personne est-elle
-- connectée ? ». Ni son rôle, ni ses droits. Donc n'importe lequel des
-- comptes — y compris un compte CLIENT — pouvait, en utilisant simplement
-- ses identifiants EN DEHORS de l'application :
--   • effacer toutes les ventes, tout le stock, toute la caisse ;
--   • se nommer ADMINISTRATEUR en modifiant sa propre fiche, puis se
--     reconnecter dans l'application avec tous les pouvoirs.
-- L'application bloquait tout cela correctement. Mais l'application n'est
-- qu'un écran : le serveur, lui, acceptait.
--
-- CE QUE FAIT CETTE VAGUE 1 — trois barrières, aucune ne peut rien casser :
--
--   1. Un CLIENT ne touche plus aux 7 tables qui ne le concernent pas.
--      Vérifié dans son écran (EspaceClient.jsx) : il ne les lit ni ne les
--      écrit jamais.
--   2. Les comptes en LECTURE SEULE le sont vraiment. L'application les
--      traite déjà ainsi — le serveur ne fait que confirmer.
--   3. Plus AUCUNE escalade de privilège : personne ne peut se donner un
--      rôle, se déclarer administrateur principal ou s'ajouter des
--      pouvoirs. Seul un vrai administrateur peut toucher à cela.
--
-- CE QU'ELLE NE FAIT PAS ENCORE (vague 2) : empêcher un client de LIRE le
-- dossier d'un autre client. Cela demande de restreindre chaque ligne à son
-- propriétaire, ce qui est plus délicat — un client fait de vraies choses
-- (valider un devis, signer son PV) et une règle trop serrée le bloquerait
-- au pire moment.
--
-- MÉTHODE : comme pour le cloisonnement, ce sont des politiques
-- RESTRICTIVES. Elles se combinent en ET avec l'existant : elles ne font que
-- RETRANCHER, sans jamais supprimer ni modifier vos règles actuelles.
--
-- ⚠ ORDRE À RESPECTER :
--   1. Déployez la version >= 2.100.43 de l'application.
--   2. Lancez CE script.
--   3. Chacun se déconnecte puis se reconnecte : les revendications de rôle
--      ne sont écrites qu'à la connexion. Tant que quelqu'un ne s'est pas
--      reconnecté, il est traité comme AVANT — jamais bloqué.
--
-- ⚠⚠ POUR TOUT ANNULER EN 5 SECONDES — copiez ce bloc SANS les tirets :
--
--   do $$
--   declare t text;
--   begin
--     foreach t in array array[
--       'depenses','ajustements','clotures','fournisseurs','commerciaux',
--       'proformas','groupes'
--     ] loop
--       execute format('drop policy if exists "role_client_interdit" on public.%I;', t);
--     end loop;
--     foreach t in array array[
--       'ventes','depenses','dettes','produits','ajustements','clotures',
--       'commandes','proformas','boutiques','prospects','clients_installes',
--       'fournisseurs','commerciaux','groupes','users'
--     ] loop
--       execute format('drop policy if exists "role_lecture_seule" on public.%I;', t);
--       execute format('drop policy if exists "role_lecture_seule_maj" on public.%I;', t);
--       execute format('drop policy if exists "role_lecture_seule_suppr" on public.%I;', t);
--     end loop;
--     drop trigger if exists interdire_escalade on public.users;
--     drop function if exists public.interdire_escalade();
--   end $$;
--
-- À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================


-- ══════════════════════════════════════════════════════════════════
-- 1. UN CLIENT NE TOUCHE PAS AUX TABLES QUI NE LE REGARDENT PAS
-- ══════════════════════════════════════════════════════════════════
-- Les tables où un compte client n'a RIEN à faire, ni en lecture ni en
-- écriture. Volontairement ABSENTES de cette liste, parce que son écran
-- s'en sert vraiment : ventes, produits, boutiques, commandes, dettes,
-- messages, users, clients_installes, prospects, categories_prospects.
-- Les y bloquer casserait la validation d'un devis ou la signature d'un PV.
do $$
declare
  t text;
  role_du_jeton constant text := 'coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''')';
begin
  foreach t in array array[
    'depenses', 'ajustements', 'clotures', 'fournisseurs', 'commerciaux',
    'proformas', 'groupes'
  ]
  loop
    execute format('drop policy if exists "role_client_interdit" on public.%I;', t);
    execute format(
      'create policy "role_client_interdit" on public.%I '
      'as restrictive for all to authenticated '
      'using (%s <> ''client'') with check (%s <> ''client'');',
      t, role_du_jeton, role_du_jeton
    );
  end loop;
  raise notice '1/3 — 7 tables désormais interdites aux comptes clients.';
end $$;


-- ══════════════════════════════════════════════════════════════════
-- 2. UN COMPTE EN LECTURE SEULE NE PEUT PLUS ÉCRIRE
-- ══════════════════════════════════════════════════════════════════
-- Le comptable (lecture seule par nature) et tout compte à qui
-- l'administrateur a retiré le pouvoir « ✏️ Créer / modifier / supprimer ».
-- L'application le leur interdit déjà : le serveur ne fait que confirmer.
--
-- ⚠ Le filet : une session sans la revendication (jeton d'avant le
-- déploiement, compte pas encore reconnecté) est considérée comme AYANT le
-- droit d'écrire. On ne bloque jamais quelqu'un par ignorance.
do $$
declare
  t text;
  peut_ecrire constant text := 'coalesce((auth.jwt() -> ''app_metadata'' ->> ''ecriture'')::boolean, true)';
begin
  foreach t in array array[
    'ventes', 'depenses', 'dettes', 'produits', 'ajustements', 'clotures',
    'commandes', 'proformas', 'boutiques', 'prospects', 'clients_installes',
    'fournisseurs', 'commerciaux', 'groupes', 'users'
  ]
  loop
    -- Relancer ce script est sans danger : on repart d'une couche propre.
    execute format('drop policy if exists "role_lecture_seule" on public.%I;', t);
    execute format('drop policy if exists "role_lecture_seule_maj" on public.%I;', t);
    execute format('drop policy if exists "role_lecture_seule_suppr" on public.%I;', t);
    -- for insert / update / delete uniquement : la LECTURE reste entière.
    execute format(
      'create policy "role_lecture_seule" on public.%I '
      'as restrictive for insert to authenticated with check (%s);', t, peut_ecrire);
    -- ⚠ MODIFICATION : la condition est mise dans `with check`, PAS dans
    -- `using`. C'est capital, et le banc d'essai l'a montré : avec `using`,
    -- PostgreSQL se contente de ne trouver aucune ligne — la modification
    -- « réussit » en ne touchant rien. L'application croirait alors avoir
    -- enregistré, viderait sa file d'attente, et la modification serait
    -- perdue en silence. Avec `with check`, le serveur refuse franchement
    -- (erreur 42501) : l'application le voit et le dit.
    execute format(
      'create policy "role_lecture_seule_maj" on public.%I '
      'as restrictive for update to authenticated using (true) with check (%s);', t, peut_ecrire);
    -- SUPPRESSION : `using` est la seule voie possible (une suppression n'a
    -- pas de « nouvelle ligne » à vérifier). Le refus est donc silencieux :
    -- la ligne reste simplement sur le serveur. Le sens est le bon — on
    -- CONSERVE au lieu de perdre — et l'application interdit déjà le geste.
    execute format(
      'create policy "role_lecture_seule_suppr" on public.%I '
      'as restrictive for delete to authenticated using (%s);', t, peut_ecrire);
  end loop;
  raise notice '2/3 — les comptes en lecture seule ne peuvent plus écrire.';
end $$;


-- ══════════════════════════════════════════════════════════════════
-- 3. PLUS AUCUNE ESCALADE DE PRIVILÈGE
-- ══════════════════════════════════════════════════════════════════
-- C'est le trou le plus grave : un client pouvait modifier sa propre fiche
-- pour s'attribuer le rôle « admin », puis se reconnecter avec tous les
-- pouvoirs. Une politique RLS ne peut pas comparer l'ancienne et la
-- nouvelle valeur d'une ligne — c'est le travail d'un déclencheur.
--
-- Il laisse passer : les administrateurs, et la clé service_role (utilisée
-- par api/sync-auth.js et par cet éditeur SQL — sinon vous ne pourriez plus
-- rien réparer vous-même).
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

drop trigger if exists interdire_escalade on public.users;
create trigger interdire_escalade
  before insert or update on public.users
  for each row execute function public.interdire_escalade();

do $$ begin raise notice '3/3 — escalade de privilege impossible.'; end $$;


-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — à lancer juste après
-- ══════════════════════════════════════════════════════════════════
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and policyname like 'role_%'
order by tablename, policyname;
