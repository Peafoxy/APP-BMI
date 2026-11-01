-- ============================================================
-- SÉCURITÉ 49 — la corbeille des VENTES, des ARTICLES et des PROSPECTS
-- (01/11/2026, Timo : « Lance 3 » → « A a, B oui, C oui »)
-- ============================================================
-- Avant : supprimer une vente, un article ou un prospect l'effaçait pour de
-- bon. Depuis : la fiche reste dans sa table avec une marque `supprime_le`
-- (30 jours, motif obligatoire), comme les chantiers et les dettes.
--
-- Ce script garde la marque, comme `securite-36` le fait pour WhatsApp :
--   (1) POSER la marque (mettre à la corbeille) = qui pouvait SUPPRIMER :
--       vente et article → un administrateur ; prospect → un administrateur
--       ou le commercial rattaché (le même qu'avant) ;
--   (2) RETIRER la marque (restaurer) = l'administrateur PRINCIPAL seul ;
--   (3) une fiche À LA CORBEILLE ne se réécrit que par le principal (rien ne
--       change en douce pendant ses 30 jours).
-- L'effacement définitif (DELETE) garde ses règles d'avant (administrateur).
-- Le serveur (jeton de service) n'est jamais gêné.
-- ⚠ PAS de « rollback » dans ce script : l'éditeur de Supabase envoie tout le
-- texte en une transaction.
-- ============================================================

create or replace function public.regles_corbeille_fiches()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  avant jsonb; apres jsonb; marque_avant boolean; marque_apres boolean; r text := public.role_jeton();
begin
  if public.jeton_de_service() then return new; end if;

  -- ⚠ UPSERT : PostgreSQL déclenche AVANT INSERT même quand la ligne existe.
  if tg_op = 'INSERT' then
    execute format('select data from public.%I where id = $1', tg_table_name) into avant using new.id;
  else
    avant := old.data;
  end if;
  apres := new.data;
  marque_avant := coalesce(avant ->> 'supprime_le', '') <> '';
  marque_apres := coalesce(apres ->> 'supprime_le', '') <> '';

  -- (1) Mettre à la corbeille.
  if marque_apres and not marque_avant then
    if tg_table_name = 'prospects' then
      if r <> 'admin' and coalesce(apres ->> 'commercial', avant ->> 'commercial', '') <> public.nom_jeton() then
        perform public.refus_role('Mettre un prospect à la corbeille', 'l''administrateur ou au commercial rattaché');
      end if;
    elsif r <> 'admin' then
      perform public.refus_role('Mettre une fiche à la corbeille (vente ou article)', 'l''administrateur');
    end if;
    return new;
  end if;

  -- (2) Restaurer.
  if marque_avant and not marque_apres and not public.est_admin_principal() then
    perform public.refus_role('Restaurer une fiche de la corbeille', 'l''administrateur principal');
  end if;

  -- (3) Une fiche à la corbeille ne change pas (sauf par le principal).
  if marque_avant and marque_apres and avant is distinct from apres and not public.est_admin_principal() then
    perform public.refus_role('Modifier une fiche de la corbeille', 'l''administrateur principal');
  end if;
  return new;
end;
$$;

revoke all on function public.regles_corbeille_fiches() from public, anon;

drop trigger if exists ventes_regles_corbeille on public.ventes;
create trigger ventes_regles_corbeille
  before insert or update on public.ventes
  for each row execute function public.regles_corbeille_fiches();

drop trigger if exists produits_regles_corbeille on public.produits;
create trigger produits_regles_corbeille
  before insert or update on public.produits
  for each row execute function public.regles_corbeille_fiches();

drop trigger if exists prospects_regles_corbeille on public.prospects;
create trigger prospects_regles_corbeille
  before insert or update on public.prospects
  for each row execute function public.regles_corbeille_fiches();

-- ── VÉRIFICATION : doit répondre « true | true | true »
-- ⚠ On ne cherche JAMAIS un morceau qui porte une apostrophe.
select
  (select count(*) = 3 from pg_trigger where tgname in ('ventes_regles_corbeille', 'produits_regles_corbeille', 'prospects_regles_corbeille')) as trois_declencheurs,
  (select prosrc like '%Restaurer une fiche de la corbeille%' from pg_proc where proname = 'regles_corbeille_fiches') as restaurer_principal,
  (select prosrc like '%Mettre un prospect%' from pg_proc where proname = 'regles_corbeille_fiches') as prospect_au_commercial;
