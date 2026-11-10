-- ============================================================
-- SÉCURITÉ 52 — 💵 LA DOTATION DE CAISSE REMISE À UN GÉRANT DÉSIGNÉ
-- (Timo, 10/11/2026 : « je préfère que celui qui dote ait la possibilité de
--  choisir le gérant à qui il a donné si la boutique comporte plusieurs
--  gérants… la dotation ira vers celui qui a réellement reçu l'argent »
--  → « oui lance »)
--
-- Reprend securite-51 EN ENTIER et n'ajoute qu'UNE règle : une dotation qui
-- porte `remise_tiroir.pour_id` (le gérant choisi) ne se confirme « ✅ Reçu »
-- QUE par ce gérant-là (l'identifiant de son jeton). Une dotation d'avant,
-- sans `pour_id`, reste confirmable par tout gérant de la boutique.
-- Le gérant désigné ne se change pas ensuite (la confirmation ne laisse
-- bouger que recue_le, recue_heure, recue_par, recue_par_id).
--
-- C'est le SEUL à coller (il remplace la fonction de securite-51).
-- À coller dans Supabase → SQL Editor → Run. Banc : scripts/tester-argent-sql.sh.
-- ============================================================

create or replace function public.depenses_regles_remise_tiroir()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  avant jsonb; r_av jsonb; r_ap jsonb; montant_avant numeric;
begin
  if public.jeton_de_service() then return new; end if;
  -- ⚠ UPSERT : PostgreSQL déclenche AVANT INSERT même quand la ligne existe.
  if tg_op = 'INSERT' then
    select d.data into avant from public.depenses d where d.id = new.id;
  else
    avant := old.data;
  end if;

  -- ⚠ `avant` est NULL pour une vraie création : `avant ? …` vaut alors NULL,
  -- et « not (… or NULL) » aussi — sans coalesce, TOUTE dépense nouvelle
  -- entrerait ici et serait refusée (vu au banc le 10/11/2026).
  if not (coalesce(new.data ? 'remise_tiroir', false) or coalesce(avant ? 'remise_tiroir', false)
     or coalesce(new.data ->> 'categorie', '') = 'Dotation de caisse'
     or coalesce(avant ->> 'categorie', '') = 'Dotation de caisse') then
    return new;
  end if;

  r_ap := coalesce(new.data -> 'remise_tiroir', '{}'::jsonb);

  -- ── Créer : le DG seul, une ligne bien formée. ──
  if avant is null then
    if not public.est_admin_principal() then
      perform public.refus_role('Faire une dotation de caisse à une boutique', 'l''administrateur principal (le DG)');
    end if;
    if not (new.data ? 'remise_tiroir') or coalesce(new.data ->> 'categorie', '') <> 'Dotation de caisse' then
      perform public.refus_role('Enregistrer une dotation de caisse sans son détail (remise_tiroir + catégorie)', 'personne');
    end if;
    if coalesce(r_ap ->> 'source', '') not in ('Chez le DG', 'BANQUE', 'Chez le comptable') then
      perform public.refus_role('Faire une dotation de caisse sans dire d''où il vient (Chez le DG, BANQUE, Chez le comptable)', 'personne');
    end if;
    if coalesce((new.data ->> 'montant')::numeric, 0) >= 0 then
      perform public.refus_role('Enregistrer une dotation de caisse sans montant (une entrée : montant négatif)', 'personne');
    end if;
    if btrim(coalesce(r_ap ->> 'motif', '')) = '' then
      perform public.refus_role('Enregistrer une dotation de caisse sans motif', 'personne');
    end if;
    if r_ap ? 'recue_le' or r_ap ? 'annulee_le' then
      perform public.refus_role('Créer une dotation de caisse déjà reçue ou annulée (le gérant confirme lui-même)', 'personne');
    end if;
    return new;
  end if;

  r_av := coalesce(avant -> 'remise_tiroir', '{}'::jsonb);
  -- La même ligne renvoyée telle quelle (synchronisation) passe.
  if (avant - 'updated_at') is not distinct from (new.data - 'updated_at') then
    return new;
  end if;

  -- ── Confirmer « ✅ Reçu » : le gérant de CETTE boutique, une seule fois. ──
  if r_av ->> 'recue_le' is null and r_av ->> 'annulee_le' is null and r_ap ->> 'recue_le' is not null then
    if public.role_jeton() <> 'gerant'
       or coalesce(auth.jwt() -> 'app_metadata' ->> 'boutique', '') <> coalesce(avant ->> 'boutique', '') then
      perform public.refus_role('Confirmer la réception d''une dotation de caisse', 'le gérant de cette boutique');
    end if;
    if coalesce(r_av ->> 'pour_id', '') <> ''
       and lower(r_av ->> 'pour_id') <> lower(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1)) then
      perform public.refus_role('Confirmer une dotation de caisse remise à un autre gérant', 'le gérant à qui elle a été remise');
    end if;
    if (avant - 'updated_at' - 'remise_tiroir') is distinct from (new.data - 'updated_at' - 'remise_tiroir')
       or (r_av) is distinct from (r_ap - 'recue_le' - 'recue_heure' - 'recue_par' - 'recue_par_id') then
      perform public.refus_role('Changer autre chose qu''« ✅ Reçu » sur une dotation de caisse', 'personne');
    end if;
    return new;
  end if;

  -- ── Annuler : le DG, tant qu'elle n'est pas reçue ; motif ; montant à 0. ──
  if r_av ->> 'recue_le' is null and r_av ->> 'annulee_le' is null and r_ap ->> 'annulee_le' is not null then
    if not public.est_admin_principal() then
      perform public.refus_role('Annuler une dotation de caisse', 'l''administrateur principal (le DG)');
    end if;
    if btrim(coalesce(r_ap ->> 'annulee_motif', '')) = '' then
      perform public.refus_role('Annuler une dotation de caisse sans motif', 'personne');
    end if;
    montant_avant := coalesce((avant ->> 'montant')::numeric, 0);
    if (avant - 'updated_at' - 'remise_tiroir' - 'montant') is distinct from (new.data - 'updated_at' - 'remise_tiroir' - 'montant')
       or (r_av) is distinct from (r_ap - 'annulee_le' - 'annulee_par' - 'annulee_motif' - 'montant') then
      perform public.refus_role('Changer autre chose que l''annulation d''une dotation de caisse', 'personne');
    end if;
    new.data := jsonb_set(new.data, '{montant}', '0'::jsonb, true);
    new.data := jsonb_set(new.data, '{remise_tiroir,montant}', to_jsonb(-montant_avant), true);
    return new;
  end if;

  perform public.refus_role('Modifier une dotation de caisse (reçue ou annulée, elle ne se réécrit plus)', 'personne');
  return new;
end;
$$;

revoke all on function public.depenses_regles_remise_tiroir() from public, anon;

drop trigger if exists depenses_regles_remise_tiroir_trg on public.depenses;
create trigger depenses_regles_remise_tiroir_trg
  before insert or update on public.depenses
  for each row execute function public.depenses_regles_remise_tiroir();

-- VÉRIFICATION — doit afficher : true | true | true
-- (on cherche des morceaux SANS apostrophe : dans le corps de la fonction
-- elles sont écrites doublées, une recherche avec une seule ne trouverait rien)
select
  (select count(*) = 1 from pg_trigger where tgname = 'depenses_regles_remise_tiroir_trg') as declencheur_en_place,
  (select prosrc like '%le gérant de cette boutique%' from pg_proc where proname = 'depenses_regles_remise_tiroir') as gerant_confirme,
  (select prosrc like '%le gérant à qui elle a été remise%' from pg_proc where proname = 'depenses_regles_remise_tiroir') as gerant_designe_seul;
