-- ============================================================
-- AVIS DE SÉCURITÉ SUPABASE — ÉTAT DES LIEUX (LECTURE SEULE)
-- ============================================================
--
-- POUR TIMO : ce script ne modifie RIEN. Il ne fait que REGARDER et
-- dresser la liste, table par table, de ce qui est protégé et de ce qui
-- ne l'est pas. Aucune annulation n'est nécessaire : il n'y a rien à
-- annuler.
--
-- Copiez tout, collez dans Supabase → SQL Editor → Run, puis
-- envoyez-moi le résultat.
--
-- COMMENT LIRE LE RÉSULTAT — la colonne « verdict » :
--
--   🔴 PORTE OUVERTE      La table n'a AUCUNE protection. Toute personne
--                         connaissant la clé publique du site (elle est
--                         visible dans le code de n'importe quelle page
--                         web) peut lire, modifier et effacer son
--                         contenu. C'est ce que Supabase signale par
--                         « RLS Disabled in Public ».
--
--   🟠 PROTÉGÉE MAIS VIDE La protection est active mais aucune règle
--                         n'est écrite : plus personne n'y accède, sauf
--                         l'éditeur SQL. Souvent le signe d'une table
--                         abandonnée.
--
--   🟢 PROTÉGÉE           Protection active + règles en place. C'est
--                         l'état de toutes les tables de BMI-Gestion.
--
-- La colonne « lignes » dit combien d'enregistrements la table contient :
-- une table à 0 ligne qui traîne depuis un vieux projet ne se répare pas,
-- elle se supprime.
-- ============================================================

select
  c.relname                                   as table_nom,
  case
    when not c.relrowsecurity              then '🔴 PORTE OUVERTE'
    when count(p.policyname) = 0           then '🟠 PROTEGEE MAIS VIDE'
    else                                        '🟢 PROTEGEE'
  end                                         as verdict,
  count(p.policyname)                         as nb_regles,
  (select n_live_tup from pg_stat_user_tables s where s.relid = c.oid) as lignes,
  -- Un droit direct accordé au visiteur anonyme (la clé publique du site).
  -- Sans protection active, c'est ce droit qui ouvre réellement la porte.
  has_table_privilege('anon',   c.oid, 'select') as anon_peut_lire,
  has_table_privilege('anon',   c.oid, 'insert') as anon_peut_ecrire,
  has_table_privilege('anon',   c.oid, 'delete') as anon_peut_effacer
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.schemaname = n.nspname and p.tablename = c.relname
where n.nspname = 'public'
  and c.relkind = 'r'          -- vraies tables seulement (pas les vues)
group by c.oid, c.relname, c.relrowsecurity
order by
  case when not c.relrowsecurity then 0 when count(p.policyname) = 0 then 1 else 2 end,
  c.relname;

-- ══════════════════════════════════════════════════════════════════
-- LES RÈGLES QUI SE SUPERPOSENT (les « warnings » sur VOS tables)
-- ══════════════════════════════════════════════════════════════════
-- Sur une table protégée, Supabase compte les règles PERMISSIVES (celles
-- qui OUVRENT un droit) valables pour le même profil et la même action.
-- Quand il y en a plusieurs, il suffit qu'UNE SEULE dise oui pour que
-- l'accès passe : les autres ne servent plus à rien, et surtout on ne
-- sait plus laquelle décide vraiment. D'où la remarque.
--
-- ⚠ À ne pas confondre avec les règles RESTRICTIVES posées pendant
-- l'audit (cloisonnement, rôles) : celles-là ne peuvent que RETRANCHER,
-- elles ne sont jamais en cause ici et n'apparaissent pas ci-dessous.
--
-- Ce tableau ne montre QUE les superpositions réelles.
-- ⚠ Une règle écrite « pour tout » (ALL) couvre en réalité les quatre
-- actions : elle doit donc être comparée à chacune. Sans ce dépliage, une
-- règle ALL et une règle SELECT sur la même table passaient inaperçues,
-- alors que c'est justement le cas le plus fréquent.
select
  p.tablename        as table_nom,
  a.action,
  r.profil,
  count(*)           as nb_regles_qui_ouvrent,
  string_agg(p.policyname, ' + ' order by p.policyname) as les_regles
from pg_policies p
cross join lateral unnest(coalesce(p.roles, '{}')) as r(profil)
cross join lateral unnest(
  case when p.cmd = 'ALL' then array['SELECT','INSERT','UPDATE','DELETE']
       else array[p.cmd] end
) as a(action)
where p.schemaname = 'public'
  and p.permissive = 'PERMISSIVE'
group by p.tablename, a.action, r.profil
having count(*) > 1
order by count(*) desc, p.tablename, a.action;

-- ══════════════════════════════════════════════════════════════════
-- LES VUES (le point « Security Definer View »)
-- ══════════════════════════════════════════════════════════════════
-- Une VUE est une fenêtre sur des tables. Par défaut elle regarde avec
-- LES YEUX DE CELUI QUI L'A CRÉÉE (vous) et non de celui qui la consulte
-- — donc elle contourne les protections. Pour catalogue_public c'est
-- VOULU : c'est ce qui permet à votre boutique en ligne d'afficher les
-- articles à des visiteurs sans compte. Pour toute autre vue, c'est à
-- vérifier.
select
  c.relname as vue_nom,
  case when exists (
    select 1 from unnest(coalesce(c.reloptions, '{}')) o
    where o like 'security_invoker=%on%' or o like 'security_invoker=%true%'
  ) then 'regarde avec les yeux du visiteur (sûr)'
    else 'regarde avec VOS yeux — contourne les protections'
  end as comportement,
  has_table_privilege('anon', c.oid, 'select') as anon_peut_lire
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
order by c.relname;
