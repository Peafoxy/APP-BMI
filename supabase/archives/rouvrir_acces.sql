-- ══════════════════════════════════════════════════════════════════
-- ROUVRIR L'ACCÈS — annule durcir_securite.sql
-- ══════════════════════════════════════════════════════════════════
-- À utiliser si la sécurisation (comptes Supabase Auth automatiques)
-- pose problème et que vous préférez la mettre de côté temporairement,
-- le temps de la reprendre plus tard dans de meilleures conditions.
--
-- Ce script remet les règles d'accès à leur état d'origine (accessible
-- avec la seule clé publique, comme avant la sécurisation). L'application
-- fonctionne alors exactement comme avant qu'on ajoute cette étape.
--
-- Sans danger pour vos données : ceci ne touche qu'aux permissions
-- d'accès, jamais au contenu des tables.
-- ══════════════════════════════════════════════════════════════════

do $$
declare
  t text;
begin
  -- Nettoyage des règles spécifiques à "users" (voir le cas particulier
  -- dans durcir_securite.sql) avant de lui remettre la règle ouverte standard.
  drop policy if exists "lecture_publique_users" on users;
  drop policy if exists "ecriture_authentifiee_users_insert" on users;
  drop policy if exists "ecriture_authentifiee_users_update" on users;
  drop policy if exists "ecriture_authentifiee_users_delete" on users;

  for t in
    select unnest(array[
      'boutiques', 'users', 'produits', 'ventes', 'depenses',
      'dettes', 'fournisseurs', 'ajustements', 'clotures', 'commerciaux',
      'tombstones', 'audits', 'prospects', 'categories_prospects', 'commandes',
      -- Indispensables ici aussi : sans elles, un retour en arrière laisserait
      -- la messagerie, le parc client, les groupes et les proformas bloqués en écriture.
      'messages', 'clients_installes', 'groupes', 'proformas'
    ])
  loop
    if to_regclass(t) is not null then
      execute format('drop policy if exists "acces_authentifie_%s" on %I;', t, t);
      execute format('drop policy if exists "acces_total_%s" on %I;', t, t);
      execute format(
        'create policy "acces_total_%s" on %I for all using (true) with check (true);',
        t, t
      );
    end if;
  end loop;
end $$;
