-- ============================================================
-- CORRECTIF URGENT — L'ADMINISTRATEUR PRINCIPAL ÉTAIT BLOQUÉ
-- SUR TROIS TABLES
-- ============================================================
--
-- POUR TIMO — CE QUI S'EST PASSÉ
--
-- Votre compte d'administrateur principal porte une autorisation spéciale,
-- « tous » : elle lui permet de travailler dans les DEUX espaces, réel et
-- formation. Les onze premières tables cloisonnées en tiennent compte
-- (c'est espace-4-admin-voit-tout.sql qui l'avait posée).
--
-- Les règles que j'ai écrites ensuite pour `fournisseurs`, `commerciaux`
-- (espace-5) et `audits` (securite-1) ont OUBLIÉ cette autorisation. Pour
-- ces trois tables, votre compte se voyait donc refuser ses propres
-- écritures — d'où les opérations bloquées dans la file d'envoi.
--
-- Rien n'est perdu : les opérations refusées attendent sur l'appareil et
-- repartiront toutes seules dès ce script exécuté.
--
-- CE QUE FAIT CE SCRIPT : il repose la règle de cloisonnement sur LES
-- QUATORZE tables d'un seul coup, avec la même formule pour toutes. Ainsi
-- aucune ne peut plus diverger des autres.
--
-- ⚠ Il n'ouvre RIEN de nouveau : c'est exactement la règle déjà en vigueur
-- sur les onze premières, étendue aux trois qui l'avaient perdue.
--
-- ⚠⚠ EN CAS DE PROBLÈME, TOUT ANNULER ⚠⚠
-- Copiez le bloc ci-dessous — SANS les tirets de début de ligne. Le
-- cloisonnement disparaît alors ENTIÈREMENT (l'application, elle, continue
-- de le faire respecter de son côté) :
--
--   do $$
--   declare t text;
--   begin
--     foreach t in array array[
--       'ventes','depenses','dettes','produits','ajustements','clotures',
--       'commandes','proformas','boutiques','prospects','clients_installes',
--       'fournisseurs','commerciaux','audits'
--     ] loop
--       execute format('drop policy if exists "espace_cloisonnement" on public.%I;', t);
--     end loop;
--   end $$;
--
-- ============================================================

do $$
declare
  t text;
  revendication constant text := 'coalesce(auth.jwt() -> ''app_metadata'' ->> ''espace'', ''reel'')';
  tables constant text[] := array[
    'ventes', 'depenses', 'dettes', 'produits', 'ajustements', 'clotures',
    'commandes', 'proformas', 'boutiques', 'prospects', 'clients_installes',
    'fournisseurs', 'commerciaux', 'audits'
  ];
begin
  foreach t in array tables
  loop
    execute format('drop policy if exists "espace_cloisonnement" on public.%I;', t);
    -- Formule IDENTIQUE pour les quatorze — c'est le fait d'en avoir écrit
    -- une variante ailleurs qui a créé le blocage.
    execute format(
      'create policy "espace_cloisonnement" on public.%I '
      'as restrictive for all to authenticated '
      'using (%s = ''tous'' or espace is null or espace = %s) '
      'with check ('
      '  %s = ''tous'''
      '  or public.espace_de_ligne(%L, data) is null'
      '  or public.espace_de_ligne(%L, data) = %s'
      ');',
      t, revendication, revendication, revendication, t, t, revendication
    );
  end loop;
  raise notice 'Cloisonnement repose a l''identique sur % tables.', array_length(tables, 1);
end $$;


-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — à lancer juste après
-- ══════════════════════════════════════════════════════════════════
-- Les deux colonnes doivent valoir 14 : autant de tables cloisonnées que de
-- tables où l'administrateur principal peut passer.
select
  count(*) as tables_cloisonnees,
  count(*) filter (where qual like '%tous%' and with_check like '%tous%') as dont_admin_principal_passe
from pg_policies
where schemaname = 'public' and policyname = 'espace_cloisonnement';
