-- ============================================================
-- PAIE-4 — LE PREMIER MOIS DE PAIE SUIVI NE SE RÉÉCRIT QUE PAR L'ADMINISTRATEUR
-- ============================================================
--
-- POUR TIMO — « ferme aussi le premier mois de paie » (05/10/2026).
--
-- paie-3 a fermé le contrat de travail et les cases CNSS. Restait
-- « 📅 Paie suivie depuis » (paie_debut) : un employé pouvait le changer sur
-- sa propre fiche de paie. Il ne touche aucun argent — il décide à partir de
-- quel mois les bulletins s'affichent —, mais c'est un réglage de
-- l'administrateur.
--
-- CE QUE CE SCRIPT FAIT : il reprend paie-3 en entier (donc paie-1) et
-- ajoute paie_debut à la liste des cases que seul l'administrateur change.
-- Rien d'autre ne bouge. C'est le SEUL à coller ; le relancer est sans danger.
--
-- ⚠⚠ EN CAS DE PROBLÈME : recollez paie-3-contrat.sql, il reprend sa place
-- sans toucher aux données.
-- ============================================================

create or replace function public.interdire_escalade_paie()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  role_jeton text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  champ text;
begin
  -- L'éditeur SQL (et les scripts de maintenance) n'ont pas de jeton :
  -- sans cette sortie, ce déclencheur vous verrouillerait vous-même.
  if auth.jwt() is null or auth.jwt() = '{}'::jsonb then
    return new;
  end if;

  -- L'administrateur fait ce qu'il veut : c'est lui qui fixe les salaires.
  if role_jeton = 'admin' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- ⚠ L'application enregistre par « upsert », et PostgreSQL déclenche la
    -- branche INSERT même quand la ligne existe déjà. La branche UPDATE,
    -- elle, fera les vraies vérifications.
    if exists (select 1 from public.paie p where p.id = new.id) then
      return new;
    end if;
    raise exception 'Creation d''une fiche de paie refusee : reserve a l''administrateur';
  end if;

  -- ---- À partir d'ici : un employé modifie SA fiche. ----

  -- Les montants décidés par l'employeur ne bougent pas.
  if coalesce(new.data -> 'salaire_base', 'null'::jsonb)
       is distinct from coalesce(old.data -> 'salaire_base', 'null'::jsonb)
     or coalesce(new.data -> 'taux_avancement', 'null'::jsonb)
       is distinct from coalesce(old.data -> 'taux_avancement', 'null'::jsonb)
     or coalesce(new.data -> 'evolutions_salaire', 'null'::jsonb)
       is distinct from coalesce(old.data -> 'evolutions_salaire', 'null'::jsonb)
     or coalesce(new.data -> 'primes', 'null'::jsonb)
       is distinct from coalesce(old.data -> 'primes', 'null'::jsonb)
     or coalesce(new.data -> 'avances', 'null'::jsonb)
       is distinct from coalesce(old.data -> 'avances', 'null'::jsonb)
  then
    raise exception 'Modification refusee : salaire, primes et avances sont fixes par l''administrateur';
  end if;

  -- paie-3 (05/10/2026) : le contrat de travail et les cases CNSS ne bougent
  -- pas non plus. Le TYPE est cnss_code_type (une seule source avec la
  -- déclaration CNSS) ; cnss_assujetti commande la retenue CNSS du net.
  -- paie-4 (05/10/2026) : le premier mois de paie suivi aussi.
  foreach champ in array array['cnss_code_type', 'contrat_fin', 'cnss_date_embauche',
                               'cnss_date_sortie', 'cnss_code_motif_sortie',
                               'cnss_assujetti', 'cnss_matricule',
                               'cnss_numero_assurance', 'cnss_mensuel',
                               'paie_debut'] loop
    if coalesce(new.data -> champ, 'null'::jsonb)
         is distinct from coalesce(old.data -> champ, 'null'::jsonb) then
      raise exception 'Modification refusee : le contrat de travail, les informations CNSS et le premier mois de paie sont fixes par l''administrateur';
    end if;
  end loop;

  -- On ne s'invente pas un virement : leur nombre ne peut pas augmenter.
  -- (En changer le statut — « reçu, confirmé » — reste permis.)
  if jsonb_array_length(coalesce(new.data -> 'virements', '[]'::jsonb))
     > jsonb_array_length(coalesce(old.data -> 'virements', '[]'::jsonb))
  then
    raise exception 'Ajout d''un virement refuse : seul l''administrateur en enregistre';
  end if;

  -- On ne s'approuve pas son propre crédit : aucun crédit ne peut PASSER à
  -- « approuve » ou « solde ». En demander un (« en_attente ») reste permis.
  if exists (
    select 1
      from jsonb_array_elements(coalesce(new.data -> 'credits', '[]'::jsonb)) n
     where n ->> 'statut' in ('approuve', 'solde')
       and not exists (
         select 1
           from jsonb_array_elements(coalesce(old.data -> 'credits', '[]'::jsonb)) o
          where o ->> 'id' = n ->> 'id'
            and o ->> 'statut' = n ->> 'statut'
       )
  ) then
    raise exception 'Approbation de credit refusee : seul l''administrateur decide';
  end if;

  return new;
end $$;

drop trigger if exists interdire_escalade_paie_trg on public.paie;
create trigger interdire_escalade_paie_trg
  before insert or update on public.paie
  for each row execute function public.interdire_escalade_paie();


-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — doit répondre  true | true
-- ══════════════════════════════════════════════════════════════════
select
  exists (select 1 from pg_proc
           where proname = 'interdire_escalade_paie'
             and prosrc like '%contrat_fin%'
             and prosrc like '%cnss_assujetti%'
             and prosrc like '%cnss_mensuel%'
             and prosrc like '%paie_debut%') as contrat_cnss_et_debut_verrouilles,
  exists (select 1 from pg_trigger
           where tgname = 'interdire_escalade_paie_trg'
             and tgrelid = 'public.paie'::regclass) as declencheur_en_place;
