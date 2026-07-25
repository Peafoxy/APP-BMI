-- ============================================================
-- SUPPRESSIONS TOUJOURS PROPAGÉES — même faites en SQL direct
-- ============================================================
-- PROBLÈME CORRIGÉ : l'app note chaque suppression qu'elle fait dans
-- la table "tombstones", que les autres appareils lisent pour savoir
-- quoi effacer chez eux. Mais une suppression faite DIRECTEMENT en SQL
-- dans Supabase (TRUNCATE, DELETE) ne passait jamais par ce mécanisme
-- — aucun ticket n'était créé, donc les appareils déjà synchronisés
-- gardaient les anciennes données pour toujours, sans jamais savoir
-- qu'elles avaient été supprimées.
--
-- CE QUE FAIT CE SCRIPT : deux déclencheurs automatiques, posés
-- directement sur chaque table. Désormais, TOUTE suppression — qu'elle
-- vienne de l'app ou d'une commande SQL tapée à la main — crée
-- elle-même son ticket de suppression. Plus jamais besoin de vider un
-- appareil à la main après un nettoyage.
--
-- Sans danger : ne touche à aucune donnée existante, ne fait qu'ajouter
-- une réaction automatique aux suppressions FUTURES.
--
-- À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

-- 1) Suppression ligne par ligne (DELETE normal, app ou SQL) --------
CREATE OR REPLACE FUNCTION public.tombstone_sur_suppression()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.tombstones (id, table_name, record_id, deleted_at)
  VALUES (TG_TABLE_NAME || ':' || OLD.id, TG_TABLE_NAME, OLD.id, now())
  ON CONFLICT (id) DO UPDATE SET deleted_at = now();
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 2) Vidage complet d'une table (TRUNCATE, ou DELETE sans condition) -
-- TRUNCATE ne déclenche pas de réaction ligne par ligne (Postgres ne
-- sait plus quelles lignes existaient) : il faut un ticket spécial,
-- "vide toute cette table", que l'app sait aussi comprendre.
CREATE OR REPLACE FUNCTION public.tombstone_sur_truncate()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.tombstones (id, table_name, record_id, deleted_at)
  VALUES (TG_TABLE_NAME || ':__TRUNCATE__', TG_TABLE_NAME, '__TRUNCATE__', now())
  ON CONFLICT (id) DO UPDATE SET deleted_at = now();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'boutiques', 'users', 'produits', 'ventes', 'depenses',
    'dettes', 'fournisseurs', 'ajustements', 'clotures', 'commerciaux',
    'audits', 'prospects', 'categories_prospects', 'commandes',
    'messages', 'clients_installes', 'proformas', 'groupes'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tombstone_suppression_trg ON public.%I;', t);
    EXECUTE format(
      'CREATE TRIGGER tombstone_suppression_trg AFTER DELETE ON public.%I ' ||
      'FOR EACH ROW EXECUTE FUNCTION public.tombstone_sur_suppression();',
      t
    );

    EXECUTE format('DROP TRIGGER IF EXISTS tombstone_truncate_trg ON public.%I;', t);
    EXECUTE format(
      'CREATE TRIGGER tombstone_truncate_trg AFTER TRUNCATE ON public.%I ' ||
      'FOR EACH STATEMENT EXECUTE FUNCTION public.tombstone_sur_truncate();',
      t
    );
  END LOOP;
END $$;

-- ============================================================
-- VÉRIFICATION APRÈS EXÉCUTION
-- ============================================================
-- select event_object_table, trigger_name from information_schema.triggers
-- where trigger_name in ('tombstone_suppression_trg', 'tombstone_truncate_trg')
-- order by event_object_table;
-- Doit lister DEUX déclencheurs par table, pour toutes les tables ci-dessus.

-- ============================================================
-- POUR ANNULER (si besoin)
-- ============================================================
-- DROP TRIGGER IF EXISTS tombstone_suppression_trg ON public.NOM_DE_LA_TABLE;
-- DROP TRIGGER IF EXISTS tombstone_truncate_trg ON public.NOM_DE_LA_TABLE;
-- (à répéter pour chaque table)
