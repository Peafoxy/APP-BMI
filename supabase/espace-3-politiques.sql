-- ============================================================
-- CLOISONNEMENT FORMATION / RÉEL — ÉTAPE 3 : LES POLITIQUES
-- ============================================================
--
-- ⚠⚠ EN CAS DE PROBLÈME, TOUT ANNULER EN 5 SECONDES ⚠⚠
-- Copiez ce bloc dans Supabase → SQL Editor → Run. Il ne supprime QUE ce
-- que ce fichier a créé : la configuration précédente redevient
-- immédiatement la seule en vigueur, exactement comme avant.
--
--   do $$
--   declare t text;
--   begin
--     foreach t in array array[
--       'ventes','depenses','dettes','produits','ajustements','clotures',
--       'commandes','proformas','boutiques','prospects','clients_installes'
--     ]
--     loop
--       execute format('drop policy if exists "espace_cloisonnement" on public.%I;', t);
--     end loop;
--   end $$;
--
-- (Cette annulation fonctionne toujours, même depuis un téléphone : la clé
-- service_role du SQL Editor n'est jamais soumise aux politiques.)
--
-- ============================================================
-- CE QUE FAIT CE SCRIPT
-- ============================================================
-- Il n'écrase AUCUNE politique existante. Il en AJOUTE une, dite
-- « restrictive », par table concernée.
--
-- La différence est capitale. Dans PostgreSQL :
--   • les politiques normales (permissives) s'additionnent : elles
--     ouvrent des accès, et c'est pour ça que les remplacer est risqué —
--     une erreur et plus personne ne passe ;
--   • une politique RESTRICTIVE se combine en ET avec les autres : elle
--     ne fait que RETRANCHER, sans jamais rien retirer de ce qui existe.
--
-- Conséquence : vos règles actuelles (« acces_authentifie_* » ou
-- « connecte_acces_complet ») ne sont ni lues, ni modifiées, ni
-- supprimées par ce script. Elles restent intactes en dessous. Retirer la
-- couche ajoutée ici suffit à revenir exactement à l'état d'aujourd'hui —
-- ce qui n'était PAS le cas de la précédente tentative de durcissement,
-- qui remplaçait les politiques et laissait les appareils sans accès.
--
-- ============================================================
-- PRÉREQUIS — À NE PAS SAUTER
-- ============================================================
--  1. espace-1-colonne.sql exécuté, et sa section VÉRIFICATION lue : pas
--     de lignes non classées inattendues.
--  2. api/sync-auth.js déployé sur Vercel avec la revendication d'espace.
--  3. TOUT LE MONDE s'est reconnecté au moins une fois DEPUIS ce
--     déploiement, avec du réseau. Vérifiez-le par la requête ci-dessous
--     AVANT de lancer ce script :
--
--       select u.email, u.raw_app_meta_data->>'espace' as espace,
--              u.last_sign_in_at
--       from auth.users u
--       order by u.raw_app_meta_data->>'espace' nulls first, u.email;
--
--     Un compte dont « espace » est vide n'est PAS bloqué pour autant :
--     il sera traité comme RÉEL (voir le coalesce plus bas). Le seul vrai
--     défaut serait un compte de formation encore sans revendication : il
--     continuerait de voir les vraies données jusqu'à sa reconnexion.
--
--  4. Choisissez un jour calme. Juste après, vérifiez sur un poste :
--     une connexion, une vente, une dépense, une clôture de caisse.
--
-- À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

-- ══════════════════════════════════════════════════════════════════
-- CONTRÔLE PRÉALABLE : la sécurité est-elle seulement active ?
-- ══════════════════════════════════════════════════════════════════
-- Une politique restrictive posée sur une table dont la sécurité (RLS)
-- n'est PAS activée ne s'applique jamais — on croirait être protégé sans
-- l'être. Ce bloc ne modifie rien : il prévient, tables à l'appui.
-- (Il n'active volontairement pas la sécurité lui-même : sur une table
-- qui n'aurait aucune politique permissive, l'activer bloquerait tout le
-- monde d'un coup. Lancez d'abord activer-rls.sql si besoin.)
do $$
declare
  t text;
  manquantes text[] := '{}';
begin
  foreach t in array array[
    'ventes', 'depenses', 'dettes', 'produits', 'ajustements', 'clotures',
    'commandes', 'proformas', 'boutiques', 'prospects', 'clients_installes'
  ]
  loop
    if not exists (
      select 1 from pg_tables
      where schemaname = 'public' and tablename = t and rowsecurity
    ) then
      manquantes := manquantes || t;
    end if;
  end loop;

  if array_length(manquantes, 1) > 0 then
    raise warning 'Sécurité (RLS) NON activée sur : %. Le cloisonnement ne s''y appliquera pas — lancez activer-rls.sql d''abord.', manquantes;
  else
    raise notice 'Sécurité (RLS) active sur les 11 tables concernées.';
  end if;
end $$;

-- ══════════════════════════════════════════════════════════════════
-- LA COUCHE DE CLOISONNEMENT
-- ══════════════════════════════════════════════════════════════════
-- Deux règles, et deux choix qui méritent d'être compris :
--
-- ┌ LECTURE (using) ─────────────────────────────────────────────────
-- │   espace is null  OU  espace = revendication
-- │
-- │ « espace is null » — une ligne que l'étape 1 n'a pas su classer
-- │ reste visible PAR TOUT LE MONDE. C'est délibéré, et c'est la
-- │ décision la plus importante de ce script : la synchronisation de
-- │ cette application fonctionne en MIROIR (reconcilierMiroir, dans
-- │ src/sync.js) — toute ligne que le serveur cesse de renvoyer est
-- │ effacée de la copie locale de l'appareil. Cacher une ligne à tort
-- │ ne se traduirait donc pas par « je ne la vois plus », mais par
-- │ « elle disparaît de mon appareil ». En cas de doute, on montre.
-- │ (Les données restent de toute façon intactes sur le serveur.)
-- └──────────────────────────────────────────────────────────────────
--
-- ┌ ÉCRITURE (with check) ───────────────────────────────────────────
-- │ On recalcule l'espace depuis « data » plutôt que de lire la
-- │ colonne. La colonne est posée par un déclencheur BEFORE INSERT :
-- │ s'appuyer dessus reviendrait à dépendre de l'ordre exact entre ce
-- │ déclencheur et la vérification. En repartant de « data », le
-- │ résultat est le même dans tous les cas de figure.
-- └──────────────────────────────────────────────────────────────────
--
-- ┌ LA REVENDICATION ────────────────────────────────────────────────
-- │   coalesce(auth.jwt() -> 'app_metadata' ->> 'espace', 'reel')
-- │
-- │ Le « coalesce » vers 'reel' est le garde-fou : une session sans
-- │ revendication (jeton antérieur au déploiement, compte pas encore
-- │ reconnecté) est traitée comme RÉELLE. Sans lui, elle ne verrait
-- │ plus rien du tout — et le miroir viderait l'appareil.
-- │ Le seul risque résiduel est donc « pas encore cloisonné », jamais
-- │ « bloqué ».
-- └──────────────────────────────────────────────────────────────────
do $$
declare
  t text;
  revendication constant text := 'coalesce(auth.jwt() -> ''app_metadata'' ->> ''espace'', ''reel'')';
begin
  foreach t in array array[
    'ventes', 'depenses', 'dettes', 'produits', 'ajustements', 'clotures',
    'commandes', 'proformas', 'boutiques', 'prospects', 'clients_installes'
  ]
  loop
    -- Relancer ce script est sans danger : on repart d'une couche propre.
    execute format('drop policy if exists "espace_cloisonnement" on public.%I;', t);

    execute format(
      'create policy "espace_cloisonnement" on public.%I '
      'as restrictive for all to authenticated '
      'using (espace is null or espace = %s) '
      'with check ('
      '  public.espace_de_ligne(%L, data) is null'
      '  or public.espace_de_ligne(%L, data) = %s'
      ');',
      t, revendication, t, t, revendication
    );
  end loop;
  raise notice 'Cloisonnement posé sur 11 tables. Pour tout annuler : voir le bloc en tête de ce fichier.';
end $$;

-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS EXÉCUTION
-- ══════════════════════════════════════════════════════════════════
-- 1. Les politiques ajoutées, et surtout celles qui étaient déjà là —
--    elles doivent TOUTES être encore présentes :
--
--      select tablename, policyname, permissive, cmd
--      from pg_policies
--      where schemaname = 'public'
--        and tablename in ('ventes','depenses','dettes','produits','ajustements',
--                          'clotures','commandes','proformas','boutiques',
--                          'prospects','clients_installes')
--      order by tablename, permissive desc, policyname;
--
--    « permissive = PERMISSIVE » : vos règles d'origine, intactes.
--    « permissive = RESTRICTIVE » : la couche ajoutée ici.
--
-- 2. Sur un poste, avec un compte RÉEL : la liste des ventes, une
--    nouvelle vente, une dépense, une clôture de caisse.
-- 3. Sur un poste, avec un compte de FORMATION : il ne doit plus voir
--    aucune vraie boutique, et son propre travail doit fonctionner.
--
-- Si quoi que ce soit coince : le bloc d'annulation en tête de fichier.
-- Il rend la main immédiatement, sans perte de données — aucune donnée
-- n'est modifiée par ce script, seulement leur visibilité.
