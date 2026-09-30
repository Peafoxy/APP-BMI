-- ============================================================
-- securite-34 — MODIFIER UNE PROFORMA AU-DELÀ DE 3 % : L'ADMINISTRATEUR SEUL
--
-- Timo, 30/09/2026 (« rendre une proforma modifiable » → « a, 2 oui, 3 oui »).
-- Une proforma se modifie désormais (même numéro, trace). Point 3 : celle
-- dont la remise dépasse 3 % (générale, ou sur un article) ne se modifie que
-- par l'administrateur. Sans ce verrou, un vendeur changerait les articles en
-- GARDANT la remise (la règle d'avant ne regardait que le pourcentage qui
-- change), puis l'encaisserait par la porte de securite-33 (« panier de la
-- proforma inchangé »).
--
-- Il REPREND la fonction des proformas de securite-14 en entier et n'y ajoute
-- que ce verrou. Rien d'autre ne change. C'est le seul à coller. Le relancer
-- est sans danger (create or replace).
-- ⚠ Ce que la base NE vérifie PAS : QUI a établi la proforma (l'auteur ou
-- l'administrateur, décision « a ») et qu'elle n'a pas été encaissée : c'est
-- l'application qui le décide.
-- ============================================================

create or replace function public.proformas_regles_remise()
returns trigger language plpgsql security definer set search_path = public as $$
declare avant jsonb; r text := public.role_jeton(); remises_changees boolean;
begin
  if public.jeton_de_service() then return new; end if;
  if tg_op = 'INSERT' then select p.data into avant from public.proformas p where p.id = new.id; else avant := old.data; end if;
  remises_changees := avant is null
    or (avant -> 'lignes') is distinct from (new.data -> 'lignes')
    or (avant -> 'remise_pct') is distinct from (new.data -> 'remise_pct')
    or (avant -> 'remise_montant') is distinct from (new.data -> 'remise_montant');
  if remises_changees and public.a_remise_sur_article(new.data -> 'lignes')
     and (coalesce((new.data ->> 'remise_pct')::numeric, 0) > 0 or coalesce((new.data ->> 'remise_montant')::numeric, 0) > 0) then
    perform public.refus_role('Remise sur un article ET remise générale sur le même proforma', 'personne (l''une ou l''autre)');
  end if;
  if r = 'admin' then return new; end if;
  -- ✏️ securite-34 : une proforma dont la remise dépasse 3 % (générale ou sur
  -- un article) ne se modifie que par l'administrateur — articles, quantités,
  -- prix ou remise. Sinon un vendeur changerait le panier en gardant la
  -- remise, puis l'encaisserait par la porte de securite-33.
  if avant is not null and remises_changees
     and (coalesce((avant ->> 'remise_pct')::numeric, 0) > 3 or public.remise_ligne_excessive(avant -> 'lignes')) then
    perform public.refus_role('Modifier une proforma dont la remise dépasse 3 %', 'l''administrateur');
  end if;
  if remises_changees and public.remise_ligne_excessive(new.data -> 'lignes') then
    perform public.refus_role('Remise supérieure à 3 % sur un article (proforma)', 'l''administrateur');
  end if;
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

-- Vérification (⚠ sans apostrophe dans le morceau cherché — piège du 24/09) :
-- attendu : true | true
select
  (select prosrc like '%Modifier une proforma dont la remise%' from pg_proc where proname = 'proformas_regles_remise') as verrou_modification,
  exists (select 1 from pg_trigger where tgname = 'proformas_regles_remise_trg') as declencheur_en_place;
