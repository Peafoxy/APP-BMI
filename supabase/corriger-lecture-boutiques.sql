-- ============================================================
-- CORRECTIF — lecture publique de "boutiques" (amorçage d'un appareil neuf)
-- ============================================================
-- Même problème que celui déjà réglé pour "users" (voir
-- corriger-lecture-users.sql) : un appareil qui vient d'être vidé (ou tout
-- neuf) affiche l'écran de connexion AVANT même de pouvoir s'authentifier.
-- Or c'est la table "boutiques" qui porte la personnalisation de cet écran
-- (couleur du badge, texte d'accueil, image, fond) — sans lecture publique,
-- ces réglages restent aux valeurs par défaut jusqu'à la toute première
-- connexion réussie de l'appareil.
--
-- Ce script AJOUTE une politique de lecture publique sur "boutiques"
-- (n'importe qui peut lire cette table), EN PLUS de la politique
-- existante — il ne retire rien. Le contenu de cette table (noms,
-- couleurs, textes d'accueil) n'est pas sensible ; aucune donnée
-- financière ou personnelle n'y figure. Écriture (création, modification)
-- reste réservée aux connectés, comme avant.
--
-- À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

DROP POLICY IF EXISTS "lecture_publique_boutiques" ON public.boutiques;

CREATE POLICY "lecture_publique_boutiques" ON public.boutiques
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================================
-- VÉRIFICATION APRÈS EXÉCUTION
-- ============================================================
-- select policyname, roles, cmd from pg_policies where tablename = 'boutiques';
-- Doit maintenant lister DEUX politiques : "connecte_acces_complet"
-- (authenticated, ALL) et "lecture_publique_boutiques" (anon+authenticated, SELECT).

-- ============================================================
-- POUR ANNULER (si besoin)
-- ============================================================
-- DROP POLICY IF EXISTS "lecture_publique_boutiques" ON public.boutiques;
