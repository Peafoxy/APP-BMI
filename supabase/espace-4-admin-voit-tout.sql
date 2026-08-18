-- ============================================================
-- CLOISONNEMENT — CORRECTIF : L'ADMINISTRATEUR VOIT LES DEUX ESPACES
-- ============================================================
--
-- POURQUOI CE FICHIER (relevé par Timo, 18/08/2026)
--
-- L'application prévoit depuis la 2.100.30 qu'un administrateur qui a le
-- pouvoir « voir les deux espaces » les voie effectivement TOUS LES DEUX.
-- La barrière serveur, elle, ne connaissait que deux valeurs : 'reel' ou
-- 'formation'. Les deux ne se parlaient pas.
--
-- Conséquence concrète, et c'est ainsi qu'elle a été découverte :
-- l'écran Paramètres proposait toujours de créer une « boutique de
-- formation », l'application l'enregistrait sur l'appareil… et le serveur
-- la refusait. L'opération restait bloquée dans la file d'attente, à
-- réessayer toutes les 20 secondes, pour toujours. Et le message affiché
-- conseillait de se reconnecter — ce qui ne pouvait rien y changer.
--
-- Une application qui propose un geste que le serveur refuse est une
-- application cassée. C'était le cas.
--
-- CE QUE FAIT CE SCRIPT : il ajoute une troisième valeur possible,
-- 'tous', qui traverse la cloison dans les deux sens. Elle est attribuée
-- par api/sync-auth.js aux comptes qui, dans l'application, voient déjà
-- les deux espaces : l'administrateur principal, et tout administrateur
-- qui a conservé le pouvoir « act_voir_tout ».
--
-- CE QU'IL NE CHANGE PAS : absolument rien pour les comptes 'reel' et
-- 'formation'. La cloison reste exactement la même pour eux.
--
-- ⚠ ORDRE À RESPECTER :
--   1. Lancez CE script (il peut l'être avant le déploiement : tant
--      qu'aucun compte ne porte 'tous', il ne change rien).
--   2. Déployez la version ≥ 2.100.42 de l'application.
--   3. Déconnectez-vous PUIS reconnectez-vous : la revendication n'est
--      réécrite qu'à la connexion.
--
-- ⚠⚠ POUR TOUT ANNULER : relancez espace-3-VAGUE-2.sql, qui repose les
-- politiques sans la dérogation. Ou, pour retirer complètement le
-- cloisonnement, le bloc d'annulation en tête de ce même fichier.
--
-- À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

do $$
declare
  t text;
  tables constant text[] := array[
    'ventes', 'depenses', 'dettes', 'produits', 'ajustements', 'clotures',
    'commandes', 'proformas', 'boutiques', 'prospects', 'clients_installes'
  ];
  -- La revendication portée par le jeton de session. Une session sans
  -- revendication (jeton ancien, compte pas encore reconnecté) reste
  -- traitée comme RÉELLE : le filet de sécurité d'origine ne bouge pas.
  revendication constant text := 'coalesce(auth.jwt() -> ''app_metadata'' ->> ''espace'', ''reel'')';
begin
  foreach t in array tables
  loop
    execute format('drop policy if exists "espace_cloisonnement" on public.%I;', t);

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
  raise notice 'Dérogation « tous » posée sur % table(s).', array_length(tables, 1);
  raise notice 'Prochaine étape : déployer la version >= 2.100.42, puis vous déconnecter et vous reconnecter.';
end $$;

-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — à lancer juste après
-- ══════════════════════════════════════════════════════════════════
-- Doit renvoyer 11 lignes, toutes avec permissive = 'RESTRICTIVE'.
select tablename, permissive
from pg_policies
where schemaname = 'public' and policyname = 'espace_cloisonnement'
order by tablename;
