-- ═══════════════════════════════════════════════════════════
-- securite-18-banque.sql — LA BANQUE D'UN EMPLOYÉ : ADMIN SEUL
-- ═══════════════════════════════════════════════════════════
-- Timo, 15/09/2026 : « si banque, normalement dans la fiche de
-- l'utilisateur, on devrait ajouter le nom de la banque ? »
--
-- La fiche d'un employé porte désormais `banque` et `compte_bancaire`
-- (👥 Utilisateurs → ⋯ Gérer → 🏦 Banque). L'application réserve ce geste à
-- l'administrateur ; SANS ce script, le serveur, lui, laisserait n'importe
-- quel compte qui peut écrire changer la banque de quelqu'un d'autre — et
-- l'argent d'un virement partirait ailleurs sans que personne le voie.
--
-- Ce script REPREND la fonction de securite-5 telle quelle et ajoute les
-- deux champs à la liste « gestion » (admin seul). Rien d'autre ne change :
-- securite-9 (changer le rôle) vit dans une AUTRE fonction, il n'est pas
-- touché. Le relancer deux fois est sans danger.
-- ═══════════════════════════════════════════════════════════

create or replace function public.users_regles_comptes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r        text := public.role_jeton();
  moi      text := public.id_jeton();
  sur_moi  boolean;
  cible_client boolean;
  champ    text;
  -- Les champs de gestion de la fiche d'un EMPLOYÉ : admin seul.
  gestion constant text[] := array[
    'nom', 'tel', 'boutique', 'boutique_avant_espace', 'chef_equipe', 'parrain_id',
    'taux_commission', 'taux_equipe', 'taux_avancement', 'nom_complet', 'piece_type', 'piece_num',
    'anniv', 'promu_de', 'date_promotion',
    -- 15/09/2026 : la banque et le numéro de compte d'un employé (Timo, « si
    -- banque, normalement dans la fiche de l'utilisateur, on devrait ajouter
    -- le nom de la banque »). L'application les réserve déjà à l'admin ;
    -- le serveur doit dire la même chose.
    'banque', 'compte_bancaire',
    -- la paie vit dans la table `paie` ; si elle traîne encore ici, même règle
    'salaire_base', 'evolutions_salaire', 'primes', 'avances', 'virements', 'credits',
    'cnss_assujetti', 'cnss_matricule', 'cnss_numero_assurance', 'cnss_mensuel',
    'cnss_code_type', 'cnss_date_embauche', 'cnss_date_sortie', 'cnss_code_motif_sortie'];
  mot_de_passe constant text[] := array['pwd', 'pwd_hash', 'pwd_salt', 'pwd_hash2', 'pwd_visible', 'mdp_auto'];
  a_change boolean;
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;

  if tg_op = 'DELETE' then
    if r <> 'admin' then perform public.refus_role('Supprimer un compte', 'l''administrateur'); end if;
    return old;
  end if;

  sur_moi := (new.id = moi);
  cible_client := coalesce(old.data ->> 'role', 'client') = 'client';

  -- Bloquer / réactiver : admin (sa propre fiche est déjà interdite à tous).
  if (old.data -> 'actif') is distinct from (new.data -> 'actif') and r <> 'admin' then
    perform public.refus_role('Bloquer ou réactiver un compte', 'l''administrateur');
  end if;

  -- Chat libre d'un client : admin.
  if (old.data -> 'chat_libre') is distinct from (new.data -> 'chat_libre') and r <> 'admin' then
    perform public.refus_role('Autoriser le chat libre', 'l''administrateur');
  end if;

  -- Transfert du rôle principal et bascule réel ↔ formation : le principal.
  if coalesce((old.data ->> 'admin_principal')::boolean, false)
     is distinct from coalesce((new.data ->> 'admin_principal')::boolean, false)
     and not public.est_admin_principal() then
    perform public.refus_role('Transférer le rôle d''administrateur principal', 'l''administrateur principal');
  end if;
  if coalesce((old.data ->> 'formation')::boolean, false)
     is distinct from coalesce((new.data ->> 'formation')::boolean, false)
     and not public.est_admin_principal() then
    perform public.refus_role('Changer l''espace d''un compte (réel / formation)', 'l''administrateur principal');
  end if;

  -- Mot de passe d'un AUTRE compte : le principal. Le sien : chacun
  -- (connexion qui renforce le chiffrement, client qui change le sien).
  if not sur_moi then
    a_change := false;
    foreach champ in array mot_de_passe loop
      if (old.data -> champ) is distinct from (new.data -> champ) then a_change := true; end if;
    end loop;
    if a_change and not public.est_admin_principal() then
      perform public.refus_role('Changer le mot de passe d''un autre compte', 'l''administrateur principal');
    end if;
  end if;

  -- Les fiches des CLIENTS s'arrêtent là (étape 4 pour le reste).
  if cible_client then return new; end if;

  -- Champs de gestion d'un employé : admin — y compris sur sa propre fiche
  -- (personne ne se change son taux, sa boutique ou son salaire).
  if r <> 'admin' then
    foreach champ in array gestion loop
      if (old.data -> champ) is distinct from (new.data -> champ) then
        perform public.refus_role(format('Modifier « %s » dans la fiche d''un employé', champ), 'l''administrateur');
      end if;
    end loop;
  end if;

  -- Les tâches d'un AUTRE : le pouvoir « tâches ».
  if not sur_moi
     and (old.data -> 'taches') is distinct from (new.data -> 'taches')
     and not public.a_pouvoir_taches() then
    perform public.refus_role('Assigner, valider ou rouvrir la tâche d''un autre compte',
      'un compte qui a le pouvoir « Assigner des tâches »');
  end if;

  return new;
end;
$$;
drop trigger if exists users_regles_comptes_trg on public.users;
create trigger users_regles_comptes_trg
  before update or delete on public.users
  for each row execute function public.users_regles_comptes();

-- ═════════════════════════════════════════════════
-- VÉRIFICATION — doit afficher : true | true
-- ═════════════════════════════════════════════════
select
  exists (select 1 from pg_trigger where tgrelid = 'public.users'::regclass
            and tgname = 'users_regles_comptes_trg') as declencheur_en_place,
  (select prosrc like '%compte_bancaire%' from pg_proc where proname = 'users_regles_comptes') as banque_reservee_a_l_admin;
