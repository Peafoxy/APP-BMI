-- ============================================================
-- CLOISONNEMENT FORMATION / RÉEL — ÉTAPE 2 : VÉRIFIER AVANT D'AGIR
-- ============================================================
-- ⚠ CE SCRIPT NE MODIFIE RIEN. Il ne fait que LIRE et compter. On peut
-- le relancer autant de fois qu'on veut, à n'importe quelle heure, sans
-- aucun risque.
--
-- À QUOI IL SERT : il n'y a pas de base de test ici. Ce script la
-- remplace — il simule l'effet des politiques de l'étape 3 SANS les
-- créer, en répondant à la seule question qui compte :
--
--        « qui perdrait accès à quoi, si je lançais l'étape 3 ? »
--
-- QUAND LE LANCER : après espace-1-colonne.sql, et après que tout le
-- monde se soit reconnecté une fois avec la nouvelle version déployée
-- sur Vercel. Puis, tant que le RÉSULTAT 1 n'est pas vide, on ne passe
-- PAS à l'étape 3.
--
-- À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

-- ══════════════════════════════════════════════════════════════════
-- RÉSULTAT 1 — LE SEUL VRAIMENT BLOQUANT
-- ══════════════════════════════════════════════════════════════════
-- Des comptes RÉELS à qui la revendication « formation » aurait été
-- attribuée par erreur. Ce sont les seuls qui perdraient réellement
-- quelque chose : leur appareil purgerait sa copie locale des vraies
-- données (le serveur, lui, garde tout).
--
-- CETTE LISTE DOIT ÊTRE VIDE avant de lancer l'étape 3.
-- Si elle ne l'est pas : le compte a gardé une ancienne revendication.
-- Faites-le se reconnecter, puis relancez ce script.
select
  '⛔ BLOQUANT — compte réel portant la revendication formation' as alerte,
  pu.data->>'nom'   as compte,
  pu.data->>'role'  as role,
  au.raw_app_meta_data->>'espace' as revendication_actuelle
from auth.users au
join public.users pu on pu.id = split_part(au.email, '@', 1)
where coalesce((pu.data->>'formation')::boolean, false) = false
  and au.raw_app_meta_data->>'espace' = 'formation';

-- ══════════════════════════════════════════════════════════════════
-- RÉSULTAT 2 — LES COMPTES PAS ENCORE À JOUR
-- ══════════════════════════════════════════════════════════════════
-- Comptes dont la revendication ne correspond pas encore à leur fiche,
-- ou qui n'en ont aucune (ils ne se sont pas reconnectés depuis le
-- déploiement).
--
-- CE N'EST PAS BLOQUANT : sans revendication, un compte est traité comme
-- RÉEL — il n'est jamais mis dehors. La seule conséquence est qu'un
-- compte de formation encore dans cet état continuerait de voir les
-- vraies données jusqu'à sa prochaine connexion.
--
-- L'idéal est que cette liste soit vide aussi. Si elle ne contient que
-- des comptes inactifs ou des clients, ce n'est pas grave.
select
  case when au.raw_app_meta_data->>'espace' is null
       then 'ℹ️ jamais reconnecté depuis le déploiement'
       else 'ℹ️ revendication périmée' end as etat,
  pu.data->>'nom'  as compte,
  pu.data->>'role' as role,
  case when coalesce((pu.data->>'formation')::boolean, false) then 'formation' else 'reel' end as devrait_etre,
  coalesce(au.raw_app_meta_data->>'espace', '(aucune)') as revendication_actuelle,
  au.last_sign_in_at as derniere_connexion
from auth.users au
join public.users pu on pu.id = split_part(au.email, '@', 1)
where coalesce(au.raw_app_meta_data->>'espace', 'aucune')
      <> case when coalesce((pu.data->>'formation')::boolean, false) then 'formation' else 'reel' end
order by au.last_sign_in_at nulls first;

-- ══════════════════════════════════════════════════════════════════
-- RÉSULTAT 3 — LES COMPTES BMI SANS COMPTE D'AUTHENTIFICATION
-- ══════════════════════════════════════════════════════════════════
-- Ils ne synchronisent déjà pas aujourd'hui (la sécurité exige une
-- session). Rien de nouveau, mais autant les voir.
select '⚠️ aucun compte Supabase Auth' as etat, pu.data->>'nom' as compte, pu.data->>'role' as role
from public.users pu
where coalesce((pu.data->>'actif')::boolean, true)
  and not exists (select 1 from auth.users au where split_part(au.email, '@', 1) = pu.id);

-- ══════════════════════════════════════════════════════════════════
-- RÉSULTAT 4 — CE QUE CHAQUE CÔTÉ VERRAIT
-- ══════════════════════════════════════════════════════════════════
-- La simulation proprement dite. « visible_reel » et « visible_formation »
-- sont exactement ce que renverraient les politiques de l'étape 3.
--
-- À LIRE AINSI :
--   • « non_classe » doit être à 0 partout, SAUF éventuellement quelques
--     chantiers orphelins (sans vente ni dette retrouvable). Ces
--     lignes-là resteront visibles par tout le monde — c'est voulu.
--   • « visible_reel » doit correspondre à ce que vous voyez
--     aujourd'hui, moins l'entraînement. Si un chiffre vous surprend,
--     n'allez pas plus loin : cherchez d'abord pourquoi.
with t as (
  select 'ventes' as tbl, espace from public.ventes
  union all select 'depenses', espace from public.depenses
  union all select 'dettes', espace from public.dettes
  union all select 'produits', espace from public.produits
  union all select 'ajustements', espace from public.ajustements
  union all select 'clotures', espace from public.clotures
  union all select 'commandes', espace from public.commandes
  union all select 'proformas', espace from public.proformas
  union all select 'boutiques', espace from public.boutiques
  union all select 'prospects', espace from public.prospects
  union all select 'clients_installes', espace from public.clients_installes
)
select
  tbl as "table",
  count(*)                                            as total,
  count(*) filter (where espace = 'reel')             as reel,
  count(*) filter (where espace = 'formation')        as formation,
  count(*) filter (where espace is null)              as non_classe,
  count(*) filter (where espace = 'reel' or espace is null)      as visible_reel,
  count(*) filter (where espace = 'formation' or espace is null) as visible_formation
from t group by tbl order by tbl;

-- ══════════════════════════════════════════════════════════════════
-- RÉSULTAT 5 — LE DÉTAIL DES LIGNES NON CLASSÉES
-- ══════════════════════════════════════════════════════════════════
-- Vide dans le cas normal, hors chantiers orphelins.
select 'clients_installes' as "table", id, data->>'nom' as libelle,
       'ni vente ni dette retrouvable' as raison
from public.clients_installes where espace is null
union all
select 'ventes', id, data->>'client', 'aucune boutique' from public.ventes where espace is null
union all
select 'depenses', id, data->>'description', 'aucune boutique' from public.depenses where espace is null
union all
select 'produits', id, data->>'nom', 'aucune boutique' from public.produits where espace is null;

-- ══════════════════════════════════════════════════════════════════
-- FEU VERT / FEU ROUGE
-- ══════════════════════════════════════════════════════════════════
do $$
declare
  bloquants int;
  en_retard int;
begin
  select count(*) into bloquants
  from auth.users au join public.users pu on pu.id = split_part(au.email, '@', 1)
  where coalesce((pu.data->>'formation')::boolean, false) = false
    and au.raw_app_meta_data->>'espace' = 'formation';

  select count(*) into en_retard
  from auth.users au join public.users pu on pu.id = split_part(au.email, '@', 1)
  where coalesce(au.raw_app_meta_data->>'espace', 'aucune')
        <> case when coalesce((pu.data->>'formation')::boolean, false) then 'formation' else 'reel' end;

  if bloquants > 0 then
    raise warning '⛔ NE PAS LANCER L''ÉTAPE 3 : % compte(s) réel(s) portent la revendication formation (résultat 1).', bloquants;
  elsif en_retard > 0 then
    raise notice '🟡 Étape 3 possible, mais % compte(s) n''ont pas encore la bonne revendication (résultat 2) — ils seront traités comme réels jusqu''à leur reconnexion.', en_retard;
  else
    raise notice '🟢 Feu vert : toutes les revendications sont en place.';
  end if;
end $$;
