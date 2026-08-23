-- ============================================================
-- CLOISONNEMENT — ÉTENDRE AUX FOURNISSEURS ET AUX COMMERCIAUX
-- ============================================================
--
-- POUR TIMO — POURQUOI CE SCRIPT
--
-- Le cloisonnement formation / réel protégeait 11 tables : ventes,
-- dépenses, dettes, stock, caisses, commandes, proformas, boutiques,
-- prospects, chantiers. Deux tables manquaient à l'appel : les
-- FOURNISSEURS et les COMMERCIAUX.
--
-- Ce n'était pas théorique. Un compte de FORMATION pouvait :
--   • enregistrer une « commande à crédit » chez un VRAI fournisseur —
--     donc gonfler sa vraie ardoise, celle que vous devez réellement ;
--   • supprimer purement et simplement un vrai fournisseur ;
--   • supprimer un vrai commercial, ou changer son taux de commission.
-- Ni l'application ni le serveur ne s'y opposaient.
--
-- Trou trouvé le 19/08/2026, en réponse à votre question « est-ce sûr que
-- les deux espaces ne se mélangent jamais ? ». La réponse était non.
--
-- Ces deux tables n'appartiennent à aucune boutique : elles portent donc
-- leur propre marque « formation », exactement comme les prospects. Votre
-- choix : séparation COMPLÈTE — un stagiaire crée ses propres fournisseurs
-- d'essai, invisibles côté réel, et inversement.
--
-- ⚠ ORDRE : lancez ce script, puis rechargez l'application (2.100.63 ou
-- plus récente). Les fiches existantes n'ayant pas de marque sont
-- considérées comme RÉELLES — le doute profite aux vraies données.
--
-- ⚠⚠ EN CAS DE PROBLÈME, TOUT ANNULER ⚠⚠
-- Copiez le bloc ci-dessous — SANS les tirets de début de ligne :
--
--   drop policy if exists "espace_cloisonnement" on public.fournisseurs;
--   drop policy if exists "espace_cloisonnement" on public.commerciaux;
--   drop trigger if exists espace_ligne_trg on public.fournisseurs;
--   drop trigger if exists espace_ligne_trg on public.commerciaux;
--   alter table public.fournisseurs drop column if exists espace;
--   alter table public.commerciaux  drop column if exists espace;
--
-- ============================================================


-- ══════════════════════════════════════════════════════════════════
-- 1. LA FONCTION QUI RANGE CHAQUE LIGNE APPREND DEUX TABLES DE PLUS
-- ══════════════════════════════════════════════════════════════════
-- Identique à celle d'espace-1-colonne.sql, avec fournisseurs et
-- commerciaux ajoutés à la liste des tables qui portent leur marque.
create or replace function public.espace_de_ligne(nom_table text, d jsonb)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case nom_table
    when 'boutiques' then
      case when coalesce((d->>'formation')::boolean, false) then 'formation' else 'reel' end
    when 'prospects' then
      case when coalesce((d->>'formation')::boolean, false) then 'formation' else 'reel' end
    when 'fournisseurs' then
      case when coalesce((d->>'formation')::boolean, false) then 'formation' else 'reel' end
    when 'commerciaux' then
      case when coalesce((d->>'formation')::boolean, false) then 'formation' else 'reel' end
    when 'clients_installes' then coalesce(
      public.espace_de_boutique((select v.data->>'boutique' from public.ventes v where v.id = d->>'vente_id')),
      public.espace_de_boutique((select t.data->>'boutique' from public.dettes t where t.id = d->>'dette_id'))
    )
    else public.espace_de_boutique(d->>'boutique')
  end;
$$;


-- ══════════════════════════════════════════════════════════════════
-- 2. LA COLONNE, LE DÉCLENCHEUR, LE REMPLISSAGE
-- ══════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array['fournisseurs', 'commerciaux']
  loop
    execute format('alter table public.%I add column if not exists espace text;', t);

    -- Chaque écriture range la ligne du bon côté, toute seule.
    execute format('drop trigger if exists espace_ligne_trg on public.%I;', t);
    execute format(
      'create trigger espace_ligne_trg before insert or update on public.%I '
      'for each row execute function public.espace_ligne();', t);

    -- Les lignes déjà présentes : sans marque, elles sont RÉELLES.
    execute format('update public.%I set espace = public.espace_de_ligne(%L, data);', t, t);

    execute format('create index if not exists %I on public.%I (espace);', t || '_espace', t);
  end loop;
  raise notice 'Colonne, declencheur et remplissage poses sur fournisseurs et commerciaux.';
end $$;


-- ⚠ La dérogation « tous » (l'administrateur principal traverse les deux
-- espaces) DOIT figurer ici comme sur les onze premières tables. Son oubli
-- dans la première version de ce script a bloqué les écritures de Timo —
-- voir espace-6-correctif-tous.sql.
-- ══════════════════════════════════════════════════════════════════
-- 3. LA RÈGLE DE CLOISONNEMENT
-- ══════════════════════════════════════════════════════════════════
-- Exactement la même que sur les 11 autres tables : « restrictive », donc
-- elle ne fait que RETRANCHER — vos règles actuelles restent intactes en
-- dessous. Une session sans revendication d'espace (jeton ancien) est
-- traitée comme RÉELLE : le risque est « pas encore cloisonné », jamais
-- « bloqué ».
do $$
declare
  t text;
  revendication constant text := 'coalesce(auth.jwt() -> ''app_metadata'' ->> ''espace'', ''reel'')';
begin
  foreach t in array array['fournisseurs', 'commerciaux']
  loop
    execute format('drop policy if exists "espace_cloisonnement" on public.%I;', t);
    execute format(
      'create policy "espace_cloisonnement" on public.%I '
      'as restrictive for all to authenticated '
      'using (%s = ''tous'' or espace is null or espace = %s) '
      'with check ('
      '  %s = ''tous'''
      '  or public.espace_de_ligne(%L, data) is null'
      '  or public.espace_de_ligne(%L, data) = %s'
      ');',
      t, revendication, revendication, revendication, t, t, revendication
    );
  end loop;
  raise notice 'Cloisonnement pose sur fournisseurs et commerciaux.';
end $$;


-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — à lancer juste après
-- ══════════════════════════════════════════════════════════════════
-- 1) Doit renvoyer 13 lignes (les 11 d'avant + les 2 nouvelles).
select tablename from pg_policies
 where schemaname = 'public' and policyname = 'espace_cloisonnement'
 order by tablename;

-- 2) La répartition obtenue. Toutes vos fiches actuelles doivent être
--    « reel » — aucune n'avait de marque avant aujourd'hui.
select 'fournisseurs' as table_nom, espace, count(*) from public.fournisseurs group by espace
union all
select 'commerciaux', espace, count(*) from public.commerciaux group by espace
order by 1, 2;
