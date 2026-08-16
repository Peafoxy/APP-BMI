-- ============================================================
-- CLOISONNEMENT FORMATION / RÉEL — ÉTAPE 1 : LA COLONNE
-- ============================================================
-- CE QUE FAIT CE SCRIPT : il ajoute une colonne « espace » sur les tables
-- qui portent une boutique, et un déclencheur qui la remplit tout seul à
-- chaque écriture — exactement le même procédé que celui déjà en place
-- pour « updated_at » (voir horodatage-serveur.sql).
--
-- CE QU'IL NE FAIT PAS : il ne touche à AUCUNE politique de sécurité.
-- Après son exécution, absolument rien ne change pour personne : la
-- colonne est simplement là, et se remplit. C'est volontaire — elle doit
-- pouvoir être vérifiée tranquillement avant qu'on s'appuie dessus.
--
-- RISQUE : quasi nul. Aucune donnée existante n'est modifiée (« data »
-- n'est jamais touché), aucun accès n'est restreint. Le remplissage de
-- l'historique est fait déclencheur d'horodatage DÉSACTIVÉ, pour ne pas
-- faire remonter « updated_at » sur toutes les lignes — sans quoi chaque
-- appareil retéléchargerait la base entière à sa prochaine connexion.
--
-- RETOUR EN ARRIÈRE : tout en bas de ce fichier. La colonne est calculée,
-- jamais saisie : la supprimer ne perd rien.
--
-- À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

-- ══════════════════════════════════════════════════════════════════
-- 1. L'ESPACE D'UNE BOUTIQUE, À PARTIR DE SON NOM
-- ══════════════════════════════════════════════════════════════════
-- Règle IDENTIQUE à celle de l'application (estBoutiqueFormation, dans
-- src/lib/calculs.js) : une boutique inconnue de la table — « Chez le
-- comptable », un nom effacé — est traitée comme RÉELLE. Le doute profite
-- toujours aux vraies données.
--
-- SECURITY DEFINER : la fonction doit classer de la même façon quel que
-- soit qui la consulte. Sans cela, une fois les politiques actives, un
-- appareil de formation ne verrait pas les vraies boutiques et le
-- classement dépendrait de l'appelant. Elle ne renvoie qu'un mot
-- ('formation', 'reel' ou rien) : aucune donnée ne peut fuir par là.
create or replace function public.espace_de_boutique(nom text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when nom is null or nom = '' then null
    when exists (
      select 1 from public.boutiques b
      where b.data->>'nom' = nom
        and coalesce((b.data->>'formation')::boolean, false)
    ) then 'formation'
    else 'reel'
  end;
$$;

-- ══════════════════════════════════════════════════════════════════
-- 2. L'ESPACE D'UNE LIGNE, SELON SA TABLE
-- ══════════════════════════════════════════════════════════════════
-- Trois cas :
--   • « boutiques » et « prospects » portent le drapeau directement dans
--     leurs données (l'application le pose à la création) ;
--   • « clients_installes » ne porte aucune boutique : elle se retrouve
--     par la vente liée, à défaut par la dette (cas « pose seule ») —
--     exactement le chemin utilisé par l'app (boutiqueDuChantier) ;
--   • toutes les autres portent « boutique » dans leurs données.
--
-- ⚠ Un chantier dont ni la vente ni la dette ne sont retrouvables reste
-- NON CLASSÉ (null). C'est délibéré : une ligne non classée restera
-- VISIBLE PAR TOUS (voir étape 3). En cas de doute, on préfère montrer
-- une ligne de trop que d'en cacher une à celui à qui elle appartient —
-- la synchronisation en miroir effacerait sa copie locale.
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
    when 'clients_installes' then coalesce(
      public.espace_de_boutique((select v.data->>'boutique' from public.ventes v where v.id = d->>'vente_id')),
      public.espace_de_boutique((select t.data->>'boutique' from public.dettes t where t.id = d->>'dette_id'))
    )
    else public.espace_de_boutique(d->>'boutique')
  end;
$$;

-- ══════════════════════════════════════════════════════════════════
-- 3. LE DÉCLENCHEUR
-- ══════════════════════════════════════════════════════════════════
create or replace function public.espace_ligne()
returns trigger
language plpgsql
as $$
begin
  new.espace := public.espace_de_ligne(tg_table_name, new.data);
  return new;
end;
$$;

-- ══════════════════════════════════════════════════════════════════
-- 4. COLONNE + DÉCLENCHEUR + INDEX SUR LES TABLES CONCERNÉES
-- ══════════════════════════════════════════════════════════════════
-- Les tables volontairement ABSENTES de cette liste :
--   • users   — doit rester lisible sans condition pour qu'un appareil
--               neuf retrouve son compte et puisse se connecter (voir le
--               cas particulier de durcir_securite.sql). Elle ne contient
--               ni argent, ni stock.
--   • messages, audits, fournisseurs, commerciaux, categories_prospects,
--     groupes — pas de rattachement à une boutique, et rien qui fausse un
--     chiffre. Les cloisonner apporterait du risque sans bénéfice.
do $$
declare
  t text;
begin
  foreach t in array array[
    'ventes', 'depenses', 'dettes', 'produits', 'ajustements',
    'clotures', 'commandes', 'proformas', 'boutiques', 'prospects',
    'clients_installes'
  ]
  loop
    execute format('alter table public.%I add column if not exists espace text;', t);

    execute format('drop trigger if exists espace_ligne_trg on public.%I;', t);
    execute format(
      'create trigger espace_ligne_trg before insert or update on public.%I '
      'for each row execute function public.espace_ligne();', t);

    execute format('create index if not exists idx_espace_%s on public.%I (espace);', t, t);
  end loop;
end $$;

-- ══════════════════════════════════════════════════════════════════
-- 5. REMPLISSAGE DE L'HISTORIQUE
-- ══════════════════════════════════════════════════════════════════
-- ⚠ Le déclencheur d'horodatage est DÉSACTIVÉ le temps du remplissage.
-- Sans cette précaution, « updated_at » remonterait à maintenant sur
-- TOUTES les lignes : chaque appareil, à sa prochaine connexion,
-- retéléchargerait l'intégralité de la base (plusieurs minutes sur un
-- téléphone, et une facture de données pour rien).
--
-- La désactivation est conditionnelle : si horodatage-serveur.sql n'a
-- jamais été exécuté chez vous, le déclencheur n'existe pas et on passe
-- simplement outre, sans erreur.
do $$
declare
  t text;
  a_horodatage boolean;
begin
  foreach t in array array[
    'ventes', 'depenses', 'dettes', 'produits', 'ajustements',
    'clotures', 'commandes', 'proformas', 'boutiques', 'prospects',
    'clients_installes'
  ]
  loop
    select exists (
      select 1 from pg_trigger tr
      join pg_class c on c.oid = tr.tgrelid
      where c.relname = t and tr.tgname = 'horodatage_serveur_trg'
    ) into a_horodatage;

    if a_horodatage then
      execute format('alter table public.%I disable trigger horodatage_serveur_trg;', t);
    end if;

    execute format('update public.%I set espace = public.espace_de_ligne(%L, data);', t, t);

    if a_horodatage then
      execute format('alter table public.%I enable trigger horodatage_serveur_trg;', t);
    end if;
  end loop;
end $$;

-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — à lire avant de passer à l'étape suivante
-- ══════════════════════════════════════════════════════════════════
-- Combien de lignes de chaque côté, et combien restent non classées ?
-- Les non classées (espace null) resteront visibles par tout le monde :
-- s'il y en a beaucoup ailleurs que dans clients_installes, ne passez PAS
-- à l'étape 3 — c'est le signe que des lignes n'ont pas de boutique
-- exploitable, et il faut comprendre pourquoi d'abord.
--
--   select 'ventes' as t, espace, count(*) from public.ventes group by 1,2
--   union all select 'depenses', espace, count(*) from public.depenses group by 1,2
--   union all select 'dettes', espace, count(*) from public.dettes group by 1,2
--   union all select 'produits', espace, count(*) from public.produits group by 1,2
--   union all select 'ajustements', espace, count(*) from public.ajustements group by 1,2
--   union all select 'clotures', espace, count(*) from public.clotures group by 1,2
--   union all select 'commandes', espace, count(*) from public.commandes group by 1,2
--   union all select 'proformas', espace, count(*) from public.proformas group by 1,2
--   union all select 'boutiques', espace, count(*) from public.boutiques group by 1,2
--   union all select 'prospects', espace, count(*) from public.prospects group by 1,2
--   union all select 'clients_installes', espace, count(*) from public.clients_installes group by 1,2
--   order by 1, 2;
--
-- Les chantiers non rattachables, en détail :
--   select id, data->>'nom' as client, data->>'vente_id', data->>'dette_id'
--   from public.clients_installes where espace is null;

-- ══════════════════════════════════════════════════════════════════
-- RETOUR EN ARRIÈRE DE L'ÉTAPE 1
-- ══════════════════════════════════════════════════════════════════
-- Sans effet sur les données : « espace » est une colonne CALCULÉE, jamais
-- saisie. À ne lancer qu'après avoir retiré les politiques de l'étape 3
-- (espace-3-politiques.sql), qui s'appuient dessus.
--
--   do $$
--   declare t text;
--   begin
--     foreach t in array array[
--       'ventes','depenses','dettes','produits','ajustements','clotures',
--       'commandes','proformas','boutiques','prospects','clients_installes'
--     ]
--     loop
--       execute format('drop trigger if exists espace_ligne_trg on public.%I;', t);
--       execute format('drop index if exists public.idx_espace_%s;', t);
--       execute format('alter table public.%I drop column if exists espace;', t);
--     end loop;
--   end $$;
--   drop function if exists public.espace_ligne();
--   drop function if exists public.espace_de_ligne(text, jsonb);
--   drop function if exists public.espace_de_boutique(text);
