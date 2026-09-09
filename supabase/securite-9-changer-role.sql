-- ============================================================
-- SÉCURITÉ 9 — CHANGER LE RÔLE D'UN COMPTE : L'ADMINISTRATEUR PRINCIPAL SEUL
-- (demande Timo, 09/09/2026 : « L'administrateur principal doit être
--  capable de changer le rôle d'un utilisateur sur la fiche utilisateur —
--  d'un vendeur, transformer en gérant ou autre »)
--
-- AVANT. Le rôle se choisissait à la création du compte, et plus jamais
-- ensuite (pas de bouton). Côté serveur, roles-1-vague1 refuse le
-- changement de rôle à tout employé NON admin, et refuser_elevation_de_soi
-- (securite-2 / securite-5) à chacun sur SA propre fiche — mais tout
-- administrateur pouvait changer le rôle d'un autre, y compris nommer un
-- administrateur. Rien ne le réservait au principal.
--
-- CE QUE CE SCRIPT POSE (un déclencheur de plus, rien d'autre ne change) :
--   • changer le rôle d'un compte : l'administrateur PRINCIPAL seul (le
--     drapeau admin_principal de sa fiche fait foi, comme pour le mot de
--     passe d'un autre compte — voir est_admin_principal, securite-5) ;
--   • un compte CLIENT ne change jamais de rôle, ni vers ni depuis : il
--     porte des devis, des chantiers, et la base ne le laisse voir que ses
--     données. Un client qui devient employé reçoit un nouveau compte.
--   • la trace du changement (role_avant, role_change_le) suit la même règle.
-- Sa propre fiche reste interdite à tous (refuser_elevation_de_soi).
--
-- ⚠ Le rôle est lu à la CONNEXION (api/sync-auth.js) : la personne changée
-- voit son nouveau menu à sa prochaine reconnexion.
--
-- À coller dans Supabase → SQL Editor → Run. Banc : scripts/tester-comptes-sql.sh.
-- ============================================================

create or replace function public.users_regles_role()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  role_avant text := coalesce(old.data ->> 'role', 'client');
  role_apres text := coalesce(new.data ->> 'role', 'client');
begin
  if public.jeton_de_service() then return new; end if;

  if role_avant is distinct from role_apres then
    if role_avant = 'client' or role_apres = 'client' then
      raise exception 'Refusé : un compte client ne change jamais de rôle (ni vers, ni depuis). Créez un compte d''employé.'
        using errcode = '42501';
    end if;
    if not public.est_admin_principal() then
      perform public.refus_role('Changer le rôle d''un compte', 'l''administrateur principal');
    end if;
  end if;

  if ((old.data -> 'role_avant') is distinct from (new.data -> 'role_avant')
      or (old.data -> 'role_change_le') is distinct from (new.data -> 'role_change_le'))
     and not public.est_admin_principal() then
    perform public.refus_role('Écrire la trace d''un changement de rôle', 'l''administrateur principal');
  end if;

  return new;
end;
$$;

drop trigger if exists users_regles_role_trg on public.users;
create trigger users_regles_role_trg
  before update on public.users
  for each row execute function public.users_regles_role();

-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — doit afficher : true | true
-- ══════════════════════════════════════════════════════════════════
select
  exists (select 1 from pg_trigger where tgrelid = 'public.users'::regclass and tgname = 'users_regles_role_trg') as verrou_role,
  exists (select 1 from pg_proc where proname = 'est_admin_principal') as principal_reconnu;

-- ══════════════════════════════════════════════════════════════════
-- EN CAS DE PROBLÈME — retirer ce verrou seul :
--   drop trigger if exists users_regles_role_trg on public.users;
--   drop function if exists public.users_regles_role();
-- ══════════════════════════════════════════════════════════════════
