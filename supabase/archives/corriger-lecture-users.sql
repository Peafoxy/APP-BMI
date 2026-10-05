-- ============================================================
-- CORRECTIF — lecture publique de "users" (amorçage d'un appareil neuf)
-- ============================================================
-- activer-rls.sql avait mis "users" sous la même règle que toutes les
-- autres tables (connecté uniquement). Erreur : un appareil qui vient
-- d'être vidé (ou tout nouveau) a besoin de lire la liste des comptes
-- AVANT même de pouvoir se connecter — sinon il ne peut identifier
-- personne, et retombe sur un compte de secours local, sans jamais
-- établir de vraie session.
--
-- Ce script AJOUTE une politique de lecture publique sur "users"
-- (n'importe qui peut lire cette table), EN PLUS de la politique
-- existante — il ne retire rien. Le contenu de cette table (noms,
-- rôles) n'est pas plus sensible qu'un annuaire interne ; les mots de
-- passe y sont de toute façon hachés, jamais en clair. Écriture
-- (création, modification) reste réservée aux connectés, comme avant.
--
-- À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

DROP POLICY IF EXISTS "lecture_publique_users" ON public.users;

CREATE POLICY "lecture_publique_users" ON public.users
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================================
-- VÉRIFICATION APRÈS EXÉCUTION
-- ============================================================
-- select policyname, roles, cmd from pg_policies where tablename = 'users';
-- Doit maintenant lister DEUX politiques : "connecte_acces_complet"
-- (authenticated, ALL) et "lecture_publique_users" (anon+authenticated, SELECT).

-- ============================================================
-- POUR ANNULER (si besoin)
-- ============================================================
-- DROP POLICY IF EXISTS "lecture_publique_users" ON public.users;
