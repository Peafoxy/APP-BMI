-- ============================================================
-- SÉCURITÉ 16 — LE FONDS DE CAISSE REMIS À UNE BOUTIQUE PAR LE DG
-- (Timo, 14/09/2026 : « on avait aussi donné un fonds de caisse de 50 000…
--  il ne faut pas mélanger le fonds de caisse avec ce qu'on va verser…
--  on ne verse jamais le fonds de caisse »)
--
-- CE QUE POSE L'APPLICATION (2.101.202, lib/versements.js,
-- construireRemiseFonds) : une ligne de `depenses` sur la boutique, catégorie
-- « Fonds de caisse remis », montant NÉGATIF (une entrée dans le tiroir,
-- convention déjà en place pour la caisse du comptable), espèces, et le
-- détail dans `fonds_caisse` : {id, origine: "Chez le DG" | "BANQUE", banque,
-- montant (positif), note}. Ce n'est ni une vente, ni une charge : c'est
-- l'argent de BMI qui passe de chez le DG (ou de la banque) au tiroir.
--
-- CE QUE CE SCRIPT VERROUILLE (nouveau déclencheur, à côté des trois
-- déclencheurs existants sur `depenses`, qui restent tels quels) :
--   • créer une remise de fonds = l'administrateur PRINCIPAL seul (le DG) —
--     c'est SA caisse qui se vide ;
--   • le montant de la ligne est FORCÉ à − fonds_caisse.montant (une remise
--     est toujours une entrée, du montant remis) ;
--   • une remise enregistrée ne se modifie plus (montant, origine, boutique,
--     date, détail) — personne ; la supprimer reste le geste de l'admin
--     (règle générale des dépenses, depenses_regles_roles).
--
-- À coller dans Supabase → SQL Editor → Run. Banc : scripts/tester-argent-sql.sh.
-- ============================================================

create or replace function public.depenses_regles_fonds_caisse()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  avant jsonb; montant_remis numeric;
begin
  if public.jeton_de_service() then return new; end if;
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

    -- Modifier : personne (montant, origine, boutique, date, détail).
    if (avant - 'updated_at') is distinct from (new.data - 'updated_at') then
      perform public.refus_role('Modifier un fonds de caisse déjà remis', 'personne');
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists depenses_regles_fonds_caisse_trg on public.depenses;
create trigger depenses_regles_fonds_caisse_trg
  before insert or update on public.depenses
  for each row execute function public.depenses_regles_fonds_caisse();

-- Supabase donne les droits par défaut à anon sur toute nouvelle fonction.
revoke all on function public.depenses_regles_fonds_caisse() from public, anon;

-- VÉRIFICATION — doit afficher : true | true
select
  (select count(*) = 1 from pg_trigger where tgname = 'depenses_regles_fonds_caisse_trg') as declencheur_pose,
  (select prosrc like '%Remettre le fonds de caisse%' from pg_proc where proname = 'depenses_regles_fonds_caisse') as dg_seul;
