-- ============================================================
-- VAGUE 2, ÉTAPE 3 — UN COMPTE CLIENT NE LIT PLUS QUE SES LIGNES
-- ============================================================
-- CE QUE FAIT CE SCRIPT, EN UNE PHRASE : l'appareil d'un client ne peut
-- plus télécharger les dettes, les ventes et les chantiers des autres —
-- il ne reçoit plus que ce qui le concerne.
--
-- POURQUOI. L'application est hors-ligne d'abord : chaque appareil
-- réclame TOUT ce qui a changé, et c'est au serveur de filtrer. Depuis
-- l'étape 1 (2.101.28), chaque ligne naît avec son propriétaire
-- (client_user_id / user_id) ; l'étape 2 a confirmé que rien d'ancien ne
-- restait à rattacher. On peut donc fermer.
--
-- CE QU'UN CLIENT CONTINUE DE VOIR — les exceptions sont précises, et
-- chacune existe parce qu'un écran en a besoin :
--
--   • SES dettes et SES ventes (celles qui portent son étiquette) ;
--   • SON chantier, et les chantiers de SES FILLEULS — l'écran de
--     parrainage affiche leur avancement ;
--   • les ventes où il est LE PARRAIN (ou l'apporteur), et la dette de
--     ces ventes-là : sa part n'est due que lorsque le filleul a soldé —
--     sans cette dette, son écran afficherait « part due » à tort ;
--   • la vente rattachée à son chantier, même si elle a été saisie par
--     un vendeur avec un autre numéro : c'est elle qu'il modifie en
--     signant son PV de réception — la fermer bloquerait la signature.
--
-- Les employés, le comptable et l'administrateur ne sont PAS concernés :
-- ils continuent de tout lire, comme aujourd'hui.
--
-- ⚠ ET CE QUI EST DÉJÀ TÉLÉCHARGÉ ? Comme pour l'annuaire (étape
-- client-1) : à sa prochaine connexion en ligne, l'appareil relit ce que
-- le serveur lui accorde et SUPPRIME de lui-même toute ligne locale que
-- le serveur ne lui montre plus (le « miroir » de src/sync.js). Rien à
-- lancer.
--
-- Vérifié au banc : npm run tester-client-lecture (base jetable).
--
-- RETOUR EN ARRIÈRE : tout en bas.
-- À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

-- L'identifiant BMI du compte se lit dans l'adresse du jeton : les comptes
-- d'authentification sont créés sous la forme « <id>@bmi.internal »
-- (voir api/sync-auth.js). Même technique que client-1-fermer-annuaire.sql.
do $$
declare
  moi        constant text := 'split_part(coalesce(auth.jwt() ->> ''email'', ''''), ''@'', 1)';
  pas_client constant text := 'coalesce(auth.jwt() -> ''app_metadata'' ->> ''role'', '''') <> ''client''';
begin
  -- ── dettes : les siennes, plus celle du filleul dont il est parrain ──
  -- (une chaîne vide ou absente = pas de propriétaire : personne ne la voit,
  -- à part les employés — c'est le cas des clients de passage, et c'est
  -- le comportement voulu)
  execute format('drop policy if exists "role_client_ses_dettes" on public.dettes;');
  execute format(
    'create policy "role_client_ses_dettes" on public.dettes '
    'as restrictive for select to authenticated '
    'using (%s or data ->> ''client_user_id'' = %s '
    '  or exists (select 1 from public.ventes v '
    '             where v.id = dettes.data ->> ''vente_id'' '
    '               and v.data -> ''apporteur'' ->> ''parrain_user_id'' = %s));',
    pas_client, moi, moi
  );

  -- ── ventes : les siennes, celles où il est parrain/apporteur, et la
  --    vente rattachée à SON chantier (celle du PV) ─────────────────────
  execute format('drop policy if exists "role_client_ses_ventes" on public.ventes;');
  execute format(
    'create policy "role_client_ses_ventes" on public.ventes '
    'as restrictive for select to authenticated '
    'using (%s or data ->> ''client_user_id'' = %s '
    '  or data -> ''apporteur'' ->> ''parrain_user_id'' = %s '
    '  or exists (select 1 from public.clients_installes c '
    '             where c.data ->> ''user_id'' = %s '
    '               and c.data ->> ''vente_id'' = ventes.id));',
    pas_client, moi, moi, moi
  );

  -- ── chantiers : le sien, et ceux de ses filleuls ─────────────────────
  -- (le lien passe par la fiche du filleul, que l'étape client-1 lui
  -- laisse justement lire : les deux règles travaillent ensemble)
  execute format('drop policy if exists "role_client_ses_chantiers" on public.clients_installes;');
  execute format(
    'create policy "role_client_ses_chantiers" on public.clients_installes '
    'as restrictive for select to authenticated '
    'using (%s or data ->> ''user_id'' = %s '
    '  or exists (select 1 from public.users u '
    '             where u.id = clients_installes.data ->> ''user_id'' '
    '               and u.data ->> ''parrain_client_id'' = %s));',
    pas_client, moi, moi
  );

  raise notice 'Lecture fermee aux comptes clients : dettes, ventes, clients_installes.';
end $$;


-- ══════════════════════════════════════════════════════════════════
-- AU PASSAGE — CORRECTIF D'UN DÉFAUT RÉEL DE L'ÉTAPE PRÉCÉDENTE
-- ══════════════════════════════════════════════════════════════════
-- Trouvé le 31/08/2026 par le banc de cette étape : le garde-fou posé par
-- client-2-fermer-ecriture.sql plante quand la vente n'a PAS d'apporteur
-- (le cas le plus courant) — et le serveur refusait alors TOUTE signature
-- de PV sur une vente sans parrain. Cette version corrigée remplace
-- l'ancienne à l'identique, à ce détail près.
create or replace function public.client_ne_touche_pas_a_l_argent_des_ventes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  jetons jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
  avant  jsonb;
  apres  jsonb;
begin
  -- Voie de secours : éditeur SQL, clé service_role, migrations.
  if jetons = '{}'::jsonb or coalesce(jetons ->> 'role', '') = 'service_role' then
    return new;
  end if;
  if coalesce(jetons -> 'app_metadata' ->> 'role', '') <> 'client' then
    return new;
  end if;

  -- On met de côté les trois champs autorisés, puis on exige que TOUT le
  -- reste soit rigoureusement identique. On ne retire la clé
  -- « a_la_reception » que si `apporteur` est bien un objet : sinon,
  -- « 'null'::jsonb - clé » lève « cannot delete from scalar ».
  avant := (old.data - 'commission_a_la_reception' - 'commission_debloquee_le')
           || jsonb_build_object('apporteur',
                case when jsonb_typeof(old.data -> 'apporteur') = 'object'
                     then (old.data -> 'apporteur') - 'a_la_reception'
                     else coalesce(old.data -> 'apporteur', 'null'::jsonb) end);
  apres := (new.data - 'commission_a_la_reception' - 'commission_debloquee_le')
           || jsonb_build_object('apporteur',
                case when jsonb_typeof(new.data -> 'apporteur') = 'object'
                     then (new.data -> 'apporteur') - 'a_la_reception'
                     else coalesce(new.data -> 'apporteur', 'null'::jsonb) end);

  if avant is distinct from apres then
    raise exception
      'Refusé : un compte client ne modifie d''une vente que la réception des travaux.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;


-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION — les trois règles doivent apparaître
-- ══════════════════════════════════════════════════════════════════
select tablename, policyname, permissive, cmd
from pg_policies
where schemaname = 'public'
  and policyname in ('role_client_ses_dettes',
                     'role_client_ses_ventes',
                     'role_client_ses_chantiers')
order by tablename;


-- ══════════════════════════════════════════════════════════════════
-- RETOUR EN ARRIÈRE (à ne coller QUE si quelque chose se bloque)
-- ══════════════════════════════════════════════════════════════════
-- drop policy if exists "role_client_ses_dettes" on public.dettes;
-- drop policy if exists "role_client_ses_ventes" on public.ventes;
-- drop policy if exists "role_client_ses_chantiers" on public.clients_installes;
