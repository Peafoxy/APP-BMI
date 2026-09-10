-- ============================================================
-- SÉCURITÉ 12 — LE REJET D'UN VERSEMENT DE FONDS
-- (décision Timo, 10/09/2026 : « l'admin ou le comptable doit avoir la
--  possibilité de rejeter une demande de versement » — « l'argent doit
--  retourner comme jamais versé »)
--
-- CE QUE POSE L'APPLICATION (2.101.122) : sur la dépense « Versement de
-- fonds » de la boutique (et sur l'entrée miroir chez le comptable), le
-- rejet écrit `versement_rejete_le` / `versement_rejete_par` /
-- `versement_rejet_motif` et met le MONTANT À 0 (le montant d'origine
-- reste dans `versement.montant`).
--
-- CE QUE CE SCRIPT VERROUILLE :
--   • qui rejette = qui valide : Chez le DG et BANQUE → l'administrateur
--     PRINCIPAL ; Chez le comptable → le comptable ;
--   • seulement un versement EN ATTENTE : déjà validé (versement_valide_le,
--     ou entrée miroir pointée decaisse_le) → refusé ;
--   • un rejet ne s'annule pas et ne se modifie pas ; un versement rejeté
--     ne se valide plus (ni versement_valide_le, ni pointage « Encaissé ») ;
--   • le montant d'une ligne rejetée est FORCÉ à 0 par le serveur, quoi
--     que l'application envoie — « jamais versé » ;
--   • une ligne ne se crée pas déjà rejetée ;
--   • le comptable (lecture seule) n'obtient que ce geste-là en plus de son
--     pointage : les champs du rejet + montant + description, et seulement
--     sur un versement « Chez le comptable ».
-- Remplace depenses_regles_roles (securite-8) et depenses_regles_versement
-- (securite-11). Upsert compris : la ligne existante est relue.
--
-- À coller dans Supabase → SQL Editor → Run. Banc : scripts/tester-argent-sql.sh.
-- ============================================================

-- ══ 1. LES RÔLES SUR LES DÉPENSES (remplace securite-8) — le comptable
--       peut aussi écrire un rejet ══
create or replace function public.depenses_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); avant jsonb; hors_rejet_avant jsonb; hors_rejet_apres jsonb;
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
  if r = 'comptable' then
    hors_rejet_avant := avant - 'decaisse_le' - 'decaisse_par' - 'updated_at';
    hors_rejet_apres := new.data - 'decaisse_le' - 'decaisse_par' - 'updated_at';
    -- Le rejet d'un versement (10/09/2026) : les champs du rejet, le montant
    -- et la description — uniquement quand la ligne devient rejetée ; le
    -- déclencheur du versement vérifie ensuite que c'est bien un versement
    -- « Chez le comptable » en attente.
    if avant ->> 'versement_rejete_le' is null and new.data ->> 'versement_rejete_le' is not null then
      hors_rejet_avant := hors_rejet_avant - 'versement_rejete_le' - 'versement_rejete_par' - 'versement_rejet_motif' - 'montant' - 'description';
      hors_rejet_apres := hors_rejet_apres - 'versement_rejete_le' - 'versement_rejete_par' - 'versement_rejet_motif' - 'montant' - 'description';
    end if;
    if hors_rejet_avant is distinct from hors_rejet_apres then
      perform public.refus_role('Modifier une dépense', 'un compte qui n''est pas en lecture seule');
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists depenses_regles_roles_trg on public.depenses;
create trigger depenses_regles_roles_trg
  before insert or update or delete on public.depenses
  for each row execute function public.depenses_regles_roles();

-- ══ 2. LE VERSEMENT DES FONDS (remplace securite-11) — validation ET rejet ══
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
  -- Créer un versement de fonds : gérant ou administrateur (securite-11).
  if avant is null and coalesce(new.data ->> 'categorie', '') = 'Versement de fonds' and r not in ('gerant', 'admin') then
    perform public.refus_role('Verser les fonds', 'le gérant, l''administrateur');
  end if;
  -- Une ligne ne naît jamais rejetée.
  if avant is null and new.data ->> 'versement_rejete_le' is not null then
    perform public.refus_role('Créer un versement déjà rejeté', 'personne');
  end if;
  -- Un rejet ne s'annule pas et ne se modifie pas.
  if avant ->> 'versement_rejete_le' is not null
     and ((avant -> 'versement_rejete_le') is distinct from (new.data -> 'versement_rejete_le')
       or (avant -> 'versement_rejete_par') is distinct from (new.data -> 'versement_rejete_par')
       or (avant -> 'versement_rejet_motif') is distinct from (new.data -> 'versement_rejet_motif')) then
    perform public.refus_role('Annuler ou modifier le rejet d''un versement', 'personne');
  end if;
  -- REJETER (la ligne devient rejetée) : qui valide rejette, en attente seulement.
  if avant ->> 'versement_rejete_le' is null and new.data ->> 'versement_rejete_le' is not null then
    if coalesce(new.data ->> 'categorie', '') <> 'Versement de fonds' then
      perform public.refus_role('Rejeter une ligne qui n''est pas un versement de fonds', 'personne');
    end if;
    if avant ? 'versement' then
      -- La sortie de la boutique.
      destination := avant -> 'versement' ->> 'destination';
      select true into miroir_pointe from public.depenses d
        where d.data ->> 'versement_id' = avant -> 'versement' ->> 'id' and d.data ->> 'decaisse_le' is not null limit 1;
      if avant ->> 'versement_valide_le' is not null or coalesce(miroir_pointe, false) then
        perform public.refus_role('Rejeter un versement déjà validé', 'personne');
      end if;
    elsif avant ? 'versement_id' then
      -- L'entrée miroir chez le comptable.
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
  -- Une ligne rejetée : montant FORCÉ à 0 (« jamais versé »), jamais validée.
  if new.data ->> 'versement_rejete_le' is not null then
    new.data := jsonb_set(new.data, '{montant}', '0'::jsonb, true);
    if new.data ->> 'versement_valide_le' is not null and (avant -> 'versement_valide_le') is distinct from (new.data -> 'versement_valide_le') then
      perform public.refus_role('Valider un versement rejeté', 'personne');
    end if;
    if new.data ->> 'decaisse_le' is not null and (avant -> 'decaisse_le') is distinct from (new.data -> 'decaisse_le') then
      perform public.refus_role('Encaisser un versement rejeté', 'personne');
    end if;
  end if;
  -- Valider un versement (Chez le DG, BANQUE) : l'administrateur principal (securite-10).
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
  (select prosrc like '%Rejeter un versement déjà validé%' from pg_proc where proname = 'depenses_regles_versement') as rejet_en_attente_seulement,
  (select prosrc like '%jsonb_set(new.data, ''{montant}'', ''0''::jsonb, true)%' from pg_proc where proname = 'depenses_regles_versement') as montant_force_a_zero,
  (select prosrc like '%versement_rejet_motif%' from pg_proc where proname = 'depenses_regles_roles') as comptable_peut_rejeter;
