-- ============================================================
-- SÉCURITÉ 17 — LE RETOUR SOUS GARANTIE OUVERT AU GÉRANT
-- (Timo, 14/09/2026 : « ouvre le retour sous garantie au gérant »)
--
-- Depuis le 04/09/2026, l'échange d'un article défectueux (🔁 Retour dans
-- 💰 Ventes : ajustements `echange_garantie` + `retour_defectueux`) était
-- réservé à l'administrateur. Décision du 14/09 : le gérant aussi. Statuer sur
-- le défectueux (« renvoyé au fournisseur » / « rebut », champ `statut`)
-- reste l'administrateur seul.
--
-- Remplace ajustements_regles_roles (securite-13), tout le reste inchangé :
-- suppression = admin ; reprise_client = administrateur principal ; autres
-- mouvements = magasinier / gérant / admin.
-- ⚠ Un UPSERT n'est pas une création : la ligne est RELUE, et un changement de
-- statut par upsert est jugé comme une mise à jour.
--
-- À coller dans Supabase → SQL Editor → Run. Banc : scripts/tester-argent-sql.sh.
-- ============================================================

create or replace function public.ajustements_regles_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text := public.role_jeton(); t text; avant jsonb;
begin
  if public.jeton_de_service() then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if r <> 'admin' then perform public.refus_role('Supprimer un ajustement', 'l''administrateur'); end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    select a.data into avant from public.ajustements a where a.id = new.id;
  else
    avant := old.data;
  end if;
  t := coalesce(new.data ->> 'type', '');
  if t = 'reprise_client' then
    if not public.est_admin_principal() then perform public.refus_role('Reprendre un article vendu (retour au stock)', 'l''administrateur principal'); end if;
    return new;
  end if;
  if t in ('echange_garantie', 'retour_defectueux') then
    -- Timo (14/09/2026) : le gérant aussi.
    if r not in ('gerant', 'admin') then perform public.refus_role('Retour sous garantie', 'le gérant, l''administrateur'); end if;
    if avant is not null and (avant ->> 'statut') is distinct from (new.data ->> 'statut') and r <> 'admin' then
      perform public.refus_role('Statuer sur un article défectueux', 'l''administrateur');
    end if;
    return new;
  end if;
  if r not in ('magasinier', 'gerant', 'admin') then
    perform public.refus_role('Mouvement de stock (entrée, ajustement, transfert, inventaire)', 'le magasinier, le gérant, l''administrateur');
  end if;
  return new;
end;
$$;
drop trigger if exists ajustements_regles_roles_trg on public.ajustements;
create trigger ajustements_regles_roles_trg
  before insert or update or delete on public.ajustements
  for each row execute function public.ajustements_regles_roles();

-- Supabase donne les droits par défaut à anon sur toute nouvelle fonction.
revoke all on function public.ajustements_regles_roles() from public, anon;

-- VÉRIFICATION — doit afficher : true | true
select
  (select count(*) = 1 from pg_trigger where tgname = 'ajustements_regles_roles_trg') as declencheur_pose,
  (select prosrc like '%le gérant, l''''administrateur%' and prosrc like '%Retour sous garantie%' from pg_proc where proname = 'ajustements_regles_roles') as gerant_admis;
