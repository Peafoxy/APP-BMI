-- ============================================================
-- securite-29 — UNE CONVERSATION CONFIÉE PEUT ÊTRE RENDUE À TOUT LE MONDE
-- (21/09/2026, demande de Timo)
-- ============================================================
--
-- Timo : « donner la possibilité à l'administrateur de rendre la discussion
-- déjà confiée à redevenir accessible à tous les utilisateurs ». Une
-- conversation confiée à quelqu'un qui part en congé n'avait AUCUNE porte de
-- sortie : on pouvait la donner à un autre, jamais la rouvrir.
--
-- ⚠⚠ POURQUOI IL FAUT DU SQL POUR ÇA. L'application pose une ligne de plus
-- dans le fil — elle ne réécrit jamais un message. Mais une ligne SANS
-- propriétaire n'efface rien : la base cherche « le dernier message qui PORTE
-- un propriétaire » et retrouverait l'ancien. L'écran rendrait donc la
-- conversation à tout le monde pendant que la base continuerait de la cacher.
--   → `wa_proprietaire` regarde désormais DEUX choses : un propriétaire, et
--     la marque `proprietaire_efface`. La première des deux qu'elle rencontre
--     en remontant décide. La marque veut dire « à partir d'ici, personne ».
--
-- ⚠ LE COUPLE : cette fonction et `proprietaireDe` / `MARQUE_RENDUE`
-- (src/lib/whatsappConversations.js) doivent dire la MÊME chose. Le banc
-- compare les deux côtés (`npm run verifier-whatsapp`).
--
-- ⚠ L'HISTOIRE RESTE ENTIÈRE : on lit toujours à qui la conversation avait
-- été confiée, et par qui. Rendre à tous n'efface rien, ça ajoute.
--
-- ⚠⚠ IL REPREND `securite-28` EN ENTIER (donc `-27`) : c'est le SEUL à
-- coller. Seule la fonction `wa_proprietaire` change ; la politique est
-- identique, mot pour mot.
--
-- ── COMMENT LANCER ──────────────────────────────────────────────────
-- Copiez TOUT, collez dans Supabase → SQL Editor → Run. Le script se
-- termine par une vérification qui doit afficher « true | true | true ».
--
-- ── EN CAS DE PROBLÈME (retour à securite-28) ───────────────────────
--   Recollez securite-28 : il repose la fonction d'avant.
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
