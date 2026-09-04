# Inventaire des gestes réservés à un rôle — et ce que le serveur en sait

Relevé du 04/09/2026, à la demande de Timo (« tout devrait normalement être
verrouillé »). Quatre relevés indépendants ont été consolidés ici : les
écrans d'argent, les écrans clients/devis, les écrans d'administration et de
stock, et les règles déjà posées sur le serveur (40 fichiers SQL).

Ce document ne change rien. Il sert à **cocher** ce qui doit devenir un
verrou serveur, ligne par ligne.

---

## 0. URGENT — un trou qui ne concerne pas les rôles : les faire-part de suppression

La table `tombstones` (les « faire-part » qui disent à tous les appareils
« cette ligne a été effacée ») est ouverte en écriture à **tout compte
connecté, clients compris** (`tombstones_connectes` : `using(true) with
check(true)`, fichier `securite-1-audits-et-tombstones.sql`).

Ce que ça permet, mesuré dans le code de synchronisation (`src/sync.js`) :

| Faire-part déposé | Effet sur TOUS les appareils |
|---|---|
| `{ table_name: "ventes", record_id: <id> }` | la vente disparaît de la copie locale de chaque appareil (la ligne serveur reste, mais n'est plus visible tant qu'un retéléchargement complet n'a pas lieu) |
| `{ table_name: "produits", record_id: "__TRUNCATE__" }` | chaque appareil vide **toute** sa table produits locale |
| `{ id: "*", table_name: "*" }` (le marqueur de réinitialisation) | chaque appareil **vide sa base locale ET sa file d'attente** — les ventes faites hors ligne et pas encore envoyées sont **perdues** |

Un compte client (ou un employé, ou une session volée) peut déposer ces
lignes avec la clé publique de l'application et son jeton de connexion.
Aucune règle ne l'en empêche.

**Correctif proposé (SQL à coller, étape 0 de la vague 3) :**
1. règle restrictive : un compte `client` ne peut ni créer, ni modifier, ni
   supprimer un faire-part (il n'a aucun droit de suppression, donc aucun
   faire-part légitime à produire) ;
2. déclencheur : un faire-part sur une ligne **qui existe encore** est
   refusé (un faire-part ne peut annoncer qu'une suppression réelle) — le
   chemin normal de l'application supprime la ligne puis dépose le
   faire-part, il continue de passer ;
3. les faire-part globaux (`*`, `__TRUNCATE__`) réservés au rôle `admin`
   (et, quand l'étiquette existera, à l'administrateur principal).
4. Banc : trois cas REFUSÉ (client, ligne vivante, marqueur global par un
   vendeur) + deux cas ACCEPTÉ (suppression normale par un employé, marqueur
   par l'admin).

---

## 1. Ce que le serveur impose déjà

L'étiquette posée à la connexion (`api/sync-auth.js`) porte trois choses :
`espace` (tous / réel / formation), `role` (tel quel), `ecriture` (oui/non).
**« Administrateur principal » n'y est pas.** Le serveur ne sait donc pas
distinguer l'admin principal d'un autre admin — sauf indirectement par
`espace = tous`, que lui seul reçoit.

| Verrouillé côté serveur | Par quoi |
|---|---|
| Un client ne lit que ses lignes (dettes, ventes, chantiers, messages, prospects, journal, annuaire) | vague 2 (client-1 à client-4) |
| Un client n'écrit pas dans produits, ne modifie pas une dette, ne crée pas de vente, ne supprime rien | client-2, roles-2 |
| Un client ne touche que 3 champs d'une vente (réception) | déclencheur `client_ventes_reception_seule_trg` |
| Le mur réel / formation (14 tables), dérogation « tous » pour l'admin principal | `espace_cloisonnement` |
| Compte en lecture seule (comptable, pouvoir écriture retiré) : rien n'écrit sur 15 tables | `role_lecture_seule*` |
| Personne ne s'attribue un rôle, le drapeau principal, des pouvoirs, un espace ; seul un admin crée un compte non-client | `interdire_escalade` |
| Personne — admin compris — ne modifie sa propre fiche sur rôle / principal / pouvoirs / espace / actif | `refuser_elevation_de_soi_trg` |
| Paie : seul un admin crée une fiche ; personne ne s'augmente ni ne s'approuve un crédit | `interdire_escalade_paie_trg`, politiques `paie_*` |
| `anon` (non connecté) : rien sur users, paie, tombstones, appliquer_lot | révocations |

**Ce que le serveur ne distingue pas :** vendeur, gérant, magasinier,
commercial, technicien sont **identiques** pour lui ; admin secondaire =
admin principal (sauf le mur) ; aucune notion de **boutique** (un vendeur
d'APESSITO peut écrire dans les données de DEMAKPOE). Toute la liste du § 2
est donc, aujourd'hui, une règle d'application seulement.

---

## 2. Les gestes réservés à un rôle — à cocher

Légende de la colonne « Verrou app » : **A** = le bouton est caché mais le
geste lui-même ne revérifie pas le rôle (une application modifiée passe) ;
**A+H** = le bouton est caché **et** le geste revérifie ; **H** = seul le
geste vérifie.

Colonne « Serveur ? » : ma proposition — ✅ à verrouiller, ➖ inutile
(écriture sur sa propre fiche, ou déjà couvert), ❓ à décider par Timo.

### 2.1 L'argent

| Geste | Qui aujourd'hui | Écrit | Verrou app | Serveur ? |
|---|---|---|---|---|
| Supprimer une vente | admin | ventes (suppr.), dettes | A | ✅ admin seul |
| Retour / échange sous garantie | admin | ajustements (2), dettes | A | ✅ admin seul (ajustements de type `echange_garantie` / `retour_defectueux`) |
| Statuer sur un défectueux (fournisseur / rebut) | admin | ajustements | A | ✅ admin seul |
| Supprimer une dette | admin | dettes (suppr.) | A | ✅ admin seul |
| Supprimer une dépense | admin | depenses (suppr.) + liens | A | ✅ admin seul |
| Annuler un pointage comptable | admin | depenses | A | ✅ admin seul |
| Pointer un décaissement « remis » | comptable | depenses | A+H | ➖ (déjà la seule écriture permise au comptable — mais côté serveur le comptable n'écrit RIEN : ce pointage est-il refusé par `role_lecture_seule` ? **À vérifier au banc**) |
| Annuler un règlement de commission | admin | ventes, depenses (suppr.) | A+H | ✅ admin seul |
| Payer une commission (individuelle, équipe, apporteur) | pouvoir `act_commission` | ventes, depenses, messages | A | ❓ (pouvoir individuel, pas un rôle — verrouillable si les pouvoirs entrent dans l'étiquette) |
| Payer une prime d'installation | admin ou vendeur de la boutique | clients_installes, depenses | A+H | ❓ (règle de boutique — pas de boutique dans l'étiquette aujourd'hui) |
| Clôturer la caisse | tout rôle ayant l'onglet | clotures | aucun | ❓ |
| Créer une dette client à la main | tout employé | dettes | aucun | ➖ |
| Corriger le prix d'achat / de vente / la quantité initiale d'un article | admin | produits (3 champs) | A+H | ✅ admin seul (déclencheur sur ces 3 champs) |
| Supprimer un article | admin | produits (suppr.) | A+H | ✅ admin seul |
| Créer un article avec prix libres | tout employé de Stocks | produits | aucun | ➖ (création, pas correction) |
| Entrée / ajustement / transfert de stock | tout employé de Stocks | produits, ajustements | aucun (sauf `save`) | ❓ (magasinier + gérant + admin ?) |
| Régler un fournisseur, dette fournisseur, supprimer un fournisseur | admin, gérant | fournisseurs, depenses | aucun (écran) | ✅ admin + gérant |
| Créer / modifier / supprimer un agent commercial (taux !) | admin | commerciaux | aucun (écran) | ✅ admin seul |

### 2.2 Les salaires et les comptes

| Geste | Qui aujourd'hui | Écrit | Verrou app | Serveur ? |
|---|---|---|---|---|
| Virement de salaire, prime, avance, crédit (approuver / refuser / rembourser) | admin | users, paie, depenses | écran | ➖ déjà verrouillé (paie) — **sauf** la partie encore dans `users.data` (`salaire_base`, échec connu du banc) → ✅ à fermer |
| Changer le mot de passe d'un compte | admin principal | users | A+H | ✅ **admin principal** (exige l'étiquette) |
| Voir un mot de passe | admin principal | — | A+H | ➖ (l'écran ne montre que ce que le serveur laisse lire ; les mots de passe sont hachés) |
| Transférer le rôle d'admin principal | admin principal | users (tous) | A+H | ✅ admin principal |
| Basculer un compte réel ↔ formation (un ou tous) | admin principal | users | A+H | ✅ déjà (interdire_escalade : admin) → resserrer à **admin principal** |
| Bloquer / réactiver un compte | admin | users.actif | H | ✅ admin seul (aujourd'hui **tout employé** peut désactiver un collègue côté serveur) |
| Créer un employé | admin | users, commerciaux | écran | ➖ déjà (interdire_escalade) |
| Supprimer un compte | admin | users (suppr.) | H | ✅ admin seul |
| Retirer / rétablir un pouvoir | admin | users.droits_off | H | ➖ déjà |
| Chef d'équipe, chat libre, parrain, taux de commission, boutique de rattachement, identité, anniversaire | admin | users (champs) | A ou écran | ✅ admin seul, en un bloc « champs de gestion d'une fiche » (aujourd'hui tout employé peut modifier le nom, le téléphone, la boutique, la signature d'un collègue) |
| Restaurer une sauvegarde / réinitialiser | admin principal | tout | A+H (6 barrières) | ✅ le marqueur global (voir § 0) réservé à l'admin principal |

### 2.3 Les clients, devis, chantiers

| Geste | Qui aujourd'hui | Écrit | Verrou app | Serveur ? |
|---|---|---|---|---|
| Accepter / rejeter un plan de règlement | admin principal | users.devis.plan_reglement | A+H | ✅ admin principal |
| Faire signer un contrat en boutique / signé sur papier / imprimer pour signature | admin principal | users.devis (statut valide, contrat), commandes, dettes, clients_installes, prospects | A+H | ✅ admin principal — **le morceau délicat** : lire dans la fiche client quel devis a changé de statut. Note : le client, lui, valide SON devis ; la règle est « un employé qui pose `statut: valide` sur un devis doit être admin principal ». À ouvrir plus tard aux vendeurs par le mode superviseur. |
| Choisir le commercial rattaché d'un chantier | admin | clients_installes.commercial | A+H | ✅ admin seul |
| Supprimer une fiche chantier | admin ou son commercial | clients_installes (suppr.) | A+H | ❓ (règle « ou son commercial » = notion de propriétaire, faisable via `commercial = nom du jeton`) |
| Programmer l'installation (date, équipe) | admin, resp. commercial | clients_installes | A+H | ✅ |
| Marquer les travaux terminés | admin ou chef du chantier | clients_installes | A | ❓ |
| Envoyer / renvoyer le lien PV, forcer la réception sans signature, avenant | admin | clients_installes, ventes | A+H | ✅ admin seul (forcer la réception débloque des commissions) |
| Répartir les frais d'installation, demander une prime | admin | clients_installes | H / A+H | ✅ admin seul |
| Offrir / retirer un cadeau | admin | clients_installes | A+H | ❓ |
| Supprimer une photo, corriger adresse / garantie / délai, date d'entretien | admin (ou personne) | clients_installes | A / aucun | ❓ |
| Réassigner un prospect | admin, resp. com, chef (+ pouvoir) | prospects.commercial | A | ❓ |
| Contacter / archiver / réactiver / supprimer un prospect | admin ou son commercial | prospects | A | ❓ (propriétaire) |
| Catégories de prospects | admin | categories_prospects | A | ✅ admin seul |
| Promouvoir un apporteur en commercial | admin | users (nouveau compte commercial) | A | ➖ déjà (interdire_escalade : seul un admin crée un non-client) |
| Assigner / valider / rouvrir une tâche | pouvoir / admin ou auteur | users.taches (fiche d'autrui) | A / aucun | ❓ |
| Envoyer un devis, convertir en vente, remises et frais libres | tout employé | users.devis, users (compte client), messages, prospects | aucun | ➖ (c'est le métier de tous) — ❓ plafonner la remise ? |
| Créer une boutique, la supprimer (avec ou sans données), paramètres, logos, cachet, accueil, domaines | admin (écran) ; cachet/accueil/transfert principal : admin principal | boutiques (+ suppression en masse) | écran / A+H | ✅ boutiques : admin seul ; suppression en masse : admin principal |
| Groupes de discussion : créer, supprimer (avec messages), membres | admin | groupes, messages (suppr.) | A | ✅ admin seul |
| Servir / refuser une demande de ravitaillement ou de transfert | tout employé rattaché | boutiques.demandes, produits, ajustements | H (écriture) | ❓ (magasinier / gérant) |

### 2.4 Trous d'application relevés au passage (à corriger côté app, indépendamment du serveur)

- Gestes dont le bouton est caché mais le geste ne revérifie pas le rôle :
  supprimer vente / dette / dépense, retour garantie, panneau SAV, groupes de
  discussion, photos et champs admin des chantiers, colonne d'actions des
  prospects, chef d'équipe / chat libre, virement (Utilisateurs). Règle à
  poser : **tout geste réservé à un rôle le revérifie dans le geste**, pas
  seulement à l'affichage (comme le fait déjà la signature en boutique).
- Gestes sans `bloquerSiLecture` : créer une dette, refuser une commande,
  proforma, entrée / ajustement / transfert de stock, code-barres. Le
  verrou terminal de `save()` les arrête, mais après la saisie.
- `save()` sans libellé (donc sans ligne de journal) : fournisseurs
  (création, dette, suppression), groupes (membres), messages, logos,
  changement de boutique d'un compte.
- Le bouton « 🔧 Frais » est visible de tous mais refuse à tous sauf admin.

---

## 3. Préalable technique : l'étiquette « administrateur principal »

Sans elle, aucune règle « admin principal seul » n'est possible côté
serveur. À ajouter dans `api/sync-auth.js` (`app_metadata.principal =
true/false`), en couple avec `estAdminPrincipal()` de `lib/calculs.js`, et
un contrôle du banc qui vérifie leur accord (comme pour `espace`). Effet à
la prochaine reconnexion de chacun.

Question ouverte : faut-il aussi mettre les **pouvoirs individuels**
(`droits_off`) et la **boutique de rattachement** dans l'étiquette ? Sans
eux, les règles « pouvoir act_commission » et « vendeur de la boutique X »
resteront côté application.

---

## 4. Ordre proposé (vague 3)

| Étape | Contenu | Risque de blocage |
|---|---|---|
| 0 | Fermer les faire-part de suppression (§ 0) | quasi nul — un seul chemin légitime, rejoué au banc |
| 1 | Étiquette « admin principal » + filet : retirer d'un lot le geste refusé pour laisser passer le reste | nul (rien ne se ferme) |
| 2 | L'argent : suppression vente / dette / dépense, prix et quantité initiale d'un article, suppression d'article, retours garantie, commerciaux, fournisseurs (§ 2.1 ✅) | faible : gestes rares, admin |
| 3 | Les comptes : bloquer / supprimer un collègue, champs de gestion d'une fiche, mot de passe, transfert du principal, bascule d'espace (§ 2.2 ✅) | faible |
| 4 | Les devis et chantiers : validation d'un devis par un employé, plan de règlement, chantiers (§ 2.3 ✅) | **moyen** : lecture dans la fiche client — banc obligatoire avec les gestes complets (ESSO) |
| 5 | Les ❓ tranchés par Timo | selon |

Chaque étape : application d'abord (les gestes revérifient le rôle), tous
les appareils à jour, puis SQL à coller avec état des lieux avant/après, et
une ligne de désactivation par verrou.
