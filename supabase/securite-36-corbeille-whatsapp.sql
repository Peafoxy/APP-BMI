-- ============================================================
-- securite-36 — SUPPRIMER UNE CONVERSATION WHATSAPP : L'ADMINISTRATEUR
-- PRINCIPAL SEUL, ET LA CORBEILLE NE COMPTE PLUS (05/10/2026)
-- ============================================================
--
-- Timo : « possibilité de supprimer les discussions dans WhatsApp de l'app
-- BMI par un appui long… seul l'admin principal » → « 1 corbeille, 2 oui ».
--
-- L'application met une conversation à la CORBEILLE (30 jours) : chacune de
-- ses lignes (messages, canal « whatsapp », et fiche légère, canal
-- « whatsapp_entete ») reçoit la marque `supprime_le`. Passé 30 jours, ou
-- « Supprimer définitivement », les lignes sont EFFACÉES.
--
-- AVANT CE SCRIPT, la base laissait tout employé effacer une ligne WhatsApp
-- ou la marquer : seul l'écran réservait le geste au principal. Ce script
-- ferme la porte côté base :
--   (1) EFFACER une ligne WhatsApp = l'administrateur PRINCIPAL seul ;
--   (2) POSER la marque (mettre à la corbeille) = le principal seul ;
--   (3) RETIRER la marque d'un MESSAGE (restaurer) = le principal seul.
--       ⚠ La fiche légère, elle, peut revivre sans lui : quand le client
--       réécrit, le serveur la repose sans marque (jeton de service), et un
--       employé qui répond la réécrit — une conversation qui recommence.
--   (4) `wa_proprietaire` IGNORE les lignes à la corbeille : le client qui
--       réécrit recommence au SUPPORT, l'ancien propriétaire ne le garde
--       pas — exactement ce que fait l'écran (lib/whatsappConversations.js,
--       `estALaCorbeille`).
--
-- ⚠ Les messages de 💬 Messages (sans canal, « support », « groupe ») ne
-- sont JAMAIS examinés : la règle commence par regarder le canal.
--
-- ⚠⚠ IL REPREND `securite-30` EN ENTIER (donc `-29`, `-28`, `-27`) : c'est
-- le SEUL à coller. Les fonctions wa_role et wa_moi et la politique de
-- lecture sont identiques, mot pour mot ; wa_proprietaire gagne UNE ligne.
--
-- ── COMMENT LANCER ──────────────────────────────────────────────────
-- Copiez TOUT, collez dans Supabase → SQL Editor → Run. Le script se
-- termine par une vérification qui doit afficher « true | true | true | true ».
--
-- ── EN CAS DE PROBLÈME (retour à securite-30) ───────────────────────
--   Recollez securite-30, puis :
--   drop trigger if exists messages_regles_corbeille_wa_trg on public.messages;
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
     -- 🗑 Une ligne À LA CORBEILLE n'appartient plus à aucune conversation
     -- (securite-36) : le client qui réécrit recommence au SUPPORT.
     and coalesce(m.data ->> 'supprime_le', '') = ''
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

-- ── 🗑 LA CORBEILLE DES CONVERSATIONS : LE PRINCIPAL SEUL ────────────
create or replace function public.messages_regles_corbeille_wa()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  avant jsonb; apres jsonb; canal text; marque_avant boolean; marque_apres boolean;
begin
  if public.jeton_de_service() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- (1) EFFACER une ligne WhatsApp.
  if tg_op = 'DELETE' then
    if coalesce(old.data ->> 'canal', '') in ('whatsapp', 'whatsapp_entete')
       and not public.est_admin_principal() then
      perform public.refus_role('Effacer une conversation WhatsApp', 'l''administrateur principal');
    end if;
    return old;
  end if;

  -- ⚠ UPSERT : PostgreSQL déclenche AVANT INSERT même quand la ligne existe.
  if tg_op = 'INSERT' then
    select m.data into avant from public.messages m where m.id = new.id;
  else
    avant := old.data;
  end if;
  apres := new.data;
  canal := coalesce(apres ->> 'canal', avant ->> 'canal', '');
  if canal not in ('whatsapp', 'whatsapp_entete') then return new; end if;

  marque_avant := coalesce(avant ->> 'supprime_le', '') <> '';
  marque_apres := coalesce(apres ->> 'supprime_le', '') <> '';

  -- (2) POSER la marque — mettre à la corbeille.
  if marque_apres and not marque_avant and not public.est_admin_principal() then
    perform public.refus_role('Mettre une conversation WhatsApp à la corbeille', 'l''administrateur principal');
  end if;
  -- (3) RETIRER la marque d'un MESSAGE — restaurer. La fiche légère peut
  -- revivre sans lui (une conversation qui recommence).
  if marque_avant and not marque_apres and canal = 'whatsapp' and not public.est_admin_principal() then
    perform public.refus_role('Restaurer une conversation WhatsApp de la corbeille', 'l''administrateur principal');
  end if;
  return new;
end;
$$;

revoke all on function public.messages_regles_corbeille_wa() from public, anon;

drop trigger if exists messages_regles_corbeille_wa_trg on public.messages;
create trigger messages_regles_corbeille_wa_trg
  before insert or update or delete on public.messages
  for each row execute function public.messages_regles_corbeille_wa();

-- ── VÉRIFICATION ─────────────────────────────────────────────────────
-- ⚠ On ne cherche JAMAIS un morceau qui porte une apostrophe (dans le corps
-- d'une fonction elle est écrite doublée : la phrase répondrait false à tort).
select
  (select count(*) = 1 from pg_trigger where tgname = 'messages_regles_corbeille_wa_trg') as declencheur_en_place,
  (select prosrc like '%Effacer une conversation WhatsApp%' from pg_proc where proname = 'messages_regles_corbeille_wa') as principal_seul,
  (select prosrc like '%supprime_le%' from pg_proc where proname = 'wa_proprietaire') as corbeille_ignoree,
  (select count(*) = 1 from pg_policies
     where schemaname = 'public' and tablename = 'messages'
       and policyname = 'wa_conversations_visibles'
       and qual like '%formation%')                                       as formation_fermee;
