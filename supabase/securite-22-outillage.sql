-- ═══════════════════════════════════════════════════════════
-- securite-22-outillage.sql — 🧰 LE REGISTRE DU MATÉRIEL DE TRAVAIL
-- ═══════════════════════════════════════════════════════════
-- Timo, 17/09/2026 : « le matériel de travail… comment faire le suivi, pour
-- éviter la perte des équipements de travail sur le terrain », puis, sur qui
-- le tient : « chef technicien, magasinier, administrateur ».
--
-- Le registre vit dans le champ `outillage` de la fiche de sa boutique —
-- il n'y a donc AUCUNE table à créer. Mais aujourd'hui, sur `boutiques`,
-- SEUL le champ `demandes` échappe à la règle « modifier une boutique =
-- l'administrateur » : sans ce script, une sortie d'outil enregistrée par le
-- chef technicien ou le magasinier serait REFUSÉE par la base, et tout le lot
-- resterait coincé dans la file d'attente.
--
-- Ce script REPREND la fonction de securite-8 telle quelle et fait deux
-- choses, et deux seulement :
--   • `outillage` rejoint `demandes` parmi les champs qui ne demandent pas
--     d'être administrateur ;
--   • un contrôle à part dit QUI a le droit d'y toucher.
-- Tout le reste est inchangé : créer / supprimer une boutique, l'écran de
-- connexion et le cachet (administrateur PRINCIPAL), le piège de l'UPSERT
-- (AVANT INSERT se déclenche même quand la ligne existe déjà).
--
-- ⚠ Il suppose `est_chef_equipe()` en place (securite-6-devis-chantiers.sql),
-- déjà collé. La vérification du bas le confirme. Le relancer deux fois est
-- sans danger.
-- ═══════════════════════════════════════════════════════════

-- Qui tient le registre : le magasinier, l'administrateur, et le CHEF des
-- techniciens (l'étoile ⭐, à commission ou salarié). Le technicien ORDINAIRE
-- ne s'enregistre pas lui-même : sinon la trace ne vaut rien. Doit dire la
-- même chose que peutTenirOutillage() dans src/lib/outillage.js.
create or replace function public.a_pouvoir_outillage()
returns boolean language sql stable set search_path = public as $$
  select (public.role_jeton() in ('magasinier', 'admin')
          or (public.role_jeton() in ('technicien', 'technicien_bmi') and public.est_chef_equipe()))
     and not coalesce(auth.jwt() -> 'app_metadata' -> 'pouvoirs_off' ? 'outillage', false);
$$;

create or replace function public.boutiques_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); champ text; avant jsonb; reste_old jsonb; reste_new jsonb;
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if r <> 'admin' then perform public.refus_role('Supprimer une boutique', 'l''administrateur'); end if;
    return old;
  end if;
  -- ⚠ UPSERT : AVANT INSERT se déclenche même si la ligne existe déjà.
  if tg_op = 'INSERT' then
    select b.data into avant from public.boutiques b where b.id = new.id;
    if avant is null then
      if r <> 'admin' and not coalesce((new.data ->> 'terrain')::boolean, false) then
        perform public.refus_role('Créer une boutique', 'l''administrateur');
      end if;
      return new;
    end if;
  else
    avant := old.data;
  end if;
  -- 🧰 17/09/2026 : `outillage` rejoint `demandes` — il a sa propre règle,
  -- juste en dessous, et ne fait donc plus de la boutique une fiche d'admin.
  reste_old := avant - 'demandes' - 'updated_at' - 'outillage';
  reste_new := new.data - 'demandes' - 'updated_at' - 'outillage';
  if reste_old is distinct from reste_new then
    if r <> 'admin' then perform public.refus_role('Modifier une boutique', 'l''administrateur'); end if;
    for champ in select k from jsonb_object_keys(reste_old || reste_new) k loop
      if (champ like 'accueil\_%' or champ like 'cachet%') and public.champ_change(reste_old, reste_new, champ)
         and not public.est_admin_principal() then
        perform public.refus_role('Personnaliser l''écran de connexion ou le cachet', 'l''administrateur principal');
      end if;
    end loop;
  end if;
  -- 🧰 Le registre de l'outillage : le chef technicien, le magasinier, l'admin.
  if (avant -> 'outillage') is distinct from (new.data -> 'outillage')
     and not public.a_pouvoir_outillage() then
    perform public.refus_role('Tenir le registre de l''outillage',
      'le chef des techniciens, le magasinier ou l''administrateur');
  end if;
  return new;
end;
$$;
drop trigger if exists boutiques_regles_roles_trg on public.boutiques;
create trigger boutiques_regles_roles_trg
  before insert or update or delete on public.boutiques
  for each row execute function public.boutiques_regles_roles();

-- ═════════════════════════════════════════════════
-- VÉRIFICATION — doit afficher : true | true | true
-- ═════════════════════════════════════════════════
select
  exists (select 1 from pg_proc where proname = 'est_chef_equipe') as securite_6_en_place,
  (select prosrc like '%technicien_bmi%' from pg_proc where proname = 'a_pouvoir_outillage') as chef_technicien_reconnu,
  (select prosrc like '%outillage%' from pg_proc where proname = 'boutiques_regles_roles') as registre_libere;
