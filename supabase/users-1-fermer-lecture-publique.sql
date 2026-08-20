-- ============================================================
-- ÉTAPE 2 — FERMER LA LECTURE PUBLIQUE DES FICHES EMPLOYÉS
-- ============================================================
--
-- POUR TIMO — CE QUE FAIT CE SCRIPT
--
-- La table des comptes (`users`) était lisible SANS AUCUNE CONNEXION. Pas
-- seulement par vos employés : par toute personne possédant la clé
-- publique de votre site — elle est visible dans le code de n'importe
-- quelle page web.
--
-- Ce n'était pas une négligence. Un appareil NEUF devait pouvoir retrouver
-- un compte AVANT la connexion, sinon personne ne pouvait se connecter la
-- première fois. C'est réglé autrement depuis la version 2.100.64 : l'écran
-- de connexion demande au serveur LA fiche correspondant à l'identifiant
-- saisi, et ne l'obtient que si le mot de passe est le bon.
--
-- CE QUE ÇA FERME, CONCRÈTEMENT :
--   • les téléphones de tout votre personnel n'est plus téléchargeable ;
--   • et surtout, les mots de passe des comptes clients auto-générés se
--     RECALCULENT à partir du nom et du téléphone. N'importe qui pouvait
--     donc les reconstituer et se connecter à la place de vos clients.
--     Cette porte-là se ferme aussi.
--
-- ⚠⚠ ORDRE DE DÉPLOIEMENT — IMPORTANT ⚠⚠
-- Déployez D'ABORD l'application (2.100.64 ou plus récente) et RECHARGEZ-LA
-- sur vos appareils, PUIS lancez ce script. Dans l'autre sens, un appareil
-- encore en ancienne version ne pourrait plus faire de PREMIÈRE connexion
-- (les appareils déjà utilisés, eux, ne sont jamais concernés : ils ont
-- leur copie locale et se connectent même sans réseau).
--
-- ⚠ VÉRIFIEZ AVANT : la fonction serveur api/chercher-compte.js doit être
-- en ligne. Testez une première connexion sur un appareil neuf (ou une
-- fenêtre de navigation privée) AVANT de lancer ce script.
--
-- ⚠⚠ EN CAS DE PROBLÈME, TOUT ANNULER EN 5 SECONDES ⚠⚠
-- Copiez la ligne ci-dessous — SANS les tirets de début de ligne. La
-- lecture publique redevient immédiatement active :
--
--   create policy "lecture_publique_users" on public.users for select using (true);
--
-- ============================================================


-- ══════════════════════════════════════════════════════════════════
-- 1. LA FERMETURE
-- ══════════════════════════════════════════════════════════════════
-- On retire la politique qui ouvrait la lecture à tous, connectés ou non.
drop policy if exists "lecture_publique_users" on public.users;

-- Et on retire le droit accordé automatiquement par Supabase au visiteur
-- anonyme. ⚠ Retirer la politique ne suffit pas : Supabase accorde les
-- droits sur les tables du schéma public au visiteur anonyme par défaut
-- (leçon apprise sur la table `paie`, le 19/08/2026).
revoke all on public.users from anon;


-- ══════════════════════════════════════════════════════════════════
-- 2. LES COMPTES CONNECTÉS CONTINUENT DE LIRE
-- ══════════════════════════════════════════════════════════════════
-- La politique "connecte_acces_complet" (ou son équivalent) reste en place :
-- une fois connecté, un appareil synchronise les fiches comme avant. Rien
-- ne change pour le fonctionnement quotidien.
--
-- On s'assure simplement qu'une politique de LECTURE existe bien pour les
-- comptes connectés — sinon la fermeture ci-dessus couperait tout le monde.
do $$
declare n int;
begin
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename = 'users'
     and permissive = 'PERMISSIVE'
     and cmd in ('SELECT', 'ALL')
     and 'authenticated' = any(roles);

  if n = 0 then
    create policy "lecture_connectee_users" on public.users
      for select to authenticated using (true);
    raise notice 'Aucune lecture pour les comptes connectes : politique de secours creee.';
  else
    raise notice 'Lecture des comptes connectes deja assuree par % politique(s).', n;
  end if;
end $$;


-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — à lancer juste après
-- ══════════════════════════════════════════════════════════════════
-- anonyme_lit_les_comptes doit valoir FALSE.
-- lectures_connectees doit être SUPÉRIEUR À 0.
select
  has_table_privilege('anon', 'public.users', 'select') as anonyme_lit_les_comptes,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'users'
      and policyname = 'lecture_publique_users') as ancienne_regle_restante,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'users'
      and permissive = 'PERMISSIVE' and cmd in ('SELECT', 'ALL')
      and 'authenticated' = any(roles)) as lectures_connectees;
