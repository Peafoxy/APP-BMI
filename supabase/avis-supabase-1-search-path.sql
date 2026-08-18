-- ============================================================
-- AVIS DE SÉCURITÉ SUPABASE — 1. LE « CHEMIN DE RECHERCHE » DES
-- FONCTIONS AUTOMATIQUES
-- ============================================================
--
-- POUR TIMO — CE QUE C'EST, EN CLAIR
--
-- Votre base contient quelques petites fonctions automatiques : celle qui
-- horodate chaque ligne modifiée, celle qui enregistre les suppressions
-- (pour que vos appareils sachent quoi effacer), celle qui range chaque
-- ligne du bon côté formation/réel.
--
-- Quand une de ces fonctions écrit « tombstones » ou « espace_de_ligne »,
-- PostgreSQL doit deviner DANS QUEL TIROIR aller chercher ce nom. La liste
-- de tiroirs qu'il consulte s'appelle le « chemin de recherche ». Si on ne
-- la fige pas, quelqu'un qui aurait le droit de créer un tiroir pourrait y
-- placer un faux « tombstones » et détourner la fonction.
--
-- Chez vous ce risque est THÉORIQUE : personne d'autre que vous n'a le
-- droit de créer un tiroir dans cette base. Mais c'est exactement le genre
-- de remarque que l'outil d'analyse de Supabase signale, et il a raison :
-- ça ne coûte rien de le figer.
--
-- CE QUE FAIT CE SCRIPT : il fige le chemin de recherche sur les quatre
-- fonctions qui ne l'avaient pas. Il ne change RIEN à ce qu'elles font.
-- (Les trois autres — espace_de_boutique, espace_de_ligne,
-- interdire_escalade — l'avaient déjà dès leur création.)
--
-- ⚠⚠ EN CAS DE PROBLÈME, TOUT ANNULER ⚠⚠
-- Copiez le bloc ci-dessous — SANS les tirets de début de ligne :
--
--   alter function public.espace_ligne() reset search_path;
--   alter function public.horodatage_serveur() reset search_path;
--   alter function public.tombstone_sur_suppression() reset search_path;
--   alter function public.tombstone_sur_truncate() reset search_path;
--
-- ============================================================

alter function public.espace_ligne()                set search_path = public;
alter function public.horodatage_serveur()          set search_path = public;
alter function public.tombstone_sur_suppression()   set search_path = public;
alter function public.tombstone_sur_truncate()      set search_path = public;

-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — à lancer juste après
-- ══════════════════════════════════════════════════════════════════
-- Doit renvoyer 7 lignes, toutes avec « chemin_fige = true ».
select p.proname as fonction,
       (p.proconfig is not null
        and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')) as chemin_fige
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('espace_ligne', 'horodatage_serveur',
                    'tombstone_sur_suppression', 'tombstone_sur_truncate',
                    'espace_de_boutique', 'espace_de_ligne', 'interdire_escalade')
order by p.proname;
