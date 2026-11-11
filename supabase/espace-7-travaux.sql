-- ============================================================
-- ESPACE-7 — LES TRAVAUX À CRÉDIT REJOIGNENT LEUR ESPACE (11/11/2026)
-- ============================================================
--
-- POUR TIMO — Trouvé grâce à la requête de lecture du 11/11/2026 : la fiche
-- « ALADJI » (🛠 Travaux à crédit, BMI DEMAKPOE) n'appartenait à AUCUN espace.
--
-- La règle qui range un chantier dans le réel ou la formation ne regardait que
-- sa VENTE ou sa DETTE. Une fiche de travaux n'a ni l'une ni l'autre tant
-- qu'elle n'est pas facturée : elle restait « sans espace », et une ligne sans
-- espace se voit DES DEUX CÔTÉS (un compte de formation la recevait).
--
-- Désormais, sans vente ni dette, c'est la BOUTIQUE de la fiche qui décide,
-- puis sa marque « formation ». Les chantiers de devis ne changent pas.
--
-- Ce script ne touche que la fonction de rangement et les fiches de chantier
-- restées sans espace. Le reste de la fonction est recopié MOT POUR MOT de
-- securite-1 (sa dernière version).
--
-- ⚠ Effet sur les téléphones : à la prochaine connexion de chacun, un compte de
-- formation cesse de recevoir les travaux réels (et l'inverse).
-- ============================================================

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
    when 'audits' then
      case when coalesce((d->>'formation')::boolean, false) then 'formation' else 'reel' end
    when 'clients_installes' then coalesce(
      public.espace_de_boutique((select v.data->>'boutique' from public.ventes v where v.id = d->>'vente_id')),
      public.espace_de_boutique((select t.data->>'boutique' from public.dettes t where t.id = d->>'dette_id')),
      -- ESPACE-7 : sans vente ni dette (travaux à crédit), la boutique de la fiche…
      public.espace_de_boutique(d->>'boutique'),
      -- … puis sa propre marque.
      case when d ? 'formation' then
        case when coalesce((d->>'formation')::boolean, false) then 'formation' else 'reel' end
      end
    )
    else public.espace_de_boutique(d->>'boutique')
  end;
$$;

-- Les fiches restées sans espace sont rangées. Horodatage suspendu : les
-- appareils qui ont déjà la ligne n'ont pas à la retélécharger.
alter table public.clients_installes disable trigger horodatage_serveur_trg;
update public.clients_installes
   set espace = public.espace_de_ligne('clients_installes', data)
 where espace is null;
alter table public.clients_installes enable trigger horodatage_serveur_trg;

-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — doit répondre  true | true | true
--   1. plus aucune fiche de chantier sans espace
--   2. une fiche de travaux d'une boutique réelle est rangée dans le réel
--   3. une fiche de travaux marquée formation, sans boutique connue, va en formation
-- ══════════════════════════════════════════════════════════════════
select
  (select count(*) = 0 from public.clients_installes where espace is null) as plus_aucune_sans_espace,
  (select public.espace_de_ligne('clients_installes', jsonb_build_object('boutique', b.data->>'nom', 'travaux', true)) = 'reel'
     from public.boutiques b
    where not coalesce((b.data->>'formation')::boolean, false) and coalesce(b.data->>'nom','') <> ''
    limit 1) as travaux_reels_ranges,
  public.espace_de_ligne('clients_installes', '{"travaux": true, "formation": true}'::jsonb) = 'formation' as travaux_formation_ranges;
