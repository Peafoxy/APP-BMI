# Chantiers en attente du feu vert de Timo — état au 06/09/2026

Déplacé de CLAUDE.md le 06/09/2026, mot pour mot. **Aucun ne se construit sans son « lance ».**

## Mots de passe des comptes clients

- **Mot de passe des comptes clients, calculable à partir du nom et du
  numéro** : un plan complet (hasard à la création, « renvoyer » = nouveau
  mot de passe, messages PV/devis sans mot de passe pour les comptes
  existants) a été décrit à Timo le 31/08/2026. Sa réponse : « on laisse
  d'abord » — mis en attente, ni validé ni refusé. **Ne pas construire
  sans son feu vert** ; le jour venu, lui rappeler le plan tel quel.

- **Mots de passe des comptes clients** : le 05/09/2026, Timo a demandé
  l'explication, puis posé la question « même l'admin principal ne pourra
  plus voir ? ». Trois voies lui ont été proposées : (1) personne ne voit,
  « Renvoyer » fabrique un nouveau mot de passe (conseillée) ; (2) pareil,
  mais l'admin principal voit le dernier mot de passe envoyé tant que le
  client ne l'a pas changé ; (3) on laisse comme aujourd'hui. **Pas encore
  tranché** — il a préféré lancer la corbeille d'abord. Ne pas construire
  sans sa réponse.

## Mode superviseur

- **Mode superviseur** (code admin sur l'appareil d'un vendeur) : plan
  CADRÉ avec Timo le 31/08/2026 mais « ne pas construire pour le moment ».
  Le déroulé validé : bouton 🛡, l'admin choisit son nom + tape SON mot de
  passe (vérifiable hors ligne, pas de code partagé), l'interface passe en
  droits admin pour UN SEUL geste puis le mode se referme tout seul
  (« tout doit être pour un seul geste et le mode se referme » — mot pour
  mot) ; journal aux deux noms (« supprimé par TIMO (superviseur) —
  appareil de KOSSI ») ; exclusions : 👥 Utilisateurs, 💰 Salaires/paie,
  💾 Restauration (le serveur exige la vraie session admin pour ceux-là).
  ⚠ Piège identifié à l'avance : en mode superviseur, `ecrivain` de
  sauvegarderDiff doit RESTER celui du vendeur (admin: false), sinon la
  séparation de paie fabriquerait des fiches vides refusées par le serveur.
  **À ouvrir avec lui, le jour venu :** la **signature du contrat en
  boutique** (📋 Tous les devis → ✍️ Faire signer ici / 🖨 Imprimer pour
  signature papier / 📝 Signé sur papier, 2.101.48) est réservée à
  l'administrateur principal — décision Timo du 04/09/2026 : « laisser
  cette possibilité à l'administrateur principal seul ; quand on mettra en
  place le code superviseur, on pourra ouvrir ce geste aux vendeurs pour un
  seul geste ». `peutSignerEnBoutique` dans TousLesDevis.jsx.

## Corbeille (construite pour les chantiers ; extension possible)

- **Corbeille pour les fiches supprimées** — **CONSTRUITE pour les chantiers
  (2.101.56, 05/09/2026, Timo : « lance la corbeille »).** `lib/corbeille.js`
  (pur) : la fiche supprimée reste dans sa table, marquée `supprime_le` /
  `supprime_par` ; `separerCorbeille` au chargement (chargerTout) la range
  dans `db.corbeille_clients_installes`, `fusionnerCorbeille` à l'écriture
  (sauvegarderDiff) la remet dans sa table — aucun écran ne la voit, aucun
  faire-part ne part (même principe que la paie). Le report d'état périmé
  (rebaser) traite `CLES_CORBEILLE` comme des tables ; la sauvegarde de
  secours emporte la corbeille et la restauration la re-sépare. ⚙ Paramètres
  → onglet 🗑 Corbeille (admin principal seul) : ♻ Restaurer (fiche telle
  qu'au moment de la suppression) / Supprimer définitivement. **Purge
  automatique à 30 jours** (`DUREE_CORBEILLE_JOURS`) au démarrage, sur
  l'appareil de l'admin principal (effet dans App.jsx, AVANT le premier
  point de sortie). Serveur : `supabase/securite-7-corbeille.sql` (remplace
  la fonction de securite-6 : poser `supprime_le` = admin ou son commercial,
  jamais un client ; le retirer = admin principal). Banc : 15 contrôles dans
  verifier-cloisonnement + 10 dans tester-devis-chantiers.
  **COLLÉ par Timo le 05/09/2026** (capture : true) — la corbeille des
  chantiers est complète, application et serveur.
  Suite possible, une famille à la fois : prospects, articles, ventes
  (`TABLES_CORBEILLE` + `LIBELLES_CORBEILLE` + `nomDeLaFiche`).
