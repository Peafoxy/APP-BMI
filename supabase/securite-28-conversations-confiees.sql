-- ============================================================
-- securite-28 — UNE CONVERSATION CONFIÉE NE DESCEND PLUS QUE CHEZ SON
-- PROPRIÉTAIRE ET L'ADMINISTRATEUR  (21/09/2026, décision « B » de Timo)
-- ============================================================
--
-- CE QU'IL A VU, ET IL AVAIT RAISON : une conversation confiée à TIMO1, et
-- ANGELE (vendeuse) qui continuait d'y écrire. C'était voulu la veille —
-- sa règle du 20/09 disait « tous les salariés voient tout ». Il l'a
-- retournée le lendemain, mot pour mot :
--     assigned_to = null   → visible à tous
--     assigned_to = TIMO1  → visible à TIMO1 + admin
--     l'admin voit tout, et lui seul confie / réassigne
--
-- ⚠⚠ ET « GRISÉ, PAS DISPARU » : « on peut voir la discussion mais grisé.
-- Impossible d'ouvrir par les autres. Pas juste la faire disparaître. »
-- Or une conversation n'est RIEN D'AUTRE que ses messages : pour qu'une
-- ligne grisée s'affiche, il faut que le téléphone ait reçu QUELQUE CHOSE.
-- D'où la FICHE LÉGÈRE (canal « whatsapp_entete », construireEntete dans
-- src/lib/whatsappConversations.js) : le numéro, le nom du client, à qui
-- la conversation est confiée, la date du dernier message.
--     PAS UN MOT DU CONTENU.
-- Elle descend chez tout le personnel ; les MESSAGES, eux, ne descendent
-- que chez qui y a droit. C'est ce que fait ce script.
--
-- ⚠ LA FICHE EST UN PANNEAU INDICATEUR, PAS UNE SOURCE DE VÉRITÉ : le
-- propriétaire d'une conversation se lit sur les MESSAGES (le dernier qui
-- en porte un, posé par « 🔁 Confier »). `wa_proprietaire` ne regarde donc
-- que le canal « whatsapp » — réécrire une fiche n'ouvre aucune porte.
--
-- ⚠⚠ IL REPREND `securite-27` EN ENTIER : c'est le SEUL à coller. Les
-- fonctions sont identiques, seule la politique change.
--
-- ⚠⚠ LE COUPLE : les rôles ci-dessous doivent dire la MÊME chose que
-- `ROLES_TOUTES_CONVERSATIONS` (= ["admin"]) et `aAccesWhatsapp`
-- (src/lib/whatsappConversations.js). L'application filtre ce qui
-- s'AFFICHE, la base ce qui DESCEND. Si les deux divergent, un employé
-- verra un écran vide sans comprendre — ou pire, l'inverse. Le banc
-- compare les deux côtés (`npm run verifier-whatsapp`).
--
-- ⚠ CE QUI NE CHANGE PAS, et c'est le point le plus délicat : c'est la
-- table de TOUS les messages, 💬 Messages compris — et 💬 Messages n'a PAS
-- bougé (sa décision « a » du 21/09 : il est déjà cloisonné, plus
-- sévèrement). La règle ne regarde QUE les canaux « whatsapp » et
-- « whatsapp_entete » ; une ligne de la messagerie interne passe sans même
-- être examinée. Une règle mal écrite ici et plus personne ne reçoit rien :
-- elle est rejouée sur une base jetable avant d'être collée
-- (`npm run tester-conversations`).
--
-- ⚠ ET CE QUI EST DÉJÀ TÉLÉCHARGÉ ? Rien à lancer : à la première
-- reconnexion, l'application retélécharge ce que le serveur lui accorde et
-- SUPPRIME toute ligne locale qu'il ne lui montre plus (reconcilierMiroir,
-- src/sync.js). Les conversations confiées quittent les autres téléphones
-- toutes seules.
--
-- ── COMMENT LANCER ──────────────────────────────────────────────────
-- Copiez TOUT, collez dans Supabase → SQL Editor → Run. Le script se
-- termine par une vérification qui doit afficher « true | true | true ».
--
-- ── EN CAS DE PROBLÈME (retour à securite-27) ───────────────────────
--   Recollez securite-27 : il repose la politique d'avant.
-- ============================================================

-- ── Qui appelle, et sous quel rôle ───────────────────────────────────
-- L'identifiant BMI se lit dans l'adresse du jeton : les comptes
-- d'authentification sont créés sous la forme « <id>@bmi.internal »
-- (api/sync-auth.js).
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

-- ── À qui est une conversation ───────────────────────────────────────
-- ⚠ SECURITY DEFINER, et il le faut : savoir à qui est une conversation
-- demande de relire la table des messages — depuis une règle POSÉE sur
-- cette table. Sans ça, PostgreSQL tournerait en rond.
-- ⚠ Elle ne lit QUE le canal « whatsapp » : la fiche légère est un reflet,
-- elle ne décide de rien.
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

-- ⚠ Supabase accorde les droits par défaut à `anon` sur toute nouvelle
-- FONCTION, pas seulement sur toute nouvelle table.
revoke all on function public.wa_role() from public, anon;
revoke all on function public.wa_moi() from public, anon;
revoke all on function public.wa_proprietaire(text) from public, anon;
grant execute on function public.wa_role() to authenticated;
grant execute on function public.wa_moi() to authenticated;
grant execute on function public.wa_proprietaire(text) to authenticated;

-- Sans cet index, la fonction relirait la table entière à chaque ligne.
create index if not exists messages_wa_tel_idx on public.messages ((data ->> 'wa_tel'));

-- ── LA RÈGLE ─────────────────────────────────────────────────────────
-- `restrictive` : elle s'AJOUTE aux politiques existantes, elle n'en
-- remplace aucune. Ce qui n'est pas du WhatsApp n'est même pas examiné.
drop policy if exists "wa_conversations_visibles" on public.messages;
create policy "wa_conversations_visibles" on public.messages
as restrictive for select to authenticated
using (
  coalesce(data ->> 'canal', '') not in ('whatsapp', 'whatsapp_entete')
  or (
    -- Le client est au bout du fil ; le comptable en est sorti le 20/09.
    public.wa_role() not in ('client', 'comptable')
    and (
      -- 🔒 LA FICHE LÉGÈRE : tout le personnel la reçoit — c'est elle qui
      -- dessine la ligne GRISÉE. Elle ne porte aucun contenu.
      coalesce(data ->> 'canal', '') = 'whatsapp_entete'
      -- L'administrateur voit tout (21/09 : il est le SEUL, désormais).
      or public.wa_role() in ('admin')
      -- Le support : personne ne l'a engagée, tout le personnel la voit.
      or coalesce(public.wa_proprietaire(data ->> 'wa_tel'), '') = ''
      -- La sienne.
      or public.wa_proprietaire(data ->> 'wa_tel') = public.wa_moi()
    )
  )
);

-- ── VÉRIFICATION ─────────────────────────────────────────────────────
select
  (select count(*) = 1 from pg_policies
     where schemaname = 'public' and tablename = 'messages'
       and policyname = 'wa_conversations_visibles')                      as regle_posee,
  (select count(*) = 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'wa_proprietaire'
       and p.prosecdef)                                                   as lecture_autorisee,
  (select not has_function_privilege('anon', 'public.wa_proprietaire(text)', 'execute')) as fermee_aux_anonymes;
