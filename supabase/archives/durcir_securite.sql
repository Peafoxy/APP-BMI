-- ══════════════════════════════════════════════════════════════════
-- ÉTAPE FINALE DE SÉCURISATION — À NE LANCER QU'EN DERNIER
-- ══════════════════════════════════════════════════════════════════
-- N'exécutez ce fichier QUE lorsque TOUS les points suivants sont vrais :
--   1. La nouvelle version de l'application est installée sur TOUS les
--      PC ET republiée sur Vercel ;
--   2. CHAQUE utilisateur (admin, vendeurs, commerciaux) s'est reconnecté
--      au moins une fois avec cette nouvelle version, sur au moins un
--      appareil, avec une connexion internet active au moment de la
--      connexion (pour que sa vraie session sécurisée soit créée) ;
--   3. Vous avez vérifié dans Supabase → Authentication → Users qu'un
--      compte "xxxxx@bmi.internal" existe pour chaque utilisateur.
--
-- Tant que ces conditions ne sont pas remplies, NE PAS exécuter ce
-- fichier : vos appareils perdraient l'accès en écriture à Supabase
-- (l'application continuerait de fonctionner localement, mais plus
-- aucune synchronisation ne passerait, sur aucun appareil, tant que
-- chacun ne se serait pas reconnecté avec une session valide).
--
-- Ce script remplace les règles "ouvertes à tous" par des règles qui
-- exigent une vraie session Supabase authentifiée (donc plus jamais
-- accessible avec la seule clé publique, qui elle reste visible dans
-- le code de l'application).
-- ══════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
-- CAS PARTICULIER : la table users doit rester lisible SANS être déjà
-- connecté — sinon un appareil neuf (ou dont les données locales ont
-- été effacées) ne peut plus jamais retrouver son compte pour se
-- connecter : cercle vicieux (« il faut être connecté pour pouvoir se
-- connecter »). Seule la LECTURE reste publique ; créer, modifier ou
-- supprimer un compte reste réservé aux sessions authentifiées.
-- ══════════════════════════════════════════════════════════════════
drop policy if exists "acces_total_users" on users;
drop policy if exists "acces_authentifie_users" on users;
drop policy if exists "lecture_publique_users" on users;
drop policy if exists "ecriture_authentifiee_users_insert" on users;
drop policy if exists "ecriture_authentifiee_users_update" on users;
drop policy if exists "ecriture_authentifiee_users_delete" on users;
create policy "lecture_publique_users" on users for select using (true);
create policy "ecriture_authentifiee_users_insert" on users for insert with check (auth.role() = 'authenticated');
create policy "ecriture_authentifiee_users_update" on users for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "ecriture_authentifiee_users_delete" on users for delete using (auth.role() = 'authenticated');

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'boutiques', 'produits', 'ventes', 'depenses',
      'dettes', 'fournisseurs', 'ajustements', 'clotures', 'commerciaux',
      'tombstones', 'audits', 'prospects', 'categories_prospects', 'commandes',
      -- CES TABLES ÉTAIENT OUBLIÉES : sans elles, la messagerie, le parc
      -- client, les groupes de discussion et les proformas restaient soit
      -- ouverts à tous, soit bloqués en écriture après durcissement.
      -- (« users » est traitée à part juste au-dessus : voir le cas particulier.)
      'messages', 'clients_installes', 'groupes', 'proformas'
    ])
  loop
    execute format('drop policy if exists "acces_total_%s" on %I;', t, t);
    -- On supprime aussi la règle authentifiée si elle existe déjà (script
    -- relancé après une tentative précédente) : sinon la création échoue
    -- avec « policy already exists » sans rien casser, mais sans avancer.
    execute format('drop policy if exists "acces_authentifie_%s" on %I;', t, t);
    execute format(
      'create policy "acces_authentifie_%s" on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'');',
      t, t
    );
  end loop;
end $$;
