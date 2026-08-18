-- ============================================================
-- CLOISONNEMENT FORMATION / RÉEL — VAGUE 2, PRÊTE À LANCER
-- ============================================================
--
-- POUR TIMO : ce fichier est le MÊME que espace-3-politiques.sql, avec la
-- ligne « vague » déjà réglée sur 2. Vous n'avez RIEN à modifier.
-- Copiez tout, collez dans Supabase → SQL Editor → Run.
--
-- CE QU'IL FAIT : il étend le cloisonnement des 3 tables actuelles
-- (proformas, prospects, commandes) aux 11 tables, comptabilité et stock
-- compris.
--
-- PRÉREQUIS : espace-1-colonne.sql doit avoir été lancé (c'est fait).
--
-- ⚠⚠ EN CAS DE PROBLÈME, TOUT ANNULER EN 5 SECONDES ⚠⚠
-- Copiez le bloc ci-dessous — SANS les tirets de début de ligne — dans
-- SQL Editor → Run. Il ne supprime QUE ce que ce fichier a créé : la
-- configuration précédente redevient immédiatement la seule en vigueur.
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
-- du SQL Editor n'est jamais soumise aux politiques.)
--
-- RAPPEL SUR LA MÉTHODE : ce script n'écrase AUCUNE politique existante.
-- Il en AJOUTE une, dite « restrictive ». Dans PostgreSQL une politique
-- restrictive se combine en ET avec les autres : elle ne fait que
-- RETRANCHER, sans jamais rien retirer de ce qui existe. Vos règles
-- actuelles restent intactes en dessous.
--
-- LE FILET DE SÉCURITÉ : une session sans revendication d'espace (jeton
-- ancien, compte pas encore reconnecté) est traitée comme RÉELLE. Sans
-- lui, elle ne verrait plus rien du tout. Le seul risque résiduel est donc
-- « pas encore cloisonné », jamais « bloqué ».
-- ============================================================

do $$
declare
  vague constant int := 2;   -- ← déjà réglé, ne touchez à rien
  t text;
  tables text[];
  revendication constant text := 'coalesce(auth.jwt() -> ''app_metadata'' ->> ''espace'', ''reel'')';
begin
  tables := case when vague = 1
    then array['proformas', 'prospects', 'commandes']
    else array['ventes', 'depenses', 'dettes', 'produits', 'ajustements', 'clotures',
               'commandes', 'proformas', 'boutiques', 'prospects', 'clients_installes']
  end;

  foreach t in array tables
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
  raise notice 'Vague % : cloisonnement posé sur % table(s) — %.', vague, array_length(tables, 1), array_to_string(tables, ', ');
  raise notice 'Pour tout annuler immédiatement : le bloc en tête de ce fichier.';
end $$;

-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — à lancer juste après
-- ══════════════════════════════════════════════════════════════════
-- Doit renvoyer 11 lignes.
select tablename from pg_policies
where schemaname = 'public' and policyname = 'espace_cloisonnement'
order by tablename;
