-- ============================================================
-- SÉCURITÉ 6 — DEVIS, CHANTIERS, PROSPECTS, BOUTIQUES, GROUPES :
-- LE SERVEUR APPLIQUE LES RÈGLES DE RÔLE
-- (vague 3, étape 4 — validée par Timo le 05/09/2026 : « Lance »)
--
-- ⚠ À COLLER SEULEMENT QUAND TOUS LES APPAREILS SONT EN 2.101.55 OU PLUS
-- (👥 Utilisateurs montre la version de chacun). Suppose securite-4 et
-- securite-5 déjà en place (aides role_jeton, jeton_de_service, refus_role,
-- id_jeton, est_admin_principal).
--
-- Les règles, mot pour mot :
--   • admin PRINCIPAL seul : accepter / rejeter un plan de règlement ;
--     poser « validé » sur le devis d'un client (signature en boutique) —
--     le client, lui, valide SON devis depuis son espace ;
--   • admin seul (chantiers) : commercial rattaché, compte lié, cadeau,
--     supprimer une photo, adresse formelle / garantie / délai de réserves /
--     date d'entretien, répartition des frais et demande de prime, lien PV,
--     réception forcée, avenant ;
--   • admin + responsable commercial : programmer l'installation (date,
--     équipe, chef) ;
--   • admin ou chef de CE chantier : marquer les travaux terminés ;
--   • admin ou son commercial (« laisser comme tel ») : supprimer un
--     chantier ; contacter / archiver / réactiver / supprimer un prospect ;
--   • réassigner un prospect : admin, responsable commercial ou chef
--     d'équipe avec le pouvoir « Réaffecter les prospects » ;
--   • admin seul : catégories de prospects, boutiques (sauf les DEMANDES de
--     ravitaillement, écrites par tout employé, et la caisse TERRAIN créée
--     automatiquement par un devis « pose seule »), groupes de discussion ;
--     l'écran de connexion et le cachet : admin principal ; supprimer une
--     boutique : admin.
--   • tout le reste ne change pas : envoyer un devis, convertir en vente,
--     créer un prospect ou un chantier, observations et photos ajoutées,
--     payer une prime demandée (vendeur de la boutique désignée)…
--
-- Les comptes CLIENTS ne sont pas concernés ici : leurs règles (roles-2,
-- client-1, client-2, client-4) restent telles quelles.
-- Jeton vide (éditeur SQL) et service_role passent. Refus : code 42501.
-- Banc : scripts/tester-devis-chantiers-sql.sh (base jetable, rejouable).
-- ============================================================

-- ══════════════════════════════════════════════════════════════════
-- 0. Aides : le nom de celui qui écrit, est-il chef d'équipe, a-t-il un pouvoir
-- ══════════════════════════════════════════════════════════════════
create or replace function public.nom_jeton()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select u.data ->> 'nom' from public.users u where u.id = public.id_jeton()), '');
$$;

create or replace function public.est_chef_equipe()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (u.data ->> 'chef_equipe')::boolean from public.users u where u.id = public.id_jeton()), false);
$$;

create or replace function public.a_pouvoir(p text)
returns boolean language sql stable set search_path = public as $$
  select not coalesce(auth.jwt() -> 'app_metadata' -> 'pouvoirs_off' ? p, false);
$$;

create or replace function public.champ_change(a jsonb, b jsonb, champ text)
returns boolean language sql immutable as $$
  select (a -> champ) is distinct from (b -> champ);
$$;

-- ══════════════════════════════════════════════════════════════════
-- 1. LES DEVIS DANS LA FICHE CLIENT : « validé » et plan de règlement
-- ══════════════════════════════════════════════════════════════════
create or replace function public.users_regles_devis()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  d_new jsonb; d_old jsonb; plan_new text; plan_old text;
begin
  if public.jeton_de_service() then return new; end if;
  if new.id = public.id_jeton() then return new; end if;                -- le client, sur SA fiche
  if (old.data -> 'devis') is not distinct from (new.data -> 'devis') then return new; end if;
  for d_new in select * from jsonb_array_elements(coalesce(new.data -> 'devis', '[]'::jsonb)) loop
    select x into d_old from jsonb_array_elements(coalesce(old.data -> 'devis', '[]'::jsonb)) x
      where x ->> 'id' = d_new ->> 'id' limit 1;
    if d_new ->> 'statut' = 'valide' and coalesce(d_old ->> 'statut', '') <> 'valide'
       and not public.est_admin_principal() then
      perform public.refus_role('Valider le devis d''un client (signature en boutique)', 'l''administrateur principal');
    end if;
    plan_new := d_new -> 'plan_reglement' ->> 'statut';
    plan_old := d_old -> 'plan_reglement' ->> 'statut';
    if plan_new in ('accepte', 'rejete') and plan_new is distinct from plan_old
       and not public.est_admin_principal() then
      perform public.refus_role('Accepter ou rejeter un plan de règlement', 'l''administrateur principal');
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists users_regles_devis_trg on public.users;
create trigger users_regles_devis_trg
  before update on public.users
  for each row execute function public.users_regles_devis();

-- ══════════════════════════════════════════════════════════════════
-- 2. LES CHANTIERS (clients_installes)
-- ══════════════════════════════════════════════════════════════════
-- Trois lectures d'une équipe, pour distinguer QUI peut y toucher :
--   structure  : qui est dessus et qui est chef      → admin, resp. commercial
--   argent     : parts, montants, boutique de prime  → admin (equipe_argent_change)
--   paiement   : la part est payée (vendeur désigné) → tout employé
create or replace function public.equipe_projection(equipe jsonb, mode text)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(
    case mode
      when 'structure' then jsonb_build_object('user_id', e ->> 'user_id', 'chef', coalesce((e ->> 'chef')::boolean, false))
      else e
    end order by e ->> 'user_id'), '[]'::jsonb)
  from jsonb_array_elements(coalesce(equipe, '[]'::jsonb)) e;
$$;

-- L'argent de l'équipe a-t-il bougé ? Membre par membre : une part qui
-- change, un membre retiré qui avait une part, un membre ajouté avec autre
-- chose qu'une part vide (ce que crée la programmation : 0 %, 0 F).
create or replace function public.equipe_argent_change(ancienne jsonb, nouvelle jsonb)
returns boolean language sql immutable as $$
  with a as (select e ->> 'user_id' as uid, e - 'user_id' - 'nom' - 'chef' - 'paye' - 'date_paiement' - 'dep_id' - 'validee_par' - 'demande_prime' as arg
              from jsonb_array_elements(coalesce(ancienne, '[]'::jsonb)) e),
       n as (select e ->> 'user_id' as uid, e - 'user_id' - 'nom' - 'chef' - 'paye' - 'date_paiement' - 'dep_id' - 'validee_par' - 'demande_prime' as arg
              from jsonb_array_elements(coalesce(nouvelle, '[]'::jsonb)) e),
       vide as (select '{"pct": 0, "montant": 0}'::jsonb as arg)
  select exists (
    select 1 from a full join n on a.uid = n.uid
    where coalesce(a.arg, (select arg from vide)) is distinct from coalesce(n.arg, (select arg from vide))
  );
$$;

create or replace function public.clients_installes_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r text := public.role_jeton(); moi text := public.id_jeton();
  champ text; chef_de_ce_chantier boolean; vers_termine boolean;
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if r = 'client' then return coalesce(new, old); end if;             -- règles client inchangées

  if tg_op = 'DELETE' then
    if r <> 'admin' and coalesce(old.data ->> 'commercial', '') <> public.nom_jeton() then
      perform public.refus_role('Supprimer une fiche chantier', 'l''administrateur ou le commercial rattaché');
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then return new; end if;

  if r = 'admin' then return new; end if;

  -- Réservé à l'administrateur
  foreach champ in array array['commercial', 'user_id', 'cadeau', 'adresse_contrat', 'garantie_mois', 'reserves_delai',
      'date_entretien', 'frais_installation', 'chef_id', 'part_chef', 'date_repartition', 'par_repartition',
      'contrat_force_par', 'contrat_force_le', 'avenant_jeton', 'avenant_jeton_le', 'avenant_statut',
      'reserves_levees_le', 'reserves_levees_par', 'receptionne_par'] loop
    if public.champ_change(old.data, new.data, champ) then
      perform public.refus_role(format('Modifier « %s » sur un chantier', champ), 'l''administrateur');
    end if;
  end loop;
  -- Une photo qui disparaît
  if exists (select 1 from jsonb_array_elements(coalesce(old.data -> 'photos', '[]'::jsonb)) p
             where not exists (select 1 from jsonb_array_elements(coalesce(new.data -> 'photos', '[]'::jsonb)) q where q ->> 'id' = p ->> 'id')) then
    perform public.refus_role('Supprimer une photo de chantier', 'l''administrateur');
  end if;
  -- L'argent de l'équipe
  if public.equipe_argent_change(old.data -> 'equipe', new.data -> 'equipe') then
    perform public.refus_role('Répartir les frais d''installation ou demander une prime', 'l''administrateur');
  end if;
  -- La programmation : qui, chef, date
  if (public.equipe_projection(old.data -> 'equipe', 'structure') is distinct from public.equipe_projection(new.data -> 'equipe', 'structure')
      or public.champ_change(old.data, new.data, 'date_installation')
      or public.champ_change(old.data, new.data, 'a_programmer'))
     and r <> 'resp_commercial' then
    perform public.refus_role('Programmer une installation (date, équipe, chef)', 'l''administrateur ou le responsable commercial');
  end if;
  -- Le statut
  vers_termine := coalesce(old.data ->> 'statut', '') <> 'termine' and new.data ->> 'statut' = 'termine';
  if public.champ_change(old.data, new.data, 'statut') then
    if vers_termine then
      chef_de_ce_chantier := exists (select 1 from jsonb_array_elements(coalesce(old.data -> 'equipe', '[]'::jsonb)) e
                                     where e ->> 'user_id' = moi and coalesce((e ->> 'chef')::boolean, false));
      if not chef_de_ce_chantier then
        perform public.refus_role('Marquer les travaux terminés', 'l''administrateur ou le chef de ce chantier');
      end if;
    else
      perform public.refus_role(format('Passer un chantier à « %s »', new.data ->> 'statut'), 'l''administrateur');
    end if;
  end if;
  -- Le lien de signature du PV : part avec « terminé » ; sinon admin (renvoi)
  if not vers_termine then
    foreach champ in array array['contrat_jeton', 'contrat_jeton_le', 'contrat_numero', 'contrat_statut'] loop
      if public.champ_change(old.data, new.data, champ) then
        perform public.refus_role('Envoyer ou renvoyer le lien de signature du PV', 'l''administrateur');
      end if;
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists clients_installes_regles_roles_trg on public.clients_installes;
create trigger clients_installes_regles_roles_trg
  before insert or update or delete on public.clients_installes
  for each row execute function public.clients_installes_regles_roles();

-- ══════════════════════════════════════════════════════════════════
-- 3. LES PROSPECTS
-- ══════════════════════════════════════════════════════════════════
create or replace function public.prospects_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); proprietaire boolean; champ text;
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if r = 'client' then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then return new; end if;
  proprietaire := r = 'admin' or coalesce(old.data ->> 'commercial', '') = public.nom_jeton();
  if tg_op = 'DELETE' then
    if not proprietaire then perform public.refus_role('Supprimer un prospect', 'l''administrateur ou le commercial rattaché'); end if;
    return old;
  end if;
  if public.champ_change(old.data, new.data, 'commercial')
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
drop trigger if exists prospects_regles_roles_trg on public.prospects;
create trigger prospects_regles_roles_trg
  before insert or update or delete on public.prospects
  for each row execute function public.prospects_regles_roles();

-- ══════════════════════════════════════════════════════════════════
-- 4. CATÉGORIES DE PROSPECTS, GROUPES : admin
-- ══════════════════════════════════════════════════════════════════
create or replace function public.admin_seul_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if public.role_jeton() <> 'admin' then
    perform public.refus_role(format('Modifier %s', tg_argv[0]), 'l''administrateur');
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists categories_prospects_regles_roles_trg on public.categories_prospects;
create trigger categories_prospects_regles_roles_trg
  before insert or update or delete on public.categories_prospects
  for each row execute function public.admin_seul_regles_roles('les catégories de prospects');
drop trigger if exists groupes_regles_roles_trg on public.groupes;
create trigger groupes_regles_roles_trg
  before insert or update or delete on public.groupes
  for each row execute function public.admin_seul_regles_roles('les groupes de discussion');

-- ══════════════════════════════════════════════════════════════════
-- 5. LES BOUTIQUES : admin, sauf les demandes de ravitaillement et la
--    caisse TERRAIN ; écran de connexion et cachet : admin principal
-- ══════════════════════════════════════════════════════════════════
create or replace function public.boutiques_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); champ text; reste_old jsonb; reste_new jsonb;
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if r <> 'admin' then perform public.refus_role('Supprimer une boutique', 'l''administrateur'); end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if r <> 'admin' and not coalesce((new.data ->> 'terrain')::boolean, false) then
      perform public.refus_role('Créer une boutique', 'l''administrateur');
    end if;
    return new;
  end if;
  reste_old := old.data - 'demandes' - 'updated_at';
  reste_new := new.data - 'demandes' - 'updated_at';
  if reste_old is distinct from reste_new then
    if r <> 'admin' then perform public.refus_role('Modifier une boutique', 'l''administrateur'); end if;
    for champ in select k from jsonb_object_keys(reste_old || reste_new) k loop
      if (champ like 'accueil\_%' or champ like 'cachet%') and public.champ_change(reste_old, reste_new, champ)
         and not public.est_admin_principal() then
        perform public.refus_role('Personnaliser l''écran de connexion ou le cachet', 'l''administrateur principal');
      end if;
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists boutiques_regles_roles_trg on public.boutiques;
create trigger boutiques_regles_roles_trg
  before insert or update or delete on public.boutiques
  for each row execute function public.boutiques_regles_roles();

-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — doit afficher : 6 | true
-- ══════════════════════════════════════════════════════════════════
select
  (select count(*) from pg_trigger where tgname in ('users_regles_devis_trg', 'clients_installes_regles_roles_trg',
     'prospects_regles_roles_trg', 'categories_prospects_regles_roles_trg', 'groupes_regles_roles_trg', 'boutiques_regles_roles_trg')) as declencheurs,
  exists (select 1 from pg_proc where proname = 'equipe_projection') as equipe_lue;

-- ══════════════════════════════════════════════════════════════════
-- EN CAS DE PROBLÈME — retirer un verrou seul (les autres restent) :
--   drop trigger if exists clients_installes_regles_roles_trg on public.clients_installes;
--   drop trigger if exists prospects_regles_roles_trg on public.prospects;
--   drop trigger if exists users_regles_devis_trg on public.users;
--   drop trigger if exists boutiques_regles_roles_trg on public.boutiques;
--   drop trigger if exists groupes_regles_roles_trg on public.groupes;
--   drop trigger if exists categories_prospects_regles_roles_trg on public.categories_prospects;
-- ══════════════════════════════════════════════════════════════════
