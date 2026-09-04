-- ============================================================
-- SÉCURITÉ 4 — L'ARGENT : LE SERVEUR APPLIQUE LES RÈGLES DE RÔLE
-- (vague 3, étape 2 — décisions de Timo du 04/09/2026,
--  docs/inventaire-verrous-employes-2026-09.md)
--
-- ⚠ À COLLER SEULEMENT QUAND TOUS LES APPAREILS SONT EN 2.101.53 OU PLUS
-- (👥 Utilisateurs montre la version de chacun) : l'application doit
-- refuser AVANT le serveur, sinon un appareil en retard enverrait des gestes
-- que le serveur refuse, et sa file d'attente se coincerait.
--
-- Les règles, mot pour mot :
--   • admin seul : supprimer une vente, une dette, une dépense ; annuler un
--     pointage du comptable ; corriger prix d'achat / prix de vente /
--     quantité initiale d'un article ; supprimer un article ; retour sous
--     garantie et sort d'un défectueux ; agents commerciaux ;
--   • magasinier + gérant + admin : créer / modifier un article, entrées,
--     ajustements, transferts, inventaire, bons ;
--   • gérant + admin : clôturer la caisse ; fournisseurs ;
--   • remise au-delà de 3 % (devis, vente, proforma, commande) : admin seul
--     — un client qui valide un devis à 5 % fait par l'admin passe, parce
--     que la remise vient du devis ;
--   • le comptable (lecture seule) garde SON seul geste : pointer un
--     décaissement « remis » — et rien d'autre sur la ligne.
--
-- Tout déclencheur laisse passer un jeton vide (éditeur SQL) et
-- service_role. Les refus portent le code 42501 : l'application les
-- reconnaît comme « règle du serveur » (pas « session expirée ») et propose
-- le filet « Abandonner ce geste refusé » à l'administrateur principal.
--
-- Banc : scripts/tester-argent-sql.sh (base jetable, rejouable).
-- ============================================================

-- ══════════════════════════════════════════════════════════════════
-- 0. Deux aides de lecture du jeton (invoker, sans droit particulier)
-- ══════════════════════════════════════════════════════════════════
create or replace function public.role_jeton()
returns text language sql stable set search_path = public as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
$$;

create or replace function public.jeton_de_service()
returns boolean language sql stable set search_path = public as $$
  select coalesce(auth.jwt() ->> 'role', '') in ('', 'service_role');
$$;

create or replace function public.refus_role(geste text, roles text)
returns void language plpgsql set search_path = public as $$
begin
  raise exception '% : réservé à % (vous : %)', geste, roles, coalesce(nullif(public.role_jeton(), ''), 'inconnu')
    using errcode = '42501';
end;
$$;

-- ══════════════════════════════════════════════════════════════════
-- 1. VENTES — suppression : admin ; remise > 3 % : admin
-- ══════════════════════════════════════════════════════════════════
create or replace function public.ventes_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); pct numeric; pct_commande numeric;
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if r <> 'admin' then perform public.refus_role('Supprimer une vente', 'l''administrateur'); end if;
    return old;
  end if;
  pct := coalesce((new.data ->> 'remise_pct')::numeric, 0);
  if pct > 3 and r <> 'admin'
     and (tg_op = 'INSERT' or coalesce((old.data ->> 'remise_pct')::numeric, 0) is distinct from pct) then
    -- Une vente qui ENCAISSE une commande (devis validé) garde la remise de
    -- la commande — déjà contrôlée par commandes_regles_remise.
    if new.data ->> 'commande_id' is not null then
      select coalesce((c.data ->> 'remise_pct')::numeric, 0) into pct_commande
        from public.commandes c where c.id = new.data ->> 'commande_id';
      if pct_commande is not null and pct_commande = pct then return new; end if;
    end if;
    perform public.refus_role('Remise supérieure à 3 % sur une vente', 'l''administrateur');
  end if;
  return new;
end;
$$;
drop trigger if exists ventes_regles_roles_trg on public.ventes;
create trigger ventes_regles_roles_trg
  before insert or update or delete on public.ventes
  for each row execute function public.ventes_regles_roles();

-- ══════════════════════════════════════════════════════════════════
-- 2. DETTES — suppression : admin
-- ══════════════════════════════════════════════════════════════════
create or replace function public.dettes_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.jeton_de_service() then return old; end if;
  if public.role_jeton() <> 'admin' then perform public.refus_role('Supprimer une dette', 'l''administrateur'); end if;
  return old;
end;
$$;
drop trigger if exists dettes_regles_roles_trg on public.dettes;
create trigger dettes_regles_roles_trg
  before delete on public.dettes
  for each row execute function public.dettes_regles_roles();

-- ══════════════════════════════════════════════════════════════════
-- 3. DÉPENSES — suppression : admin ; annuler un pointage : admin ;
--    le comptable ne touche QUE decaisse_le / decaisse_par
-- ══════════════════════════════════════════════════════════════════
create or replace function public.depenses_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton();
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if r <> 'admin' then perform public.refus_role('Supprimer une dépense', 'l''administrateur'); end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if old.data ->> 'decaisse_le' is not null and new.data ->> 'decaisse_le' is null and r <> 'admin' then
      perform public.refus_role('Annuler un pointage du comptable', 'l''administrateur');
    end if;
    if r = 'comptable'
       and (old.data - 'decaisse_le' - 'decaisse_par') is distinct from (new.data - 'decaisse_le' - 'decaisse_par') then
      perform public.refus_role('Modifier une dépense', 'un compte qui n''est pas en lecture seule');
    end if;
  elsif tg_op = 'INSERT' and r = 'comptable' then
    perform public.refus_role('Créer une dépense', 'un compte qui n''est pas en lecture seule');
  end if;
  return new;
end;
$$;
drop trigger if exists depenses_regles_roles_trg on public.depenses;
create trigger depenses_regles_roles_trg
  before insert or update or delete on public.depenses
  for each row execute function public.depenses_regles_roles();

-- Le comptable est en lecture seule (ecriture = false) : la règle
-- role_lecture_seule_maj lui refusait TOUT, y compris son pointage. On lui
-- ouvre la porte de la mise à jour sur cette seule table — le déclencheur
-- ci-dessus ne le laisse toucher que les deux champs du pointage.
drop policy if exists "role_lecture_seule_maj" on public.depenses;
create policy "role_lecture_seule_maj" on public.depenses
  as restrictive for update to authenticated
  using (true)
  with check (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'ecriture')::boolean, true)
    or public.role_jeton() = 'comptable'
  );

-- ══════════════════════════════════════════════════════════════════
-- 4. PRODUITS — écrire : magasinier / gérant / admin ;
--    prix d'achat, prix de vente, quantité initiale et suppression : admin
-- ══════════════════════════════════════════════════════════════════
create or replace function public.produits_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton();
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if r <> 'admin' then perform public.refus_role('Supprimer un article', 'l''administrateur'); end if;
    return old;
  end if;
  if r not in ('magasinier', 'gerant', 'admin') then
    perform public.refus_role(case when tg_op = 'INSERT' then 'Créer un article' else 'Modifier un article' end, 'le magasinier, le gérant, l''administrateur');
  end if;
  if tg_op = 'UPDATE' and r <> 'admin' and (
       (old.data ->> 'prix_achat') is distinct from (new.data ->> 'prix_achat')
    or (old.data ->> 'prix_vente') is distinct from (new.data ->> 'prix_vente')
    or (old.data ->> 'initial')    is distinct from (new.data ->> 'initial')) then
    perform public.refus_role('Corriger le prix ou la quantité initiale d''un article', 'l''administrateur');
  end if;
  return new;
end;
$$;
drop trigger if exists produits_regles_roles_trg on public.produits;
create trigger produits_regles_roles_trg
  before insert or update or delete on public.produits
  for each row execute function public.produits_regles_roles();

-- ══════════════════════════════════════════════════════════════════
-- 5. AJUSTEMENTS — mouvements de stock : magasinier / gérant / admin ;
--    retour sous garantie, sort d'un défectueux, suppression : admin
-- ══════════════════════════════════════════════════════════════════
create or replace function public.ajustements_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); t text;
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if r <> 'admin' then perform public.refus_role('Supprimer un ajustement', 'l''administrateur'); end if;
    return old;
  end if;
  t := coalesce(new.data ->> 'type', '');
  if t in ('echange_garantie', 'retour_defectueux') then
    if r <> 'admin' then perform public.refus_role('Retour sous garantie', 'l''administrateur'); end if;
    if tg_op = 'UPDATE' and (old.data ->> 'statut') is distinct from (new.data ->> 'statut') and r <> 'admin' then
      perform public.refus_role('Statuer sur un article défectueux', 'l''administrateur');
    end if;
    return new;
  end if;
  if r not in ('magasinier', 'gerant', 'admin') then
    perform public.refus_role('Mouvement de stock (entrée, ajustement, transfert, inventaire)', 'le magasinier, le gérant, l''administrateur');
  end if;
  return new;
end;
$$;
drop trigger if exists ajustements_regles_roles_trg on public.ajustements;
create trigger ajustements_regles_roles_trg
  before insert or update or delete on public.ajustements
  for each row execute function public.ajustements_regles_roles();

-- ══════════════════════════════════════════════════════════════════
-- 6. CLÔTURES DE CAISSE — gérant / admin
-- ══════════════════════════════════════════════════════════════════
create or replace function public.clotures_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if public.role_jeton() not in ('gerant', 'admin') then perform public.refus_role('Clôturer la caisse', 'le gérant, l''administrateur'); end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists clotures_regles_roles_trg on public.clotures;
create trigger clotures_regles_roles_trg
  before insert or update or delete on public.clotures
  for each row execute function public.clotures_regles_roles();

-- ══════════════════════════════════════════════════════════════════
-- 7. AGENTS COMMERCIAUX — admin
-- ══════════════════════════════════════════════════════════════════
create or replace function public.commerciaux_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if public.role_jeton() <> 'admin' then perform public.refus_role('Gérer les agents commerciaux', 'l''administrateur'); end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists commerciaux_regles_roles_trg on public.commerciaux;
create trigger commerciaux_regles_roles_trg
  before insert or update or delete on public.commerciaux
  for each row execute function public.commerciaux_regles_roles();

-- ══════════════════════════════════════════════════════════════════
-- 8. FOURNISSEURS — gérant / admin
-- ══════════════════════════════════════════════════════════════════
create or replace function public.fournisseurs_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if public.role_jeton() not in ('gerant', 'admin') then perform public.refus_role('Gérer les fournisseurs', 'le gérant, l''administrateur'); end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists fournisseurs_regles_roles_trg on public.fournisseurs;
create trigger fournisseurs_regles_roles_trg
  before insert or update or delete on public.fournisseurs
  for each row execute function public.fournisseurs_regles_roles();

-- ══════════════════════════════════════════════════════════════════
-- 9. LA REMISE AU-DELÀ DE 3 % — devis (fiche client), proformas, commandes
-- ══════════════════════════════════════════════════════════════════
-- Un devis vit DANS la fiche du client (users.data.devis[]). Un employé qui
-- y pose une remise > 3 % (nouveau devis, ou devis dont la remise change)
-- doit être admin. Le client qui valide son devis ne change pas la remise :
-- il passe. Toute autre modification de la fiche est ignorée ici.
create or replace function public.users_regles_remise()
returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb; avant jsonb; pct numeric;
begin
  if public.jeton_de_service() or public.role_jeton() = 'admin' then return new; end if;
  if jsonb_typeof(new.data -> 'devis') <> 'array' then return new; end if;
  for d in select * from jsonb_array_elements(new.data -> 'devis') loop
    pct := coalesce((d ->> 'pct_remise')::numeric, 0);
    if pct > 3 then
      select x into avant from jsonb_array_elements(coalesce(old.data -> 'devis', '[]'::jsonb)) x where x ->> 'id' = d ->> 'id';
      if avant is null or coalesce((avant ->> 'pct_remise')::numeric, 0) is distinct from pct then
        perform public.refus_role('Remise supérieure à 3 % sur un devis', 'l''administrateur');
      end if;
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists users_regles_remise_trg on public.users;
create trigger users_regles_remise_trg
  before insert or update on public.users
  for each row execute function public.users_regles_remise();

create or replace function public.proformas_regles_remise()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.jeton_de_service() or public.role_jeton() = 'admin' then return new; end if;
  if coalesce((new.data ->> 'remise_pct')::numeric, 0) > 3
     and (tg_op = 'INSERT' or (old.data ->> 'remise_pct') is distinct from (new.data ->> 'remise_pct')) then
    perform public.refus_role('Remise supérieure à 3 % sur un proforma', 'l''administrateur');
  end if;
  return new;
end;
$$;
drop trigger if exists proformas_regles_remise_trg on public.proformas;
create trigger proformas_regles_remise_trg
  before insert or update on public.proformas
  for each row execute function public.proformas_regles_remise();

-- Une commande née d'un devis validé porte la remise DU DEVIS : le client
-- qui la crée passe si les deux remises sont identiques. Tout autre auteur
-- non-admin est limité à 3 %.
create or replace function public.commandes_regles_remise()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); pct numeric; pct_devis numeric;
begin
  if public.jeton_de_service() or r = 'admin' then return new; end if;
  pct := coalesce((new.data ->> 'remise_pct')::numeric, 0);
  if pct <= 3 then return new; end if;
  if tg_op = 'UPDATE' and (old.data ->> 'remise_pct') is not distinct from (new.data ->> 'remise_pct') then return new; end if;
  if r = 'client' and new.data -> 'origine_devis' is not null then
    select coalesce((d ->> 'pct_remise')::numeric, 0) into pct_devis
      from public.users u, jsonb_array_elements(coalesce(u.data -> 'devis', '[]'::jsonb)) d
      where u.id = new.data -> 'origine_devis' ->> 'client_id' and d ->> 'id' = new.data -> 'origine_devis' ->> 'devis_id';
    if pct_devis is not null and pct_devis = pct then return new; end if;
  end if;
  perform public.refus_role('Remise supérieure à 3 % sur une commande', 'l''administrateur');
  return new;
end;
$$;
drop trigger if exists commandes_regles_remise_trg on public.commandes;
create trigger commandes_regles_remise_trg
  before insert or update on public.commandes
  for each row execute function public.commandes_regles_remise();

-- Les aides ne sont pas appelables par les anonymes.
revoke all on function public.refus_role(text, text) from public, anon;
revoke all on function public.ventes_regles_roles() from public, anon;
revoke all on function public.dettes_regles_roles() from public, anon;
revoke all on function public.depenses_regles_roles() from public, anon;
revoke all on function public.produits_regles_roles() from public, anon;
revoke all on function public.ajustements_regles_roles() from public, anon;
revoke all on function public.clotures_regles_roles() from public, anon;
revoke all on function public.commerciaux_regles_roles() from public, anon;
revoke all on function public.fournisseurs_regles_roles() from public, anon;
revoke all on function public.users_regles_remise() from public, anon;
revoke all on function public.proformas_regles_remise() from public, anon;
revoke all on function public.commandes_regles_remise() from public, anon;

-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — à lancer juste après (attendu : 11 / true)
-- ══════════════════════════════════════════════════════════════════
select
  (select count(*) from pg_trigger where tgname like '%\_regles\_%\_trg' escape '\'
     and tgname in ('ventes_regles_roles_trg','dettes_regles_roles_trg','depenses_regles_roles_trg','produits_regles_roles_trg',
       'ajustements_regles_roles_trg','clotures_regles_roles_trg','commerciaux_regles_roles_trg','fournisseurs_regles_roles_trg',
       'users_regles_remise_trg','proformas_regles_remise_trg','commandes_regles_remise_trg')) as declencheurs_poses,
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'depenses'
     and policyname = 'role_lecture_seule_maj' and with_check like '%comptable%') as pointage_comptable_ouvert;

-- ══════════════════════════════════════════════════════════════════
-- POUR DÉSACTIVER UN VERROU (une ligne chacun) :
--   alter table public.ventes      disable trigger ventes_regles_roles_trg;
--   alter table public.dettes      disable trigger dettes_regles_roles_trg;
--   alter table public.depenses    disable trigger depenses_regles_roles_trg;
--   alter table public.produits    disable trigger produits_regles_roles_trg;
--   alter table public.ajustements disable trigger ajustements_regles_roles_trg;
--   alter table public.clotures    disable trigger clotures_regles_roles_trg;
--   alter table public.commerciaux disable trigger commerciaux_regles_roles_trg;
--   alter table public.fournisseurs disable trigger fournisseurs_regles_roles_trg;
--   alter table public.users       disable trigger users_regles_remise_trg;
--   alter table public.proformas   disable trigger proformas_regles_remise_trg;
--   alter table public.commandes   disable trigger commandes_regles_remise_trg;
-- (et « enable trigger » pour le remettre)
-- ══════════════════════════════════════════════════════════════════
