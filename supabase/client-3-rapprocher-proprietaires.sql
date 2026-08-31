-- ============================================================
-- VAGUE 2, ÉTAPE 2 — RAPPROCHER L'EXISTANT DE SES PROPRIÉTAIRES
-- ============================================================
-- CE QUE FAIT CE SCRIPT, EN UNE PHRASE : il inscrit sur chaque dette,
-- vente et chantier DÉJÀ enregistrés le compte client auquel la ligne
-- appartient — quand on peut l'établir SANS DEVINER.
--
-- POURQUOI. Depuis la 2.101.28, toute nouvelle ligne naît avec son
-- propriétaire (client_user_id). Les lignes d'AVANT n'ont qu'un nom et un
-- téléphone — du texte. L'étape 3 (« un client ne lit que SES lignes »)
-- a besoin que l'existant soit marqué, sinon fermer la lecture viderait
-- l'espace de vos clients actuels.
--
-- LA RÈGLE DE RAPPROCHEMENT — la même que l'application, en plus prudent :
--   1. le TÉLÉPHONE d'abord : mêmes 8 derniers chiffres (l'indicatif ne
--      compte pas), et le numéro de la ligne doit avoir au moins 6 chiffres ;
--   2. à défaut, le NOM EXACT (majuscules et espaces ignorés) ;
--   3. et dans les deux cas : SEULEMENT si UN SEUL compte correspond.
--      Deux comptes possibles = on n'écrit RIEN. En matière d'argent, on ne
--      devine pas — la ligne reste à rattacher à la main.
--   Ne sont jamais rattachés : les comptes bloqués, les non-clients.
--
-- CE QUI NE CHANGE PAS : les lignes déjà marquées (créées depuis la
-- 2.101.28, ou reprises par un passage précédent de ce script) ne sont
-- jamais réécrites. Le script peut donc être collé plusieurs fois sans
-- danger. Rien n'est fermé : ceci ne fait qu'écrire une étiquette.
--
-- ⚠ HORODATAGE DÉSACTIVÉ PENDANT L'ÉCRITURE — même précaution que
-- espace-1-colonne.sql : sans cela, toutes les dettes et ventes verraient
-- leur « updated_at » remonter, et chaque téléphone retéléchargerait ces
-- tables entières dans la journée. Les appareils récupéreront les marques
-- naturellement, à leur prochaine connexion (le miroir de l'ouverture
-- relit tout) — et l'étape 3 agit côté serveur de toute façon.
--
-- RETOUR EN ARRIÈRE : tout en bas. L'étiquette est calculée, jamais
-- saisie : l'effacer ne perd rien.
--
-- À exécuter dans Supabase → SQL Editor → coller → Run.
-- Le tableau final dit ce qui a été fait, table par table.
-- ============================================================

create or replace function public.rapprocher_proprietaires()
returns table (tableau text, lignes bigint, deja_marquees bigint,
               marquees_par_telephone bigint, marquees_par_nom bigint,
               ambigues bigint, sans_correspondance bigint)
language plpgsql
as $$
declare
  t record;
begin
  -- Les comptes clients actifs, avec leur numéro comparable (8 derniers
  -- chiffres) et leur nom comparable (minuscules, sans espaces autour).
  create temp table _clients on commit drop as
  select id,
         nullif(right(regexp_replace(coalesce(data->>'tel', ''), '\D', '', 'g'), 8), '') as tel8,
         lower(trim(coalesce(data->>'nom_complet', data->>'nom_base', data->>'nom', ''))) as nom
  from public.users
  where data->>'role' = 'client'
    and coalesce((data->>'actif')::boolean, true);

  for t in
    select * from (values
      ('dettes',            'client_user_id', 'client'),
      ('ventes',            'client_user_id', 'client'),
      ('clients_installes', 'user_id',        null)
    ) as v(nom_table, champ, champ_nom)
  loop
    execute format('alter table public.%I disable trigger horodatage_serveur_trg', t.nom_table);

    -- Le verdict de chaque ligne non marquée : son compte, ou pourquoi pas.
    -- ⚠ « non marquée » inclut la chaîne vide : l'écran Chantiers écrit
    -- user_id: "" quand aucun compte n'est lié — ce n'est pas une marque.
    execute format($sql$
      create temp table _verdict on commit drop as
      select l.id as ligne_id,
        (select array_agg(distinct c.id) from _clients c
          where c.tel8 is not null
            and length(regexp_replace(coalesce(l.data->>'tel', ''), '\D', '', 'g')) >= 6
            and c.tel8 = nullif(right(regexp_replace(coalesce(l.data->>'tel', ''), '\D', '', 'g'), 8), '')
        ) as par_tel,
        (select array_agg(distinct c.id) from _clients c
          where %s
        ) as par_nom
      from public.%I l
      where nullif(l.data->>%L, '') is null
    $sql$,
      case when t.champ_nom is null then 'false' else
        format('c.nom <> '''' and c.nom = lower(trim(coalesce(l.data->>%L, '''')))', t.champ_nom) end,
      t.nom_table, t.champ);

    -- Un téléphone qui correspond à UN SEUL compte gagne. Sinon, si le
    -- téléphone ne dit RIEN (aucun compte), le nom exact et unique prend le
    -- relais. Un téléphone AMBIGU (deux comptes) n'a pas de relais : on
    -- n'écrit rien, exprès.
    execute format($sql$
      update public.%I l
      set data = jsonb_set(l.data, array[%L], to_jsonb(
        case
          when array_length(v.par_tel, 1) = 1 then v.par_tel[1]
          when v.par_tel is null and array_length(v.par_nom, 1) = 1 then v.par_nom[1]
        end))
      from _verdict v
      where v.ligne_id = l.id
        and (array_length(v.par_tel, 1) = 1
             or (v.par_tel is null and array_length(v.par_nom, 1) = 1))
    $sql$, t.nom_table, t.champ);

    -- La ligne de compte-rendu de cette table.
    execute format($sql$
      select %L,
        (select count(*) from public.%I),
        (select count(*) from public.%I where nullif(data->>%L, '') is not null)
          - (select count(*) from _verdict where array_length(par_tel,1) = 1
              or (par_tel is null and array_length(par_nom,1) = 1)),
        (select count(*) from _verdict where array_length(par_tel, 1) = 1),
        (select count(*) from _verdict where par_tel is null and array_length(par_nom, 1) = 1),
        (select count(*) from _verdict where array_length(par_tel, 1) > 1
            or (par_tel is null and array_length(par_nom, 1) > 1)),
        (select count(*) from _verdict where par_tel is null and par_nom is null)
    $sql$, t.nom_table, t.nom_table, t.nom_table, t.champ)
    into tableau, lignes, deja_marquees, marquees_par_telephone,
         marquees_par_nom, ambigues, sans_correspondance;

    execute format('alter table public.%I enable trigger horodatage_serveur_trg', t.nom_table);
    drop table _verdict;
    return next;
  end loop;
end;
$$;

-- ── L'EXÉCUTION ET LE COMPTE-RENDU ────────────────────────────────
select * from public.rapprocher_proprietaires();

-- La fonction a fait son travail : elle ne reste pas dans la base.
drop function public.rapprocher_proprietaires();


-- ══════════════════════════════════════════════════════════════════
-- LIRE LE COMPTE-RENDU
-- ══════════════════════════════════════════════════════════════════
-- marquees_par_telephone / par_nom : rattachées, c'est fait.
-- sans_correspondance : clients de passage sans compte — NORMAL, la
--   plupart des lignes. Elles resteront visibles de vos employés
--   seulement, d'aucun client : c'est le bon comportement.
-- ambigues : deux comptes se partagent le même numéro. À regarder à la
--   main (la requête ci-dessous les liste) — probablement des doublons
--   d'avant la règle des 8 chiffres.
--
-- select 'dette' as type, data->>'client' as nom, data->>'tel' as tel
-- from public.dettes where data->>'client_user_id' is null
--   and length(regexp_replace(coalesce(data->>'tel',''),'\D','','g')) >= 6
-- limit 50;

-- ══════════════════════════════════════════════════════════════════
-- RETOUR EN ARRIÈRE (efface TOUTES les étiquettes, y compris celles
-- posées par l'application depuis la 2.101.28 — à n'utiliser que si
-- quelque chose va vraiment de travers)
-- ══════════════════════════════════════════════════════════════════
-- update public.dettes set data = data - 'client_user_id';
-- update public.ventes set data = data - 'client_user_id';
