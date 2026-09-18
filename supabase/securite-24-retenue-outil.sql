-- ═══════════════════════════════════════════════════════════
-- securite-24-retenue-outil.sql — LA RETENUE POUR UN OUTIL PERDU
-- ═══════════════════════════════════════════════════════════
-- Timo, 18/09/2026 : « pour les salariés, c'est une retenue sur le salaire ;
-- pour les techniciens commission, c'est retenu sur commission ».
--
-- La retenue sur COMMISSION se prend au moment où on paie la part
-- d'installation du technicien — et ce paiement peut être fait par le VENDEUR
-- de la boutique (💰 Primes remises) ou par le GÉRANT, qui n'ont pas le droit
-- de tenir le registre de l'outillage (securite-22). Leur écriture serait donc
-- REFUSÉE par la base, et tout le lot resterait coincé dans la file d'attente.
--
-- On leur ouvre EXACTEMENT une porte, pas une de plus : ils peuvent écrire
-- dans `outillage` À CONDITION que, une fois les RETENUES retirées de chaque
-- mouvement de chaque outil, le registre soit IDENTIQUE. Autrement dit : ils
-- inscrivent ce qui a été retenu, ils ne sortent pas un outil, ne le rendent
-- pas, ne le déclarent pas perdu, ne changent pas ce qui est dû.
--
-- Ce script REPREND securite-23 (et donc securite-22) telle quelle et ajoute
-- cette seule exception. C'est le SEUL à coller. Le relancer est sans danger.
-- ═══════════════════════════════════════════════════════════

-- Le registre débarrassé des RETENUES : ce qui doit rester identique.
create or replace function public.outillage_sans_retenues(o jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'appels', coalesce(o -> 'appels', '[]'::jsonb),
    'outils', coalesce((
      select jsonb_agg(
        jsonb_set(e, '{mouvements}', coalesce((
          select jsonb_agg(m - 'retenues' order by mord)
          from jsonb_array_elements(coalesce(e -> 'mouvements', '[]'::jsonb)) with ordinality u(m, mord)
        ), '[]'::jsonb), true)
        order by ord)
      from jsonb_array_elements(coalesce(o -> 'outils', '[]'::jsonb)) with ordinality t(e, ord)
    ), '[]'::jsonb)
  );
$$;

-- Qui peut INSCRIRE une retenue : celui qui paie une part d'installation
-- (l'administrateur, le gérant, le vendeur de la boutique qui paie), en plus
-- de ceux qui tiennent déjà le registre.
create or replace function public.a_pouvoir_retenue_outil()
returns boolean language sql stable set search_path = public as $$
  select public.a_pouvoir_outillage()
      or public.role_jeton() in ('admin', 'gerant', 'vendeur');
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
    -- ⏱ PREMIÈRE EXCEPTION : un technicien JUSTIFIE un retard (securite-23).
    -- 💵 SECONDE EXCEPTION : celui qui paie une part d'installation INSCRIT la
    -- retenue pour un outil perdu. Dans les deux cas, tout le reste du
    -- registre doit être identique — sinon c'est un autre geste.
    if not (r in ('technicien', 'technicien_bmi')
            and public.outillage_sans_justifs(avant -> 'outillage')
                is not distinct from public.outillage_sans_justifs(new.data -> 'outillage'))
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

-- ═════════════════════════════════════════════════════
-- VÉRIFICATION — doit afficher : true | true | true | true
-- ═════════════════════════════════════════════════════
select
  exists (select 1 from pg_proc where proname = 'a_pouvoir_outillage') as securite_22_en_place,
  exists (select 1 from pg_proc where proname = 'outillage_sans_justifs') as securite_23_en_place,
  exists (select 1 from pg_proc where proname = 'outillage_sans_retenues') as regle_retenue_posee,
  (select prosrc like '%outillage_sans_retenues%' from pg_proc where proname = 'boutiques_regles_roles') as porte_ouverte_au_payeur;
