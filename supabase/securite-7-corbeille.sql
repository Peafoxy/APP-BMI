-- ============================================================
-- SÉCURITÉ 7 — LA CORBEILLE DES CHANTIERS (2.101.56, demande Timo 05/09/2026)
--
-- ⚠ À COLLER SEULEMENT QUAND TOUS LES APPAREILS SONT EN 2.101.56 OU PLUS.
-- Suppose securite-4, 5 et 6 en place. Ce fichier REMPLACE la fonction
-- clients_installes_regles_roles de securite-6 par la même, plus la règle
-- de la corbeille :
--   • mettre une fiche à la corbeille (poser `supprime_le`) = supprimer :
--     l'administrateur ou le commercial rattaché — jamais un compte client,
--     même sur son propre chantier ;
--   • restaurer (retirer `supprime_le`) : l'administrateur PRINCIPAL seul ;
--   • effacer pour de bon (DELETE) : inchangé — admin ou son commercial.
-- Banc : scripts/tester-devis-chantiers-sql.sh.
-- ============================================================

create or replace function public.clients_installes_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r text := public.role_jeton(); moi text := public.id_jeton();
  champ text; chef_de_ce_chantier boolean; vers_termine boolean;
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;

  -- ══ LA CORBEILLE (2.101.56) : mettre à la corbeille = supprimer (admin ou
  -- son commercial, jamais un client) ; restaurer = l'administrateur principal.
  if tg_op = 'UPDATE' and public.champ_change(old.data, new.data, 'supprime_le') then
    if new.data ->> 'supprime_le' is not null then
      if r = 'client' or (r <> 'admin' and coalesce(old.data ->> 'commercial', '') <> public.nom_jeton()) then
        perform public.refus_role('Mettre une fiche chantier à la corbeille', 'l''administrateur ou le commercial rattaché');
      end if;
    elsif not public.est_admin_principal() then
      perform public.refus_role('Restaurer une fiche chantier de la corbeille', 'l''administrateur principal');
    end if;
  end if;

  if r = 'client' then return coalesce(new, old); end if;             -- règles client inchangées

  if tg_op = 'DELETE' then
    if r <> 'admin' and coalesce(old.data ->> 'commercial', '') <> public.nom_jeton() then
      perform public.refus_role('Supprimer une fiche chantier', 'l''administrateur ou le commercial rattaché');
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then return new; end if;

  if r = 'admin' then return new; end if;

  -- Réservé à l'administrateur
  foreach champ in array array['commercial', 'user_id', 'cadeau', 'adresse_contrat', 'garantie_mois', 'reserves_delai',
      'date_entretien', 'frais_installation', 'chef_id', 'part_chef', 'date_repartition', 'par_repartition',
      'contrat_force_par', 'contrat_force_le', 'avenant_jeton', 'avenant_jeton_le', 'avenant_statut',
      'reserves_levees_le', 'reserves_levees_par', 'receptionne_par'] loop
    if public.champ_change(old.data, new.data, champ) then
      perform public.refus_role(format('Modifier « %s » sur un chantier', champ), 'l''administrateur');
    end if;
  end loop;
  -- Une photo qui disparaît
  if exists (select 1 from jsonb_array_elements(coalesce(old.data -> 'photos', '[]'::jsonb)) p
             where not exists (select 1 from jsonb_array_elements(coalesce(new.data -> 'photos', '[]'::jsonb)) q where q ->> 'id' = p ->> 'id')) then
    perform public.refus_role('Supprimer une photo de chantier', 'l''administrateur');
  end if;
  -- L'argent de l'équipe
  if public.equipe_argent_change(old.data -> 'equipe', new.data -> 'equipe') then
    perform public.refus_role('Répartir les frais d''installation ou demander une prime', 'l''administrateur');
  end if;
  -- La programmation : qui, chef, date
  if (public.equipe_projection(old.data -> 'equipe', 'structure') is distinct from public.equipe_projection(new.data -> 'equipe', 'structure')
      or public.champ_change(old.data, new.data, 'date_installation')
      or public.champ_change(old.data, new.data, 'a_programmer'))
     and r <> 'resp_commercial' then
    perform public.refus_role('Programmer une installation (date, équipe, chef)', 'l''administrateur ou le responsable commercial');
  end if;
  -- Le statut
  vers_termine := coalesce(old.data ->> 'statut', '') <> 'termine' and new.data ->> 'statut' = 'termine';
  if public.champ_change(old.data, new.data, 'statut') then
    if vers_termine then
      chef_de_ce_chantier := exists (select 1 from jsonb_array_elements(coalesce(old.data -> 'equipe', '[]'::jsonb)) e
                                     where e ->> 'user_id' = moi and coalesce((e ->> 'chef')::boolean, false));
      if not chef_de_ce_chantier then
        perform public.refus_role('Marquer les travaux terminés', 'l''administrateur ou le chef de ce chantier');
      end if;
    else
      perform public.refus_role(format('Passer un chantier à « %s »', new.data ->> 'statut'), 'l''administrateur');
    end if;
  end if;
  -- Le lien de signature du PV : part avec « terminé » ; sinon admin (renvoi)
  if not vers_termine then
    foreach champ in array array['contrat_jeton', 'contrat_jeton_le', 'contrat_numero', 'contrat_statut'] loop
      if public.champ_change(old.data, new.data, champ) then
        perform public.refus_role('Envoyer ou renvoyer le lien de signature du PV', 'l''administrateur');
      end if;
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists clients_installes_regles_roles_trg on public.clients_installes;
create trigger clients_installes_regles_roles_trg
  before insert or update or delete on public.clients_installes
  for each row execute function public.clients_installes_regles_roles();

-- VÉRIFICATION — doit afficher : true
select exists (select 1 from pg_proc where proname = 'clients_installes_regles_roles'
  and prosrc like '%corbeille%') as corbeille_verrouillee;
