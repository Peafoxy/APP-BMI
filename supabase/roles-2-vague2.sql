-- ============================================================
-- DROITS PAR RÔLE CÔTÉ SERVEUR — VAGUE 2
-- ============================================================
--
-- ⚠ À LIRE AVANT DE LANCER — ce que cette vague fait, et ce qu'elle ne fait
-- PAS. Le contenu diffère de ce qui était annoncé, et voici pourquoi.
--
-- L'idée de départ était : « un client ne voit et ne touche QUE ses propres
-- lignes ». En relisant ce qu'un client fait réellement dans son espace
-- (src/screens/EspaceClient.jsx), cette règle s'est révélée FAUSSE — un
-- client touche légitimement des lignes qui ne sont pas les siennes :
--
--   • quand il NOTE le commercial, il écrit dans la fiche de CE COMMERCIAL
--     (EspaceClient.jsx : users.map(u => u.id === d.par_id …)) ;
--   • quand il PARRAINE quelqu'un, il CRÉE un autre compte client ;
--   • quand il consulte ses filleuls, il LIT leurs chantiers et leurs ventes
--     pour afficher sa part de parrainage.
--
-- Une règle « ses propres lignes seulement » aurait donc bloqué ces trois
-- fonctions — et le client l'aurait découvert au pire moment, en pleine
-- validation de devis ou de signature de PV, avec le nom de BMI à l'écran.
--
-- Cette vague 2 pose donc les deux barrières qui protègent réellement, sans
-- rien casser de ce qui existe :
--
--   1. UN CLIENT NE SUPPRIME PLUS RIEN, nulle part. Il n'a aucune raison
--      légitime de supprimer quoi que ce soit — vérifié dans son écran. Cela
--      ferme la seule capacité vraiment destructrice qui lui restait.
--
--   2. UN CLIENT NE MODIFIE QUE SON PROPRE CHANTIER. Il signe son PV et
--      réceptionne SES travaux ; il n'a jamais à modifier celui d'un autre.
--      La LECTURE reste ouverte : il doit voir les chantiers de ses filleuls
--      pour suivre sa part de parrainage.
--
-- CE QUI RESTE OUVERT, ET C'EST ASSUMÉ : un client peut encore LIRE des
-- données qui ne le concernent pas. Fermer cela demande de modifier
-- l'application elle-même (elle télécharge des tables entières pour
-- fonctionner hors ligne), pas seulement le serveur. C'est un chantier à
-- part, à faire quand de vrais clients utiliseront leur espace — c'est en
-- les regardant faire qu'on saura où placer la limite sans les gêner.
--
-- ⚠ PRÉREQUIS : roles-1-vague1.sql doit avoir été lancé (c'est fait).
--
-- ⚠⚠ POUR TOUT ANNULER EN 5 SECONDES — copiez ce bloc SANS les tirets :
--
--   do $$
--   declare t text;
--   begin
--     foreach t in array array[
--       'ventes','depenses','dettes','produits','ajustements','clotures',
--       'commandes','proformas','boutiques','prospects','clients_installes',
--       'fournisseurs','commerciaux','groupes','users','messages'
--     ] loop
--       execute format('drop policy if exists "role_client_sans_suppression" on public.%I;', t);
--     end loop;
--     drop policy if exists "role_client_son_chantier" on public.clients_installes;
--   end $$;
--
-- À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================


-- ══════════════════════════════════════════════════════════════════
-- 1. UN CLIENT NE SUPPRIME PLUS RIEN
-- ══════════════════════════════════════════════════════════════════
-- Vérifié dans son écran : il valide, il signe, il note, il parraine, il
-- écrit des messages. Il ne supprime jamais rien. Cette capacité n'avait
-- donc aucune raison d'exister — et c'était la plus destructrice.
do $$
declare
  t text;
  role_du_jeton constant text := 'coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''')';
begin
  foreach t in array array[
    'ventes', 'depenses', 'dettes', 'produits', 'ajustements', 'clotures',
    'commandes', 'proformas', 'boutiques', 'prospects', 'clients_installes',
    'fournisseurs', 'commerciaux', 'groupes', 'users', 'messages'
  ]
  loop
    execute format('drop policy if exists "role_client_sans_suppression" on public.%I;', t);
    execute format(
      'create policy "role_client_sans_suppression" on public.%I '
      'as restrictive for delete to authenticated using (%s <> ''client'');',
      t, role_du_jeton
    );
  end loop;
  raise notice '1/2 — un compte client ne peut plus rien supprimer.';
end $$;


-- ══════════════════════════════════════════════════════════════════
-- 2. UN CLIENT NE MODIFIE QUE SON PROPRE CHANTIER
-- ══════════════════════════════════════════════════════════════════
-- Il signe son PV et réceptionne SES travaux. Modifier le chantier d'un
-- autre n'a jamais de sens pour lui.
--
-- La LECTURE reste entière : son écran affiche les chantiers de ses
-- filleuls pour lui montrer sa part de parrainage. La restreindre casserait
-- cette page.
--
-- L'identifiant BMI du compte se lit dans l'adresse du jeton : les comptes
-- d'authentification sont créés sous la forme « <id>@bmi.internal »
-- (voir api/sync-auth.js).
drop policy if exists "role_client_son_chantier" on public.clients_installes;
create policy "role_client_son_chantier" on public.clients_installes
  as restrictive for update to authenticated
  using (true)
  with check (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'client'
    or data ->> 'user_id' = split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)
  );

do $$ begin raise notice '2/2 — un client ne modifie que son propre chantier.'; end $$;


-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — à lancer juste après
-- ══════════════════════════════════════════════════════════════════
select tablename, policyname
from pg_policies
where schemaname = 'public' and policyname like 'role_client_%'
order by tablename, policyname;
