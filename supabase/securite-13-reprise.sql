-- ============================================================
-- SÉCURITÉ 13 — LA REPRISE D'UN ARTICLE PAR LE CLIENT
-- (décision Timo, 10/09/2026 : « un article vendu, mais sur le champ le
--  client ne veut plus le prendre » → « Reprise pour l'administrateur
--  principal seul »)
--
-- CE QUE POSE L'APPLICATION (2.101.130) : la reprise est notée SUR la vente
-- (`reprises`, liste qui ne fait que grandir), l'article revient au stock
-- par un ajustement de type `reprise_client`, et l'argent rendu est une
-- dépense « Remboursement client ».
--
-- CE QUE CE SCRIPT VERROUILLE :
--   • écrire ou changer `reprises` sur une vente → administrateur PRINCIPAL
--     seul, et la liste ne rétrécit jamais (même pour lui) ;
--   • un ajustement `reprise_client` → administrateur principal seul ;
--   • créer une dépense « Remboursement client » → administrateur principal
--     seul (une ligne existante n'est pas une création : upsert relu).
-- Remplace ventes_regles_roles (securite-8), ajustements_regles_roles
-- (securite-4) et depenses_regles_versement (securite-12).
--
-- À coller dans Supabase → SQL Editor → Run. Banc : scripts/tester-argent-sql.sh.
-- ============================================================

-- ══ 1. VENTES (remplace securite-8) — remise > 3 % : admin ; reprises : principal ══
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
  -- La reprise d'un article (10/09/2026) : le principal seul, et jamais en arrière.
  if (coalesce(avant, '{}'::jsonb) -> 'reprises') is distinct from (new.data -> 'reprises') then
    if not public.est_admin_principal() then
      perform public.refus_role('Reprendre un article vendu', 'l''administrateur principal');
    end if;
    if coalesce(jsonb_array_length(new.data -> 'reprises'), 0) < coalesce(jsonb_array_length(coalesce(avant, '{}'::jsonb) -> 'reprises'), 0) then
      perform public.refus_role('Effacer une reprise', 'personne');
    end if;
  end if;
  pct := coalesce((new.data ->> 'remise_pct')::numeric, 0);
  if pct > 3 and r <> 'admin'
     and (avant is null or coalesce((avant ->> 'remise_pct')::numeric, 0) is distinct from pct) then
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

-- ══ 2. AJUSTEMENTS (remplace securite-4) — reprise_client : principal ══
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
  if t = 'reprise_client' then
    if not public.est_admin_principal() then perform public.refus_role('Reprendre un article vendu (retour au stock)', 'l''administrateur principal'); end if;
    return new;
  end if;
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

-- ══ 3. DÉPENSES (remplace securite-12) — « Remboursement client » : principal ══
create or replace function public.depenses_regles_versement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  avant jsonb; r text := public.role_jeton();
  destination text; sortie jsonb; miroir_pointe boolean := false;
begin
  if public.jeton_de_service() then return new; end if;
  if tg_op = 'INSERT' then
    select d.data into avant from public.depenses d where d.id = new.id;
  else
    avant := old.data;
  end if;
  if avant is null and coalesce(new.data ->> 'categorie', '') = 'Versement de fonds' and r not in ('gerant', 'admin') then
    perform public.refus_role('Verser les fonds', 'le gérant, l''administrateur');
  end if;
  -- Rendre l'argent d'une reprise (10/09/2026) : l'administrateur principal seul.
  if avant is null and coalesce(new.data ->> 'categorie', '') = 'Remboursement client' and not public.est_admin_principal() then
    perform public.refus_role('Rembourser un client (reprise d''un article)', 'l''administrateur principal');
  end if;
  if avant is null and new.data ->> 'versement_rejete_le' is not null then
    perform public.refus_role('Créer un versement déjà rejeté', 'personne');
  end if;
  if avant ->> 'versement_rejete_le' is not null
     and ((avant -> 'versement_rejete_le') is distinct from (new.data -> 'versement_rejete_le')
       or (avant -> 'versement_rejete_par') is distinct from (new.data -> 'versement_rejete_par')
       or (avant -> 'versement_rejet_motif') is distinct from (new.data -> 'versement_rejet_motif')) then
    perform public.refus_role('Annuler ou modifier le rejet d''un versement', 'personne');
  end if;
  if avant ->> 'versement_rejete_le' is null and new.data ->> 'versement_rejete_le' is not null then
    if coalesce(new.data ->> 'categorie', '') <> 'Versement de fonds' then
      perform public.refus_role('Rejeter une ligne qui n''est pas un versement de fonds', 'personne');
    end if;
    if avant ? 'versement' then
      destination := avant -> 'versement' ->> 'destination';
      select true into miroir_pointe from public.depenses d
        where d.data ->> 'versement_id' = avant -> 'versement' ->> 'id' and d.data ->> 'decaisse_le' is not null limit 1;
      if avant ->> 'versement_valide_le' is not null or coalesce(miroir_pointe, false) then
        perform public.refus_role('Rejeter un versement déjà validé', 'personne');
      end if;
    elsif avant ? 'versement_id' then
      select d.data into sortie from public.depenses d where d.data -> 'versement' ->> 'id' = avant ->> 'versement_id' limit 1;
      destination := coalesce(sortie -> 'versement' ->> 'destination', 'Chez le comptable');
      if avant ->> 'decaisse_le' is not null then
        perform public.refus_role('Rejeter un versement déjà encaissé', 'personne');
      end if;
    else
      perform public.refus_role('Rejeter une ligne qui n''est pas un versement de fonds', 'personne');
    end if;
    if destination = 'Chez le comptable' then
      if r <> 'comptable' then perform public.refus_role('Rejeter un versement « Chez le comptable »', 'le comptable'); end if;
    else
      if not public.est_admin_principal() then perform public.refus_role('Rejeter un versement (Chez le DG, BANQUE)', 'l''administrateur principal (le DG)'); end if;
    end if;
    if not (new.data ? 'versement_rejet_motif') or btrim(coalesce(new.data ->> 'versement_rejet_motif', '')) = '' then
      perform public.refus_role('Rejeter un versement sans motif', 'personne');
    end if;
  end if;
  if new.data ->> 'versement_rejete_le' is not null then
    new.data := jsonb_set(new.data, '{montant}', '0'::jsonb, true);
    if new.data ->> 'versement_valide_le' is not null and (avant -> 'versement_valide_le') is distinct from (new.data -> 'versement_valide_le') then
      perform public.refus_role('Valider un versement rejeté', 'personne');
    end if;
    if new.data ->> 'decaisse_le' is not null and (avant -> 'decaisse_le') is distinct from (new.data -> 'decaisse_le') then
      perform public.refus_role('Encaisser un versement rejeté', 'personne');
    end if;
  end if;
  if (coalesce(avant, '{}'::jsonb) -> 'versement_valide_le') is distinct from (new.data -> 'versement_valide_le')
     or (coalesce(avant, '{}'::jsonb) -> 'versement_valide_par') is distinct from (new.data -> 'versement_valide_par') then
    if not public.est_admin_principal() then
      perform public.refus_role('Valider un versement de fonds (Chez le DG, BANQUE)', 'l''administrateur principal (le DG)');
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists depenses_regles_versement_trg on public.depenses;
create trigger depenses_regles_versement_trg
  before insert or update on public.depenses
  for each row execute function public.depenses_regles_versement();

-- VÉRIFICATION — doit afficher : true | true | true
select
  (select prosrc like '%Reprendre un article vendu%' from pg_proc where proname = 'ventes_regles_roles') as reprise_principal,
  (select prosrc like '%reprise_client%' from pg_proc where proname = 'ajustements_regles_roles') as stock_principal,
  (select prosrc like '%Remboursement client%' from pg_proc where proname = 'depenses_regles_versement') as remboursement_principal;
