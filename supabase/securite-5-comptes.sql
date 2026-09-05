-- ============================================================
-- SÉCURITÉ 5 — LES COMPTES : LE SERVEUR APPLIQUE LES RÈGLES DE RÔLE
-- (vague 3, étape 3 — validée par Timo le 05/09/2026 : « Lance »)
--
-- ⚠ À COLLER SEULEMENT QUAND TOUS LES APPAREILS SONT EN 2.101.54 OU PLUS
-- (👥 Utilisateurs montre la version de chacun) : l'application doit
-- refuser AVANT le serveur, sinon un appareil en retard enverrait des gestes
-- que le serveur refuse, et sa file d'attente se coincerait.
--
-- Les règles, mot pour mot :
--   • admin seul : bloquer / réactiver un compte, supprimer un compte, et
--     modifier les « champs de gestion » de la fiche d'un EMPLOYÉ
--     (rattachement, chef d'équipe, parrain, taux, identité officielle,
--     anniversaire, et tout champ de paie qui traînerait encore dans la
--     fiche : salaire, primes, avances, virements, crédits, CNSS) ;
--     autoriser le chat libre à un client ;
--   • admin PRINCIPAL seul : changer le mot de passe d'un AUTRE compte,
--     transférer le rôle principal, basculer un compte réel ↔ formation ;
--   • le pouvoir « tâches » (admin, responsable commercial, commercial,
--     technicien — sauf si ce pouvoir leur a été retiré) : écrire dans les
--     tâches d'un AUTRE compte ;
--   • chacun garde SA propre fiche pour le quotidien : signature,
--     disponibilité, ses tâches, son mot de passe ; jamais ses pouvoirs
--     (refuser_elevation_de_soi, inchangé) ni ses champs de gestion.
--   • les fiches des CLIENTS ne sont PAS touchées par cette étape (devis,
--     badges, évaluations… restent comme aujourd'hui — étape 4), sauf le
--     mot de passe, le blocage, la suppression et le chat libre.
--
-- L'« administrateur principal » est reconnu de trois façons, pour qu'un
-- appareil dont l'étiquette de connexion est ancienne (avant 2.101.51) ne
-- soit pas coincé : l'étiquette « principal » du jeton, OU le drapeau
-- admin_principal de SA fiche, OU (le temps d'un transfert) le fait d'être
-- celui qui vient de rendre son drapeau dans la même transaction.
-- ⚠ Le serveur ne reproduit PAS le repli de l'application « premier admin
-- trouvé » : sans drapeau posé, personne n'est principal pour lui.
--
-- Tout déclencheur laisse passer un jeton vide (éditeur SQL) et
-- service_role. Les refus portent le code 42501 : l'application les
-- reconnaît comme « règle du serveur » et propose le filet « Abandonner ce
-- geste refusé » à l'administrateur principal.
--
-- Banc : scripts/tester-comptes-sql.sh (base jetable, rejouable).
-- ============================================================

-- ══════════════════════════════════════════════════════════════════
-- 0. Qui écrit ? (aides de lecture du jeton)
-- ══════════════════════════════════════════════════════════════════
create or replace function public.id_jeton()
returns text language sql stable set search_path = public as $$
  select split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1);
$$;

create or replace function public.est_admin_principal()
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  moi  text := public.id_jeton();
  flag boolean;
begin
  if public.role_jeton() <> 'admin' then return false; end if;
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'principal')::boolean, false) then return true; end if;
  if coalesce(current_setting('bmi.transfert_principal', true), '') = moi and moi <> '' then return true; end if;
  select coalesce((u.data ->> 'admin_principal')::boolean, false) and coalesce((u.data ->> 'actif')::boolean, true)
    into flag from public.users u where u.id = moi;
  return coalesce(flag, false);
end;
$$;

-- Le pouvoir « tâches » : rôle qui l'a d'office, et pas retiré par l'admin
-- (l'étiquette pouvoirs_off est posée à la connexion depuis 2.101.51 ; sans
-- étiquette, on considère qu'aucun pouvoir n'a été retiré).
create or replace function public.a_pouvoir_taches()
returns boolean language sql stable set search_path = public as $$
  select public.role_jeton() in ('admin', 'resp_commercial', 'commercial', 'technicien')
     and not coalesce(auth.jwt() -> 'app_metadata' -> 'pouvoirs_off' ? 'act_taches', false);
$$;

-- ══════════════════════════════════════════════════════════════════
-- 1. refuser_elevation_de_soi : UNE exception, le transfert du rôle
--    principal. L'administrateur principal qui transfère son rôle rend
--    lui-même son drapeau (true → false) sur SA fiche : ce n'est pas une
--    élévation, c'est l'inverse. On le laisse passer, et on note dans la
--    transaction que c'est lui qui transfère — pour que la fiche du
--    nouveau principal, écrite dans le même envoi, le reconnaisse encore.
--    Tout le reste du contrôle est inchangé (securite-2-role-inviolable).
-- ══════════════════════════════════════════════════════════════════
create or replace function public.refuser_elevation_de_soi()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  jetons jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  moi    text  := split_part(coalesce(jetons ->> 'email', ''), '@', 1);
  champ  text;
  surveilles constant text[] := array['role', 'admin_principal', 'droits_off', 'formation', 'actif'];
begin
  if jetons = '{}'::jsonb or coalesce(jetons ->> 'role', '') = 'service_role' then
    return new;
  end if;
  if new.id is distinct from moi then
    return new;
  end if;
  foreach champ in array surveilles loop
    if (old.data -> champ) is distinct from (new.data -> champ) then
      if champ = 'admin_principal'
         and coalesce((old.data ->> 'admin_principal')::boolean, false)
         and not coalesce((new.data ->> 'admin_principal')::boolean, false)
         and public.est_admin_principal() then
        perform set_config('bmi.transfert_principal', moi, true);
        continue;
      end if;
      raise exception
        'Refusé : personne ne modifie les pouvoirs de sa propre fiche (champ « % »). Demandez à l''administrateur principal.', champ
        using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists refuser_elevation_de_soi_trg on public.users;
create trigger refuser_elevation_de_soi_trg
  before update on public.users
  for each row execute function public.refuser_elevation_de_soi();

-- ══════════════════════════════════════════════════════════════════
-- 2. LES RÈGLES DE RÔLE SUR LES COMPTES
-- ══════════════════════════════════════════════════════════════════
create or replace function public.users_regles_comptes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r        text := public.role_jeton();
  moi      text := public.id_jeton();
  sur_moi  boolean;
  cible_client boolean;
  champ    text;
  -- Les champs de gestion de la fiche d'un EMPLOYÉ : admin seul.
  gestion constant text[] := array[
    'nom', 'tel', 'boutique', 'boutique_avant_espace', 'chef_equipe', 'parrain_id',
    'taux_commission', 'taux_equipe', 'taux_avancement', 'nom_complet', 'piece_type', 'piece_num',
    'anniv', 'promu_de', 'date_promotion',
    -- la paie vit dans la table `paie` ; si elle traîne encore ici, même règle
    'salaire_base', 'evolutions_salaire', 'primes', 'avances', 'virements', 'credits',
    'cnss_assujetti', 'cnss_matricule', 'cnss_numero_assurance', 'cnss_mensuel',
    'cnss_code_type', 'cnss_date_embauche', 'cnss_date_sortie', 'cnss_code_motif_sortie'];
  mot_de_passe constant text[] := array['pwd', 'pwd_hash', 'pwd_salt', 'pwd_hash2', 'pwd_visible', 'mdp_auto'];
  a_change boolean;
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;

  if tg_op = 'DELETE' then
    if r <> 'admin' then perform public.refus_role('Supprimer un compte', 'l''administrateur'); end if;
    return old;
  end if;

  sur_moi := (new.id = moi);
  cible_client := coalesce(old.data ->> 'role', 'client') = 'client';

  -- Bloquer / réactiver : admin (sa propre fiche est déjà interdite à tous).
  if (old.data -> 'actif') is distinct from (new.data -> 'actif') and r <> 'admin' then
    perform public.refus_role('Bloquer ou réactiver un compte', 'l''administrateur');
  end if;

  -- Chat libre d'un client : admin.
  if (old.data -> 'chat_libre') is distinct from (new.data -> 'chat_libre') and r <> 'admin' then
    perform public.refus_role('Autoriser le chat libre', 'l''administrateur');
  end if;

  -- Transfert du rôle principal et bascule réel ↔ formation : le principal.
  if coalesce((old.data ->> 'admin_principal')::boolean, false)
     is distinct from coalesce((new.data ->> 'admin_principal')::boolean, false)
     and not public.est_admin_principal() then
    perform public.refus_role('Transférer le rôle d''administrateur principal', 'l''administrateur principal');
  end if;
  if coalesce((old.data ->> 'formation')::boolean, false)
     is distinct from coalesce((new.data ->> 'formation')::boolean, false)
     and not public.est_admin_principal() then
    perform public.refus_role('Changer l''espace d''un compte (réel / formation)', 'l''administrateur principal');
  end if;

  -- Mot de passe d'un AUTRE compte : le principal. Le sien : chacun
  -- (connexion qui renforce le chiffrement, client qui change le sien).
  if not sur_moi then
    a_change := false;
    foreach champ in array mot_de_passe loop
      if (old.data -> champ) is distinct from (new.data -> champ) then a_change := true; end if;
    end loop;
    if a_change and not public.est_admin_principal() then
      perform public.refus_role('Changer le mot de passe d''un autre compte', 'l''administrateur principal');
    end if;
  end if;

  -- Les fiches des CLIENTS s'arrêtent là (étape 4 pour le reste).
  if cible_client then return new; end if;

  -- Champs de gestion d'un employé : admin — y compris sur sa propre fiche
  -- (personne ne se change son taux, sa boutique ou son salaire).
  if r <> 'admin' then
    foreach champ in array gestion loop
      if (old.data -> champ) is distinct from (new.data -> champ) then
        perform public.refus_role(format('Modifier « %s » dans la fiche d''un employé', champ), 'l''administrateur');
      end if;
    end loop;
  end if;

  -- Les tâches d'un AUTRE : le pouvoir « tâches ».
  if not sur_moi
     and (old.data -> 'taches') is distinct from (new.data -> 'taches')
     and not public.a_pouvoir_taches() then
    perform public.refus_role('Assigner, valider ou rouvrir la tâche d''un autre compte',
      'un compte qui a le pouvoir « Assigner des tâches »');
  end if;

  return new;
end;
$$;
drop trigger if exists users_regles_comptes_trg on public.users;
create trigger users_regles_comptes_trg
  before update or delete on public.users
  for each row execute function public.users_regles_comptes();

-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — doit afficher : 3 | true | true
-- ══════════════════════════════════════════════════════════════════
select
  (select count(*) from pg_trigger where tgrelid = 'public.users'::regclass
     and tgname in ('interdire_escalade', 'refuser_elevation_de_soi_trg', 'users_regles_comptes_trg')) as declencheurs_users,
  exists (select 1 from pg_proc where proname = 'est_admin_principal') as principal_reconnu,
  exists (select 1 from pg_proc where proname = 'a_pouvoir_taches') as pouvoir_taches;

-- ══════════════════════════════════════════════════════════════════
-- EN CAS DE PROBLÈME — retirer ce verrou seul (les autres restent) :
--   drop trigger if exists users_regles_comptes_trg on public.users;
--   drop function if exists public.users_regles_comptes();
--   (refuser_elevation_de_soi garde son exception, sans danger.)
-- ══════════════════════════════════════════════════════════════════
