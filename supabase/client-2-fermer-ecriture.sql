-- ============================================================
-- VAGUE 2 — CE QU'UN COMPTE CLIENT N'A PLUS LE DROIT D'ÉCRIRE
-- ============================================================
-- CE QUE FAIT CE SCRIPT, EN UNE PHRASE : il empêche un compte client de
-- toucher à l'argent — sa dette, le montant d'une vente, le prix d'un
-- article — sans casser ce que son espace fait légitimement.
--
-- POURQUOI (audit du 29/08/2026, mesuré sur base d'essai)
--
--   Un client efface sa propre dette de 800 000 F ......... accepté
--   Un client change le montant d'une vente .............. accepté
--   Un client change le prix d'un article ................ accepté
--   Un client invente une vente de toutes pièces ......... accepté
--
-- La clé publique de l'application est dans le code envoyé au navigateur :
-- elle est connue de tous. Un client qui parle directement au serveur, sans
-- passer par l'écran, pouvait donc faire tout cela.
--
-- ⚠ POURQUOI ON NE FERME PAS SIMPLEMENT TOUT — c'est le point délicat.
-- Son espace ÉCRIT VRAIMENT dans deux de ces tables :
--
--   • `dettes` — en validant un devis « pose seule », le client crée
--     lui-même la dette correspondante (EspaceClient.jsx, finaliserValidation).
--     On lui laisse donc la CRÉATION, on lui retire la MODIFICATION.
--
--   • `ventes` — en signant son PV de réception, son appareil débloque la
--     commission du commercial et la part du parrain
--     (debloquerCommissionsReception, lib/calculs.js). Il modifie donc bien
--     une vente, mais TROIS CHAMPS SEULEMENT. On lui laisse ces trois-là, et
--     rien d'autre.
--
--   • `produits` — son espace n'y touche jamais. On ferme complètement.
--
-- Fermer sans regarder cela aurait cassé la signature du PV et la validation
-- des devis : l'opération serait partie, le serveur l'aurait refusée, et la
-- commission serait restée bloquée pour toujours. C'est exactement le piège
-- des boutiques de formation (2.100.30).
--
-- RETOUR EN ARRIÈRE : tout en bas.
-- À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================


-- ══════════════════════════════════════════════════════════════════
-- 1. LES ARTICLES : un client n'y a rien à faire, ni de près ni de loin
-- ══════════════════════════════════════════════════════════════════
drop policy if exists "role_client_pas_de_produits" on public.produits;
create policy "role_client_pas_de_produits" on public.produits
  as restrictive for all to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'client')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'client');


-- ══════════════════════════════════════════════════════════════════
-- 2. LES DETTES : il en crée (devis « pose seule »), il n'en modifie aucune
-- ══════════════════════════════════════════════════════════════════
-- La suppression lui est déjà interdite (roles-2-vague2.sql).
drop policy if exists "role_client_ne_modifie_pas_les_dettes" on public.dettes;
create policy "role_client_ne_modifie_pas_les_dettes" on public.dettes
  as restrictive for update to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'client')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'client');


-- ══════════════════════════════════════════════════════════════════
-- 3. LES VENTES : il n'en crée aucune, et n'en modifie que la réception
-- ══════════════════════════════════════════════════════════════════
drop policy if exists "role_client_ne_cree_pas_de_vente" on public.ventes;
create policy "role_client_ne_cree_pas_de_vente" on public.ventes
  as restrictive for insert to authenticated
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'client');

-- Une politique RLS ne sait pas comparer l'ancienne et la nouvelle ligne :
-- c'est le travail d'un déclencheur.
--
-- Les TROIS champs qu'un client a le droit de faire bouger, et eux seuls :
--   commission_a_la_reception  — passe à false quand il signe son PV
--   commission_debloquee_le    — la date de ce déblocage
--   apporteur.a_la_reception   — la part du parrain devient due
-- Le montant de l'apporteur, lui, ne bouge pas : sinon un client pourrait
-- s'augmenter la prime de parrainage qu'il touchera.
create or replace function public.client_ne_touche_pas_a_l_argent_des_ventes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  jetons jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  avant  jsonb;
  apres  jsonb;
begin
  -- Voie de secours : éditeur SQL, clé service_role, migrations.
  if jetons = '{}'::jsonb or coalesce(jetons ->> 'role', '') = 'service_role' then
    return new;
  end if;
  if coalesce(jetons -> 'app_metadata' ->> 'role', '') <> 'client' then
    return new;
  end if;

  -- On met de côté les trois champs autorisés, puis on exige que TOUT le
  -- reste soit rigoureusement identique.
  avant := (old.data - 'commission_a_la_reception' - 'commission_debloquee_le')
           || jsonb_build_object('apporteur', coalesce(old.data -> 'apporteur', 'null'::jsonb) - 'a_la_reception');
  apres := (new.data - 'commission_a_la_reception' - 'commission_debloquee_le')
           || jsonb_build_object('apporteur', coalesce(new.data -> 'apporteur', 'null'::jsonb) - 'a_la_reception');

  if avant is distinct from apres then
    raise exception
      'Refusé : un compte client ne modifie d''une vente que la réception des travaux.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists client_ventes_reception_seule_trg on public.ventes;
create trigger client_ventes_reception_seule_trg
  before update on public.ventes
  for each row execute function public.client_ne_touche_pas_a_l_argent_des_ventes();


-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — doit afficher 3 règles et 1 déclencheur
-- ══════════════════════════════════════════════════════════════════
select 'politique' as genre, policyname as nom, tablename as sur_la_table
from pg_policies
where schemaname = 'public'
  and policyname in ('role_client_pas_de_produits',
                     'role_client_ne_modifie_pas_les_dettes',
                     'role_client_ne_cree_pas_de_vente')
union all
select 'declencheur', tgname, tgrelid::regclass::text
from pg_trigger
where tgname = 'client_ventes_reception_seule_trg'
order by genre, nom;


-- ══════════════════════════════════════════════════════════════════
-- RETOUR EN ARRIÈRE (à ne coller QUE si quelque chose se bloque)
-- ══════════════════════════════════════════════════════════════════
-- drop policy if exists "role_client_pas_de_produits" on public.produits;
-- drop policy if exists "role_client_ne_modifie_pas_les_dettes" on public.dettes;
-- drop policy if exists "role_client_ne_cree_pas_de_vente" on public.ventes;
-- drop trigger if exists client_ventes_reception_seule_trg on public.ventes;
-- drop function if exists public.client_ne_touche_pas_a_l_argent_des_ventes();
