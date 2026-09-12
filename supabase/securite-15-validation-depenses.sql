-- ============================================================
-- SÉCURITÉ 15 — LA VALIDATION DES DÉPENSES PAR LE DG, LES AVANCES DE FRAIS
-- (décisions Timo, 12/09/2026 : « on met un seuil : à partir de 5 mil, il
--  faut valider ; moins de 5 mil pas besoin » — « seules les dépenses
--  validées comptent » — « la clôture impossible s'il y a des dépenses liées
--  à la caisse qui ne sont pas validées »)
--
-- CE QUE POSE L'APPLICATION (2.101.156, lib/validationDepenses.js) sur une
-- dépense saisie dans 📤 Dépenses :
--   • `paye_avec` : "caisse" (la caisse de la boutique), "avance" (l'employé a
--     payé de sa poche), "dg" (argent remis par le DG) ;
--   • `validation` : absent (moins de 5 000 F : rien à valider),
--     {statut:"attente"}, {statut:"validee", le, par, auto?},
--     {statut:"rejetee", le, par, motif, montant} — le montant de la ligne
--     passe alors à 0, le montant d'origine reste dans `validation.montant` ;
--   • `remboursement` : {le, par, moyen, mois?, depense_id?} sur une avance
--     remboursée (gérant / admin depuis la caisse, admin avec le salaire ou
--     par le DG).
--
-- CE QUE CE SCRIPT VERROUILLE (nouveau déclencheur, à côté de
-- depenses_regles_roles et depenses_regles_versement, qui restent tels quels) :
--   • valider ou rejeter (passer de « attente » à « validee » / « rejetee »)
--     = l'administrateur PRINCIPAL seul ; créer une ligne déjà validée ou
--     rejetée aussi (c'est le DG qui saisit sa propre dépense) ;
--   • un rejet exige un motif, et le serveur FORCE le montant à 0 ;
--   • une validation ou un rejet ne se défont ni ne se modifient (personne) ;
--   • une dépense rejetée ne se valide plus, une validée ne se rejette plus ;
--   • marquer une avance remboursée = gérant / admin ; le remboursement ne se
--     défait pas.
--
-- À coller dans Supabase → SQL Editor → Run. Banc : scripts/tester-argent-sql.sh.
-- ============================================================

create or replace function public.depenses_regles_validation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  avant jsonb; r text := public.role_jeton();
  s_avant text; s_apres text;
begin
  if public.jeton_de_service() then return new; end if;
  if tg_op = 'INSERT' then
    select d.data into avant from public.depenses d where d.id = new.id;
  else
    avant := old.data;
  end if;
  s_avant := coalesce(avant -> 'validation' ->> 'statut', '');
  s_apres := coalesce(new.data -> 'validation' ->> 'statut', '');

  -- ── Créer une ligne déjà tranchée : le DG seul (sa propre dépense). ──
  if avant is null and s_apres in ('validee', 'rejetee') and not public.est_admin_principal() then
    perform public.refus_role('Créer une dépense déjà validée ou rejetée', 'l''administrateur principal (le DG)');
  end if;

  -- ── Une décision prise ne bouge plus. ──
  if s_avant in ('validee', 'rejetee') then
    if s_apres <> s_avant then
      perform public.refus_role('Défaire la validation ou le rejet d''une dépense', 'personne');
    end if;
    if (avant -> 'validation') is distinct from (new.data -> 'validation') then
      perform public.refus_role('Modifier la validation ou le rejet d''une dépense', 'personne');
    end if;
  end if;

  -- ── Passer de « attente » (ou de rien) à « validee » / « rejetee » : le DG seul. ──
  if avant is not null and s_avant not in ('validee', 'rejetee') and s_apres in ('validee', 'rejetee') then
    if not public.est_admin_principal() then
      perform public.refus_role('Valider ou rejeter une dépense', 'l''administrateur principal (le DG)');
    end if;
  end if;

  -- ── Un rejet : motif obligatoire, montant forcé à 0. ──
  if s_apres = 'rejetee' then
    if btrim(coalesce(new.data -> 'validation' ->> 'motif', '')) = '' then
      perform public.refus_role('Rejeter une dépense sans motif', 'personne');
    end if;
    new.data := jsonb_set(new.data, '{montant}', '0'::jsonb, true);
  end if;

  -- ── Le remboursement d'une avance : gérant / admin, et ne se défait pas. ──
  if (coalesce(avant, '{}'::jsonb) -> 'remboursement') is distinct from (new.data -> 'remboursement') then
    if avant ? 'remboursement' then
      perform public.refus_role('Défaire ou modifier le remboursement d''une avance de frais', 'personne');
    end if;
    if r not in ('gerant', 'admin') then
      perform public.refus_role('Rembourser une avance de frais', 'le gérant, l''administrateur');
    end if;
    if r = 'gerant' and coalesce(new.data -> 'remboursement' ->> 'moyen', '') <> 'caisse' then
      perform public.refus_role('Rembourser une avance avec le salaire ou par le DG', 'l''administrateur');
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists depenses_regles_validation_trg on public.depenses;
create trigger depenses_regles_validation_trg
  before insert or update on public.depenses
  for each row execute function public.depenses_regles_validation();

-- Supabase donne les droits par défaut à anon sur toute nouvelle fonction.
revoke all on function public.depenses_regles_validation() from public, anon;

-- VÉRIFICATION — doit afficher : true | true
select
  (select count(*) = 1 from pg_trigger where tgname = 'depenses_regles_validation_trg') as declencheur_pose,
  (select prosrc like '%Rejeter une dépense sans motif%' from pg_proc where proname = 'depenses_regles_validation') as rejet_avec_motif;
