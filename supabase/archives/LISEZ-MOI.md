# ⛔ NE JAMAIS COLLER CES SCRIPTS DANS SUPABASE

Rangés ici le 05/10/2026 (Timo : « oui, range les vieux scripts »), après
l'avis extérieur qui avait pris leurs `using (true)` pour l'état actuel de
la base.

Ce sont des scripts d'**avant la sécurisation** (juillet–août 2026). Ils
sont gardés pour l'histoire seulement. Plusieurs **défont** la sécurité
d'aujourd'hui :

| Fichier | Pourquoi il est dangereux aujourd'hui |
|---|---|
| `rouvrir_acces.sql` | Rouvre TOUTE la base à n'importe qui, sans compte. |
| `schema.sql`, `ajouter_groupes.sql`, `ajouter_proformas.sql` | Posent des règles « tout le monde a tout » (`using (true)` sans connexion). |
| `corriger-lecture-boutiques.sql` | Rouvre la lecture des boutiques sans connexion (cachet, loyer, numéros) — fermée le 05/10/2026. |
| `corriger-lecture-users.sql`, `durcir_securite.sql` | Rouvrent la lecture des comptes sans connexion — fermée par `users-1`. |
| `activer-rls.sql` | La toute première protection, remplacée depuis. |
| `reinitialiser_base.sql`, `vider-donnees-demo.sql` | EFFACENT les données. |

La sécurité en vigueur est faite des scripts restés dans `supabase/`
(`securite-1` à `-35`, `espace-*`, `client-*`, `roles-*`, `users-1`,
`paie-*`…), tous collés par Timo.
