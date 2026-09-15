-- ============================================================
-- SÉCURITÉ 20 — LE FONDS DE CAISSE SE RÈGLE À LA HAUSSE ET À LA BAISSE
-- (Timo, 15/09/2026 : « le réglage dans les paramètres doit rester utile,
--  car à tout moment je peux augmenter ou diminuer le fonds de caisse et ça
--  devrait passer par les paramètres »)
--
-- Jusqu'ici, une ligne « Fonds de caisse remis » devait porter un
-- fonds_caisse.montant POSITIF : seule une remise était possible. Une baisse
-- du fonds — le DG qui récupère une partie de l'enveloppe — était refusée par
-- la base.
--
-- CE QUE CE SCRIPT CHANGE (il REMPLACE la fonction de securite-16/-19 ; le
-- déclencheur ne bouge pas) :
--   • fonds_caisse.montant peut être NÉGATIF : c'est une REPRISE, l'argent
--     sort de l'enveloppe de la boutique et rentre chez le DG ou en banque ;
--   • zéro reste refusé (un mouvement de fonds a toujours un montant) ;
--   • le montant de la ligne reste FORCÉ à − fonds_caisse.montant : une
--     remise est une entrée (ligne négative), une reprise une sortie (ligne
--     positive) — la convention de la caisse du comptable ;
--   • remettre comme reprendre = l'administrateur PRINCIPAL seul (le DG) ;
--   • une fois enregistré, seule la DATE se corrige (securite-19), par le DG.
--
-- À coller dans Supabase → SQL Editor → Run. Banc : scripts/tester-argent-sql.sh.
-- ============================================================

create or replace function public.depenses_regles_fonds_caisse()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  avant jsonb; montant_fonds numeric;
begin
  if public.jeton_de_service() then return new; end if;
  -- ⚠ UPSERT : PostgreSQL déclenche AVANT INSERT même quand la ligne existe.
  if tg_op = 'INSERT' then
    select d.data into avant from public.depenses d where d.id = new.id;
  else
    avant := old.data;
  end if;

  if (new.data ? 'fonds_caisse') or (avant ? 'fonds_caisse')
     or coalesce(new.data ->> 'categorie', '') = 'Fonds de caisse remis'
     or coalesce(avant ->> 'categorie', '') = 'Fonds de caisse remis' then

    -- Créer : le DG seul, et la ligne doit être bien formée.
    if avant is null then
      if not public.est_admin_principal() then
        perform public.refus_role('Régler le fonds de caisse d''une boutique', 'l''administrateur principal (le DG)');
      end if;
      if not (new.data ? 'fonds_caisse') or coalesce(new.data ->> 'categorie', '') <> 'Fonds de caisse remis' then
        perform public.refus_role('Enregistrer un fonds de caisse sans son détail (fonds_caisse + catégorie « Fonds de caisse remis »)', 'personne');
      end if;
      if coalesce(new.data -> 'fonds_caisse' ->> 'origine', '') not in ('Chez le DG', 'BANQUE') then
        perform public.refus_role('Bouger un fonds de caisse sans dire d''où vient l''argent, ou où il retourne (Chez le DG, BANQUE)', 'personne');
      end if;
      montant_fonds := coalesce((new.data -> 'fonds_caisse' ->> 'montant')::numeric, 0);
      -- Positif = remise (le DG donne) ; négatif = reprise (le DG récupère).
      if montant_fonds = 0 then
        perform public.refus_role('Bouger un fonds de caisse sans montant', 'personne');
      end if;
      new.data := jsonb_set(new.data, '{montant}', to_jsonb(-montant_fonds), true);
      return new;
    end if;

    -- Modifier : SEULE la date (et la description qui la porte en clair),
    -- par l'administrateur PRINCIPAL.
    if (avant - 'updated_at' - 'date' - 'description')
       is distinct from (new.data - 'updated_at' - 'date' - 'description') then
      perform public.refus_role('Modifier un fonds de caisse déjà enregistré (seule sa DATE se corrige)', 'personne');
    end if;
    if (avant - 'updated_at') is distinct from (new.data - 'updated_at')
       and not public.est_admin_principal() then
      perform public.refus_role('Corriger la date d''un mouvement de fonds de caisse', 'l''administrateur principal (le DG)');
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.depenses_regles_fonds_caisse() from public, anon;

-- Vérification : le déclencheur est là, la reprise est permise, la date se corrige.
select
  (select count(*) = 1 from pg_trigger where tgname = 'depenses_regles_fonds_caisse_trg') as declencheur_en_place,
  (select prosrc like '%le DG récupère%' from pg_proc where proname = 'depenses_regles_fonds_caisse') as reprise_permise,
  (select prosrc like '%seule sa DATE se corrige%' from pg_proc where proname = 'depenses_regles_fonds_caisse') as date_corrigeable;
