-- ============================================================
-- AVIS DE SÉCURITÉ SUPABASE — LES 4 DERNIÈRES ERREURS
-- (objets qui n'appartiennent PAS à l'application BMI-Gestion)
-- ============================================================
--
-- Après la sécurisation de l'application APESPOT WI-FI (tables wifi_*,
-- désormais toutes protégées), le Security Advisor n'affiche plus que
-- 4 erreurs. Aucune ne vient du code de BMI-Gestion : son schéma
-- (supabase/schema.sql) ne contient ni demandes_devis, ni
-- nom_source_boutique, ni catalogue_public — et users_sauvegarde_avant_purge
-- est une table de maintenance créée par purger-mots-de-passe.sql.
--
-- Ce script est en 3 parties :
--   PARTIE A — à exécuter TOUT DE SUITE (aucun risque) : verrouille la
--              sauvegarde des comptes, qui contient des mots de passe
--              et est aujourd'hui lisible par n'importe quel visiteur.
--   PARTIE B — LECTURE SEULE : dresse l'état des 3 objets restants
--              (contenu, dernière activité) pour décider en connaissance
--              de cause.
--   PARTIE C — EN COMMENTAIRE : le verrouillage des 3 objets restants,
--              à n'exécuter QU'APRÈS avoir confirmé qu'aucun site
--              (boutique en ligne, vitrine, formulaire de devis) ne les
--              utilise encore.
-- ============================================================


-- ══════════════════════════════════════════════════════════════════
-- PARTIE A — URGENT ET SANS RISQUE : la sauvegarde des comptes
-- ══════════════════════════════════════════════════════════════════
-- users_sauvegarde_avant_purge est la copie intégrale de la table users
-- prise AVANT la purge des mots de passe : elle contient donc les mots de
-- passe (en clair et/ou hachés) de tous les comptes. Créée par un script
-- de maintenance, elle a hérité des droits par défaut : SANS protection,
-- tout visiteur muni de la clé publique du site peut la télécharger.
-- Personne d'autre que l'éditeur SQL n'a besoin d'y accéder : on ferme tout.

alter table if exists public.users_sauvegarde_avant_purge enable row level security;
revoke all on table public.users_sauvegarde_avant_purge from anon, authenticated;

-- (Le jour où la purge est validée depuis assez longtemps, cette table
--  pourra être supprimée définitivement : drop table users_sauvegarde_avant_purge;)


-- ══════════════════════════════════════════════════════════════════
-- PARTIE B — LECTURE SEULE : que contiennent les 3 objets restants ?
-- ══════════════════════════════════════════════════════════════════
-- Copiez le résultat et décidez : si la boutique en ligne / le formulaire
-- de devis n'existe plus, la PARTIE C peut être exécutée.

select 'demandes_devis' as objet,
       (select count(*) from public.demandes_devis) as lignes,
       (select max(created_at::text) from public.demandes_devis
        where to_regclass('public.demandes_devis') is not null) as derniere_ligne
where to_regclass('public.demandes_devis') is not null
union all
select 'nom_source_boutique',
       (select count(*) from public.nom_source_boutique), null
where to_regclass('public.nom_source_boutique') is not null
union all
select 'catalogue_public (vue)',
       (select count(*) from public.catalogue_public), null
where to_regclass('public.catalogue_public') is not null;


-- ══════════════════════════════════════════════════════════════════
-- PARTIE C — À N'EXÉCUTER QUE SI AUCUN SITE N'UTILISE ENCORE CES OBJETS
-- ══════════════════════════════════════════════════════════════════
-- Décommentez (retirez les « -- » devant chaque ligne) puis exécutez.
--
-- 1) Le formulaire de demandes de devis :
-- alter table public.demandes_devis enable row level security;
-- revoke all on table public.demandes_devis from anon, authenticated;
--
-- 2) La table de correspondance des noms de boutique :
-- alter table public.nom_source_boutique enable row level security;
-- revoke all on table public.nom_source_boutique from anon, authenticated;
--
-- 3) La vue du catalogue public : au lieu de regarder « avec les yeux de
--    son créateur » (ce que Supabase signale), elle regardera avec les
--    yeux du visiteur — qui n'a plus aucun droit dessus.
-- alter view public.catalogue_public set (security_invoker = true);
-- revoke all on public.catalogue_public from anon, authenticated;
--
-- ANNULATION (si un site cassait après coup) :
-- alter table public.demandes_devis disable row level security;
-- grant all on table public.demandes_devis to anon, authenticated;
-- alter table public.nom_source_boutique disable row level security;
-- grant all on table public.nom_source_boutique to anon, authenticated;
-- alter view public.catalogue_public set (security_invoker = false);
-- grant select on public.catalogue_public to anon, authenticated;
