-- ============================================================
-- SÉCURITÉ 32 — UNE DEMANDE DE L'ASSISTANT WHATSAPP SE PREND EN CHARGE
-- (Timo, 24/09/2026 : « 1 et 2 »)
--
-- L'assistant WhatsApp crée une fiche 🧲 Prospects au nom « Assistant BMI
-- TOGO », qui n'est personne. La règle de securite-6 dit : changer le
-- commercial d'un prospect = l'administrateur, le responsable commercial ou
-- un chef d'équipe avec le pouvoir « Réaffecter ». Un commercial ordinaire
-- ne pouvait donc PAS prendre une demande de l'assistant : la base aurait
-- refusé, et tout son lot serait resté coincé dans la file d'attente.
--
-- CE SCRIPT REPREND la fonction des prospects de securite-6 EN ENTIER et
-- n'y ajoute qu'UNE porte : le changement de commercial passe quand la fiche
-- vient de l'assistant (`source` = assistant_whatsapp), qu'elle n'a PAS
-- encore été prise (`pris_le` absent) et qu'on la prend POUR SOI (le nouveau
-- commercial est le nom du compte qui écrit). Tout le reste est mot pour mot
-- la règle de securite-6 : supprimer / archiver / contacter = l'administrateur
-- ou le commercial rattaché ; réassigner = admin / resp. com / chef avec le
-- pouvoir.
--
-- ⚠ LE COUPLE : lib/prospects.js (`estDemandeAssistant`, `prendreEnCharge`)
-- et cette fonction doivent dire la même chose ; le banc les compare et
-- rejoue ce script sur une base jetable (npm run tester-devis-chantiers).
-- C'est le SEUL script à coller. Sans danger à relancer (create or replace).
-- ============================================================
create or replace function public.prospects_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); proprietaire boolean; champ text; prise_pour_soi boolean;
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if r = 'client' then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then return new; end if;
  proprietaire := r = 'admin' or coalesce(old.data ->> 'commercial', '') = public.nom_jeton();
  if tg_op = 'DELETE' then
    if not proprietaire then perform public.refus_role('Supprimer un prospect', 'l''administrateur ou le commercial rattaché'); end if;
    return old;
  end if;
  -- 🤖 La porte de securite-32 : une demande de l'assistant, pas encore
  -- prise, prise POUR SOI. Rien d'autre ne change.
  prise_pour_soi := coalesce(old.data ->> 'source', '') = 'assistant_whatsapp'
    and (old.data ->> 'pris_le') is null
    and coalesce(new.data ->> 'commercial', '') = public.nom_jeton();
  if public.champ_change(old.data, new.data, 'commercial')
     and not prise_pour_soi
     and not ((r in ('admin', 'resp_commercial') or public.est_chef_equipe()) and public.a_pouvoir('act_reaffecter')) then
    perform public.refus_role('Réassigner un prospect', 'l''administrateur, le responsable commercial ou un chef d''équipe (pouvoir « Réaffecter »)');
  end if;
  foreach champ in array array['archive', 'archive_motif', 'archive_le', 'contacts'] loop
    if public.champ_change(old.data, new.data, champ) and not proprietaire then
      perform public.refus_role('Contacter, archiver ou réactiver un prospect', 'l''administrateur ou le commercial rattaché');
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.prospects_regles_roles() from public, anon;
drop trigger if exists prospects_regles_roles_trg on public.prospects;
create trigger prospects_regles_roles_trg
  before insert or update or delete on public.prospects
  for each row execute function public.prospects_regles_roles();

-- Vérification (⚠ sans apostrophe dans le morceau cherché — piège du 24/09) :
-- attendu : true | true
select
  (select prosrc like '%prise_pour_soi%' from pg_proc where proname = 'prospects_regles_roles') as porte_assistant,
  exists (select 1 from pg_trigger where tgname = 'prospects_regles_roles_trg') as declencheur_en_place;
