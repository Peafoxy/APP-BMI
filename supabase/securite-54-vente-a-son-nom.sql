-- ══════════════════════════════════════════════════════════════════
-- securite-54 — UNE VENTE SE CRÉE À SON NOM (16/11/2026, audit, point 4)
--
-- À la création d'une vente, la base ne comparait pas le VENDEUR inscrit
-- sur la vente (« par ») au compte réellement connecté : un appareil
-- trafiqué pouvait enregistrer une vente au nom d'un collègue.
--
-- Depuis ce script, une vente NEUVE est refusée si son vendeur n'est pas
-- le compte connecté. Deux portes restent ouvertes, exprès :
--   • l'administrateur (et le serveur) ;
--   • un collègue vendeur ou gérant de LA MÊME boutique : sur un poste
--     partagé, une vente faite hors connexion par l'un peut partir à la
--     connexion de l'autre — la refuser coincerait une vraie vente.
-- Le COMMERCIAL (la commission) n'est pas concerné : on encaisse le devis
-- d'un autre. Une vente qui existe déjà : securite-53 fige son vendeur.
--
-- Un déclencheur NOUVEAU, à part : aucune fonction existante n'est touchée.
-- Sans danger à relancer.
-- ══════════════════════════════════════════════════════════════════

create or replace function public.ventes_regles_vendeur()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); vendeur text; moi text;
begin
  if public.jeton_de_service() or r = 'admin' then return new; end if;
  -- Un UPSERT sur une vente qui existe n'est pas une création.
  if exists (select 1 from public.ventes v where v.id = new.id) then return new; end if;

  vendeur := lower(btrim(coalesce(new.data ->> 'par', '')));
  -- Le nom du compte connecté, lu sur SA fiche (par l'identifiant du jeton).
  select lower(btrim(coalesce(u.data ->> 'nom', ''))) into moi from public.users u
   where u.id = split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1);
  moi := coalesce(moi, '');
  -- Sans nom de vendeur, personne n'est imité : rien à comparer.
  if vendeur = '' or vendeur = moi then return new; end if;

  -- Poste partagé : un collègue qui vend dans CETTE boutique.
  if exists (
    select 1 from public.users u
    where lower(btrim(coalesce(u.data ->> 'nom', ''))) = vendeur
      and (u.data ->> 'role') in ('vendeur', 'gerant')
      and coalesce(u.data ->> 'actif', 'true') <> 'false'
      and coalesce(u.data ->> 'boutique', '') <> ''
      and (u.data ->> 'boutique') = (new.data ->> 'boutique')
  ) then return new; end if;

  perform public.refus_role('Enregistrer une vente au nom d''une autre personne',
                            'la personne connectée (ou l''administrateur)');
  return new;
end;
$$;
revoke all on function public.ventes_regles_vendeur() from public, anon;
drop trigger if exists ventes_regles_vendeur_trg on public.ventes;
create trigger ventes_regles_vendeur_trg
  before insert on public.ventes
  for each row execute function public.ventes_regles_vendeur();


-- VÉRIFICATION — doit afficher : true
select
  exists (select 1 from pg_trigger where tgname = 'ventes_regles_vendeur_trg') as vente_a_son_nom;

-- RETOUR EN ARRIÈRE (à coller seulement si on veut retirer cette règle) :
-- drop trigger if exists ventes_regles_vendeur_trg on public.ventes;
