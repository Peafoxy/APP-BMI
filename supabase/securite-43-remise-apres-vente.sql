-- ============================================================
-- SÉCURITÉ 43 — LA REMISE APRÈS-VENTE (gérant + administrateur)
-- (Timo, 29/10/2026 : « Je veux que ça soit une fonctionnalité » → « 1 admin
-- + gérant, 2 oui, 3 ok, 4 oui, 5 oui, lance »)
--
-- CE QUE POSE L'APPLICATION (lib/remiseApresVente.js) : une remise accordée
-- APRÈS l'encaissement, SANS qu'aucun article ne revienne (au contraire
-- d'une reprise, securite-13/-33/-40/-42). Notée SUR la vente
-- (`remises_apres_vente`, liste qui ne fait que grandir), elle réduit la
-- dette (si elle n'est pas soldée) ou rend l'argent par une dépense
-- « Remboursement client » (qui porte `remise_apres_vente_ref`, jamais
-- `reprise_ref`).
--
-- CE QUE CE SCRIPT VERROUILLE :
--   • écrire ou changer `remises_apres_vente` sur une vente → gérant,
--     administrateur (jamais les autres), et la liste ne rétrécit jamais ;
--   • créer une dépense « Remboursement client » qui porte
--     `remise_apres_vente_ref` → gérant, administrateur (au contraire
--     d'un remboursement de REPRISE, resté à l'administrateur PRINCIPAL
--     seul — la clause d'origine, securite-13, n'est pas touchée pour lui).
--
-- ⚠ LE COUPLE : reprend `ventes_regles_roles` (securite-42, donc -40, -33,
-- -14) EN ENTIER et y ajoute UNE clause. Reprend `depenses_regles_versement`
-- (securite-13, jamais retouché depuis) EN ENTIER et relâche UNE condition.
-- Sans ce script, le geste de l'écran serait refusé par la base et tout
-- le lot resterait coincé derrière un refus que personne ne comprendrait.
--
-- À coller dans Supabase → SQL Editor → Run. Banc : tester-argent-sql.sh.
-- ============================================================

-- ══ 1. VENTES (remplace securite-42, identique + remises_apres_vente) ══
create or replace function public.ventes_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); pct numeric; pct_commande numeric; avant jsonb; remises_changees boolean; plafond numeric;
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if r <> 'admin' then perform public.refus_role('Supprimer une vente', 'l''administrateur'); end if;
    return old;
  end if;
  if tg_op = 'INSERT' then select v.data into avant from public.ventes v where v.id = new.id; else avant := old.data; end if;
  plafond := public.plafond_remise_boutique(new.data ->> 'boutique');
  -- La reprise d'un article (securite-13) : le principal seul, et jamais en arrière.
  -- 🔄 securite-40 : le gérant et l'administrateur AJOUTENT une ligne d'échange.
  if (coalesce(avant, '{}'::jsonb) -> 'reprises') is distinct from (new.data -> 'reprises') then
    if not public.est_admin_principal()
       and not (r in ('gerant', 'admin') and public.reprises_ajout_echange(coalesce(avant, '{}'::jsonb) -> 'reprises', new.data -> 'reprises')) then
      perform public.refus_role('Reprendre un article vendu', 'l''administrateur principal (un échange : le gérant, l''administrateur)');
    end if;
    if coalesce(jsonb_array_length(new.data -> 'reprises'), 0) < coalesce(jsonb_array_length(coalesce(avant, '{}'::jsonb) -> 'reprises'), 0) then
      perform public.refus_role('Effacer une reprise', 'personne');
    end if;
  end if;
  -- 🔄 securite-40 : l'avoir d'un échange, à la création seulement.
  if (coalesce(avant, '{}'::jsonb) -> 'avoir_echange') is distinct from (new.data -> 'avoir_echange') then
    if avant is not null then
      perform public.refus_role('Modifier l''avoir d''un échange', 'personne');
    end if;
    if r not in ('gerant', 'admin') then
      perform public.refus_role('Enregistrer un échange d''article', 'le gérant, l''administrateur');
    end if;
  end if;
  -- ✏️ securite-43 : la remise après-vente — gérant, administrateur, jamais
  -- en arrière (une entrée posée reste posée, comme une reprise).
  if (coalesce(avant, '{}'::jsonb) -> 'remises_apres_vente') is distinct from (new.data -> 'remises_apres_vente') then
    if r not in ('gerant', 'admin') then
      perform public.refus_role('Accorder une remise après-vente', 'le gérant, l''administrateur');
    end if;
    if coalesce(jsonb_array_length(new.data -> 'remises_apres_vente'), 0) < coalesce(jsonb_array_length(coalesce(avant, '{}'::jsonb) -> 'remises_apres_vente'), 0) then
      perform public.refus_role('Effacer une remise après-vente', 'personne');
    end if;
  end if;
  -- Les remises par article (10/09/2026), quand les lignes ou la remise changent.
  -- ⚙ securite-42 : la limite est désormais celle réglée sur la boutique.
  remises_changees := avant is null
    or (avant -> 'articles') is distinct from (new.data -> 'articles')
    or (avant -> 'remise_pct') is distinct from (new.data -> 'remise_pct')
    or (avant -> 'remise') is distinct from (new.data -> 'remise');
  if remises_changees then
    if public.a_remise_sur_article(new.data -> 'articles')
       and (coalesce((new.data ->> 'remise_pct')::numeric, 0) > 0 or coalesce((new.data ->> 'remise')::numeric, 0) > 0) then
      perform public.refus_role('Remise sur un article ET remise générale sur la même vente', 'personne (l''une ou l''autre)');
    end if;
    if r <> 'admin' and public.remise_ligne_excessive(new.data -> 'articles', plafond)
       and not public.panier_de_la_proforma(new.data) then
      perform public.refus_role(format('Remise supérieure à %s %% sur un article', plafond), 'l''administrateur');
    end if;
  end if;
  pct := coalesce((new.data ->> 'remise_pct')::numeric, 0);
  if pct > plafond and r <> 'admin'
     and (avant is null or coalesce((avant ->> 'remise_pct')::numeric, 0) is distinct from pct) then
    if new.data ->> 'commande_id' is not null then
      select coalesce((c.data ->> 'remise_pct')::numeric, 0) into pct_commande
        from public.commandes c where c.id = new.data ->> 'commande_id';
      if pct_commande is not null and pct_commande = pct then return new; end if;
    end if;
    -- 🧾 securite-33 : la remise d'une proforma reprise TELLE QUELLE.
    if public.panier_de_la_proforma(new.data) then return new; end if;
    perform public.refus_role(format('Remise supérieure à %s %% sur une vente', plafond), 'l''administrateur');
  end if;
  return new;
end;
$$;
drop trigger if exists ventes_regles_roles_trg on public.ventes;
create trigger ventes_regles_roles_trg
  before insert or update or delete on public.ventes
  for each row execute function public.ventes_regles_roles();

-- ══ 2. DÉPENSES (remplace securite-13) — « Remboursement client » : principal
--       pour une reprise, gérant + administrateur pour une remise après-vente ══
create or replace function public.depenses_regles_versement()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  avant jsonb; r text := public.role_jeton();
  destination text; sortie jsonb; miroir_pointe boolean := false;
begin
  if public.jeton_de_service() then return new; end if;
  if tg_op = 'INSERT' then
    select d.data into avant from public.depenses d where d.id = new.id;
  else
    avant := old.data;
  end if;
  if avant is null and coalesce(new.data ->> 'categorie', '') = 'Versement de fonds' and r not in ('gerant', 'admin') then
    perform public.refus_role('Verser les fonds', 'le gérant, l''administrateur');
  end if;
  -- Rendre l'argent : une reprise (10/09/2026) = l'administrateur principal
  -- seul ; une remise après-vente (29/10/2026, `remise_apres_vente_ref`) =
  -- le gérant, l'administrateur — la même liste que le geste qui l'accorde.
  if avant is null and coalesce(new.data ->> 'categorie', '') = 'Remboursement client' then
    if new.data ->> 'remise_apres_vente_ref' is not null then
      if r not in ('gerant', 'admin') then
        perform public.refus_role('Rembourser un client (remise après-vente)', 'le gérant, l''administrateur');
      end if;
    elsif not public.est_admin_principal() then
      perform public.refus_role('Rembourser un client (reprise d''un article)', 'l''administrateur principal');
    end if;
  end if;
  if avant is null and new.data ->> 'versement_rejete_le' is not null then
    perform public.refus_role('Créer un versement déjà rejeté', 'personne');
  end if;
  if avant ->> 'versement_rejete_le' is not null
     and ((avant -> 'versement_rejete_le') is distinct from (new.data -> 'versement_rejete_le')
       or (avant -> 'versement_rejete_par') is distinct from (new.data -> 'versement_rejete_par')
       or (avant -> 'versement_rejet_motif') is distinct from (new.data -> 'versement_rejet_motif')) then
    perform public.refus_role('Annuler ou modifier le rejet d''un versement', 'personne');
  end if;
  if avant ->> 'versement_rejete_le' is null and new.data ->> 'versement_rejete_le' is not null then
    if coalesce(new.data ->> 'categorie', '') <> 'Versement de fonds' then
      perform public.refus_role('Rejeter une ligne qui n''est pas un versement de fonds', 'personne');
    end if;
    if avant ? 'versement' then
      destination := avant -> 'versement' ->> 'destination';
      select true into miroir_pointe from public.depenses d
        where d.data ->> 'versement_id' = avant -> 'versement' ->> 'id' and d.data ->> 'decaisse_le' is not null limit 1;
      if avant ->> 'versement_valide_le' is not null or coalesce(miroir_pointe, false) then
        perform public.refus_role('Rejeter un versement déjà validé', 'personne');
      end if;
    elsif avant ? 'versement_id' then
      select d.data into sortie from public.depenses d where d.data -> 'versement' ->> 'id' = avant ->> 'versement_id' limit 1;
      destination := coalesce(sortie -> 'versement' ->> 'destination', 'Chez le comptable');
      if avant ->> 'decaisse_le' is not null then
        perform public.refus_role('Rejeter un versement déjà encaissé', 'personne');
      end if;
    else
      perform public.refus_role('Rejeter une ligne qui n''est pas un versement de fonds', 'personne');
    end if;
    if destination = 'Chez le comptable' then
      if r <> 'comptable' then perform public.refus_role('Rejeter un versement « Chez le comptable »', 'le comptable'); end if;
    else
      if not public.est_admin_principal() then perform public.refus_role('Rejeter un versement (Chez le DG, BANQUE)', 'l''administrateur principal (le DG)'); end if;
    end if;
    if not (new.data ? 'versement_rejet_motif') or btrim(coalesce(new.data ->> 'versement_rejet_motif', '')) = '' then
      perform public.refus_role('Rejeter un versement sans motif', 'personne');
    end if;
  end if;
  if new.data ->> 'versement_rejete_le' is not null then
    new.data := jsonb_set(new.data, '{montant}', '0'::jsonb, true);
    if new.data ->> 'versement_valide_le' is not null and (avant -> 'versement_valide_le') is distinct from (new.data -> 'versement_valide_le') then
      perform public.refus_role('Valider un versement rejeté', 'personne');
    end if;
    if new.data ->> 'decaisse_le' is not null and (avant -> 'decaisse_le') is distinct from (new.data -> 'decaisse_le') then
      perform public.refus_role('Encaisser un versement rejeté', 'personne');
    end if;
  end if;
  if (coalesce(avant, '{}'::jsonb) -> 'versement_valide_le') is distinct from (new.data -> 'versement_valide_le')
     or (coalesce(avant, '{}'::jsonb) -> 'versement_valide_par') is distinct from (new.data -> 'versement_valide_par') then
    if not public.est_admin_principal() then
      perform public.refus_role('Valider un versement de fonds (Chez le DG, BANQUE)', 'l''administrateur principal (le DG)');
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists depenses_regles_versement_trg on public.depenses;
create trigger depenses_regles_versement_trg
  before insert or update on public.depenses
  for each row execute function public.depenses_regles_versement();

-- VÉRIFICATION — doit afficher : true | true | true
select
  (select prosrc like '%remises_apres_vente%' from pg_proc where proname = 'ventes_regles_roles') as ventes_remise_apres_vente,
  (select prosrc like '%remise_apres_vente_ref%' from pg_proc where proname = 'depenses_regles_versement') as depenses_remise_apres_vente,
  exists (select 1 from pg_trigger where tgname = 'ventes_regles_roles_trg') as declencheur_en_place;
