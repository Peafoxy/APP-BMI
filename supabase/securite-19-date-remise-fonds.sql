-- ============================================================
-- SÉCURITÉ 19 — LA DATE D'UNE REMISE DE FONDS DE CAISSE SE CORRIGE
-- (Timo, 15/09/2026, capture de la clôture du 14/09 à DEMAKPOE, écart
--  −40 800 : « pourquoi tu additionnes le fonds de caisse aux ventes ? »
--  puis, sur ces 50 000 : « l'argent était remis depuis [avant] »)
--
-- CE QUI S'EST PASSÉ : dans ⚙ Paramètres → 💼 Fonds de caisse, le bouton
-- « Régulariser » pré-remplissait la date à AUJOURD'HUI — alors qu'une
-- régularisation parle par définition d'un argent remis dans le PASSÉ. Les
-- 50 000 F remis des semaines plus tôt sont donc entrés dans la clôture du
-- jour, comme s'ils venaient d'arriver dans le tiroir : la caisse du 14/09
-- attendait 50 000 F de trop.
--
-- L'application ne pré-remplit plus cette date (2.101.227) et permet de
-- corriger celle d'une remise déjà enregistrée. Mais securite-16 refusait
-- TOUTE modification d'une remise, date comprise : le geste serait refusé
-- par la base. Ce script rouvre cette porte-là, et elle seule.
--
-- CE QUE CE SCRIPT CHANGE (il REMPLACE la fonction de securite-16 ; le
-- déclencheur, lui, ne bouge pas) :
--   • la DATE d'une remise (et la description, qui la porte en clair) peut
--     être corrigée par l'administrateur PRINCIPAL seul — c'est sa caisse ;
--   • tout le reste d'une remise enregistrée reste gravé pour TOUT LE MONDE :
--     montant, origine, banque, boutique, détail fonds_caisse ;
--   • la création reste inchangée : le DG seul, origine exigée, montant
--     forcé à − fonds_caisse.montant.
--
-- À coller dans Supabase → SQL Editor → Run. Banc : scripts/tester-argent-sql.sh.
-- ============================================================

create or replace function public.depenses_regles_fonds_caisse()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  avant jsonb; montant_remis numeric;
begin
  if public.jeton_de_service() then return new; end if;
  -- ⚠ UPSERT : PostgreSQL déclenche AVANT INSERT même quand la ligne existe.
  -- On relit donc la ligne avant de décider « création » ou « modification ».
  if tg_op = 'INSERT' then
    select d.data into avant from public.depenses d where d.id = new.id;
  else
    avant := old.data;
  end if;

  -- ── Une ligne qui porte (ou portait) un fonds de caisse remis. ──
  if (new.data ? 'fonds_caisse') or (avant ? 'fonds_caisse')
     or coalesce(new.data ->> 'categorie', '') = 'Fonds de caisse remis'
     or coalesce(avant ->> 'categorie', '') = 'Fonds de caisse remis' then

    -- Créer : le DG seul, et la ligne doit être bien formée.
    if avant is null then
      if not public.est_admin_principal() then
        perform public.refus_role('Remettre le fonds de caisse d''une boutique', 'l''administrateur principal (le DG)');
      end if;
      if not (new.data ? 'fonds_caisse') or coalesce(new.data ->> 'categorie', '') <> 'Fonds de caisse remis' then
        perform public.refus_role('Enregistrer un fonds de caisse sans son détail (fonds_caisse + catégorie « Fonds de caisse remis »)', 'personne');
      end if;
      if coalesce(new.data -> 'fonds_caisse' ->> 'origine', '') not in ('Chez le DG', 'BANQUE') then
        perform public.refus_role('Remettre un fonds de caisse sans dire d''où vient l''argent (Chez le DG, BANQUE)', 'personne');
      end if;
      montant_remis := coalesce((new.data -> 'fonds_caisse' ->> 'montant')::numeric, 0);
      if montant_remis <= 0 then
        perform public.refus_role('Remettre un fonds de caisse sans montant', 'personne');
      end if;
      -- Une remise est TOUJOURS une entrée du montant remis.
      new.data := jsonb_set(new.data, '{montant}', to_jsonb(-montant_remis), true);
      return new;
    end if;

    -- Modifier : SEULE la date (et la description qui la porte en clair).
    -- Tout le reste — montant, origine, banque, boutique, détail — reste
    -- gravé pour tout le monde, l'administrateur principal compris.
    if (avant - 'updated_at' - 'date' - 'description')
       is distinct from (new.data - 'updated_at' - 'date' - 'description') then
      perform public.refus_role('Modifier un fonds de caisse déjà remis (seule sa DATE se corrige)', 'personne');
    end if;
    -- …et corriger la date est le geste du DG : c'est sa caisse qui s'est vidée.
    if (avant - 'updated_at') is distinct from (new.data - 'updated_at')
       and not public.est_admin_principal() then
      perform public.refus_role('Corriger la date d''une remise de fonds de caisse', 'l''administrateur principal (le DG)');
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.depenses_regles_fonds_caisse() from public, anon;

-- Vérification : le déclencheur est toujours là, et la date se corrige.
select
  (select count(*) = 1 from pg_trigger where tgname = 'depenses_regles_fonds_caisse_trg') as declencheur_en_place,
  (select prosrc like '%seule sa DATE se corrige%' from pg_proc where proname = 'depenses_regles_fonds_caisse') as date_corrigeable;
