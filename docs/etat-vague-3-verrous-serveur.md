# Vague 3 — les verrous serveur entre employés (terminée) — état au 06/09/2026

Déplacé de CLAUDE.md le 06/09/2026, mot pour mot. Tous les SQL sont collés sur la vraie base.

- **VAGUE 3 — verrouiller côté serveur les règles entre EMPLOYÉS** :
  demandée par Timo le 04/09/2026 (« tout devrait normalement être
  verrouillé »). **Inventaire livré** :
  `docs/inventaire-verrous-employes-2026-09.md` (à cocher par lui, ligne
  par ligne). Constat : le serveur ne distingue que client / admin /
  lecture seule et le mur d'espace ; vendeur, gérant, magasinier,
  commercial, technicien sont identiques pour lui, admin secondaire =
  admin principal (l'étiquette « principal » n'est PAS dans le jeton), et
  aucune notion de boutique. Ordre proposé : (0) **URGENT** fermer les
  faire-part de suppression `tombstones` — ouverts à TOUT compte connecté,
  clients compris : un faux marqueur `*` vide la base locale ET la file
  d'attente de tous les appareils ; (1) étiquette « admin principal » +
  filet « retirer d'un lot le geste refusé » ; (2) argent ; (3) comptes ;
  (4) devis/chantiers (lecture dans la fiche client — délicat) ; (5) les ❓.
  Règle d'application à poser en même temps : tout geste réservé à un rôle
  le revérifie DANS le geste, pas seulement à l'affichage. **Ne rien
  construire avant que Timo ait coché l'inventaire.**
  **Étape 0 ÉCRITE ET TESTÉE le 04/09/2026** (Timo : « Ok ») :
  `supabase/securite-3-faire-part.sql` — un client n'écrit jamais de
  faire-part (3 règles restrictives), déclencheur `faire_part_sincere_trg`
  (BEFORE INSERT/UPDATE, security definer) : refuse un faire-part sur une
  ligne qui existe encore, une table inconnue, et réserve les marqueurs
  globaux (`*`, `__TRUNCATE__`) au rôle admin ; jeton vide / service_role
  passent (éditeur SQL, TRUNCATE). Banc `npm run tester-faire-part`
  (14 contrôles, dont 2 qui prouvent le trou AVANT le verrou).
  **COLLÉ par Timo le 04/09/2026** (capture : 3 / true / true) — le trou
  des faire-part est FERMÉ sur la vraie base. Suite : ses réponses aux ❓
  de l'inventaire, puis étape 1 (étiquette « principal » + filet de lot).
  **Réponses de Timo aux ❓ (04/09/2026)** — point 5 : « limiter et
  verrouiller » = plafonner la remise libre sur un devis côté serveur
  (au-delà du seuil : admin seul — **seuil à lui demander**) ET verrouiller
  cadeaux, photos, date d'entretien, tâches (admin / pouvoir) côté serveur,
  contre mon avis « laisser » — sa décision. **Plafond de remise : 3 %**
  (au-delà : admin seul). Point 1 (clôturer la caisse) : **admin + gérant**.
  Point 3 (pouvoirs + boutique dans l'étiquette) : **oui**. Point 2 (entrées / ajustements / transferts de stock) :
  **magasinier + gérant + admin** (tranché après signalement des
  conséquences d'« admin principal seul »). Point 4 (gestes « admin ou son
  commercial ») : **« laisser comme tel »** = la règle d'aujourd'hui,
  appliquée par le serveur avec la notion de propriétaire. **Tous les ❓
  sont tranchés ; les ✅ validés par défaut.**
  **Étape 1 CONSTRUITE (2.101.51, 04/09/2026)** : (a) l'étiquette de
  connexion porte `principal` (drapeau admin_principal sur un admin actif —
  le serveur NE reproduit PAS le repli « premier admin » de l'application ;
  App.jsx prévient l'intéressé si sa fiche n'a pas le drapeau, seul un SQL
  peut le poser), `boutique` et `pouvoirs_off` ; effet à la reconnexion ;
  (b) **le filet** : `lib/abandonLot.js` (pur) + `abandonnerGesteRefuse` dans
  sync.js + bouton « 🗑 Abandonner ce geste refusé » dans la bannière rouge
  (admin principal seul) — retire de la file le geste refusé ET ce qui
  attendait derrière sur les mêmes enregistrements, remet l'appareil à
  l'état d'avant (base / effacement des créations), redemande au serveur
  les lignes supprimées localement, journal au nom de l'admin. Aucun SQL
  pour cette étape ; drapeau vérifié par Timo (TIMO = true).
  **Étape 2 CONSTRUITE (2.101.52 application, 2.101.53 alignements) :**
  chaque geste d'argent revérifie son rôle DANS le geste
  (`refuserSaufAdmin` / `refuserSaufRoles` / `ROLES_STOCK` / `ROLES_CAISSE`
  / `ROLES_FOURNISSEURS` / `PLAFOND_REMISE_PCT` dans lib/calculs.js) ; la
  remise > 3 % est refusée aux non-admins sur devis, vente (sauf remise de
  la commande encaissée), proforma, commande ; l'entrée Excel ignore le
  prix d'achat pour les non-admins. **SQL serveur écrit et testé** :
  `supabase/securite-4-argent.sql` (11 déclencheurs + exception du pointage
  comptable sur `role_lecture_seule_maj` de depenses — le comptable était
  refusé côté serveur AVANT, trouvé par le banc), banc
  `npm run tester-argent` (57 contrôles). ⚠ Extension décidée par moi et
  signalée à Timo : le plafond de 3 % vaut aussi pour ventes / proformas /
  commandes (même argent). **COLLÉ par Timo le 04/09/2026** (capture :
  11 / true) — les verrous de l'argent sont EN PLACE sur la vraie base.
  **Étape 3 CONSTRUITE (2.101.54, 05/09/2026 — Timo : « Lance ») :** les
  gestes sur les comptes revérifient leur rôle dans le geste
  (`refuserSaufAdmin` ×19 dans Utilisateurs.jsx, `refuserSaufAdminPrincipal`
  pour mot de passe / bascule d'espace / transfert du rôle, `refuserSaufTaches`
  + `ROLES_TACHES` dans Mon équipe, virement de salaire dans calculs.js).
  **SQL serveur écrit et testé** : `supabase/securite-5-comptes.sql` —
  déclencheur `users_regles_comptes_trg` (supprimer / bloquer / champs de
  gestion d'un employé → admin ; mot de passe d'un autre, transfert du rôle
  principal, réel ↔ formation → admin principal ; tâches d'un autre →
  pouvoir « tâches » via l'étiquette `pouvoirs_off` ; fiches CLIENTS non
  touchées sauf mot de passe / blocage / suppression / chat libre).
  `est_admin_principal()` reconnaît le principal par l'étiquette OU le
  drapeau de sa fiche (un appareil à vieille étiquette n'est pas coincé) OU,
  le temps d'un transfert, la transaction en cours (`bmi.transfert_principal`).
  ⚠ Trouvé par le banc : `refuser_elevation_de_soi` refusait au principal
  de rendre SON drapeau — **le transfert du rôle principal était refusé par
  le serveur depuis le 29/08/2026**, sans que personne l'ait tenté ;
  securite-5 recrée la fonction avec cette seule exception.
  ⚠ `lib/fusion.js` : la fusion à l'envoi ne renvoie plus une vieille copie
  d'un champ qu'on n'a PAS touché (sinon assigner une tâche aurait « changé »
  le taux que l'admin venait de modifier → refus serveur). Banc
  `npm run tester-comptes` (54 contrôles, les deux ordres du transfert).
  **COLLÉ par Timo le 05/09/2026** (capture : 3 / true / true) — les verrous
  des comptes sont EN PLACE sur la vraie base.
  **Étape 4 CONSTRUITE (2.101.55, 05/09/2026 — Timo : « Lance ») :** devis,
  chantiers, prospects, boutiques, groupes. Application : `refuserSaufAdmin`
  ×14 dans ClientsInstalles (photo, cadeau, PV, réception forcée, avenant,
  frais, prime, compte lié, entretien, adresse / garantie / délai),
  `refuserSaufProprietaire` (admin ou son commercial : supprimer un chantier ;
  contacter / archiver / réactiver / relancer / convertir / supprimer un
  prospect), `refuserSaufRoles(ROLES_PROGRAMMATION)` (programmer = admin +
  resp. commercial), `peutTerminer` dans le geste (admin ou chef de CE
  chantier), `refuserSaufReaffectation` (admin / resp. com / chef d'équipe
  avec le pouvoir « Réaffecter »), Messagerie (groupes = admin), Paramètres
  (boutiques = admin ; accueil, cachet, suppression avec données =
  principal), Tous les devis (plan de règlement et signature en boutique via
  `refuserSaufAdminPrincipal`). **SQL serveur écrit et testé** :
  `supabase/securite-6-devis-chantiers.sql` — 6 déclencheurs :
  `users_regles_devis_trg` (« validé » posé par un employé et plan accepté /
  rejeté → principal ; le client sur SA fiche passe),
  `clients_installes_regles_roles_trg` (l'équipe est lue en trois :
  structure → admin + resp. com ; argent → admin via `equipe_argent_change`,
  membre par membre ; paiement → tout employé, le vendeur désigné paie),
  `prospects_regles_roles_trg` (propriétaire = `nom_jeton()`, réassigner =
  `est_chef_equipe()` + `a_pouvoir('act_reaffecter')`), catégories et
  groupes → admin, `boutiques_regles_roles_trg` (tout sauf `demandes` et
  `updated_at` → admin ; `accueil_*` / `cachet*` → principal ; la caisse
  TERRAIN se crée librement — un devis « pose seule » d'un client la crée).
  Les comptes CLIENTS ne sont pas concernés (leurs règles restent).
  Banc `npm run tester-devis-chantiers` (69 contrôles) ; tester-ecriture-sql
  et tester-espace-client chargent désormais securite-4/5/6 (les gestes
  complets de l'espace client passent les trois verrous).
  **COLLÉ par Timo le 05/09/2026** (capture : 6 / true) — **la vague 3 est
  TERMINÉE** : argent, comptes, devis / chantiers / prospects / boutiques /
  groupes sont verrouillés côté serveur, tous les ❓ de l'inventaire traités.
  Suite : les ❓ restants — tâches et photos sont faits ; cadeaux, date
  d'entretien, propriétaire aussi (étape 4). Il reste : cloisonnement par
  boutique (reporté), mode superviseur (en attente de Timo).
  Bancs à lancer désormais : les 6 + tester-faire-part + tester-argent +
  tester-comptes + tester-devis-chantiers.

- Cloisonnement **par boutique** (au-delà de l'espace) : reporté.

## Correctif du 08/09/2026 — securite-8 (l'upsert pris pour une création)

Capture Timo : « Demande de ravitaillement ne passe pas » — « Le serveur
REFUSE cet enregistrement (boutiques) — Créer une boutique : réservé à
l'administrateur (vous : vendeur) ». Même piège que roles-1b (18/08) :
l'application écrit par UPSERT et PostgreSQL déclenche AVANT INSERT même
quand la ligne existe. Quatre règles de la vague 3 le portaient encore :
boutiques (demande de ravitaillement), dépenses (pointage du comptable,
bloqué aussi par la politique RLS d'insertion), ventes et proformas (une
remise > 3 % accordée par l'admin refusait ensuite toute écriture d'un
vendeur sur la ligne). `supabase/securite-8-correctif-upsert.sql` relit la
ligne existante et applique les règles de mise à jour ; la politique
d'insertion des dépenses laisse passer le comptable sur une ligne existante
(`depense_existe`, security definer). Bancs : `UPS()` dans
tester-devis-chantiers (84) et tester-argent (66) — 4 cas tombent sans le
correctif, tous passent avec. **COLLÉ par Timo le 08/09/2026 à 21 h 41** (capture : `4 | true`) — les
opérations bloquées repartent seules dans la minute.

## Ajout du 09/09/2026 — securite-9 (changer le rôle d'un compte)

Demande Timo : « L'administrateur principal doit être capable de changer le
rôle d'un utilisateur sur la fiche utilisateur — d'un vendeur, transformer en
gérant ou autre. » Avant, le rôle se choisissait à la création et plus jamais
ensuite ; côté serveur, tout administrateur pouvait changer le rôle d'un
autre (roles-1 ne refusait que les non-admins).

- Écran : bouton **🎭 Rôle** dans 👥 Utilisateurs (`changerRole`), principal
  seul, hors clients et hors sa propre fiche ; la boutique suit le rôle ;
  trace `role_avant` / `role_change_le` ; effet à la prochaine connexion.
- Serveur : `supabase/securite-9-changer-role.sql` — déclencheur
  `users_regles_role_trg` (BEFORE UPDATE) : changer le rôle → principal
  seul ; client ↔ employé → toujours refusé ; la trace suit la même règle.
- Banc : `scripts/tester-comptes-sql.sh` (67, dont 13 nouveaux ; sans le
  script, 5 tombent).
- **État : collé par Timo le 09/09/2026** (les deux lignes de retrait n'ont pas été collées).

## Ajout du 09/09/2026 — securite-10 (le versement des fonds : validation du DG)

Demande Timo : « le versement des fonds par les vendeurs et gérants » —
destinations Chez le DG / BANQUE / Chez le comptable ; BANQUE avec banque et
bordereau ; « toujours à être validé par le DG », « DG, c'est l'admin
principal » ; Chez le comptable → le comptable valide (pointage Encaissé).

- Écran : 🔒 Caisse, bloc « 💸 Verser les fonds » (vendeur, gérant, admin),
  fonds à verser, historique ; bloc « Versements à valider par le DG » en
  haut pour l'administrateur principal. Règle pure `lib/versements.js`.
- Serveur : `supabase/securite-10-versements.sql` — `versement_valide_le` /
  `_par` sur `depenses` ne s'écrivent que par l'administrateur principal
  (upsert relu). Banc : `scripts/tester-argent-sql.sh` (75, dont 9 nouveaux ;
  sans le script, 4 tombent).
- **État : collé par Timo le 09/09/2026** (capture : true | true).

## Ajout du 09/09/2026 — securite-11 (versement = gérant ; clôture = vendeur aussi)

Timo : « on va restreindre le versement au vendeur pour le moment… c'est au
gérant de faire le versement », puis « comment la clôture de la caisse peut
être impossible à un vendeur ? ». `supabase/securite-11-versement-gerant.sql`
remplace deux fonctions : créer un « Versement de fonds » → gérant / admin ;
clôturer la caisse → vendeur / gérant / admin. Banc : tester-argent (79).
- **État : collé par Timo le 10/09/2026** — vérification true | true | true (capture).

## Ajout du 10/09/2026 — securite-12 (le rejet d'un versement de fonds)

Timo : « l'admin ou le comptable doit avoir la possibilité de rejeter une
demande de versement », puis « je valide, l'argent doit retourner comme
jamais versé ». `supabase/securite-12-rejet-versement.sql` remplace
`depenses_regles_roles` (securite-8 : le comptable peut écrire les champs du
rejet + montant + description quand la ligne devient rejetée) et
`depenses_regles_versement` (securite-11 : qui valide rejette, en attente
seulement, motif obligatoire, rejet inaltérable, montant forcé à 0, rejeté
jamais validé ni encaissé, jamais créé rejeté). Banc : tester-argent (102 ;
sans le script, 16 contrôles tombent — mesuré).
- **État : collé par Timo le 10/09/2026** — vérification true | true | true (capture).
