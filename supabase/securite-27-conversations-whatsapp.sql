-- ============================================================
-- securite-27 — LES CONVERSATIONS WHATSAPP NE DESCENDENT PLUS CHEZ TOUT
-- LE MONDE  (20/09/2026, décisions « 1a » et « 2a » de Timo)
-- ============================================================
--
-- CE QUE ÇA RÉPARE, et ce n'était pas caché : depuis le 20/09/2026 au
-- matin, 📲 WhatsApp N'AFFICHE à un commercial ou à un technicien à
-- commission que les conversations qu'il a engagées, plus le support que
-- personne n'a engagé. Mais ce n'était qu'un filtre d'AFFICHAGE : la table
-- des messages n'est pas cloisonnée par personne côté serveur, donc la
-- copie locale de son téléphone contenait TOUTES les conversations. La
-- porte était fermée et le coffre restait ouvert derrière.
-- Timo, le 20/09/2026 : « 1a » — on la ferme pour de bon.
--
-- ET LE COMPTABLE SORT (« 2a ») : la règle du matin disait « tous les
-- salariés », ce qu'il est. Il garde 💬 Messages ; il n'a plus 📲 WhatsApp.
--
-- ⚠⚠ LE COUPLE : les deux listes de rôles ci-dessous doivent dire la MÊME
-- chose que `ROLES_TOUTES_CONVERSATIONS` et `aAccesWhatsapp`
-- (src/lib/whatsappConversations.js). L'application filtre ce qui
-- s'AFFICHE, la base filtre ce qui DESCEND. Si les deux divergent, un
-- employé verra un écran vide sans comprendre pourquoi — ou pire, l'inverse.
-- Le banc compare les deux côtés (`npm run verifier-whatsapp`).
--
-- ⚠ CE QUI NE CHANGE PAS, et c'est le point le plus délicat : c'est la
-- table de TOUS les messages, 💬 Messages compris. La règle ne regarde QUE
-- les lignes du canal « whatsapp » — une ligne de la messagerie interne
-- passe sans même être examinée. Une règle mal écrite ici et plus personne
-- ne reçoit rien : c'est pourquoi elle est rejouée sur une base jetable
-- avant d'être collée (`bash scripts/tester-conversations-sql.sh`).
--
-- ⚠ ET CE QUI EST DÉJÀ TÉLÉCHARGÉ ? Une règle serveur empêche les
-- PROCHAINS téléchargements ; elle n'efface pas ce qu'un téléphone détient
-- déjà. L'application s'en charge seule : à chaque connexion avec réseau
-- elle retélécharge ce que le serveur lui accorde, puis SUPPRIME toute
-- ligne locale que le serveur ne lui montre plus (« miroir »,
-- reconcilierMiroir dans src/sync.js). Dès la première reconnexion, les
-- conversations qui ne le regardent pas quittent son téléphone.
--
-- ── COMMENT LANCER ──────────────────────────────────────────────────
-- Copiez TOUT, collez dans Supabase → SQL Editor → Run. Le script se
-- termine par une vérification qui doit afficher « true | true | true ».
--
-- ── EN CAS DE PROBLÈME (annulation complète) ────────────────────────
--   drop policy if exists "wa_conversations_visibles" on public.messages;
--   drop function if exists public.wa_proprietaire(text);
--   drop function if exists public.wa_role();
--   drop function if exists public.wa_moi();
-- ============================================================

-- ── Qui appelle, et sous quel rôle ───────────────────────────────────
-- L'identifiant BMI se lit dans l'adresse du jeton : les comptes
-- d'authentification sont créés sous la forme « <id>@bmi.internal »
-- (api/sync-auth.js). Même technique que client-1-fermer-annuaire.sql.
create or replace function public.wa_role() returns text
language sql stable
set search_path = public, pg_temp
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
$$;

create or replace function public.wa_moi() returns text
language sql stable
set search_path = public, pg_temp
as $$
  select split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1);
$$;

-- ── À qui appartient une conversation ────────────────────────────────
-- ⚠ SECURITY DEFINER, et il le faut : sans ça, cette lecture repasserait
-- par la règle qu'elle sert à calculer, et PostgreSQL tournerait en rond.
-- ⚠ Le propriétaire est celui du DERNIER message qui en porte un : une
-- réattribution (« 🔁 Confier ») pose une ligne de plus, elle ne réécrit
-- jamais l'histoire. C'est mot pour mot `proprietaireDe` côté application.
create or replace function public.wa_proprietaire(cle text) returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(m.data ->> 'proprietaire_id', '')
    from public.messages m
   where m.data ->> 'canal' = 'whatsapp'
     and m.data ->> 'wa_tel' = cle
     and coalesce(m.data ->> 'proprietaire_id', '') <> ''
   order by m.data ->> 'ts' desc
   limit 1;
$$;

-- ⚠ Supabase accorde les droits par défaut à `anon` sur toute NOUVELLE
-- fonction : `revoke from public` ne suffit pas, on nomme les rôles.
revoke all on function public.wa_role() from public, anon;
revoke all on function public.wa_moi() from public, anon;
revoke all on function public.wa_proprietaire(text) from public, anon;
grant execute on function public.wa_role() to authenticated;
grant execute on function public.wa_moi() to authenticated;
grant execute on function public.wa_proprietaire(text) to authenticated;

-- La conversation se cherche par son numéro : sans cet index, chaque ligne
-- relirait la table entière.
create index if not exists messages_wa_tel_idx on public.messages ((data ->> 'wa_tel'));

-- ── LA RÈGLE ─────────────────────────────────────────────────────────
-- « restrictive » : elle s'AJOUTE aux règles existantes (elles se
-- combinent par ET), elle n'en remplace aucune. Une ligne de 💬 Messages
-- n'est même pas examinée.
drop policy if exists "wa_conversations_visibles" on public.messages;
create policy "wa_conversations_visibles" on public.messages
as restrictive for select to authenticated
using (
  coalesce(data ->> 'canal', '') <> 'whatsapp'
  or (
    -- Le client est au bout du fil ; le comptable en est sorti le 20/09.
    public.wa_role() not in ('client', 'comptable')
    and (
      -- Ceux qui voient toutes les conversations.
      public.wa_role() in ('admin', 'vendeur', 'gerant', 'magasinier', 'technicien_bmi', 'resp_commercial')
      -- Le support : personne ne l'a engagée, tout le personnel la voit.
      or coalesce(public.wa_proprietaire(data ->> 'wa_tel'), '') = ''
      -- La sienne.
      or public.wa_proprietaire(data ->> 'wa_tel') = public.wa_moi()
    )
  )
);

-- ============================================================
-- VÉRIFICATION — doit afficher « true | true | true »
-- ============================================================
select
  (select count(*) = 1 from pg_policies
     where schemaname = 'public' and tablename = 'messages'
       and policyname = 'wa_conversations_visibles')                      as regle_posee,
  (select count(*) = 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'wa_proprietaire'
       and p.prosecdef)                                                   as lecture_autorisee,
  (select not has_function_privilege('anon', 'public.wa_proprietaire(text)', 'execute')) as fermee_aux_anonymes;
