-- ============================================================
-- VAGUE 2 — COMPLÉMENT : LES FICHES PROSPECT REJOIGNENT LEURS COMPTES
-- ============================================================
-- CE QUE FAIT CE SCRIPT, EN UNE PHRASE : il inscrit sur chaque fiche
-- prospect le compte client auquel elle correspond — quand on peut
-- l'établir SANS DEVINER.
--
-- POURQUOI (vécu par Timo avec le compte ESSO, 31/08/2026). Quand un
-- client valide son devis, son téléphone pose un badge « devis validé »
-- sur SA fiche prospect. Depuis la fermeture de l'annuaire (client-1),
-- le serveur ne le laisse toucher que les fiches MARQUÉES à son nom
-- (client_user_id) — or les fiches créées par un commercial AVANT le
-- compte n'ont pas cette marque. Résultat : le badge était refusé, et
-- comme les écritures d'une validation partent ensemble (tout ou rien),
-- TOUTE la validation restait coincée sur l'appareil du client.
--
-- L'application marque désormais la fiche à l'ENVOI du devis (2.101.34) ;
-- ce script rattrape l'existant, avec la même règle prudente que le
-- rapprochement des dettes (client-3) : téléphone aux 8 derniers
-- chiffres, et SEULEMENT si UN SEUL compte client actif correspond.
-- Deux comptes possibles = on n'écrit rien. Les fiches déjà marquées ou
-- déjà converties ne sont jamais réécrites. Rejouable sans danger.
--
-- ⚠ L'HORODATAGE N'EST PAS SUSPENDU ICI, ET C'EST VOULU (contrairement à
-- client-3) : les appareils DOIVENT retélécharger les fiches marquées —
-- celui du client coincé compris — pour que sa validation reparte toute
-- seule, par la fusion, au prochain cycle de synchronisation. La table
-- prospects est petite : aucun retéléchargement massif à craindre.
--
-- À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

update public.prospects p
set data = jsonb_set(p.data, '{client_user_id}', to_jsonb(c.id))
from (
  select u.id,
         nullif(right(regexp_replace(coalesce(u.data->>'tel', ''), '\D', '', 'g'), 8), '') as tel8,
         count(*) over (partition by nullif(right(regexp_replace(coalesce(u.data->>'tel', ''), '\D', '', 'g'), 8), '')) as nb
  from public.users u
  where u.data->>'role' = 'client'
    and coalesce((u.data->>'actif')::boolean, true)
) c
where nullif(p.data->>'client_user_id', '') is null
  and coalesce((p.data->>'converti')::boolean, false) = false
  and c.tel8 is not null
  and c.nb = 1
  and length(regexp_replace(coalesce(p.data->>'tel', ''), '\D', '', 'g')) >= 6
  and c.tel8 = nullif(right(regexp_replace(coalesce(p.data->>'tel', ''), '\D', '', 'g'), 8), '');

-- ══════════════════════════════════════════════════════════════════
-- COMPTE-RENDU — fiches_marquees = rattachées à un compte ;
-- fiches_sans_compte = prospects sans compte client (normal).
-- ══════════════════════════════════════════════════════════════════
select
  count(*) filter (where nullif(data->>'client_user_id', '') is not null) as fiches_marquees,
  count(*) filter (where nullif(data->>'client_user_id', '') is null)     as fiches_sans_compte,
  count(*)                                                                as total
from public.prospects;

-- ══════════════════════════════════════════════════════════════════
-- RETOUR EN ARRIÈRE (efface toutes les marques — à n'utiliser que si
-- quelque chose va vraiment de travers)
-- ══════════════════════════════════════════════════════════════════
-- update public.prospects set data = data - 'client_user_id'
-- where coalesce((data->>'converti')::boolean, false) = false;
