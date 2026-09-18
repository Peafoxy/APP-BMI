-- ═══════════════════════════════════════════════════════════
-- securite-25-chantier-outil.sql — CHANGER LE CHANTIER D'UN OUTIL
-- ═══════════════════════════════════════════════════════════
-- Timo, 18/09/2026 : « aujourd'hui il finit le chantier A, il n'a pas besoin
-- de ramener l'outil avant d'aller sur le chantier B… il peut juste changer
-- le chantier DANS SON ESPACE ».
--
-- Le technicien qui détient l'outil n'a pas le droit de tenir le registre
-- (securite-22), et securite-23 ne lui ouvrait QUE la justification d'un
-- retard. Son changement de chantier serait donc REFUSÉ par la base, et tout
-- le lot resterait coincé dans la file d'attente.
--
-- On élargit sa porte d'UN cran, pas plus : il peut écrire dans `outillage`
-- à condition que, une fois retirés de chaque outil ses JUSTIFICATIONS et
-- ses mouvements de type « chantier », le registre soit IDENTIQUE. Autrement
-- dit : il dit où il travaille, il ne sort pas un outil, ne le rend pas, ne
-- le déclare pas perdu, ne touche pas à ce qui est dû.
--
-- Ce script REPREND securite-24 (donc -23 et -22) telle quelle et ne change
-- que cette condition. C'est le SEUL à coller. Le relancer est sans danger.
-- ═══════════════════════════════════════════════════════════

-- Le registre débarrassé des justifications ET des changements de chantier.
create or replace function public.outillage_sans_justifs_ni_chantiers(o jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'appels', coalesce(o -> 'appels', '[]'::jsonb),
    'outils', coalesce((
      select jsonb_agg(
        jsonb_set(e - 'justifications', '{mouvements}', coalesce((
          select jsonb_agg(m order by mord)
          from jsonb_array_elements(coalesce(e -> 'mouvements', '[]'::jsonb)) with ordinality u(m, mord)
          where coalesce(m ->> 'type', '') <> 'chantier'
        ), '[]'::jsonb), true)
        order by ord)
      from jsonb_array_elements(coalesce(o -> 'outils', '[]'::jsonb)) with ordinality t(e, ord)
    ), '[]'::jsonb)
  );
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
    -- ⏱🏗 PREMIÈRE EXCEPTION : le technicien qui DÉTIENT l'outil justifie son
    -- retard (securite-23) et dit sur quel chantier il part (securite-25).
    -- 💵 SECONDE EXCEPTION : celui qui paie une part d'installation INSCRIT la
    -- retenue pour un outil perdu (securite-24). Dans les deux cas, tout le
    -- reste du registre doit être identique — sinon c'est un autre geste.
    if not (r in ('technicien', 'technicien_bmi')
            and public.outillage_sans_justifs_ni_chantiers(avant -> 'outillage')
                is not distinct from public.outillage_sans_justifs_ni_chantiers(new.data -> 'outillage'))
       and not (public.a_pouvoir_retenue_outil()
            and public.outillage_sans_retenues(avant -> 'outillage')
                is not distinct from public.outillage_sans_retenues(new.data -> 'outillage')) then
      perform public.refus_role('Tenir le registre de l''outillage',
        'le chef des techniciens, le magasinier ou l''administrateur');
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists boutiques_regles_roles_trg on public.boutiques;
create trigger boutiques_regles_roles_trg
  before insert or update or delete on public.boutiques
  for each row execute function public.boutiques_regles_roles();

-- ═══════════════════════════════════════════════════════════
-- VÉRIFICATION — doit afficher : true | true | true | true | true
-- ═══════════════════════════════════════════════════════════
select
  exists (select 1 from pg_proc where proname = 'a_pouvoir_outillage') as securite_22_en_place,
  exists (select 1 from pg_proc where proname = 'outillage_sans_justifs') as securite_23_en_place,
  exists (select 1 from pg_proc where proname = 'outillage_sans_retenues') as securite_24_en_place,
  exists (select 1 from pg_proc where proname = 'outillage_sans_justifs_ni_chantiers') as regle_chantier_posee,
  (select prosrc like '%outillage_sans_justifs_ni_chantiers%' from pg_proc where proname = 'boutiques_regles_roles') as porte_ouverte_au_detenteur;
