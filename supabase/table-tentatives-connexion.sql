-- ============================================================
-- TABLE DE VERROUILLAGE PROGRESSIF — /api/sync-auth
-- ============================================================
-- Stocke, PAR IDENTIFIANT (pas par IP, plus fiable), le nombre
-- d'échecs récents et jusqu'à quand le compte est temporairement
-- verrouillé. Utilisée uniquement par la fonction serveur (clé
-- service_role) — jamais accédée depuis le navigateur.
--
-- À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tentatives_connexion (
  id text PRIMARY KEY,                 -- identifiant du compte visé
  echecs integer NOT NULL DEFAULT 0,
  dernier_echec timestamptz,
  verrouille_jusqu_a timestamptz
);

-- Sécurité : personne (ni anon, ni authenticated) n'a de politique
-- d'accès sur cette table — seule la clé service_role (qui ignore RLS)
-- peut la lire ou l'écrire. Une app cliente ne doit jamais la toucher.
ALTER TABLE public.tentatives_connexion ENABLE ROW LEVEL SECURITY;
