-- ============================================================
-- securite-46 — LA REMISE COMMUNE DE LA CARTE DE FIDÉLITÉ (29/10/2026)
--
-- Timo : « Régler dans paramètres 3 % pour tous les clients… et d'une
-- manière individuelle, on peut modifier pour chacun », puis « A a » (les
-- cartes déjà posées suivent la remise commune) et « B oui » (50 % au plus).
--
-- Une carte SUIT la remise commune (réglée dans ⚙ Paramètres, champ
-- `fidelite_pct_commun` sur les boutiques, 3 % si rien n'est réglé), SAUF
-- si elle porte `a_lui: true` : elle garde alors SON pourcentage (`pct`).
--
-- Ce script ne change QU'UNE fonction, `remise_de_la_carte` (securite-45),
-- et en ajoute une, `pct_commun_carte`. `ventes_regles_roles` et la règle
-- de la fiche (le principal seul) ne bougent pas.
--
-- ⚠ LE COUPLE : sans ce script, l'écran applique 3 % à une carte qui suit
-- la remise commune, et la base attend l'ancien pourcentage de la fiche —
-- la vente est refusée et tout le lot reste coincé.
-- À coller dans Supabase → SQL Editor → Run. Banc : tester-argent-sql.sh.
-- ============================================================

-- La remise commune réglée sur la boutique (par son NOM), 3 % si rien n'est
-- réglé. `max()` garantit toujours UNE ligne.
create or replace function public.pct_commun_carte(nom text)
returns numeric language sql stable set search_path = public as $$
  select coalesce(max(nullif(b.data ->> 'fidelite_pct_commun', '')::numeric), 3)
  from public.boutiques b where b.data ->> 'nom' = nom;
$$;
revoke all on function public.pct_commun_carte(text) from public, anon;
grant execute on function public.pct_commun_carte(text) to authenticated, service_role;

create or replace function public.remise_de_la_carte(vente jsonb)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare f jsonb; num text := vente -> 'carte_fidelite' ->> 'numero'; attendu numeric;
begin
  if coalesce(num, '') = '' then return false; end if;
  select u.data -> 'fidelite' into f from public.users u
   where u.data -> 'fidelite' ->> 'numero' = num
     and coalesce((u.data -> 'fidelite' ->> 'active')::boolean, true)
   limit 1;
  if f is null then return false; end if;
  -- Une remise À LUI : son pourcentage ; sinon la remise commune.
  if coalesce((f ->> 'a_lui')::boolean, false) then
    attendu := (f ->> 'pct')::numeric;
  else
    attendu := public.pct_commun_carte(vente ->> 'boutique');
  end if;
  if coalesce(attendu, -1) <> coalesce((vente ->> 'remise_pct')::numeric, 0) then return false; end if;
  if public.a_remise_sur_article(vente -> 'articles') then return false; end if;
  return true;
end;
$$;
revoke all on function public.remise_de_la_carte(jsonb) from public, anon;
grant execute on function public.remise_de_la_carte(jsonb) to authenticated, service_role;

-- VÉRIFICATION — doit afficher : true | true | true
select
  exists (select 1 from pg_proc where proname = 'pct_commun_carte') as remise_commune_lue,
  (select prosrc like '%a_lui%' from pg_proc where proname = 'remise_de_la_carte') as remise_a_lui_lue,
  (select prosrc like '%remise_de_la_carte%' from pg_proc where proname = 'ventes_regles_roles') as ventes_ouvertes_a_la_carte;
