-- ============================================================
-- SÉCURITÉ 35 — la fiche des boutiques n'est plus lisible sans connexion
-- ============================================================
-- Collé par Timo le 05/10/2026 (réponse : false | false).
--
-- POURQUOI : la règle « lecture_publique_boutiques » (août 2026) servait à
-- habiller l'écran de connexion d'un appareil neuf. Depuis, la fiche d'une
-- boutique porte le loyer (propriétaire, montant), le cachet BMI en image,
-- les numéros Flooz / Mixx, le registre de l'outillage : rien de cela ne
-- doit être lisible par un inconnu qui a la clé publique du site.
-- L'apparence de l'écran de connexion passe par api/apparence.js, qui ne
-- renvoie que l'habillage. Le site vitrine lit le stock par sa vue
-- catalogue_public et sa fonction stock_calcule, qui ne dépendent pas de
-- cette règle (vérifié dans le code du site le même jour).
-- ============================================================

-- 1. La réponse d'avant, pour mémoire
select has_table_privilege('anon', 'public.boutiques', 'select') as visiteur_lisait_avant;

-- 2. Fermer
drop policy if exists "lecture_publique_boutiques" on public.boutiques;
revoke select on public.boutiques from anon;

-- 3. Vérifier : les deux doivent répondre « false »
select
  has_table_privilege('anon', 'public.boutiques', 'select') as visiteur_peut_lire,
  exists (select 1 from pg_policies
          where schemaname = 'public' and tablename = 'boutiques'
            and policyname = 'lecture_publique_boutiques') as regle_encore_la;
