-- ============================================================
-- SÉCURITÉ 8 — CORRECTIF : L'UPSERT PRIS POUR UNE CRÉATION
-- (capture Timo, 08/09/2026 : « Demande de ravitaillement ne passe pas » —
--  « Le serveur REFUSE cet enregistrement (boutiques) — Créer une boutique :
--  réservé à l'administrateur (vous : vendeur) »)
--
-- LE DÉFAUT. L'application synchronise par UPSERT (« créer ou mettre à
-- jour »). PostgreSQL déclenche le contrôle AVANT INSERT même quand la ligne
-- existe déjà et que l'écriture n'est qu'une mise à jour. C'est le piège
-- déjà rencontré le 18/08/2026 sur la table des comptes
-- (roles-1b-correctif-upsert.sql) — il restait dans quatre règles de la
-- vague 3 :
--   • boutiques  : un vendeur qui DEMANDE un ravitaillement réécrit sa
--                  boutique (champ `demandes`) → « Créer une boutique » ;
--   • dépenses   : le comptable qui POINTE un décaissement → « Créer une
--                  dépense » ;
--   • ventes     : un vendeur qui touche une vente dont l'admin avait
--                  accordé une remise > 3 % → « Remise supérieure à 3 % » ;
--   • proformas  : idem.
-- Le banc les avait testés par UPDATE, jamais par UPSERT : il rassurait
-- sans protéger. Il rejoue maintenant les deux chemins.
--
-- LE CORRECTIF. Une ligne qui existe déjà n'est pas une création : dans la
-- branche INSERT, on relit la ligne existante et on applique les règles de
-- MISE À JOUR (les mêmes, mot pour mot). Une ligne vraiment nouvelle garde
-- les règles de création. Rien d'autre ne change.
--
-- À coller dans Supabase → SQL Editor → Run. Les opérations bloquées
-- repartiront toutes seules dans la minute (l'application réessaie toutes
-- les 20 secondes) — aucune reconnexion nécessaire.
-- Banc : scripts/tester-devis-chantiers-sql.sh et scripts/tester-argent-sql.sh.
-- ============================================================

-- ══ 1. BOUTIQUES (remplace la fonction de securite-6) ══
create or replace function public.boutiques_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); champ text; avant jsonb; reste_old jsonb; reste_new jsonb;
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if r <> 'admin' then perform public.refus_role('Supprimer une boutique', 'l''administrateur'); end if;
    return old;
  end if;
  -- ⚠ UPSERT : AVANT INSERT se déclenche même si la ligne existe déjà.
  if tg_op = 'INSERT' then
    select b.data into avant from public.boutiques b where b.id = new.id;
    if avant is null then
      if r <> 'admin' and not coalesce((new.data ->> 'terrain')::boolean, false) then
        perform public.refus_role('Créer une boutique', 'l''administrateur');
      end if;
      return new;
    end if;
  else
    avant := old.data;
  end if;
  reste_old := avant - 'demandes' - 'updated_at';
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

-- ══ 2. DÉPENSES (remplace la fonction de securite-4) ══
create or replace function public.depenses_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); avant jsonb;
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if r <> 'admin' then perform public.refus_role('Supprimer une dépense', 'l''administrateur'); end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    select d.data into avant from public.depenses d where d.id = new.id;
    if avant is null then
      if r = 'comptable' then perform public.refus_role('Créer une dépense', 'un compte qui n''est pas en lecture seule'); end if;
      return new;
    end if;
  else
    avant := old.data;
  end if;
  if avant ->> 'decaisse_le' is not null and new.data ->> 'decaisse_le' is null and r <> 'admin' then
    perform public.refus_role('Annuler un pointage du comptable', 'l''administrateur');
  end if;
  if r = 'comptable'
     and (avant - 'decaisse_le' - 'decaisse_par' - 'updated_at') is distinct from (new.data - 'decaisse_le' - 'decaisse_par' - 'updated_at') then
    perform public.refus_role('Modifier une dépense', 'un compte qui n''est pas en lecture seule');
  end if;
  return new;
end;
$$;
drop trigger if exists depenses_regles_roles_trg on public.depenses;
create trigger depenses_regles_roles_trg
  before insert or update or delete on public.depenses
  for each row execute function public.depenses_regles_roles();

-- ══ 2b. DÉPENSES — la politique d'INSERTION laisse passer le pointage ══
-- Le comptable est en lecture seule (ecriture = false). securite-4 lui avait
-- ouvert la MISE À JOUR de cette table (son seul geste : pointer un
-- décaissement). Mais l'application écrit par UPSERT, qui passe d'abord par
-- la politique d'INSERTION — restée fermée : son pointage restait bloqué
-- dans la file d'attente. On l'ouvre à une seule condition : la ligne
-- existe déjà (ce n'est donc pas une création). Le déclencheur ci-dessus ne
-- le laisse ensuite toucher que les deux champs du pointage.
create or replace function public.depense_existe(p_id text)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.depenses d where d.id = p_id);
$$;
revoke all on function public.depense_existe(text) from public, anon;
grant execute on function public.depense_existe(text) to authenticated, service_role;
drop policy if exists "role_lecture_seule" on public.depenses;
create policy "role_lecture_seule" on public.depenses
  as restrictive for insert to authenticated
  with check (
    coalesce((auth.jwt() -> 'app_metadata' ->> 'ecriture')::boolean, true)
    or (public.role_jeton() = 'comptable' and public.depense_existe(id))
  );

-- ══ 3. VENTES (remplace la fonction de securite-4) ══
create or replace function public.ventes_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); pct numeric; pct_commande numeric; avant jsonb;
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if r <> 'admin' then perform public.refus_role('Supprimer une vente', 'l''administrateur'); end if;
    return old;
  end if;
  if tg_op = 'INSERT' then select v.data into avant from public.ventes v where v.id = new.id; else avant := old.data; end if;
  pct := coalesce((new.data ->> 'remise_pct')::numeric, 0);
  if pct > 3 and r <> 'admin'
     and (avant is null or coalesce((avant ->> 'remise_pct')::numeric, 0) is distinct from pct) then
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

-- ══ 4. PROFORMAS (remplace la fonction de securite-4) ══
create or replace function public.proformas_regles_remise()
returns trigger language plpgsql security definer set search_path = public as $$
declare avant jsonb;
begin
  if public.jeton_de_service() or public.role_jeton() = 'admin' then return new; end if;
  if tg_op = 'INSERT' then select p.data into avant from public.proformas p where p.id = new.id; else avant := old.data; end if;
  if coalesce((new.data ->> 'remise_pct')::numeric, 0) > 3
     and (avant is null or (avant ->> 'remise_pct') is distinct from (new.data ->> 'remise_pct')) then
    perform public.refus_role('Remise supérieure à 3 % sur un proforma', 'l''administrateur');
  end if;
  return new;
end;
$$;
drop trigger if exists proformas_regles_remise_trg on public.proformas;
create trigger proformas_regles_remise_trg
  before insert or update on public.proformas
  for each row execute function public.proformas_regles_remise();

-- VÉRIFICATION — doit afficher : 4 | true
select
  (select count(*) from pg_proc where proname in ('boutiques_regles_roles', 'depenses_regles_roles', 'ventes_regles_roles', 'proformas_regles_remise')
     and prosrc like '%avant is null%') as regles_corrigees,
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'depenses'
     and policyname = 'role_lecture_seule' and with_check like '%depense_existe%') as pointage_comptable_ouvert;
