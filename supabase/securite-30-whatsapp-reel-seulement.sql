-- ============================================================
-- securite-30 — LES CONVERSATIONS WHATSAPP N'EXISTENT QU'EN RÉEL
-- (22/09/2026, décision « B » de Timo)
-- ============================================================
--
-- Timo : « les messages WhatsApp sont-ils finalement bloqués sur l'espace
-- formation ? ». L'ENVOI l'était (api/whatsapp.js refuse tout compte de
-- formation, modèles et réponses). Mais la LECTURE, non : la table des
-- messages est hors du cloisonnement par espace depuis l'origine
-- (espace-1-colonne.sql : « pas de rattachement à une boutique »), et les
-- règles securite-27 à -29 regardent le RÔLE et le PROPRIÉTAIRE, jamais
-- l'espace. Un administrateur de FORMATION recevait donc sur son appareil
-- les vraies conversations des vrais clients — et leur contenu.
--
-- Une conversation WhatsApp est un VRAI client qui écrit sur le VRAI numéro
-- BMI : il n'existe pas de conversation « de formation ». Décision « B » :
--   → un compte dont le jeton dit `espace = formation` ne reçoit AUCUNE
--     ligne WhatsApp — ni les messages, ni les fiches légères.
--   → l'administrateur principal (`espace = tous`) et les comptes réels ne
--     changent pas d'un pouce.
--
-- ⚠ LA REVENDICATION EST LA MÊME que celle des politiques `espace_cloisonnement`
-- (espace-3-politiques.sql) : `app_metadata.espace`, réécrite par
-- api/sync-auth.js à chaque connexion, jamais modifiable par l'appareil.
--
-- ⚠ CE QUE LA BASE NE PEUT PAS FAIRE : elle ne sait pas ce que
-- l'administrateur PRINCIPAL regarde (son compte est réel). Pour lui, c'est
-- l'écran qui cache la liste et refuse la réponse en formation
-- (src/lib/whatsappConversations.js, `MOTIF_WA_FORMATION`).
--
-- ⚠⚠ IL REPREND `securite-29` EN ENTIER (donc `-28`, `-27`) : c'est le SEUL
-- à coller. Seule la politique change, d'une clause ; les trois fonctions
-- sont identiques, mot pour mot.
--
-- ── COMMENT LANCER ──────────────────────────────────────────────────
-- Copiez TOUT, collez dans Supabase → SQL Editor → Run. Le script se
-- termine par une vérification qui doit afficher « true | true | true | true ».
--
-- ── EN CAS DE PROBLÈME (retour à securite-29) ───────────────────────
--   Recollez securite-29 : il repose la politique d'avant.
--
-- ⚠ Effet à la prochaine reconnexion de chacun : c'est là que l'appareil
-- retélécharge ce que le serveur lui accorde et SUPPRIME le reste
-- (`reconcilierMiroir`, src/sync.js). Rien à lancer.
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
-- ⚠ Elle s'arrête sur la MARQUE `proprietaire_efface` comme sur un
-- propriétaire : c'est ce qui rend « 🔓 Rendre à tous » efficace jusqu'à la
-- base, et pas seulement à l'écran.
create or replace function public.wa_proprietaire(cle text) returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(m.data ->> 'proprietaire_id', '')
    from public.messages m
   where m.data ->> 'canal' = 'whatsapp'
     and m.data ->> 'wa_tel' = cle
     and (
       coalesce(m.data ->> 'proprietaire_id', '') <> ''
       -- 🔓 « Rendue à tout le personnel » : la remontée s'arrête ici, et
       -- la ligne ne portant aucun propriétaire, le coalesce rend '' —
       -- c'est-à-dire le SUPPORT, visible par tout le personnel.
       or coalesce(m.data ->> 'proprietaire_efface', '') = 'true'
     )
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
    -- 🎓 Un compte de FORMATION ne reçoit rien de WhatsApp (22/09/2026,
    -- décision « B ») : ni message, ni fiche légère. `tous` (le principal)
    -- et `reel` passent ; la revendication est celle d'espace-3-politiques.
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'espace', 'reel') <> 'formation'
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
  (select not has_function_privilege('anon', 'public.wa_proprietaire(text)', 'execute')) as fermee_aux_anonymes,
  (select count(*) = 1 from pg_policies
     where schemaname = 'public' and tablename = 'messages'
       and policyname = 'wa_conversations_visibles'
       and qual like '%formation%')                                       as formation_fermee;
