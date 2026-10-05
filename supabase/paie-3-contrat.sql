-- ============================================================
-- PAIE-3 — LE CONTRAT DE TRAVAIL NE SE RÉÉCRIT QUE PAR L'ADMINISTRATEUR
-- ============================================================
--
-- POUR TIMO — CE QUI N'ALLAIT PAS.
--
-- Chaque employé peut écrire SA propre fiche de paie : c'est voulu, il
-- confirme ainsi un virement reçu ou demande un crédit BMI. Le verrou posé le
-- 19/08/2026 (paie-1) l'empêche de toucher à son salaire, ses primes, ses
-- avances, d'inventer un virement ou d'approuver son crédit.
--
-- Mais le contrat de travail, ajouté le 05/10/2026 (📄 Contrat, 🚪 Sortie
-- dans 👥 Utilisateurs), n'était PAS dans ce verrou. Un employé qui sait
-- s'y prendre pouvait donc changer lui-même :
--   • son type de contrat (CDD → CDI),
--   • la date de fin de son CDD (repoussée, ou effacée),
--   • sa date d'embauche,
--   • sa date et son motif de sortie.
-- L'écran ne le lui propose pas — seul l'administrateur a les boutons —,
-- mais la base, elle, ne disait pas non. Ces champs ne déplacent pas
-- d'argent ; ils changent ce qu'affichent le bulletin, la déclaration CNSS
-- et le rappel de fin de contrat.
--
-- CE QUE CE SCRIPT FAIT.
--
-- Il reprend le verrou de paie-1 MOT POUR MOT et y ajoute UN contrôle : pour
-- tout autre compte que l'administrateur, ces cinq cases doivent rester
-- telles qu'elles étaient. Rien d'autre ne change : l'employé confirme
-- toujours ses virements et demande toujours ses crédits ; l'administrateur
-- fait toujours tout.
--
-- Rien n'est déplacé, rien n'est effacé. Le relancer est sans danger.
--
-- ⚠⚠ EN CAS DE PROBLÈME, REVENIR AU VERROU D'AVANT ⚠⚠
-- Recollez la partie « 4. UN EMPLOYÉ NE S'AUGMENTE PAS TOUT SEUL » de
-- paie-1-table.sql (la fonction interdire_escalade_paie et son
-- déclencheur) : elle reprend sa place, sans toucher aux données.
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

  -- paie-3 (05/10/2026) : le contrat de travail ne bouge pas non plus.
  -- Le TYPE est cnss_code_type (une seule source avec la déclaration CNSS).
  foreach champ in array array['cnss_code_type', 'contrat_fin', 'cnss_date_embauche',
                               'cnss_date_sortie', 'cnss_code_motif_sortie'] loop
    if coalesce(new.data -> champ, 'null'::jsonb)
         is distinct from coalesce(old.data -> champ, 'null'::jsonb) then
      raise exception 'Modification refusee : le contrat de travail (type, fin, embauche, sortie) est fixe par l''administrateur';
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
             and prosrc like '%cnss_code_motif_sortie%'
             and prosrc like '%contrat_fin%') as contrat_verrouille,
  exists (select 1 from pg_trigger
           where tgname = 'interdire_escalade_paie_trg'
             and tgrelid = 'public.paie'::regclass) as declencheur_en_place;
