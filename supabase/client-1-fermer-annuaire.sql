-- ============================================================
-- ÉTAPE 2 — UN COMPTE CLIENT NE TÉLÉCHARGE PLUS L'ANNUAIRE
-- ============================================================
--
-- POUR TIMO — LE PROBLÈME, EN CLAIR.
--
-- Vous avez demandé pourquoi l'appareil de chaque client télécharge les
-- dettes de tous les autres. Parce que l'application est hors-ligne
-- d'abord : elle réclame au serveur TOUT ce qui a changé, table par table,
-- et c'est au serveur de filtrer. Or vos règles actuelles interdisent 7
-- tables aux comptes clients, et laissent la LECTURE ENTIÈRE sur toutes
-- les autres — c'était volontaire, pour faire marcher l'écran de
-- parrainage.
--
-- CE QUE CE SCRIPT FERME (première vague, la plus importante) :
--
--   • users — l'annuaire. C'est la fuite la plus grave, et pas seulement
--     à cause des téléphones de votre personnel : les mots de passe des
--     comptes clients auto-générés se RECALCULENT à partir du nom et du
--     numéro. Avec cette table, un client un peu technique reconstituait
--     le mot de passe d'un autre client. Après ce script, il ne voit plus
--     que SA fiche et celles de SES FILLEULS.
--
--   • messages — il ne voit plus que ceux qui lui sont adressés, ou qu'il
--     a envoyés.
--
--   • prospects — seulement ceux qui le concernent (ses filleuls, ou sa
--     propre fiche de prospect).
--
--   • audits (le journal) et categories_prospects — il ne les lit jamais.
--
-- CE QUI RESTE OUVERT, ET POURQUOI JE NE LE FERME PAS AUJOURD'HUI :
-- dettes, ventes et clients_installes. Ces tables ne portent AUCUN champ
-- qui dise « cette ligne appartient à tel client » : la dette d'une pose
-- désigne un devis, pas un compte. Fermer à l'aveugle couperait au client
-- le suivi de son propre paiement. Cela demande d'abord d'inscrire un
-- propriétaire sur ces lignes — c'est la vague 2, et elle touche à des
-- données existantes : elle mérite son propre script et son propre essai.
--
-- ⚠ ET CE QUI EST DÉJÀ TÉLÉCHARGÉ ? Une règle serveur empêche les PROCHAINS
-- téléchargements ; elle n'efface pas ce qu'un téléphone détient déjà. La
-- porte serait fermée et le coffre resterait ouvert derrière.
--
-- L'application s'en charge SEULE, et le mécanisme existe depuis longtemps :
-- à chaque connexion avec réseau, elle remet ses curseurs à zéro, retélécharge
-- ce que le serveur lui accorde, puis SUPPRIME toute ligne locale que le
-- serveur ne lui montre plus (« miroir », voir reconcilierMiroir dans
-- src/sync.js). Dès la première connexion en ligne après ce script, l'annuaire
-- disparaît donc des appareils clients — sans rien à lancer.
--
-- Vérifié au banc : scripts/tester-client-annuaire-sql.sh.
--
-- ── COMMENT LANCER ──────────────────────────────────────────────────
-- Copiez tout, collez dans Supabase → SQL Editor → Run. Le script se
-- termine par une vérification qui affiche ce qu'un client peut lire.
--
-- ── EN CAS DE PROBLÈME (annulation complète) ────────────────────────
--   drop policy if exists "role_client_ses_comptes" on public.users;
--   drop policy if exists "role_client_ses_messages" on public.messages;
--   drop policy if exists "role_client_ses_prospects" on public.prospects;
--   drop policy if exists "role_client_pas_de_journal" on public.audits;
--   drop policy if exists "role_client_pas_de_categories" on public.categories_prospects;
-- ============================================================

-- L'identifiant BMI du compte se lit dans l'adresse du jeton : les comptes
-- d'authentification sont créés sous la forme « <id>@bmi.internal »
-- (voir api/sync-auth.js). Même technique que roles-2-vague2.sql.
do $$
declare
  moi      constant text := 'split_part(coalesce(auth.jwt() ->> ''email'', ''''), ''@'', 1)';
  pas_client constant text := 'coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''') <> ''client''';
begin
  -- ── users : sa fiche et celles de ses filleuls ────────────────────
  -- ⚠ Ses DEVIS vivent DANS sa propre fiche (users.data->'devis') : les lui
  -- laisser est indispensable, sinon son espace devient vide.
  -- ⚠ Ses filleuls lui restent visibles : l'écran de parrainage affiche
  -- leur nom et l'avancement de leur installation.
  execute format(
    'drop policy if exists "role_client_ses_comptes" on public.users;'
  );
  execute format(
    'create policy "role_client_ses_comptes" on public.users '
    'as restrictive for select to authenticated '
    'using (%s or id = %s or data ->> ''parrain_client_id'' = %s);',
    pas_client, moi, moi
  );

  -- ── messages : ceux qui lui sont adressés, ou qu'il a écrits ──────
  execute format('drop policy if exists "role_client_ses_messages" on public.messages;');
  execute format(
    'create policy "role_client_ses_messages" on public.messages '
    'as restrictive for select to authenticated '
    'using (%s or data ->> ''a_id'' = %s or data ->> ''de_id'' = %s);',
    pas_client, moi, moi
  );

  -- ── prospects : les siens et ceux de ses filleuls ─────────────────
  execute format('drop policy if exists "role_client_ses_prospects" on public.prospects;');
  execute format(
    'create policy "role_client_ses_prospects" on public.prospects '
    'as restrictive for select to authenticated '
    'using (%s or data ->> ''client_user_id'' = %s or data ->> ''parrain_user_id'' = %s);',
    pas_client, moi, moi
  );

  -- ── audits : un client ne lit que SES lignes de journal ──────────
  -- ⚠ CORRECTIF DU 31/08/2026 (compte ESSO) : la première version fermait
  -- le journal ENTIÈREMENT aux clients — or chaque geste d'un client ÉCRIT
  -- sa ligne de journal (« Devis validé par… »), et l'écriture groupée
  -- vérifie aussi la visibilité en lecture : la ligne était refusée, et
  -- TOUT le lot de la validation restait coincé sur son téléphone.
  -- Il voit donc ses propres lignes : celles signées de son identifiant
  -- (user_id, posé par l'app depuis la 2.101.36), et celles à son nom
  -- (les lignes déjà en attente sur les appareils, d'avant cette version —
  -- le nom se vérifie dans SA fiche, la seule qu'il puisse lire).
  execute format('drop policy if exists "role_client_pas_de_journal" on public.audits;');
  execute format(
    'create policy "role_client_pas_de_journal" on public.audits '
    'as restrictive for select to authenticated '
    'using (%s or data ->> ''user_id'' = %s '
    '  or exists (select 1 from public.users u '
    '             where u.id = %s and u.data ->> ''nom'' = audits.data ->> ''user''));',
    pas_client, moi, moi
  );
  execute format('drop policy if exists "role_client_pas_de_categories" on public.categories_prospects;');
  execute format(
    'create policy "role_client_pas_de_categories" on public.categories_prospects '
    'as restrictive for select to authenticated using (%s);', pas_client
  );

  raise notice 'Annuaire ferme aux comptes clients : users, messages, prospects, audits, categories_prospects.';
end $$;


-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — à lancer juste après
-- ══════════════════════════════════════════════════════════════════
-- Les cinq règles doivent apparaître. Si l'une manque, elle n'a pas été
-- posée : ne considérez pas la porte comme fermée.
select tablename, policyname, permissive, cmd
from pg_policies
where schemaname = 'public' and policyname like 'role_client_%'
order by tablename, policyname;
