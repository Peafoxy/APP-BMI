-- ============================================================
-- ACTIVATION DE LA SÉCURITÉ (RLS) SUR SUPABASE — BMI Gestion
-- ============================================================
--
-- POURQUOI : sans RLS, la clé publique de l'app (visible dans le code
-- envoyé au navigateur) donne à N'IMPORTE QUI un accès en lecture ET
-- écriture à TOUTE la base, en contournant entièrement les rôles gérés
-- dans l'application. C'est le point le plus critique de l'audit de
-- sécurité (juillet 2026).
--
-- CE QUE FAIT CE SCRIPT (et rien de plus) :
-- Il exige simplement d'être connecté (authentifié via Supabase Auth,
-- ce que l'app fait déjà à chaque connexion) pour lire ou écrire quoi
-- que ce soit. Une fois connecté, le comportement reste EXACTEMENT le
-- même qu'aujourd'hui : tout employé connecté garde le même accès que
-- maintenant — les restrictions par rôle (qui voit quoi) continuent
-- d'être gérées par l'app, comme actuellement.
--
-- Ce choix est volontairement prudent : une politique "par rôle" plus
-- fine (un vendeur ne lit que sa boutique, etc.) serait plus stricte,
-- mais BEAUCOUP plus risquée à mettre en place d'un coup — une
-- tentative précédente de durcissement a dû être annulée. Ce script-ci
-- ne change qu'UNE seule chose : bloquer l'accès de quelqu'un qui n'est
-- PAS connecté. C'est la version la moins susceptible de casser quoi
-- que ce soit.
--
-- ⚠ AVANT D'EXÉCUTER CE SCRIPT EN PRODUCTION :
-- 1. Si possible, testez-le d'abord sur un projet Supabase de test
--    (ou un environnement de dev), pas directement sur la base réelle.
-- 2. Exécutez-le un jour calme, pas en pleine journée de vente.
-- 3. Juste après l'exécution, ouvrez l'app sur un poste et vérifiez :
--    connexion, une vente, une dépense, la messagerie. Si un écran
--    reste bloqué en "en attente" ou une erreur apparaît, c'est
--    probablement qu'un utilisateur n'a pas de session Supabase valide
--    (voir l'écran Paramètres → Sécurité Supabase → vérifier les comptes).
-- 4. Gardez ce fichier : la commande d'annulation est tout en bas.
--
-- Ce script s'exécute dans Supabase → SQL Editor → coller → Run.
-- ============================================================

-- Une table par une table, dans l'ordre où l'app les utilise.
-- (Si une table n'existe pas encore chez vous, sa ligne échouera sans
-- toucher aux autres — relancez-la seule après vérification du nom.)

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'boutiques', 'users', 'produits', 'ventes', 'depenses',
    'dettes', 'fournisseurs', 'ajustements', 'clotures', 'commerciaux',
    'audits', 'prospects', 'categories_prospects', 'commandes',
    'messages', 'clients_installes', 'proformas', 'groupes'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

    -- On repart toujours d'une politique propre (évite les doublons si
    -- le script est relancé).
    EXECUTE format('DROP POLICY IF EXISTS "connecte_acces_complet" ON public.%I;', t);

    EXECUTE format(
      'CREATE POLICY "connecte_acces_complet" ON public.%I ' ||
      'FOR ALL TO authenticated USING (true) WITH CHECK (true);',
      t
    );
  END LOOP;
END $$;

-- ============================================================
-- VÉRIFICATION APRÈS EXÉCUTION
-- ============================================================
-- Cette requête doit afficher "true" pour rowsecurity sur toutes les
-- tables listées ci-dessus.
--
-- select tablename, rowsecurity from pg_tables
-- where schemaname = 'public'
-- order by tablename;

-- ============================================================
-- POUR ANNULER (si un souci survient après activation)
-- ============================================================
-- Répétez pour chaque table concernée :
--
-- ALTER TABLE public.NOM_DE_LA_TABLE DISABLE ROW LEVEL SECURITY;
