-- ============================================================
-- updated_at AUTORITAIRE CÔTÉ SERVEUR
-- ============================================================
-- PROBLÈME CORRIGÉ : jusqu'ici, chaque appareil envoyait sa propre
-- horloge comme valeur de "updated_at". Si l'horloge d'un poste est
-- même légèrement en retard, ses écritures semblent "plus vieilles"
-- qu'elles ne le sont réellement — un autre appareil, déjà synchronisé
-- au-delà de ce moment-là, ne les verra alors JAMAIS.
--
-- CE QUE FAIT CE SCRIPT : à chaque écriture (insertion ou
-- modification), la valeur envoyée par l'appareil pour "updated_at"
-- est ignorée et remplacée par l'heure RÉELLE du serveur Supabase.
-- Toutes les horloges de tous les appareils deviennent donc sans
-- importance pour la synchronisation — seule l'heure du serveur, unique
-- et fiable, compte désormais.
--
-- Sans danger : n'efface ni ne modifie aucune donnée existante.
--
-- À exécuter dans Supabase → SQL Editor → coller → Run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.horodatage_serveur()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
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
    EXECUTE format('DROP TRIGGER IF EXISTS horodatage_serveur_trg ON public.%I;', t);
    EXECUTE format(
      'CREATE TRIGGER horodatage_serveur_trg BEFORE INSERT OR UPDATE ON public.%I ' ||
      'FOR EACH ROW EXECUTE FUNCTION public.horodatage_serveur();',
      t
    );
  END LOOP;
END $$;

-- ============================================================
-- VÉRIFICATION APRÈS EXÉCUTION
-- ============================================================
-- select trigger_name, event_object_table from information_schema.triggers
-- where trigger_name = 'horodatage_serveur_trg';
-- Doit lister toutes les tables ci-dessus.

-- ============================================================
-- POUR ANNULER (si besoin)
-- ============================================================
-- DROP TRIGGER IF EXISTS horodatage_serveur_trg ON public.NOM_DE_LA_TABLE;
-- (à répéter pour chaque table)
