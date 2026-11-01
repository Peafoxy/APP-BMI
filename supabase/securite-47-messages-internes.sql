-- ============================================================
-- securite-47 — LES MESSAGES INTERNES NE DESCENDENT QUE CHEZ LEURS LECTEURS
-- ============================================================
--
-- POUR TIMO — CE QUE FAIT CE SCRIPT (01/11/2026, « A, lance »)
--
-- Jusqu'ici, la base envoyait TOUS les messages de 💬 Messages sur le
-- téléphone de chaque employé — y compris les conversations privées entre
-- deux AUTRES personnes. L'écran ne les montrait qu'aux deux concernés, mais
-- la copie était là, dans la mémoire du téléphone.
--
-- Après ce script, la base n'envoie à chacun que ce que son écran lui
-- montre déjà :
--   • une conversation privée : les deux personnes seulement ;
--   • un groupe : ses membres, plus les administrateurs (l'écran leur
--     montre déjà tous les groupes) ;
--   • un message automatique adressé à quelqu'un : son destinataire ;
--   • ce que l'appareil vient d'écrire lui-même (`ecrit_par`, posé par
--     l'application) : toujours — sinon une vendeuse qui enregistre une
--     grosse dépense ne pourrait plus écrire le message automatique à
--     l'administrateur, et tout son envoi resterait coincé ;
--   • l'administrateur PRINCIPAL reçoit tout : le droit à l'effacement et
--     le dossier d'accès d'un client ou d'un employé ont besoin de TOUS
--     ses messages.
--
-- ⚠ Ce qui NE bouge PAS : le fil d'un client (Support), WhatsApp (règle
-- securite-41), les comptes clients (règle client-1). Ce script ajoute UNE
-- règle à part ; il ne touche à aucune des autres.
--
-- ⚠ Effet à la prochaine connexion de chacun : le téléphone retélécharge et
-- efface de sa mémoire ce que la base ne lui donne plus.
--
-- EN CAS DE PROBLÈME, TOUT ANNULER (sans les tirets de début de ligne) :
--   drop policy if exists "messages_internes_prives" on public.messages;
-- ============================================================

create or replace function public.msg_membre_du_groupe(gid text) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.groupes g
     where g.id::text = gid
       and jsonb_typeof(g.data -> 'membres') = 'array'
       and (g.data -> 'membres') ? public.wa_moi()
  );
$$;

revoke all on function public.msg_membre_du_groupe(text) from public, anon;
grant execute on function public.msg_membre_du_groupe(text) to authenticated;

drop policy if exists "messages_internes_prives" on public.messages;
create policy "messages_internes_prives" on public.messages
as restrictive for select to authenticated
using (
  -- Le compte CLIENT a sa propre règle (client-1) ; WhatsApp et le fil d'un
  -- client (Support) gardent la leur. Seuls les messages internes et les
  -- groupes sont examinés ici.
  (select public.wa_role()) = 'client'
  or coalesce(data ->> 'canal', '') not in ('', 'groupe')
  or (select public.est_admin_principal())
  -- Ce que cet appareil a écrit lui-même, et ce que la personne a envoyé.
  or coalesce(data ->> 'ecrit_par', '') = (select public.wa_moi())
  or coalesce(data ->> 'de_id', '') = (select public.wa_moi())
  -- Une conversation privée, ou un message automatique : son destinataire.
  -- Un message sans destinataire ni canal reste ouvert (aucun n'en fabrique
  -- aujourd'hui ; on ne cache pas ce dont on ne sait pas à qui il est).
  or (
    coalesce(data ->> 'canal', '') = ''
    and (
      coalesce(data ->> 'a_id', '') = (select public.wa_moi())
      or coalesce(data ->> 'a_id', '') = ''
    )
  )
  -- Un groupe : ses membres, et les administrateurs.
  or (
    data ->> 'canal' = 'groupe'
    and (
      (select public.wa_role()) = 'admin'
      or public.msg_membre_du_groupe(data ->> 'groupe_id')
    )
  )
);

-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — la réponse doit être : true | true
-- ══════════════════════════════════════════════════════════════════
select
  (select count(*) = 1 from pg_policies
     where schemaname = 'public' and tablename = 'messages'
       and policyname = 'messages_internes_prives'
       and qual like '%ecrit_par%' and qual like '%msg_membre_du_groupe%') as regle_en_place,
  (select count(*) = 1 from pg_proc where proname = 'msg_membre_du_groupe') as membres_lus;
